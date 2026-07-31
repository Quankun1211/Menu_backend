import express from "express";
import { vnpayIPN } from "../controller/vnpayCallbackController.js";

const router = express.Router();

// Compatibility endpoint configured in the external VNPay merchant portal.
router.get("/vnpay-ipn", vnpayIPN);

export default router;
