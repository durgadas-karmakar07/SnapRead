import { executeSummarizePipeline } from "../../server/services/pipeline.js";

interface NetlifyContext {
  ip?: string;
}

function clientIdFrom(req: Request, context?: NetlifyContext): string {
  return (
    context?.ip ||
    req.headers.get("x-nf-client-connection-ip") ||
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "unknown"
  );
}

export default async function handler(req: Request, context?: NetlifyContext): Promise<Response> {
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
    clientId: clientIdFrom(req, context),
    signal: req.signal,
  });

  return Response.json(result.body, {
    status: result.status,
    headers: { "Cache-Control": "no-store", ...result.headers },
  });
}
