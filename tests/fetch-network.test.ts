import assert from "node:assert/strict";
import dns from "node:dns/promises";
import { afterEach, beforeEach, describe, it, mock } from "node:test";
import { FetchPageError, fetchPublicPage } from "../server/services/fetcher.js";

/** DNS answers used by the fake resolver. */
const dnsTable: Record<string, string> = {
  "news.example.com": "93.184.216.34",
  "short.example.com": "93.184.216.35",
  "evil-redirect.example.com": "93.184.216.36",
  "rebind.example.com": "10.0.0.7", // public name that resolves to a private address
};

const ARTICLE_HTML = `<!doctype html><html><head><title>Fetched article</title>
  <meta property="og:site_name" content="Example News"></head>
  <body><nav>Home | World | Sport</nav><main>
  <h1>Rivers and cities</h1>
  <p>Cities have always grown along rivers because water brought trade, food and a way to move goods.</p>
  <p>Modern planners now restore riverbanks to reduce flooding and give residents green space.</p>
  </main></body></html>`;

let responder: (url: URL) => Response;
const requested: string[] = [];

function codeOf(error: unknown): string {
  return error instanceof FetchPageError ? error.code : "OTHER";
}

beforeEach(() => {
  requested.length = 0;
  mock.method(dns, "lookup", async (hostname: string) => {
    const address = dnsTable[hostname];
    if (!address) throw Object.assign(new Error("ENOTFOUND"), { code: "ENOTFOUND" });
    return [{ address, family: 4 }];
  });
  mock.method(globalThis, "fetch", async (input: URL | string) => {
    const url = new URL(String(input));
    requested.push(url.toString());
    return responder(url);
  });
});

afterEach(() => {
  mock.restoreAll();
});

describe("fetchPublicPage (network mocked)", () => {
  it("fetches HTML and returns only the visible article text", async () => {
    responder = () => new Response(ARTICLE_HTML, { headers: { "content-type": "text/html; charset=utf-8" } });
    const page = await fetchPublicPage("news.example.com/rivers");

    assert.equal(page.finalUrl, "https://news.example.com/rivers");
    assert.equal(page.title, "Fetched article");
    assert.equal(page.siteName, "Example News");
    assert.match(page.visibleText, /Cities have always grown along rivers/);
    assert.doesNotMatch(page.visibleText, /Home \| World/);
  });

  it("follows a redirect and reports the final URL", async () => {
    responder = (url) =>
      url.hostname === "short.example.com"
        ? new Response(null, { status: 301, headers: { location: "https://news.example.com/rivers" } })
        : new Response(ARTICLE_HTML, { headers: { "content-type": "text/html" } });

    const page = await fetchPublicPage("https://short.example.com/r");
    assert.equal(page.finalUrl, "https://news.example.com/rivers");
    assert.deepEqual(requested, ["https://short.example.com/r", "https://news.example.com/rivers"]);
  });

  it("refuses a redirect that points to a private address", async () => {
    responder = () =>
      new Response(null, { status: 302, headers: { location: "http://169.254.169.254/latest/meta-data" } });
    await assert.rejects(() => fetchPublicPage("https://evil-redirect.example.com/"), (e) => codeOf(e) === "PRIVATE_URL_BLOCKED");
    assert.equal(requested.length, 1, "the private address is never requested");
  });

  it("refuses a public hostname whose DNS points to a private network", async () => {
    responder = () => new Response(ARTICLE_HTML);
    await assert.rejects(() => fetchPublicPage("https://rebind.example.com/"), (e) => codeOf(e) === "PRIVATE_URL_BLOCKED");
    assert.equal(requested.length, 0);
  });

  it("reports unknown hosts clearly", async () => {
    responder = () => new Response(ARTICLE_HTML);
    await assert.rejects(() => fetchPublicPage("https://no-such-host.example.org/"), (e) => codeOf(e) === "DNS_LOOKUP_FAILED");
  });

  it("explains blocked and missing pages", async () => {
    responder = () => new Response("Forbidden", { status: 403 });
    await assert.rejects(
      () => fetchPublicPage("https://news.example.com/private"),
      (e) => codeOf(e) === "UPSTREAM_HTTP_ERROR" && /blocked automated access/.test((e as Error).message)
    );

    responder = () => new Response("Not found", { status: 404 });
    await assert.rejects(
      () => fetchPublicPage("https://news.example.com/missing"),
      (e) => /404/.test((e as Error).message)
    );
  });

  it("rejects files that are not web pages", async () => {
    responder = () => new Response("%PDF-1.7", { headers: { "content-type": "application/pdf" } });
    await assert.rejects(() => fetchPublicPage("https://news.example.com/file.pdf"), (e) => codeOf(e) === "UNSUPPORTED_CONTENT_TYPE");
  });

  it("rejects pages that declare more than 2 MB", async () => {
    responder = () =>
      new Response("<p>big</p>", { headers: { "content-type": "text/html", "content-length": String(3 * 1024 * 1024) } });
    await assert.rejects(() => fetchPublicPage("https://news.example.com/huge"), (e) => codeOf(e) === "PAGE_TOO_LARGE");
  });

  it("reads plain-text pages", async () => {
    const text = "Plain text notes about rivers, cities and flood planning written for a public audience.";
    responder = () => new Response(text, { headers: { "content-type": "text/plain" } });
    const page = await fetchPublicPage("https://news.example.com/notes.txt");
    assert.equal(page.visibleText, text);
    assert.equal(page.siteName, "news.example.com");
  });

  it("stops after too many redirects", async () => {
    let hop = 0;
    responder = () => new Response(null, { status: 302, headers: { location: `https://news.example.com/hop-${++hop}` } });
    await assert.rejects(() => fetchPublicPage("https://news.example.com/loop"), (e) => codeOf(e) === "TOO_MANY_REDIRECTS");
  });

  it("maps network failures and user cancellation to clear errors", async () => {
    responder = () => {
      throw new TypeError("fetch failed");
    };
    await assert.rejects(() => fetchPublicPage("https://news.example.com/down"), (e) => codeOf(e) === "FETCH_FAILED");

    const controller = new AbortController();
    controller.abort();
    await assert.rejects(
      () => fetchPublicPage("https://news.example.com/cancelled", controller.signal),
      (e) => codeOf(e) === "REQUEST_ABORTED"
    );
  });
});
