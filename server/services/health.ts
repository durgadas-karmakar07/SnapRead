import { config } from "../config.js";
import type { HealthResponse } from "../types/summary.js";

export function getHealthStatus(
  getConfig: () => { geminiApiKey: string; geminiModel: string } = () => ({
    geminiApiKey: config.geminiApiKey,
    geminiModel: config.geminiModel,
  })
): HealthResponse {
  const { geminiApiKey, geminiModel } = getConfig();
  return {
    ok: true,
    aiConfigured: Boolean(geminiApiKey),
    model: geminiModel,
  };
}
