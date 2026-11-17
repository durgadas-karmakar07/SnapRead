import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  extractVisibleText,
  FetchPageError,
  normalizeAndValidateUrl,
} from "../server/services/fetcher.js";

describe("normalizeAndValidateUrl", () => {
  it("normalizes bare domains to https://", () => {
    const parsed = normalizeAndValidateUrl("example.com/articles/1");
    assert.equal(parsed.toString(), "https://example.com/articles/1");
  });

  it("accepts valid https and http URLs", () => {
    assert.equal(
      normalizeAndValidateUrl("https://react.dev/learn").toString(),
      "https://react.dev/learn"
    );
    assert.equal(
      normalizeAndValidateUrl("http://example.org/docs").toString(),
      "http://example.org/docs"
    );
  });

  it("rejects empty or non-HTTP protocols", () => {
    assert.throws(() => normalizeAndValidateUrl("   "), FetchPageError);
    assert.throws(() => normalizeAndValidateUrl("ftp://example.com"), FetchPageError);
    assert.throws(() => normalizeAndValidateUrl("javascript:alert(1)"), FetchPageError);
  });

  it("blocks localhost and private/link-local IP addresses", () => {
    for (const blocked of [
      "http://localhost:3000",
      "http://127.0.0.1/admin",
      "http://10.0.0.5",
      "http://192.168.1.10",
      "http://172.16.0.1",
      "http://169.254.169.254/latest/meta-data",
      "http://[::1]:8080",
      "https://metadata.google.internal",
    ]) {
      assert.throws(() => normalizeAndValidateUrl(blocked), (err: unknown) => {
        return err instanceof FetchPageError && err.code === "PRIVATE_URL_BLOCKED";
      });
    }
  });
});

describe("extractVisibleText", () => {
  it("extracts title, siteName, and visible main content while stripping scripts and hidden elements", () => {
    const html = `
      <!doctype html>
      <html lang="en">
        <head>
          <title>Understanding Web Accessibility - MDN</title>
          <meta property="og:site_name" content="MDN Web Docs" />
          <meta name="description" content="A guide to building accessible sites." />
          <style>.hidden { display: none; }</style>
        </head>
        <body>
          <nav>Home | Docs | Blog</nav>
          <main>
            <h1>Web Accessibility Basics</h1>
            <p>Accessibility ensures websites are usable by everyone, including people using assistive technologies such as screen readers and keyboard navigation.</p>
            <p>Semantic HTML landmarks, proper form labels, and sufficient color contrast form the foundation of an inclusive web experience.</p>
            <p hidden>Secret hidden content that must not be extracted.</p>
            <div aria-hidden="true">Decorative screen reader hidden text.</div>
            <div style="display: none;">Inline hidden text.</div>
            <script>console.log("ignore script text");</script>
          </main>
          <footer>Copyright MDN</footer>
        </body>
      </html>
    `;

    const extracted = extractVisibleText(
      html,
      "https://developer.mozilla.org/en-US/docs/Web/Accessibility"
    );

    assert.equal(extracted.title, "Understanding Web Accessibility - MDN");
    assert.equal(extracted.siteName, "MDN Web Docs");
    assert.match(extracted.visibleText, /Web Accessibility Basics/);
    assert.match(extracted.visibleText, /Semantic HTML landmarks/);
    assert.doesNotMatch(extracted.visibleText, /ignore script text/);
    assert.doesNotMatch(extracted.visibleText, /Secret hidden content/);
    assert.doesNotMatch(extracted.visibleText, /Decorative screen reader hidden/);
    assert.doesNotMatch(extracted.visibleText, /Inline hidden text/);
    assert.doesNotMatch(extracted.visibleText, /Home \| Docs \| Blog/);
    assert.ok(extracted.wordCount > 25);
    assert.equal(extracted.truncated, false);
  });

  it("throws EMPTY_CONTENT when a page has insufficient visible text", () => {
    const emptySpaHtml = `
      <!doctype html>
      <html>
        <head><title>Blank App</title></head>
        <body>
          <div id="root"></div>
          <script src="/bundle.js"></script>
        </body>
      </html>
    `;

    assert.throws(
      () => extractVisibleText(emptySpaHtml, "https://example.com"),
      (err: unknown) => err instanceof FetchPageError && err.code === "EMPTY_CONTENT"
    );
  });
});
