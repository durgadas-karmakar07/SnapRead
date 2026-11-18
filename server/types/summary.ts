export interface PageContent {
  url: string;
  finalUrl: string;
  title: string;
  description: string;
  siteName: string;
  visibleText: string;
  wordCount: number;
  truncated: boolean;
}

export interface SummaryResult {
  headline: string;
  summary: string;
  keyPoints: string[];
  topics: string[];
  readingTimeMinutes: number;
}

export type SummaryProvider = "gemini" | "extractive";

export interface SummarizeSuccessResponse {
  page: {
    url: string;
    title: string;
    siteName: string;
    wordCount: number;
    truncated: boolean;
    excerpt: string;
  };
  summary: SummaryResult;
  meta: {
    model: string;
    provider: SummaryProvider;
    durationMs: number;
    /** Set when the brief came from the offline fallback instead of Gemini. */
    notice?: string;
  };
}

export interface ApiErrorResponse {
  error: {
    code: string;
    message: string;
  };
}

export interface HealthResponse {
  ok: boolean;
  aiConfigured: boolean;
  model: string;
}
