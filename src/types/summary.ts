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
    durationMs: number;
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
