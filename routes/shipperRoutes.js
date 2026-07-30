import express from "express"
import { authorizeRole, protectRoute } from "../middleware/protectRoute.js"
import { validate } from "../middleware/validate.js"
import { locationSchema, onlineSchema, shipperCancelSchema, shipperStatusSchema } from "../validation/schemas.js"
import { updateOrderStatus, getShipperOrders, requestCancelOrder, updateShipperStatus, getAllShipperOrders, updateShipperLocation, getShipperStats } from "../controller/shipperController.js"
const router = express.Router()

router.use(protectRoute, authorizeRole(["shipper"]));
router.get("/orders", getShipperOrders)
router.get("/all-orders", getAllShipperOrders)
router.get("/stats", getShipperStats)
router.patch(["/update", "/orders/status"], validate(shipperStatusSchema), updateOrderStatus);
router.post(["/request-cancel", "/orders/cancellation-requests"], validate(shipperCancelSchema), requestCancelOrder);
router.put(["/update-online", "/me/availability"], validate(onlineSchema), updateShipperStatus);
router.put(["/update-location", "/orders/location"], validate(locationSchema), updateShipperLocation);

export default router
