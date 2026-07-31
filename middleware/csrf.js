const safeMethods = new Set(["GET", "HEAD", "OPTIONS"]);
const excludedPaths = new Set([
  "/api/order/vnpay-ipn",
  "/api/v1/auth/registrations",
  "/api/v1/auth/email-verifications",
  "/api/v1/auth/email-verification-deliveries",
  "/api/v1/auth/password-reset-requests",
  "/api/v1/auth/password-resets",
  "/api/v1/auth/sessions",
  "/api/v1/auth/session-refreshes",
  "/api/v1/auth/identity-providers/google/sessions",
  "/api/v1/auth/identity-providers/facebook/sessions",
  "/api/v1/orders/payment-callbacks/vnpay/ipn",
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
