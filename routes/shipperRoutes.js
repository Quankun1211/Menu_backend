import express from "express"
import { protectRoute } from "../middleware/protectRoute.js"
import { updateOrderStatus, getShipperOrders, requestCancelOrder, updateShipperStatus, getAllShipperOrders, updateShipperLocation } from "../controller/shipperController.js"
const router = express.Router()

router.get("/orders", protectRoute, getShipperOrders)
router.get("/all-orders", protectRoute, getAllShipperOrders)
router.patch("/update", protectRoute, updateOrderStatus);
router.post("/request-cancel", protectRoute, requestCancelOrder);
router.put("/update-online", protectRoute, updateShipperStatus);
router.put("/update-location", protectRoute, updateShipperLocation);

export default router