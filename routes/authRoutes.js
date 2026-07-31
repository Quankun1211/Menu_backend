import express from "express";
import {
  facebookLogin,
  forgotPassword,
  getCsrfToken,
  googleLogin,
  login,
  logout,
  refreshAccessToken,
  resendOTP,
  resetPassword,
  signUp,
  verifyOTP,
} from "../controller/authController.js";
import { rateLimit } from "../middleware/security.js";
import { validate } from "../middleware/validate.js";
import {
  emailSchema,
  loginSchema,
  otpSchema,
  refreshSchema,
  registerSchema,
  resetPasswordSchema,
  socialLoginSchema,
} from "../validation/schemas.js";

const router = express.Router();

router.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 20 }));
router.post("/registrations", validate(registerSchema), signUp);
router.post("/email-verifications", validate(otpSchema), verifyOTP);
router.post("/email-verification-deliveries", validate(emailSchema), resendOTP);
router.post("/password-reset-requests", validate(emailSchema), forgotPassword);
router.put("/password-resets", validate(resetPasswordSchema), resetPassword);
router.post("/sessions", validate(loginSchema), login);
router.delete("/sessions", logout);
router.post("/session-refreshes", validate(refreshSchema), refreshAccessToken);
router.post("/identity-providers/google/sessions", validate(socialLoginSchema), googleLogin);
router.post("/identity-providers/facebook/sessions", validate(socialLoginSchema), facebookLogin);
router.get("/csrf-tokens", getCsrfToken);

export default router;
