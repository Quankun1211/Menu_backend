import express from "express";
import { authorizeRole, protectRoute } from "../middleware/protectRoute.js";
import { validate } from "../middleware/validate.js";
import { locationSchema, objectIdParams, onlineSchema, shipperCancelSchema, shipperStatusSchema } from "../validation/schemas.js";
import {
  getAllShipperOrders,
  getShipperOrders,
  getShipperStats,
  requestCancelOrder,
  updateOrderStatus,
  updateShipperLocation,
  updateShipperStatus,
} from "../controller/shipperController.js";

const router = express.Router();
const injectOrderId = (req, _res, next) => {
  req.body.orderId = req.params.orderId;
  next();
};

router.use(protectRoute, authorizeRole(["shipper"]));
router.get("/orders/assigned", getShipperOrders);
router.get("/orders", getAllShipperOrders);
router.get("/me/statistics", getShipperStats);
router.patch(
  "/orders/:orderId/status",
  validate(objectIdParams("orderId"), "params"),
  injectOrderId,
  validate(shipperStatusSchema),
  updateOrderStatus,
);
router.post(
  "/orders/:orderId/cancellation-requests",
  validate(objectIdParams("orderId"), "params"),
  injectOrderId,
  validate(shipperCancelSchema),
  requestCancelOrder,
);
router.put("/me/availability", validate(onlineSchema), updateShipperStatus);
router.put(
  "/orders/:orderId/location",
  validate(objectIdParams("orderId"), "params"),
  injectOrderId,
  validate(locationSchema),
  updateShipperLocation,
);

export default router;
