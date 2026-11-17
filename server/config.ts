import "dotenv/config";

export const config = {
  port: Number(process.env.PORT) || 3001,
  geminiApiKey: (process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || "").trim(),
  geminiModel: (process.env.GEMINI_MODEL || "gemini-3.5-flash-lite").trim(),
  fetchTimeoutMs: 12_000,
  maxHtmlBytes: 2 * 1024 * 1024,
  maxVisibleChars: 24_000,
  maxRedirects: 5,
} as const;
