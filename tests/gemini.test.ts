import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  GeminiServiceError,
  parseSummaryPayload,
  summarizePageContent,
} from "../server/services/gemini.js";
import type { PageContent } from "../server/types/summary.js";

describe("parseSummaryPayload", () => {
  it("parses valid structured JSON output", () => {
    const raw = JSON.stringify({
      headline: "Understanding React Server Components",
      summary: "React Server Components render on the server to reduce client bundle size.",
      keyPoints: [
        "Zero client JavaScript for server-only components.",
        "Seamless integration with async data fetching.",
      ],
      topics: ["React", "Web Architecture"],
      readingTimeMinutes: 4,
    });

    const result = parseSummaryPayload(raw, 800);
    assert.equal(result.headline, "Understanding React Server Components");
    assert.equal(result.keyPoints.length, 2);
    assert.equal(result.topics.length, 2);
    assert.equal(result.readingTimeMinutes, 4);
  });

  it("handles fenced JSON and falls back to computed readingTimeMinutes", () => {
    const raw = [
      "```json",
      JSON.stringify({
        headline: "Clean APIs",
        summary: "Keep API interfaces simple and predictable.",
        keyPoints: ["Validate inputs early."],
        topics: ["APIs"],
      }),
      "```",
    ].join("\n");

    const result = parseSummaryPayload(raw, 660);
    assert.equal(result.headline, "Clean APIs");
    assert.equal(result.readingTimeMinutes, 3);
  });

  it("throws when summary is empty", () => {
    assert.throws(() =>
      parseSummaryPayload(JSON.stringify({ headline: "X", summary: "  " }), 100)
    );
  });
});

describe("summarizePageContent", () => {
  it("throws MISSING_API_KEY when apiKey is empty", async () => {
    const page: PageContent = {
      url: "https://example.com",
      finalUrl: "https://example.com/",
      title: "Example",
      description: "",
      siteName: "example.com",
      visibleText: "Example page text long enough to pass extraction.",
      wordCount: 8,
      truncated: false,
    };

    await assert.rejects(
      () => summarizePageContent(page, "", "gemini-3.5-flash-lite"),
      (err: unknown) => err instanceof GeminiServiceError && err.code === "MISSING_API_KEY"
    );
  });
});
