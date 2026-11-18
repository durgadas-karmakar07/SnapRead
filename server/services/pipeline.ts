import { config } from "../config.js";
import { EXTRACTIVE_MODEL_LABEL, summarizeWithExtractiveNlp } from "./extractive.js";
import { FetchPageError, fetchPublicPage } from "./fetcher.js";
import { GeminiServiceError, summarizePageContent } from "./gemini.js";
import { createRateLimiter, rateLimitedBody, type RateLimiter } from "./rateLimit.js";
export { getHealthStatus } from "./health.js";
import type {
  ApiErrorResponse,
  PageContent,
  SummarizeSuccessResponse,
  SummaryProvider,
  SummaryResult,
} from "../types/summary.js";

/** Shared limiter for this server instance (per client IP, one-minute window). */
export const defaultRateLimiter = createRateLimiter({
  limit: config.rateLimitPerMinute,
  windowMs: 60_000,
});

function fallbackNotice(reason: "no-key" | unknown): string {
  if (reason === "no-key") {
    return "No Gemini API key is configured, so this brief was produced by SnapRead's offline extractive summariser.";
  }
  if (reason instanceof GeminiServiceError && reason.code === "INVALID_API_KEY") {
    return "Gemini rejected the API key, so this brief was produced by SnapRead's offline extractive summariser.";
  }
  if (reason instanceof GeminiServiceError && reason.code === "RATE_LIMITED") {
    return "Gemini's free-tier limit was reached, so this brief was produced by SnapRead's offline extractive summariser.";
  }
  return "Gemini was unavailable for this request, so this brief was produced by SnapRead's offline extractive summariser.";
}

export interface SummarizePipelineDeps {
  fetchPage?: (url: string, signal?: AbortSignal) => Promise<PageContent>;
  summarize?: (
    page: PageContent,
    apiKey: string,
    model: string,
    signal?: AbortSignal
  ) => Promise<SummaryResult>;
  getConfig?: () => { geminiApiKey: string; geminiModel: string };
  rateLimiter?: RateLimiter;
}

export interface PipelineHttpResult {
  status: number;
  body: SummarizeSuccessResponse | ApiErrorResponse;
  headers?: Record<string, string>;
}

export async function executeSummarizePipeline(params: {
  rawUrl: string;
  headerKey?: string;
  /** Client identifier for rate limiting (usually the IP address). */
  clientId?: string;
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

  const limiter = deps.rateLimiter ?? defaultRateLimiter;
  const limit = limiter.check(params.clientId ?? "unknown");
  if (!limit.allowed) {
    return {
      status: 429,
      body: rateLimitedBody(limit.retryAfterSeconds),
      headers: { "Retry-After": String(limit.retryAfterSeconds) },
    };
  }

  const { geminiApiKey, geminiModel } = getConfig();
  const apiKey = (params.headerKey ?? "").trim() || geminiApiKey;

  try {
    const page = await fetchPage(rawUrl, params.signal);

    let summary: SummaryResult;
    let activeModel = geminiModel;
    let provider: SummaryProvider = "gemini";
    let notice: string | undefined;

    if (!apiKey) {
      summary = summarizeWithExtractiveNlp(page);
      activeModel = EXTRACTIVE_MODEL_LABEL;
      provider = "extractive";
      notice = fallbackNotice("no-key");
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
        // Zero-cost fallback when the key is revoked or the free-tier quota is used up.
        // The UI shows `notice` so the user knows this brief did not come from Gemini.
        summary = summarizeWithExtractiveNlp(page);
        activeModel = EXTRACTIVE_MODEL_LABEL;
        provider = "extractive";
        notice = fallbackNotice(aiError);
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
          provider,
          durationMs: Date.now() - startedAt,
          ...(notice ? { notice } : {}),
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
