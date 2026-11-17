import { executeSummarizePipeline } from "../../server/services/pipeline.js";

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== "POST") {
    return Response.json(
      { error: { code: "METHOD_NOT_ALLOWED", message: "Use POST /api/summarize." } },
      { status: 405 }
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json(
      { error: { code: "INVALID_JSON", message: "Request body must be valid JSON." } },
      { status: 400 }
    );
  }

  const rawUrl =
    typeof body === "object" && body !== null && "url" in body && typeof body.url === "string"
      ? body.url
      : "";
  const headerKey = req.headers.get("x-gemini-api-key") ?? "";

  const result = await executeSummarizePipeline({
    rawUrl,
    headerKey,
    signal: req.signal,
  });

  return Response.json(result.body, {
    status: result.status,
    headers: { "Cache-Control": "no-store" },
  });
}
