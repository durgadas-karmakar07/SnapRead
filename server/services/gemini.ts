import { GoogleGenAI, Type } from "@google/genai";
import type { PageContent, SummaryResult } from "../types/summary.js";

export class GeminiServiceError extends Error {
  readonly code: string;
  readonly statusCode: number;

  constructor(code: string, message: string, statusCode = 502) {
    super(message);
    this.name = "GeminiServiceError";
    this.code = code;
    this.statusCode = statusCode;
  }
}

const SUMMARY_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    headline: {
      type: Type.STRING,
      description: "A concise, clear 5-12 word title capturing what the page is about.",
    },
    summary: {
      type: Type.STRING,
      description:
        "A crisp, accurate 2-4 sentence summary written in plain English based strictly on the provided webpage text.",
    },
    keyPoints: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: "3 to 5 distinct, scannable key takeaways from the page.",
    },
    topics: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: "2 to 4 short topic tags (1-3 words each) describing the subject matter.",
    },
    readingTimeMinutes: {
      type: Type.INTEGER,
      description: "Estimated original page reading time in whole minutes (minimum 1).",
    },
  },
  required: ["headline", "summary", "keyPoints", "topics", "readingTimeMinutes"],
  propertyOrdering: ["headline", "summary", "keyPoints", "topics", "readingTimeMinutes"],
};

export function parseSummaryPayload(rawText: string, wordCount: number): SummaryResult {
  const cleaned = rawText
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "");

  const parsed = JSON.parse(cleaned) as Partial<SummaryResult>;
  const estimatedMinutes = Math.max(1, Math.round(wordCount / 220));

  const headline = typeof parsed.headline === "string" ? parsed.headline.trim() : "";
  const summary = typeof parsed.summary === "string" ? parsed.summary.trim() : "";
  const keyPoints = Array.isArray(parsed.keyPoints)
    ? parsed.keyPoints
        .filter((item): item is string => typeof item === "string" && item.trim().length > 0)
        .map((item) => item.trim())
        .slice(0, 5)
    : [];
  const topics = Array.isArray(parsed.topics)
    ? parsed.topics
        .filter((item): item is string => typeof item === "string" && item.trim().length > 0)
        .map((item) => item.trim())
        .slice(0, 4)
    : [];
  const readingTimeMinutes =
    typeof parsed.readingTimeMinutes === "number" && Number.isFinite(parsed.readingTimeMinutes)
      ? Math.max(1, Math.round(parsed.readingTimeMinutes))
      : estimatedMinutes;

  if (!summary) {
    throw new Error("Empty summary field returned by Gemini.");
  }

  return {
    headline: headline || "Page Summary",
    summary,
    keyPoints,
    topics,
    readingTimeMinutes,
  };
}

function extractReadableErrorMessage(error: unknown): { status?: number; message: string } {
  const status =
    typeof error === "object" && error !== null && "status" in error && typeof error.status === "number"
      ? error.status
      : undefined;
  const rawMessage = error instanceof Error ? error.message : String(error);

  try {
    const parsed = JSON.parse(rawMessage) as { error?: { message?: string } };
    if (parsed?.error?.message) {
      return { status, message: parsed.error.message.split("\n")[0] || parsed.error.message };
    }
  } catch {
    // Non-JSON error message; return as-is.
  }

  return { status, message: rawMessage };
}

export async function summarizePageContent(
  page: PageContent,
  apiKey: string,
  model: string,
  signal?: AbortSignal
): Promise<SummaryResult> {
  if (!apiKey) {
    throw new GeminiServiceError(
      "MISSING_API_KEY",
      "Gemini API key is not configured. Add GEMINI_API_KEY to .env or provide a session key.",
      400
    );
  }

  const client = new GoogleGenAI({ apiKey });

  const prompt = [
    `URL: ${page.finalUrl}`,
    `Page Title: ${page.title}`,
    page.description ? `Meta Description: ${page.description}` : "",
    `Word Count: ${page.wordCount}${page.truncated ? " (truncated to fit context)" : ""}`,
    "",
    "Visible Webpage Text:",
    page.visibleText,
  ]
    .filter(Boolean)
    .join("\n");

  try {
    const response = await client.models.generateContent({
      model,
      contents: prompt,
      config: {
        systemInstruction:
          "You are SnapRead, an accurate editorial summarizer. Summarize ONLY facts present in the provided webpage text. Keep the summary concise (2-4 sentences), list 3-5 clear bullet takeaways, avoid hype or speculation, and return valid JSON matching the schema.",
        responseMimeType: "application/json",
        responseJsonSchema: SUMMARY_SCHEMA,
        maxOutputTokens: 1024,
        abortSignal: signal,
      },
    });

    const outputText = response.text;
    if (!outputText) {
      throw new GeminiServiceError(
        "EMPTY_AI_RESPONSE",
        "Gemini returned an empty response for this webpage.",
        502
      );
    }

    return parseSummaryPayload(outputText, page.wordCount);
  } catch (error) {
    if (error instanceof GeminiServiceError) {
      throw error;
    }

    if (signal?.aborted || (error instanceof Error && error.name === "AbortError")) {
      throw new GeminiServiceError("REQUEST_ABORTED", "Request was cancelled.", 499);
    }

    const { status, message } = extractReadableErrorMessage(error);
    const lower = message.toLowerCase();

    if (status === 401 || status === 403 || lower.includes("api key") || lower.includes("permission")) {
      throw new GeminiServiceError(
        "INVALID_API_KEY",
        "Gemini rejected the API key. Check that your GEMINI_API_KEY is valid and enabled.",
        401
      );
    }

    if (status === 429 || lower.includes("quota") || lower.includes("rate limit")) {
      throw new GeminiServiceError(
        "RATE_LIMITED",
        "Gemini API rate limit reached. Please wait a few seconds and try again.",
        429
      );
    }

    throw new GeminiServiceError(
      "AI_GENERATION_FAILED",
      `Failed to generate summary with Gemini (${model}): ${message}`,
      502
    );
  }
}
