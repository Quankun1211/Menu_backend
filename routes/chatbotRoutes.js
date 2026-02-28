import express from "express"
import { askChatbot } from "../controller/chatbotController.js"
const router = express.Router()

router.post("/ask", askChatbot)

export default router