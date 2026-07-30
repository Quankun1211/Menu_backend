const buckets = new Map();
import { redisClient } from "../config/redis.js";

export const securityHeaders = (_req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  res.setHeader("Cross-Origin-Resource-Policy", "same-site");
  next();
};

export const rateLimit = ({ windowMs = 60_000, max = 100 } = {}) =>
  (req, res, next) => {
    const key = `${req.ip}:${req.baseUrl}`;
    const now = Date.now();
    const current = buckets.get(key);
    if (!current || current.resetAt <= now) {
      buckets.set(key, { count: 1, resetAt: now + windowMs });
      return next();
    }
    current.count += 1;
    if (current.count > max) {
      res.setHeader("Retry-After", Math.ceil((current.resetAt - now) / 1000));
      return res.status(429).json({ success: false, message: "Quá nhiều yêu cầu, vui lòng thử lại sau" });
    }
    next();
  };

export const distributedRateLimit = ({
  windowSeconds = 60,
  max = 20,
  prefix = "rate",
} = {}) =>
  async (req, res, next) => {
    if (!redisClient.isReady) return next();
    try {
      const identity = req.user?._id || req.user?.id || req.ip;
      const key = `${prefix}:${identity}:${Math.floor(Date.now() / (windowSeconds * 1000))}`;
      const count = await redisClient.incr(key);
      if (count === 1) await redisClient.expire(key, windowSeconds);
      if (count > max) {
        res.setHeader("Retry-After", windowSeconds);
        return res.status(429).json({
          success: false,
          code: "ORDER_RATE_LIMIT",
          message: "Bạn thao tác đặt hàng quá nhanh, vui lòng thử lại sau",
        });
      }
      next();
    } catch {
      next();
    }
  };
