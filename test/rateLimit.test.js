import test from "node:test";
import assert from "node:assert/strict";
import { distributedRateLimit } from "../middleware/security.js";

const runLimit = async (middleware, { ip, userId }) => {
  const response = {
    headers: {},
    statusCode: 200,
    setHeader(name, value) { this.headers[name] = value; },
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };
  let nextCalled = false;
  await middleware({ ip, user: userId ? { _id: userId } : undefined }, response, () => {
    nextCalled = true;
  });
  return { response, nextCalled };
};

test("rate limit counts authenticated traffic by both IP and user", async () => {
  const middleware = distributedRateLimit({
    windowSeconds: 60,
    max: 2,
    prefix: `test:${Date.now()}:${Math.random()}`,
  });

  assert.equal((await runLimit(middleware, { ip: "192.0.2.1", userId: "user-a" })).nextCalled, true);
  // A second IP cannot bypass the per-user bucket.
  assert.equal((await runLimit(middleware, { ip: "192.0.2.2", userId: "user-a" })).nextCalled, true);
  const blockedByUser = await runLimit(middleware, { ip: "192.0.2.3", userId: "user-a" });
  assert.equal(blockedByUser.response.statusCode, 429);
  assert.equal(blockedByUser.response.body.code, "RATE_LIMIT_EXCEEDED");

  // A new user still shares the per-IP bucket with other authenticated users.
  await runLimit(middleware, { ip: "192.0.2.1", userId: "user-b" });
  const blockedByIp = await runLimit(middleware, { ip: "192.0.2.1", userId: "user-c" });
  assert.equal(blockedByIp.response.statusCode, 429);
});
