/**
 * E2E server: the real Express app, routes, pipeline, security headers and
 * offline summariser, with only the two network calls replaced:
 *   - fetchPage  -> returns a fixture article (no live website needed)
 *   - summarize  -> returns a fixed "Gemini" response (no API key or quota needed)
 *
 * Special words in the URL trigger edge cases:
 *   "slow"      -> 2.5 s delay (loading indicator and cancel)
 *   "upstream"  -> the target site answers with an error
 *   "fallback"  -> Gemini rejects the key, so the offline summariser answers
 *   "xss"       -> the AI returns HTML/script that must be shown as plain text
 */
import { createApp } from "../../server/index.js";
import { FetchPageError } from "../../server/services/fetcher.js";
import { GeminiServiceError } from "../../server/services/gemini.js";
import { createRateLimiter } from "../../server/services/rateLimit.js";
import type { SummaryResult } from "../../server/types/summary.js";
import { MOCK_AI_SUMMARY, XSS_PAYLOAD, articlePage } from "./fixtures.js";

const port = Number(process.env.E2E_PORT ?? 4173);

function wait(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener("abort", () => {
      clearTimeout(timer);
      reject(new FetchPageError("REQUEST_ABORTED", "Request was cancelled.", 499));
    });
  });
}

const app = createApp({
  getConfig: () => ({ geminiApiKey: "e2e-mock-key", geminiModel: "gemini-3.5-flash-lite" }),
  rateLimiter: createRateLimiter({ limit: 1_000, windowMs: 60_000 }),
  fetchPage: async (url, signal) => {
    if (url.includes("slow")) await wait(2_500, signal);
    if (url.includes("upstream")) {
      throw new FetchPageError(
        "UPSTREAM_HTTP_ERROR",
        "This site blocked automated access or requires authentication.",
        502
      );
    }
    return articlePage(url);
  },
  summarize: async (page): Promise<SummaryResult> => {
    if (page.finalUrl.includes("fallback")) {
      throw new GeminiServiceError("INVALID_API_KEY", "Gemini rejected the API key.", 401);
    }
    if (page.finalUrl.includes("xss")) {
      return {
        ...MOCK_AI_SUMMARY,
        headline: `Injected ${XSS_PAYLOAD}`,
        keyPoints: [`Takeaway ${XSS_PAYLOAD}`],
      };
    }
    return MOCK_AI_SUMMARY;
  },
});

app.listen(port, "127.0.0.1", () => {
  console.log(`SnapRead E2E server on http://127.0.0.1:${port}`);
});
