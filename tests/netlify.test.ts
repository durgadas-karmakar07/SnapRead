import assert from "node:assert/strict";
import { describe, it } from "node:test";
import healthHandler from "../netlify/functions/health.js";
import summarizeHandler from "../netlify/functions/summarize.js";

describe("Netlify Functions", () => {
  it("health function returns 200 for GET and 405 for POST", async () => {
    const getRes = await healthHandler(new Request("https://example.netlify.app/api/health"));
    assert.equal(getRes.status, 200);
    const body = (await getRes.json()) as { ok: boolean; model: string };
    assert.equal(body.ok, true);
    assert.ok(body.model.length > 0);

    const postRes = await healthHandler(
      new Request("https://example.netlify.app/api/health", { method: "POST" })
    );
    assert.equal(postRes.status, 405);
  });

  it("summarize function validates HTTP method, JSON body, and empty URL", async () => {
    const getRes = await summarizeHandler(
      new Request("https://example.netlify.app/api/summarize", { method: "GET" })
    );
    assert.equal(getRes.status, 405);

    const badJsonRes = await summarizeHandler(
      new Request("https://example.netlify.app/api/summarize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{bad json",
      })
    );
    assert.equal(badJsonRes.status, 400);
    const badJsonBody = (await badJsonRes.json()) as { error: { code: string } };
    assert.equal(badJsonBody.error.code, "INVALID_JSON");

    const emptyUrlRes = await summarizeHandler(
      new Request("https://example.netlify.app/api/summarize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: "  " }),
      })
    );
    assert.equal(emptyUrlRes.status, 400);
    const emptyBody = (await emptyUrlRes.json()) as { error: { code: string } };
    assert.equal(emptyBody.error.code, "INVALID_URL");
  });
});
