import { config } from "../config.js";
import { summarizeWithExtractiveNlp } from "./extractive.js";
import { FetchPageError, fetchPublicPage } from "./fetcher.js";
import { GeminiServiceError, summarizePageContent } from "./gemini.js";
export { getHealthStatus } from "./health.js";
import type {
  ApiErrorResponse,
  PageContent,
  SummarizeSuccessResponse,
  SummaryResult,
} from "../types/summary.js";

export interface SummarizePipelineDeps {
  fetchPage?: (url: string, signal?: AbortSignal) => Promise<PageContent>;
  summarize?: (
    page: PageContent,
    apiKey: string,
    model: string,
    signal?: AbortSignal
  ) => Promise<SummaryResult>;
  getConfig?: () => { geminiApiKey: string; geminiModel: string };
}

export interface PipelineHttpResult {
  status: number;
  body: SummarizeSuccessResponse | ApiErrorResponse;
}

export async function executeSummarizePipeline(params: {
  rawUrl: string;
  headerKey?: string;
  signal?: AbortSignal;
  deps?: SummarizePipelineDeps;
}): Promise<PipelineHttpResult> {
  const startedAt = Date.now();
  const rawUrl = params.rawUrl;
  const deps = params.deps ?? {};
  const fetchPage = deps.fetchPage ?? fetchPublicPage;
  const summarize = deps.summarize ?? summarizePageContent;
  const getConfig =
    deps.getConfig ??
    (() => ({
      geminiApiKey: config.geminiApiKey,
      geminiModel: config.geminiModel,
    }));

  if (!rawUrl.trim()) {
    return {
      status: 400,
      body: {
        error: {
          code: "INVALID_URL",
          message: "Please enter a website URL to summarize.",
        },
      },
    };
  }

  const { geminiApiKey, geminiModel } = getConfig();
  const apiKey = (params.headerKey ?? "").trim() || geminiApiKey;

  try {
    const page = await fetchPage(rawUrl, params.signal);

    let summary: SummaryResult;
    let activeModel = geminiModel;

    if (!apiKey) {
      summary = summarizeWithExtractiveNlp(page);
      activeModel = "extractive-nlp (free)";
    } else {
      try {
        summary = await summarize(page, apiKey, geminiModel, params.signal);
      } catch (aiError) {
        if (
          aiError instanceof GeminiServiceError &&
          aiError.code === "REQUEST_ABORTED"
        ) {
          throw aiError;
        }
        // Seamless zero-cost fallback when API key is expired/revoked or free-tier quota is exhausted
        summary = summarizeWithExtractiveNlp(page);
        activeModel = "extractive-nlp (free)";
      }
    }

    const excerpt =
      page.visibleText.length > 1800
        ? `${page.visibleText.slice(0, 1800).trim()}…`
        : page.visibleText;

    return {
      status: 200,
      body: {
        page: {
          url: page.finalUrl,
          title: page.title,
          siteName: page.siteName,
          wordCount: page.wordCount,
          truncated: page.truncated,
          excerpt,
        },
        summary,
        meta: {
          model: activeModel,
          durationMs: Date.now() - startedAt,
        },
      },
    };
  } catch (error) {
    if (error instanceof FetchPageError || error instanceof GeminiServiceError) {
      return {
        status: error.statusCode,
        body: {
          error: {
            code: error.code,
            message: error.message,
          },
        },
      };
    }

    return {
      status: 500,
      body: {
        error: {
          code: "INTERNAL_ERROR",
          message: "An unexpected error occurred while summarizing that page.",
        },
      },
    };
  }
}
