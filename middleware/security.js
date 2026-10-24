import { redisClient } from "../config/redis.js";

const localBuckets = new Map();
let operationsSinceCleanup = 0;

const cleanupLocalBuckets = (now) => {
  operationsSinceCleanup += 1;
  if (operationsSinceCleanup < 500) return;
  operationsSinceCleanup = 0;

  for (const [key, bucket] of localBuckets) {
    if (bucket.resetAt <= now) localBuckets.delete(key);
  }

  // Bound memory if a client sends many spoofed/rotating IP values.
  while (localBuckets.size > 20_000) {
    const oldestKey = localBuckets.keys().next().value;
    if (!oldestKey) break;
    localBuckets.delete(oldestKey);
  }
};

const consumeLocalBuckets = (keys, { windowSeconds, max }) => {
  const now = Date.now();
  const windowMs = windowSeconds * 1000;
  const resetAt = Math.floor(now / windowMs) * windowMs + windowMs;
  cleanupLocalBuckets(now);

  const buckets = keys.map((key) => {
    const bucketKey = `${key}:${Math.floor(now / windowMs)}`;
    let bucket = localBuckets.get(bucketKey);
    if (!bucket || bucket.resetAt <= now) {
      bucket = { count: 0, resetAt };
      localBuckets.set(bucketKey, bucket);
    }
    bucket.count += 1;
    return bucket;
  });

  return {
    allowed: buckets.every((bucket) => bucket.count <= max),
    count: Math.max(...buckets.map((bucket) => bucket.count)),
    resetAt,
  };
};

const consumeRedisBuckets = async (keys, windowSeconds) => {
  const values = await redisClient.eval(
    `local counts = {}
     for i, key in ipairs(KEYS) do
       local count = redis.call('INCR', key)
       if count == 1 then redis.call('EXPIRE', key, ARGV[1]) end
       counts[i] = count
     end
     return counts`,
    { keys, arguments: [String(windowSeconds)] },
  );

  return values.map(Number);
};

export const securityHeaders = (_req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  res.setHeader("Cross-Origin-Resource-Policy", "same-site");
  next();
};

/**
 * Fixed-window distributed limiter. Redis is the shared source when available;
 * process-local buckets keep limits active during Redis outages/reconnects.
 * By default authenticated requests consume both an IP and a user bucket.
 */
export const distributedRateLimit = ({
  windowSeconds = 60,
  max = 100,
  prefix = "api",
  keyBy = ["ip", "user"],
} = {}) =>
  async (req, res, next) => {
    const dimensions = [];
    if (keyBy.includes("ip") && req.ip) dimensions.push(`ip:${req.ip}`);
    const userId = req.user?._id || req.user?.id;
    if (keyBy.includes("user") && userId) dimensions.push(`user:${userId}`);
    if (dimensions.length === 0) dimensions.push("ip:unknown");

    const now = Date.now();
    const windowMs = windowSeconds * 1000;
    const resetAt = Math.floor(now / windowMs) * windowMs + windowMs;
    const bucket = Math.floor(now / windowMs);
    const keys = dimensions.map((identity) => `${prefix}:${identity}:${bucket}`);

    let counts;
    if (redisClient.isReady) {
      try {
        counts = await consumeRedisBuckets(keys, windowSeconds);
      } catch (error) {
        console.error("Rate limiter Redis fallback:", error.message);
      }
    }

    if (!counts) {
      const local = consumeLocalBuckets(keys, { windowSeconds, max });
      counts = keys.map(() => local.count);
    }

    const count = Math.max(...counts);
    const remaining = Math.max(0, max - count);
    res.setHeader("RateLimit-Limit", String(max));
    res.setHeader("RateLimit-Remaining", String(remaining));
    res.setHeader("RateLimit-Reset", String(Math.ceil(resetAt / 1000)));

    if (count > max) {
      const retryAfter = Math.max(1, Math.ceil((resetAt - now) / 1000));
      res.setHeader("Retry-After", String(retryAfter));
      return res.status(429).json({
        success: false,
        code: "RATE_LIMIT_EXCEEDED",
        message: "Quá nhiều yêu cầu, vui lòng thử lại sau",
      });
    }

    return next();
  };

// Kept as the existing public name so current route middleware remains compatible.
export const rateLimit = ({ windowMs = 60_000, max = 100, prefix = "api" } = {}) =>
  distributedRateLimit({
    windowSeconds: Math.max(1, Math.ceil(windowMs / 1000)),
    max,
    prefix,
    keyBy: ["ip"],
  });
