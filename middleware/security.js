const buckets = new Map();

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
