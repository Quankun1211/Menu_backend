import express from "express"
import { createNotificationFromApi, getNotification, readAllNotifications, readNotification, sendInternalNotification } from "../controller/notificationController.js"
import { authorizeRole, protectRoute, optionalProtectRoute } from "../middleware/protectRoute.js"
import { validate } from "../middleware/validate.js"
import { notificationSchema, objectIdParams } from "../validation/schemas.js"

const router = express.Router()

router.post("/", protectRoute, authorizeRole(["admin", "super_admin"]), validate(notificationSchema), createNotificationFromApi)
router.get("/", optionalProtectRoute, getNotification)
router.patch("/", protectRoute, readAllNotifications);
router.patch("/:id", protectRoute, validate(objectIdParams(), "params"), readNotification)

export default router
