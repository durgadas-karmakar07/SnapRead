import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createRateLimiter } from "../server/services/rateLimit.js";

describe("createRateLimiter", () => {
  it("allows requests up to the limit, then blocks with a Retry-After hint", () => {
    let clock = 0;
    const limiter = createRateLimiter({ limit: 3, windowMs: 60_000, now: () => clock });

    assert.deepEqual(limiter.check("1.1.1.1"), { allowed: true, remaining: 2, retryAfterSeconds: 0 });
    assert.equal(limiter.check("1.1.1.1").allowed, true);
    assert.equal(limiter.check("1.1.1.1").allowed, true);

    clock = 15_000;
    const blocked = limiter.check("1.1.1.1");
    assert.equal(blocked.allowed, false);
    assert.equal(blocked.remaining, 0);
    assert.equal(blocked.retryAfterSeconds, 45);
  });

  it("opens a fresh window once the previous one expires", () => {
    let clock = 0;
    const limiter = createRateLimiter({ limit: 1, windowMs: 1_000, now: () => clock });

    assert.equal(limiter.check("client").allowed, true);
    assert.equal(limiter.check("client").allowed, false);
    clock = 1_000;
    assert.equal(limiter.check("client").allowed, true);
  });

  it("tracks each client separately and can be reset", () => {
    const limiter = createRateLimiter({ limit: 1, windowMs: 60_000 });

    assert.equal(limiter.check("a").allowed, true);
    assert.equal(limiter.check("b").allowed, true);
    assert.equal(limiter.check("a").allowed, false);

    limiter.reset();
    assert.equal(limiter.check("a").allowed, true);
  });
});
