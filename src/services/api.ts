import type {
  ApiErrorPayload,
  HealthResponse,
  SummarizeResponse,
} from "../types/summary";

export class ApiClientError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(code: string, message: string, status: number) {
    super(message);
    this.name = "ApiClientError";
    this.code = code;
    this.status = status;
  }
}

export async function fetchHealth(signal?: AbortSignal): Promise<HealthResponse> {
  const response = await fetch("/api/health", { signal });
  if (!response.ok) {
    throw new ApiClientError("HEALTH_ERROR", "Unable to reach SnapRead backend.", response.status);
  }
  return (await response.json()) as HealthResponse;
}

export async function summarizeUrl(
  url: string,
  options?: { signal?: AbortSignal; sessionApiKey?: string }
): Promise<SummarizeResponse> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (options?.sessionApiKey?.trim()) {
    headers["X-Gemini-Api-Key"] = options.sessionApiKey.trim();
  }

  let response: Response;
  try {
    response = await fetch("/api/summarize", {
      method: "POST",
      headers,
      body: JSON.stringify({ url }),
      signal: options?.signal,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw error;
    }
    throw new ApiClientError(
      "NETWORK_ERROR",
      "Could not reach the SnapRead API server. Make sure the backend is running.",
      0
    );
  }

  if (!response.ok) {
    let payload: ApiErrorPayload | null = null;
    try {
      payload = (await response.json()) as ApiErrorPayload;
    } catch {
      payload = null;
    }

    const code = payload?.error?.code || "REQUEST_FAILED";
    const message =
      payload?.error?.message || `Request failed with status ${response.status}.`;
    throw new ApiClientError(code, message, response.status);
  }

  return (await response.json()) as SummarizeResponse;
}
