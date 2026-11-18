import { config } from "../config.js";
import type { HealthResponse } from "../types/summary.js";
import { EXTRACTIVE_MODEL_LABEL } from "./extractive.js";

export function getHealthStatus(
  getConfig: () => { geminiApiKey: string; geminiModel: string } = () => ({
    geminiApiKey: config.geminiApiKey,
    geminiModel: config.geminiModel,
  })
): HealthResponse {
  const { geminiApiKey, geminiModel } = getConfig();
  const aiConfigured = Boolean(geminiApiKey);
  return {
    ok: true,
    aiConfigured,
    model: aiConfigured ? geminiModel : EXTRACTIVE_MODEL_LABEL,
  };
}
