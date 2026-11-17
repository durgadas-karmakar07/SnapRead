import { config } from "../config.js";
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

  if (!apiKey) {
    return {
      status: 400,
      body: {
        error: {
          code: "MISSING_API_KEY",
          message:
            "Gemini API key is not configured. Add GEMINI_API_KEY to your environment variables or provide a temporary session key below.",
        },
      },
    };
  }

  try {
    const page = await fetchPage(rawUrl, params.signal);
    const summary = await summarize(page, apiKey, geminiModel, params.signal);

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
          model: geminiModel,
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
