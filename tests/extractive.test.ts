import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { summarizeWithExtractiveNlp } from "../server/services/extractive.js";
import type { PageContent } from "../server/types/summary.js";

describe("summarizeWithExtractiveNlp", () => {
  it("generates headline, summary, keyPoints, and topics from webpage content with zero API key", () => {
    const page: PageContent = {
      url: "https://intglobal.com/",
      finalUrl: "https://intglobal.com/",
      title: "INT Global | Digital Transformation & Technology Solutions",
      description:
        "We help enterprises build, modernise and scale technology with speed and agility across AI solutions and cloud engineering.",
      siteName: "intglobal.com",
      visibleText: [
        "Skip to content",
        "AI-first engineering and enterprise-scale reliability with three decades of trust.",
        "We help enterprises build, modernise and scale technology with speed and agility across AI solutions, digital products, cloud and data.",
        "Our teams deliver full-lifecycle software engineering, cloud migration, and analytics platforms for global financial and healthcare organizations.",
        "Customer experience transformation combines human-centered design with modern web and mobile architectures to improve conversion and retention.",
      ].join("\n\n"),
      wordCount: 420,
      truncated: false,
    };

    const result = summarizeWithExtractiveNlp(page);
    assert.match(result.headline, /INT Global/);
    assert.ok(result.summary.length > 40);
    assert.ok(result.keyPoints.length >= 2);
    assert.ok(result.topics.length >= 1);
    assert.equal(result.readingTimeMinutes, 2);
  });
});
