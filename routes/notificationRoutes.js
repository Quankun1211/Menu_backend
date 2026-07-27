import express from "express"
import { createNotificationFromApi, getNotification, readAllNotifications, readNotification, sendInternalNotification } from "../controller/notificationController.js"
import { authorizeRole, protectRoute, optionalProtectRoute } from "../middleware/protectRoute.js"
import { validate } from "../middleware/validate.js"
import { notificationSchema, objectIdParams } from "../validation/schemas.js"

const router = express.Router()

router.post("/send-notification", protectRoute, authorizeRole(["admin", "super_admin"]), validate(notificationSchema), createNotificationFromApi)
router.get("/get", optionalProtectRoute, getNotification)
router.patch("/read-all", protectRoute, readAllNotifications);
router.patch("/read/:id", protectRoute, validate(objectIdParams(), "params"), readNotification)

export default router
