import express from "express";
import { getShippingFee, updateShippingFee } from "../controller/configController.js";
import { authorizeRole, protectRoute } from "../middleware/protectRoute.js";
import { validate } from "../middleware/validate.js";
import { shippingFeeSchema } from "../validation/schemas.js";

const router = express.Router();
router.get("/shipping", getShippingFee);
router.put("/shipping", protectRoute, authorizeRole(["admin", "super_admin"]), validate(shippingFeeSchema), updateShippingFee);
export default router;
