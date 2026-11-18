import type { PageContent, SummaryResult } from "../../server/types/summary.js";

/** Original fixture article used by the E2E server so tests never depend on a live website. */
export const ARTICLE_URL = "https://blog.example.com/http-caching-basics";

const ARTICLE_TEXT = [
  "HTTP caching basics for faster websites",
  "Every time a browser loads a page it asks the server for HTML, stylesheets, scripts and images. Caching lets the browser keep a copy of those files so the next visit can skip most of the network work.",
  "The Cache-Control header is the main switch. A value such as max-age=31536000 tells the browser it may reuse a file for a year without asking again, which suits files whose names change whenever their content changes.",
  "HTML documents usually need a shorter lifetime. Many teams send no-cache for HTML, which still stores the page but makes the browser check with the server before using it.",
  "That check is called revalidation. The server compares an ETag or Last-Modified value and answers 304 Not Modified when nothing changed, so only a few hundred bytes cross the network.",
  "Content delivery networks add a shared cache close to the user. They follow the same headers, and the s-maxage directive lets a team give the CDN a different lifetime from the browser.",
  "Mistakes are common. Caching personalised pages in a shared cache can leak one user's data to another, so responses that depend on cookies should be marked private.",
  "A practical starting point is long-lived caching for fingerprinted assets, revalidation for HTML, and private for anything tied to a signed-in user. Measuring with the browser's network panel shows quickly whether the rules work.",
].join("\n\n");

export function articlePage(url: string = ARTICLE_URL): PageContent {
  return {
    url,
    finalUrl: url,
    title: "HTTP caching basics for faster websites | Example Engineering Blog",
    description: "How Cache-Control, revalidation and CDNs work together to make websites load faster.",
    siteName: "Example Engineering Blog",
    visibleText: ARTICLE_TEXT,
    wordCount: ARTICLE_TEXT.split(/\s+/).filter(Boolean).length,
    truncated: false,
  };
}

/** Deterministic stand-in for the Gemini response (the real call is covered by unit tests). */
export const MOCK_AI_SUMMARY: SummaryResult = {
  headline: "How HTTP caching makes websites load faster",
  summary:
    "The article explains how browsers and CDNs reuse files instead of downloading them again. Cache-Control lifetimes, revalidation with ETags and private responses for signed-in users together cut network work without serving stale or leaked data.",
  keyPoints: [
    "Fingerprinted assets can be cached for a year with a long max-age.",
    "HTML is usually sent with no-cache so the browser revalidates before reuse.",
    "A 304 Not Modified answer saves bandwidth when a file has not changed.",
    "Responses tied to cookies should be private so shared caches never store them.",
  ],
  topics: ["HTTP caching", "Web performance", "CDN"],
  readingTimeMinutes: 2,
};

export const XSS_PAYLOAD = `<img src=x onerror="window.__xss=1"><script>window.__xss=1</script>`;
