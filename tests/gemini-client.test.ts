import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  FREE_TIER_MODELS,
  GeminiServiceError,
  SYSTEM_INSTRUCTION,
  summarizePageContent,
  type GeminiClient,
} from "../server/services/gemini.js";
import type { PageContent } from "../server/types/summary.js";

const page: PageContent = {
  url: "https://example.com/a",
  finalUrl: "https://example.com/a",
  title: "Example",
  description: "Example description",
  siteName: "example.com",
  visibleText: "Example page text about clean architecture and testing.",
  wordCount: 440,
  truncated: false,
};

const validJson = JSON.stringify({
  headline: "Clean architecture",
  summary: "Layers stay separate so they can be tested.",
  keyPoints: ["Separate layers", "Test each layer"],
  topics: ["Architecture"],
  readingTimeMinutes: 2,
});

type Call = { model: string; contents: unknown; config: Record<string, unknown> };

/** Fake Gemini client: each entry answers one call (string = response text, Error = thrown). */
function fakeClient(answers: Array<string | Error>, calls: Call[]): () => GeminiClient {
  return () =>
    ({
      models: {
        generateContent: async (request: Call) => {
          calls.push(request);
          const next = answers.shift();
          if (next instanceof Error) throw next;
          return { text: next ?? "" };
        },
      },
    }) as unknown as GeminiClient;
}

function httpError(status: number, message: string): Error {
  return Object.assign(new Error(JSON.stringify({ error: { message } })), { status });
}

describe("summarizePageContent with a Gemini client", () => {
  it("sends the system instruction, JSON schema and wrapped page text", async () => {
    const calls: Call[] = [];
    const result = await summarizePageContent(page, "key", "gemini-3.5-flash-lite", undefined, fakeClient([validJson], calls));

    assert.equal(result.headline, "Clean architecture");
    assert.equal(calls.length, 1);
    assert.equal(calls[0]?.model, "gemini-3.5-flash-lite");
    assert.equal(calls[0]?.config.systemInstruction, SYSTEM_INSTRUCTION);
    assert.equal(calls[0]?.config.responseMimeType, "application/json");
    assert.ok(calls[0]?.config.responseSchema, "structured output schema is sent");
    assert.match(String(calls[0]?.contents), /<webpage_content>[\s\S]*clean architecture[\s\S]*<\/webpage_content>/);
  });

  it("falls through the free-tier model list when a model fails", async () => {
    const calls: Call[] = [];
    const result = await summarizePageContent(
      page,
      "key",
      "gemini-3.5-flash-lite",
      undefined,
      fakeClient([httpError(404, "model not found"), "", validJson], calls)
    );

    assert.equal(result.summary, "Layers stay separate so they can be tested.");
    assert.deepEqual(
      calls.map((c) => c.model),
      [...FREE_TIER_MODELS]
    );
  });

  it("stops immediately with INVALID_API_KEY when Gemini rejects the key", async () => {
    const calls: Call[] = [];
    await assert.rejects(
      () => summarizePageContent(page, "bad", "gemini-3.5-flash-lite", undefined, fakeClient([httpError(403, "API key not valid")], calls)),
      (err: unknown) => err instanceof GeminiServiceError && err.code === "INVALID_API_KEY" && err.statusCode === 401
    );
    assert.equal(calls.length, 1);
  });

  it("reports RATE_LIMITED when every model is over quota", async () => {
    const quota = () => httpError(429, "Resource has been exhausted (e.g. check quota).");
    await assert.rejects(
      () => summarizePageContent(page, "key", "gemini-3.5-flash-lite", undefined, fakeClient([quota(), quota(), quota()], [])),
      (err: unknown) => err instanceof GeminiServiceError && err.code === "RATE_LIMITED"
    );
  });

  it("reports AI_GENERATION_FAILED when no model returns valid JSON", async () => {
    await assert.rejects(
      () => summarizePageContent(page, "key", "gemini-3.5-flash-lite", undefined, fakeClient(["not json", "{}", "[]"], [])),
      (err: unknown) => err instanceof GeminiServiceError && err.code === "AI_GENERATION_FAILED"
    );
  });

  it("maps a cancelled request to REQUEST_ABORTED", async () => {
    const controller = new AbortController();
    controller.abort();
    const abortError = Object.assign(new Error("aborted"), { name: "AbortError" });
    await assert.rejects(
      () => summarizePageContent(page, "key", "gemini-3.5-flash-lite", controller.signal, fakeClient([abortError], [])),
      (err: unknown) => err instanceof GeminiServiceError && err.code === "REQUEST_ABORTED"
    );
  });
});
