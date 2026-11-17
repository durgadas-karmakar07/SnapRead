import dns from "node:dns/promises";
import net from "node:net";
import * as cheerio from "cheerio";
import { config } from "../config.js";
import type { PageContent } from "../types/summary.js";

export class FetchPageError extends Error {
  readonly code: string;
  readonly statusCode: number;

  constructor(code: string, message: string, statusCode = 400) {
    super(message);
    this.name = "FetchPageError";
    this.code = code;
    this.statusCode = statusCode;
  }
}

const BLOCKED_HOSTNAMES = new Set([
  "localhost",
  "localhost.localdomain",
  "ip6-localhost",
  "ip6-loopback",
  "metadata.google.internal",
  "metadata",
]);

function isPrivateOrReservedIpv4(ip: string): boolean {
  const parts = ip.split(".").map((segment) => Number(segment));
  if (parts.length !== 4 || parts.some((n) => Number.isNaN(n) || n < 0 || n > 255)) {
    return true;
  }
  const [a, b] = parts;
  if (a === 0 || a === 10 || a === 127) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 100 && b >= 64 && b <= 127) return true;
  if (a >= 224) return true;
  return false;
}

function isPrivateOrReservedIp(ip: string): boolean {
  const normalized = ip.toLowerCase();
  if (net.isIPv4(normalized)) {
    return isPrivateOrReservedIpv4(normalized);
  }
  if (!net.isIPv6(normalized)) {
    return true;
  }
  if (normalized === "::" || normalized === "::1") return true;
  if (normalized.startsWith("::ffff:")) {
    const v4 = normalized.slice("::ffff:".length);
    return net.isIPv4(v4) ? isPrivateOrReservedIpv4(v4) : true;
  }
  // fc00::/7 (unique local) and fe80::/10 (link-local) and ff00::/8 (multicast)
  const firstWordHex = normalized.split(":")[0];
  const firstWord = Number.parseInt(firstWordHex || "0", 16);
  if ((firstWord & 0xfe00) === 0xfc00) return true;
  if ((firstWord & 0xffc0) === 0xfe80) return true;
  if ((firstWord & 0xff00) === 0xff00) return true;
  return false;
}

export function normalizeAndValidateUrl(rawInput: string): URL {
  const trimmed = rawInput.trim();
  if (!trimmed) {
    throw new FetchPageError("INVALID_URL", "Please enter a website URL to summarize.", 400);
  }

  const withScheme = /^[a-zA-Z][a-zA-Z\d+\-.]*:/.test(trimmed)
    ? trimmed
    : `https://${trimmed}`;

  let parsed: URL;
  try {
    parsed = new URL(withScheme);
  } catch {
    throw new FetchPageError(
      "INVALID_URL",
      "Please enter a valid public web address (for example, https://example.com/article).",
      400
    );
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new FetchPageError(
      "UNSUPPORTED_PROTOCOL",
      "Only http:// and https:// URLs are supported.",
      400
    );
  }

  if (parsed.username || parsed.password) {
    throw new FetchPageError(
      "INVALID_URL",
      "URLs containing embedded usernames or passwords are not allowed.",
      400
    );
  }

  const hostname = parsed.hostname
    .toLowerCase()
    .replace(/^\[|\]$/g, "")
    .replace(/\.$/, "");
  if (
    !hostname ||
    BLOCKED_HOSTNAMES.has(hostname) ||
    hostname.endsWith(".localhost") ||
    hostname.endsWith(".local") ||
    hostname.endsWith(".internal")
  ) {
    throw new FetchPageError(
      "PRIVATE_URL_BLOCKED",
      "Local or private network addresses cannot be summarized.",
      400
    );
  }

  if (net.isIP(hostname) && isPrivateOrReservedIp(hostname)) {
    throw new FetchPageError(
      "PRIVATE_URL_BLOCKED",
      "Private or reserved IP addresses cannot be summarized.",
      400
    );
  }

  return parsed;
}

async function assertPublicDns(rawHostname: string): Promise<void> {
  const hostname = rawHostname.replace(/^\[|\]$/g, "");
  if (net.isIP(hostname)) {
    if (isPrivateOrReservedIp(hostname)) {
      throw new FetchPageError(
        "PRIVATE_URL_BLOCKED",
        "Private or reserved IP addresses cannot be summarized.",
        400
      );
    }
    return;
  }

  let addresses: Array<{ address: string; family: number }>;
  try {
    addresses = await dns.lookup(hostname, { all: true });
  } catch {
    throw new FetchPageError(
      "DNS_LOOKUP_FAILED",
      `Could not find host "${hostname}". Check the URL and try again.`,
      422
    );
  }

  if (addresses.length === 0 || addresses.some((entry) => isPrivateOrReservedIp(entry.address))) {
    throw new FetchPageError(
      "PRIVATE_URL_BLOCKED",
      "The destination resolved to a private or unreachable network address.",
      400
    );
  }
}

async function readLimitedText(response: Response, maxBytes: number): Promise<string> {
  const declaredLength = Number(response.headers.get("content-length") || "0");
  if (declaredLength > maxBytes) {
    throw new FetchPageError(
      "PAGE_TOO_LARGE",
      "This webpage is larger than the 2 MB extraction limit.",
      413
    );
  }

  const reader = response.body?.getReader();
  if (!reader) {
    return await response.text();
  }

  const chunks: Uint8Array[] = [];
  let received = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;

    received += value.byteLength;
    if (received > maxBytes) {
      await reader.cancel().catch(() => {});
      break;
    }
    chunks.push(value);
  }

  const merged = new Uint8Array(received > maxBytes ? maxBytes : received);
  let offset = 0;
  for (const chunk of chunks) {
    const remaining = merged.byteLength - offset;
    if (remaining <= 0) break;
    const slice = chunk.byteLength > remaining ? chunk.subarray(0, remaining) : chunk;
    merged.set(slice, offset);
    offset += slice.byteLength;
  }

  return new TextDecoder("utf-8", { fatal: false }).decode(merged);
}

function normalizeWhitespace(rawText: string): string {
  return rawText
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t\f\v]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function countWords(text: string): number {
  if (!text) return 0;
  return text.split(/\s+/).filter(Boolean).length;
}

function truncateCleanly(text: string, maxChars: number): { text: string; truncated: boolean } {
  if (text.length <= maxChars) {
    return { text, truncated: false };
  }
  const sliced = text.slice(0, maxChars);
  const lastBreak = Math.max(sliced.lastIndexOf("\n"), sliced.lastIndexOf(" "));
  const boundary = lastBreak > maxChars * 0.8 ? lastBreak : maxChars;
  return {
    text: `${sliced.slice(0, boundary).trim()}…`,
    truncated: true,
  };
}

export function extractVisibleText(
  html: string,
  pageUrl: string
): Omit<PageContent, "url" | "finalUrl"> {
  const $ = cheerio.load(html);
  const parsedUrl = new URL(pageUrl);

  const rawTitle =
    $('meta[property="og:title"]').attr("content")?.trim() ||
    $("title").first().text().trim() ||
    $("h1").first().text().trim() ||
    parsedUrl.hostname;

  const description =
    $('meta[name="description"]').attr("content")?.trim() ||
    $('meta[property="og:description"]').attr("content")?.trim() ||
    "";

  const siteName =
    $('meta[property="og:site_name"]').attr("content")?.trim() ||
    parsedUrl.hostname.replace(/^www\./, "");

  // Remove non-visible, executable, and embedded media elements
  $(
    [
      "script",
      "style",
      "noscript",
      "template",
      "svg",
      "canvas",
      "iframe",
      "object",
      "embed",
      "audio",
      "video",
      "source",
      "track",
      "map",
      "head",
      "[hidden]",
      '[aria-hidden="true"]',
      '[style*="display:none"]',
      '[style*="display: none"]',
      '[style*="visibility:hidden"]',
      '[style*="visibility: hidden"]',
    ].join(",")
  ).remove();

  // Add newlines around block elements so extracted text preserves paragraph breaks
  $("p, h1, h2, h3, h4, h5, h6, li, blockquote, pre, tr, section, article, div, br").each(
    (_, element) => {
      const node = $(element);
      if (element.tagName === "br") {
        node.replaceWith("\n");
      } else {
        node.prepend("\n").append("\n");
      }
    }
  );

  // Prefer primary content landmark when it holds substantial text
  const primaryCandidate = $("main, article, [role='main']").first();
  let rawVisibleText = "";

  if (primaryCandidate.length > 0) {
    const candidateText = normalizeWhitespace(primaryCandidate.text());
    if (candidateText.length >= 200) {
      rawVisibleText = candidateText;
    }
  }

  if (!rawVisibleText) {
    const bodyClone = $("body").clone();
    bodyClone.find("nav, header, footer, aside, [role='navigation'], [role='banner'], [role='contentinfo']").remove();
    const cleanedBodyText = normalizeWhitespace(bodyClone.text());
    rawVisibleText =
      cleanedBodyText.length >= 120
        ? cleanedBodyText
        : normalizeWhitespace($("body").text() || $.root().text());
  }

  if (rawVisibleText.length < 40) {
    throw new FetchPageError(
      "EMPTY_CONTENT",
      "Could not extract enough visible text from this page. It may require JavaScript rendering or block automated readers.",
      422
    );
  }

  const wordCount = countWords(rawVisibleText);
  const { text: visibleText, truncated } = truncateCleanly(
    rawVisibleText,
    config.maxVisibleChars
  );

  return {
    title: normalizeWhitespace(rawTitle) || parsedUrl.hostname,
    description: normalizeWhitespace(description),
    siteName: normalizeWhitespace(siteName) || parsedUrl.hostname,
    visibleText,
    wordCount,
    truncated,
  };
}

export async function fetchPublicPage(
  rawUrl: string,
  externalSignal?: AbortSignal
): Promise<PageContent> {
  let currentUrl = normalizeAndValidateUrl(rawUrl);

  const timeoutSignal = AbortSignal.timeout(config.fetchTimeoutMs);
  const signal = externalSignal
    ? AbortSignal.any([externalSignal, timeoutSignal])
    : timeoutSignal;

  let response: Response | null = null;

  for (let hop = 0; hop <= config.maxRedirects; hop += 1) {
    await assertPublicDns(currentUrl.hostname);

    try {
      response = await fetch(currentUrl, {
        method: "GET",
        redirect: "manual",
        signal,
        headers: {
          "User-Agent":
            "Mozilla/5.0 (compatible; SnapReadBot/1.0; +https://github.com/snapread)",
          Accept: "text/html,application/xhtml+xml,text/plain;q=0.9,*/*;q=0.1",
          "Accept-Language": "en-US,en;q=0.9",
        },
      });
    } catch (error) {
      if (externalSignal?.aborted) {
        throw new FetchPageError("REQUEST_ABORTED", "Request was cancelled.", 499);
      }
      if (error instanceof Error && error.name === "TimeoutError") {
        throw new FetchPageError(
          "FETCH_TIMEOUT",
          "Timed out while waiting for the website to respond.",
          504
        );
      }
      throw new FetchPageError(
        "FETCH_FAILED",
        `Failed to fetch "${currentUrl.hostname}". Verify the URL is reachable publicly.`,
        502
      );
    }

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (!location) {
        throw new FetchPageError(
          "REDIRECT_ERROR",
          "The webpage returned an incomplete redirect.",
          502
        );
      }
      const nextUrl = new URL(location, currentUrl);
      currentUrl = normalizeAndValidateUrl(nextUrl.toString());
      continue;
    }

    break;
  }

  if (!response) {
    throw new FetchPageError("FETCH_FAILED", "Could not retrieve a response from the URL.", 502);
  }

  if (response.status >= 300 && response.status < 400) {
    throw new FetchPageError(
      "TOO_MANY_REDIRECTS",
      "The URL redirected too many times.",
      502
    );
  }

  if (!response.ok) {
    const statusHint =
      response.status === 401 || response.status === 403
        ? "This site blocked automated access or requires authentication."
        : response.status === 404
          ? "The requested page was not found (404)."
          : `The target site returned HTTP ${response.status}.`;
    throw new FetchPageError("UPSTREAM_HTTP_ERROR", statusHint, 502);
  }

  const contentType = (response.headers.get("content-type") || "").toLowerCase();
  const isPlainText = contentType.includes("text/plain");
  const isHtml =
    !contentType ||
    contentType.includes("text/html") ||
    contentType.includes("application/xhtml+xml");

  if (!isHtml && !isPlainText) {
    const cleanType = contentType.split(";")[0]?.trim() || "unknown";
    throw new FetchPageError(
      "UNSUPPORTED_CONTENT_TYPE",
      `This URL returned "${cleanType}" instead of a readable HTML webpage or plain text.`,
      415
    );
  }

  const body = await readLimitedText(response, config.maxHtmlBytes);
  const finalUrl = currentUrl.toString();

  if (isPlainText) {
    const cleaned = normalizeWhitespace(body);
    if (cleaned.length < 40) {
      throw new FetchPageError(
        "EMPTY_CONTENT",
        "The page returned very little readable text.",
        422
      );
    }
    const wordCount = countWords(cleaned);
    const { text: visibleText, truncated } = truncateCleanly(cleaned, config.maxVisibleChars);
    return {
      url: rawUrl,
      finalUrl,
      title: currentUrl.hostname,
      description: "",
      siteName: currentUrl.hostname.replace(/^www\./, ""),
      visibleText,
      wordCount,
      truncated,
    };
  }

  const extracted = extractVisibleText(body, finalUrl);
  return {
    url: rawUrl,
    finalUrl,
    ...extracted,
  };
}
