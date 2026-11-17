import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";
import { after, before, describe, it } from "node:test";
import { createApp } from "../server/index.js";
import { FetchPageError } from "../server/services/fetcher.js";
import type { PageContent, SummaryResult } from "../server/types/summary.js";

describe("SnapRead API routes", () => {
  let baseUrl = "";
  let closeServer: () => Promise<void>;
  let mockConfiguredKey = "test-key";

  before(async () => {
    const app = createApp({
      getConfig: () => ({
        geminiApiKey: mockConfiguredKey,
        geminiModel: "gemini-3.5-flash-lite",
      }),
      fetchPage: async (url): Promise<PageContent> => {
        if (url.includes("blocked.example")) {
          throw new FetchPageError("UPSTREAM_HTTP_ERROR", "Blocked by target site.", 502);
        }
        return {
          url,
          finalUrl: "https://example.com/article",
          title: "Example Article",
          description: "Short test description",
          siteName: "Example",
          visibleText: "Example visible article text discussing clean architecture and web performance.",
          wordCount: 10,
          truncated: false,
        };
      },
      summarize: async (): Promise<SummaryResult> => ({
        headline: "Clean Web Architecture Guide",
        summary: "This article outlines best practices for clean web architecture and performance.",
        keyPoints: [
          "Keep client and server responsibilities separated.",
          "Extract only visible text before calling the AI model.",
        ],
        topics: ["Architecture", "Performance"],
        readingTimeMinutes: 1,
      }),
    });

    await new Promise<void>((resolve) => {
      const server = app.listen(0, "127.0.0.1", () => {
        const address = server.address() as AddressInfo;
        baseUrl = `http://127.0.0.1:${address.port}`;
        closeServer = () =>
          new Promise<void>((closeResolve, closeReject) => {
            server.close((err) => (err ? closeReject(err) : closeResolve()));
          });
        resolve();
      });
    });
  });

  after(async () => {
    await closeServer();
  });

  it("GET /api/health reports configuration status", async () => {
    mockConfiguredKey = "test-key";
    const res = await fetch(`${baseUrl}/api/health`);
    assert.equal(res.status, 200);
    const body = (await res.json()) as { ok: boolean; aiConfigured: boolean; model: string };
    assert.deepEqual(body, {
      ok: true,
      aiConfigured: true,
      model: "gemini-3.5-flash-lite",
    });
  });

  it("POST /api/summarize validates empty URL", async () => {
    const res = await fetch(`${baseUrl}/api/summarize`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: "   " }),
    });
    assert.equal(res.status, 400);
    const body = (await res.json()) as { error: { code: string } };
    assert.equal(body.error.code, "INVALID_URL");
  });

  it("POST /api/summarize falls back to built-in free extractive NLP when no key is configured", async () => {
    mockConfiguredKey = "";
    const res = await fetch(`${baseUrl}/api/summarize`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: "https://example.com/article" }),
    });
    assert.equal(res.status, 200);
    const body = (await res.json()) as {
      summary: { headline: string; summary: string; keyPoints: string[] };
      meta: { model: string };
    };
    assert.equal(body.meta.model, "extractive-nlp (free)");
    assert.ok(body.summary.summary.length > 10);
    assert.ok(body.summary.keyPoints.length >= 1);
  });

  it("POST /api/summarize accepts session header key when env key is unset", async () => {
    mockConfiguredKey = "";
    const res = await fetch(`${baseUrl}/api/summarize`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Gemini-Api-Key": "session-key-123",
      },
      body: JSON.stringify({ url: "https://example.com/article" }),
    });
    assert.equal(res.status, 200);
    const body = (await res.json()) as {
      page: { title: string; siteName: string };
      summary: { headline: string; keyPoints: string[] };
      meta: { model: string };
    };
    assert.equal(body.page.title, "Example Article");
    assert.equal(body.summary.headline, "Clean Web Architecture Guide");
    assert.equal(body.summary.keyPoints.length, 2);
    assert.equal(body.meta.model, "gemini-3.5-flash-lite");
  });

  it("POST /api/summarize forwards fetcher errors cleanly", async () => {
    mockConfiguredKey = "test-key";
    const res = await fetch(`${baseUrl}/api/summarize`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: "https://blocked.example/secret" }),
    });
    assert.equal(res.status, 502);
    const body = (await res.json()) as { error: { code: string; message: string } };
    assert.equal(body.error.code, "UPSTREAM_HTTP_ERROR");
    assert.equal(body.error.message, "Blocked by target site.");
  });

  it("POST /api/summarize lets session header key override an existing env key", async () => {
    let usedKey = "";
    const overrideApp = createApp({
      getConfig: () => ({
        geminiApiKey: "revoked-env-key",
        geminiModel: "gemini-3.5-flash-lite",
      }),
      fetchPage: async (url): Promise<PageContent> => ({
        url,
        finalUrl: url,
        title: "Test",
        description: "",
        siteName: "example.com",
        visibleText: "Example page text long enough to summarize cleanly.",
        wordCount: 8,
        truncated: false,
      }),
      summarize: async (_page, apiKey): Promise<SummaryResult> => {
        usedKey = apiKey;
        return {
          headline: "Override Works",
          summary: "Header key overrides an invalid server key.",
          keyPoints: ["Session key works immediately."],
          topics: ["Testing"],
          readingTimeMinutes: 1,
        };
      },
    });

    const srv = await new Promise<ReturnType<typeof overrideApp.listen>>((resolve) => {
      const s = overrideApp.listen(0, "127.0.0.1", () => resolve(s));
    });
    try {
      const addr = srv.address() as AddressInfo;
      const res = await fetch(`http://127.0.0.1:${addr.port}/api/summarize`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Gemini-Api-Key": "fresh-session-key",
        },
        body: JSON.stringify({ url: "https://example.com" }),
      });
      assert.equal(res.status, 200);
      assert.equal(usedKey, "fresh-session-key");
    } finally {
      await new Promise<void>((resolve, reject) =>
        srv.close((err) => (err ? reject(err) : resolve()))
      );
    }
  });
});
