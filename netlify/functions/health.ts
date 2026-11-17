import { getHealthStatus } from "../../server/services/health.js";

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== "GET") {
    return Response.json(
      { error: { code: "METHOD_NOT_ALLOWED", message: "Method not allowed." } },
      { status: 405 }
    );
  }

  return Response.json(getHealthStatus(), {
    status: 200,
    headers: { "Cache-Control": "no-store" },
  });
}
