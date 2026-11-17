import "dotenv/config";

const isServerless = Boolean(process.env.NETLIFY || process.env.AWS_LAMBDA_FUNCTION_NAME);

export const config = {
  port: Number(process.env.PORT) || 3001,
  geminiApiKey: (process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || "").trim(),
  geminiModel: (process.env.GEMINI_MODEL || "gemini-3.5-flash-lite").trim(),
  fetchTimeoutMs: isServerless ? 5_500 : 12_000,
  maxHtmlBytes: 2 * 1024 * 1024,
  maxVisibleChars: isServerless ? 16_000 : 24_000,
  maxRedirects: 5,
} as const;
