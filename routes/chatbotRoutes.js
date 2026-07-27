import express from "express"
import { askChatbot } from "../controller/chatbotController.js"
import { validate } from "../middleware/validate.js"
import { chatbotSchema } from "../validation/schemas.js"
const router = express.Router()

router.post("/ask", validate(chatbotSchema), askChatbot)

export default router
