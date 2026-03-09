import express from "express"
import { createNotificationFromApi, getNotification, readNotification, sendInternalNotification } from "../controller/notificationController.js"
import { protectRoute, optionalProtectRoute } from "../middleware/protectRoute.js"

const router = express.Router()

router.post("/send-notification", createNotificationFromApi)
router.get("/get", optionalProtectRoute, getNotification)
router.patch("/read/:id", optionalProtectRoute, readNotification)

export default router