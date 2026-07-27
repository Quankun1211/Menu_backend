import express from "express"
import { signUp, login, logout, verifyOTP, resendOTP, forgotPassword, resetPassword, createSuperAdmin, refreshAccessToken, getCsrfToken } from "../controller/authController.js"
import { rateLimit } from "../middleware/security.js"
import { validate } from "../middleware/validate.js"
import { emailSchema, loginSchema, otpSchema, refreshSchema, registerSchema, resetPasswordSchema } from "../validation/schemas.js"

const router = express.Router()

router.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 20 }));
router.post("/register", validate(registerSchema), signUp)
router.post('/verify-otp', validate(otpSchema), verifyOTP);
router.post('/resend-otp', validate(emailSchema), resendOTP);
router.post('/forgot-password', validate(emailSchema), forgotPassword);
router.post('/reset-password', validate(resetPasswordSchema), resetPassword);
router.post("/login", validate(loginSchema), login)
router.get("/csrf", getCsrfToken)
router.post("/refresh", validate(refreshSchema), refreshAccessToken)
router.post("/logout", logout)

// router.post("/create-supper-admin", createSuperAdmin)
export default router
