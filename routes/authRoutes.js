import express from "express"
import { signUp, login, logout, verifyOTP, resendOTP, forgotPassword, resetPassword, createSuperAdmin } from "../controller/authController.js"

const router = express.Router()

router.post("/register", signUp)
// router.post("/create-supper-admin", createSuperAdmin)
router.post('/verify-otp', verifyOTP);
router.post('/resend-otp', resendOTP);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);
router.post("/login", login)
router.post("/logout", logout)

export default router