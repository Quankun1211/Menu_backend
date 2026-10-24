import test from "node:test";
import assert from "node:assert/strict";
import { redisClient } from "../config/redis.js";
import { clearCache, getOrSetCache } from "../utils/redis.utils.js";

test("cache falls back to source and calls it only once while Redis is unavailable", async (context) => {
  if (redisClient.isReady) return context.skip("Redis is available in this test process");

  let callbackCount = 0;
  const value = await getOrSetCache("test:redis-fallback", async () => {
    callbackCount += 1;
    return { value: "database" };
  });

  assert.deepEqual(value, { value: "database" });
  assert.equal(callbackCount, 1);

  let concurrentCallbackCount = 0;
  const loadConcurrently = () => getOrSetCache("test:redis-single-flight", async () => {
    concurrentCallbackCount += 1;
    await new Promise((resolve) => setTimeout(resolve, 10));
    return "shared";
  });
  assert.deepEqual(await Promise.all([loadConcurrently(), loadConcurrently()]), ["shared", "shared"]);
  assert.equal(concurrentCallbackCount, 1);
  assert.equal(await clearCache("test:redis-fallback:*"), 0);
});
