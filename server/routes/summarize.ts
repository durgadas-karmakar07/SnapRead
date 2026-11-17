import { Router } from "express";
import { config } from "../config.js";
import { FetchPageError, fetchPublicPage } from "../services/fetcher.js";
import { GeminiServiceError, summarizePageContent } from "../services/gemini.js";
import type {
  ApiErrorResponse,
  HealthResponse,
  PageContent,
  SummarizeSuccessResponse,
  SummaryResult,
} from "../types/summary.js";

export interface SummarizeRouterDeps {
  fetchPage?: (url: string, signal?: AbortSignal) => Promise<PageContent>;
  summarize?: (
    page: PageContent,
    apiKey: string,
    model: string,
    signal?: AbortSignal
  ) => Promise<SummaryResult>;
  getConfig?: () => { geminiApiKey: string; geminiModel: string };
}

export function createSummarizeRouter(deps: SummarizeRouterDeps = {}) {
  const router = Router();
  const fetchPage = deps.fetchPage ?? fetchPublicPage;
  const summarize = deps.summarize ?? summarizePageContent;
  const getConfig =
    deps.getConfig ??
    (() => ({
      geminiApiKey: config.geminiApiKey,
      geminiModel: config.geminiModel,
    }));

  router.get("/health", (_req, res) => {
    const { geminiApiKey, geminiModel } = getConfig();
    const payload: HealthResponse = {
      ok: true,
      aiConfigured: Boolean(geminiApiKey),
      model: geminiModel,
    };
    res.json(payload);
  });

  router.post("/summarize", async (req, res) => {
    const startedAt = Date.now();
    const rawUrl = typeof req.body?.url === "string" ? req.body.url : "";

    if (!rawUrl.trim()) {
      const errorPayload: ApiErrorResponse = {
        error: {
          code: "INVALID_URL",
          message: "Please enter a website URL to summarize.",
        },
      };
      res.status(400).json(errorPayload);
      return;
    }

    const { geminiApiKey, geminiModel } = getConfig();
    const headerKey =
      typeof req.headers["x-gemini-api-key"] === "string"
        ? req.headers["x-gemini-api-key"].trim()
        : "";
    const apiKey = geminiApiKey || headerKey;

    if (!apiKey) {
      const errorPayload: ApiErrorResponse = {
        error: {
          code: "MISSING_API_KEY",
          message:
            "Gemini API key is not configured. Add GEMINI_API_KEY to your .env file or provide a temporary session key below.",
        },
      };
      res.status(400).json(errorPayload);
      return;
    }

    const abortController = new AbortController();
    res.on("close", () => {
      if (!res.writableEnded) {
        abortController.abort();
      }
    });

    try {
      const page = await fetchPage(rawUrl, abortController.signal);
      const summary = await summarize(page, apiKey, geminiModel, abortController.signal);

      const excerpt =
        page.visibleText.length > 1800
          ? `${page.visibleText.slice(0, 1800).trim()}…`
          : page.visibleText;

      const responsePayload: SummarizeSuccessResponse = {
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
      };

      res.json(responsePayload);
    } catch (error) {
      if (error instanceof FetchPageError || error instanceof GeminiServiceError) {
        const errorPayload: ApiErrorResponse = {
          error: {
            code: error.code,
            message: error.message,
          },
        };
        res.status(error.statusCode).json(errorPayload);
        return;
      }

      const errorPayload: ApiErrorResponse = {
        error: {
          code: "INTERNAL_ERROR",
          message: "An unexpected error occurred while summarizing that page.",
        },
      };
      res.status(500).json(errorPayload);
    }
  });

  return router;
}

export const summarizeRouter = createSummarizeRouter();
