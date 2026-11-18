import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  extractVisibleText,
  FetchPageError,
  normalizeAndValidateUrl,
} from "../server/services/fetcher.js";

function codeOf(fn: () => unknown): string {
  try {
    fn();
    return "NO_ERROR";
  } catch (error) {
    return error instanceof FetchPageError ? error.code : "OTHER_ERROR";
  }
}

describe("SSRF guard edge cases", () => {
  it("blocks encoded and mapped forms of private addresses", () => {
    for (const blocked of [
      "http://2130706433/", // 127.0.0.1 written as a decimal integer
      "http://0x7f000001/", // 127.0.0.1 in hex
      "http://0.0.0.0/",
      "http://[::ffff:127.0.0.1]/", // IPv4-mapped IPv6 loopback
      "http://[fd00::1]/", // IPv6 unique local
      "http://[fe80::1]/", // IPv6 link-local
      "http://100.64.0.1/", // carrier-grade NAT
      "http://printer.local/",
      "http://service.internal/",
      "http://app.localhost/",
    ]) {
      assert.equal(codeOf(() => normalizeAndValidateUrl(blocked)), "PRIVATE_URL_BLOCKED", blocked);
    }
  });

  it("rejects URLs with embedded credentials and non-web schemes", () => {
    assert.equal(codeOf(() => normalizeAndValidateUrl("https://user:pass@example.com")), "INVALID_URL");
    assert.equal(codeOf(() => normalizeAndValidateUrl("file:///etc/passwd")), "UNSUPPORTED_PROTOCOL");
    assert.equal(codeOf(() => normalizeAndValidateUrl("data:text/html,hi")), "UNSUPPORTED_PROTOCOL");
  });

  it("still accepts ordinary public hosts", () => {
    assert.equal(codeOf(() => normalizeAndValidateUrl("https://en.wikipedia.org/wiki/AI")), "NO_ERROR");
    assert.equal(codeOf(() => normalizeAndValidateUrl("8.8.8.8")), "NO_ERROR");
  });
});

describe("visible text extraction limits", () => {
  it("truncates very long pages but keeps the full word count", () => {
    const paragraph = "<p>Readable sentence about web performance and caching strategies for modern apps.</p>";
    const html = `<html><head><title>Long page</title></head><body><main>${paragraph.repeat(800)}</main></body></html>`;
    const result = extractVisibleText(html, "https://example.com/long");

    assert.equal(result.truncated, true);
    assert.ok(result.visibleText.length <= 24_001);
    assert.ok(result.wordCount > 8_000);
  });

  it("falls back to the body (minus nav and footer) when there is no <main>", () => {
    const html = `
      <html><head><title>No landmarks</title></head><body>
        <nav>Home About Contact Careers Blog</nav>
        <div><p>This page has no main landmark but still carries a full paragraph of useful article text for readers.</p>
        <p>A second paragraph adds more detail so the extractor has enough visible content to work with.</p></div>
        <footer>Copyright 2026 Example Ltd</footer>
      </body></html>`;
    const result = extractVisibleText(html, "https://example.com/plain");

    assert.match(result.visibleText, /no main landmark/);
    assert.doesNotMatch(result.visibleText, /Copyright 2026/);
    assert.doesNotMatch(result.visibleText, /Careers Blog/);
    assert.equal(result.siteName, "example.com");
  });
});
