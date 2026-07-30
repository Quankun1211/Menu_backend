const safeMethods = new Set(["GET", "HEAD", "OPTIONS"]);
const excludedPaths = new Set([
  "/api/auth/login",
  "/api/auth/register",
  "/api/auth/google",
  "/api/auth/facebook",
  "/api/auth/verify-otp",
  "/api/auth/resend-otp",
  "/api/auth/forgot-password",
  "/api/auth/reset-password",
  "/api/auth/refresh",
  "/api/order/vnpay-ipn",
  "/api/v1/auth/login",
  "/api/v1/auth/register",
  "/api/v1/auth/google",
  "/api/v1/auth/facebook",
  "/api/v1/auth/verify-otp",
  "/api/v1/auth/resend-otp",
  "/api/v1/auth/forgot-password",
  "/api/v1/auth/reset-password",
  "/api/v1/auth/refresh",
  "/api/v1/orders/payments/vnpay/ipn",
]);

export const csrfProtection = (req, res, next) => {
  if (safeMethods.has(req.method) || excludedPaths.has(req.path)) return next();
  if (req.get("authorization")?.startsWith("Bearer ")) return next();
  const cookieToken = req.cookies?.csrf_token;
  const headerToken = req.get("x-csrf-token");
  if (!cookieToken || !headerToken || cookieToken !== headerToken) {
    return res.status(403).json({ success: false, message: "CSRF token không hợp lệ" });
  }
  next();
};
