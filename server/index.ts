import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import express, { type ErrorRequestHandler } from "express";
import { config } from "./config.js";
import { createSummarizeRouter, type SummarizeRouterDeps } from "./routes/summarize.js";
import { SECURITY_HEADERS } from "./services/securityHeaders.js";

export function createApp(deps?: SummarizeRouterDeps) {
  const app = express();

  // Use the real client IP for rate limiting when running behind a local or private proxy.
  app.set("trust proxy", "loopback, linklocal, uniquelocal");
  app.disable("x-powered-by");

  app.use((_req, res, next) => {
    res.set(SECURITY_HEADERS);
    next();
  });
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

  app.use(jsonErrorHandler);

  return app;
}

/** Turns body-parser and unexpected errors into the same JSON shape as other API errors. */
const jsonErrorHandler: ErrorRequestHandler = (err, _req, res, next) => {
  if (res.headersSent) {
    next(err);
    return;
  }
  const type = typeof err === "object" && err !== null && "type" in err ? err.type : undefined;
  if (type === "entity.too.large") {
    res.status(413).json({
      error: { code: "PAYLOAD_TOO_LARGE", message: "Request body is larger than 16 KB." },
    });
    return;
  }
  if (type === "entity.parse.failed") {
    res.status(400).json({
      error: { code: "INVALID_JSON", message: "Request body must be valid JSON." },
    });
    return;
  }
  console.error("Unexpected server error:", err);
  res.status(500).json({
    error: { code: "INTERNAL_ERROR", message: "An unexpected server error occurred." },
  });
};

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
