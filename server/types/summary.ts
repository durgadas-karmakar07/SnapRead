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
    durationMs: number;
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
