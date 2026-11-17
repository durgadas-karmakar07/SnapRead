import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import { config } from "./config.js";
import { createSummarizeRouter, type SummarizeRouterDeps } from "./routes/summarize.js";

export function createApp(deps?: SummarizeRouterDeps) {
  const app = express();

  app.use(express.json({ limit: "16kb" }));
  app.use("/api", createSummarizeRouter(deps));

  const currentDir = path.dirname(fileURLToPath(import.meta.url));
  const clientDistDir = path.resolve(currentDir, "..", "dist");
  const prodDistDir = path.resolve(currentDir, "..", "..", "dist");
  const staticDir = fs.existsSync(clientDistDir)
    ? clientDistDir
    : fs.existsSync(prodDistDir)
      ? prodDistDir
      : null;

  if (staticDir) {
    app.use(express.static(staticDir));
    app.get("/{*splat}", (req, res, next) => {
      if (req.path.startsWith("/api")) {
        next();
        return;
      }
      res.sendFile(path.join(staticDir, "index.html"));
    });
  }

  return app;
}

const isEntrypoint =
  process.argv[1] &&
  path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));

if (isEntrypoint) {
  const app = createApp();
  app.listen(config.port, () => {
    console.log(
      `SnapRead API server listening on http://localhost:${config.port} (model: ${config.geminiModel}, key configured: ${Boolean(config.geminiApiKey)})`
    );
  });
}
