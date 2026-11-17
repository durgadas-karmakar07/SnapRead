import { Router } from "express";
import {
  executeSummarizePipeline,
  getHealthStatus,
  type SummarizePipelineDeps,
} from "../services/pipeline.js";

export type SummarizeRouterDeps = SummarizePipelineDeps;

export function createSummarizeRouter(deps: SummarizeRouterDeps = {}) {
  const router = Router();

  router.get("/health", (_req, res) => {
    res.json(getHealthStatus(deps.getConfig));
  });

  router.post("/summarize", async (req, res) => {
    const rawUrl = typeof req.body?.url === "string" ? req.body.url : "";
    const headerKey =
      typeof req.headers["x-gemini-api-key"] === "string"
        ? req.headers["x-gemini-api-key"]
        : "";

    const abortController = new AbortController();
    res.on("close", () => {
      if (!res.writableEnded) {
        abortController.abort();
      }
    });

    const result = await executeSummarizePipeline({
      rawUrl,
      headerKey,
      signal: abortController.signal,
      deps,
    });

    res.status(result.status).json(result.body);
  });

  return router;
}

export const summarizeRouter = createSummarizeRouter();
