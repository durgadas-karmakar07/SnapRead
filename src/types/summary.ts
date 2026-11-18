export interface SummaryResult {
  headline: string;
  summary: string;
  keyPoints: string[];
  topics: string[];
  readingTimeMinutes: number;
}

export interface SummarizeResponse {
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
    provider: "gemini" | "extractive";
    durationMs: number;
    /** Present when the brief came from the offline fallback instead of Gemini. */
    notice?: string;
  };
}

export interface HealthResponse {
  ok: boolean;
  aiConfigured: boolean;
  model: string;
}

export interface ApiErrorPayload {
  error?: {
    code?: string;
    message?: string;
  };
}
