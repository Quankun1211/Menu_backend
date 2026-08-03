import express from "express";
import { authorizeRole, protectRoute } from "../middleware/protectRoute.js";
import { claimConversation, getAdminConversation, getMyConversation, listConversations, readAdminConversation, readCustomerConversation, releaseConversation, resolveConversation, sendAdminMessage, sendCustomerMessage } from "../controller/supportChatController.js";

const router = express.Router();
router.use(protectRoute);
router.get("/me", getMyConversation);
router.post("/me/messages", sendCustomerMessage);
router.patch("/me/read", readCustomerConversation);
router.get("/conversations", authorizeRole(["admin", "super_admin"]), listConversations);
router.get("/conversations/:id", authorizeRole(["admin", "super_admin"]), getAdminConversation);
router.post("/conversations/:id/messages", authorizeRole(["admin", "super_admin"]), sendAdminMessage);
router.patch("/conversations/:id/read", authorizeRole(["admin", "super_admin"]), readAdminConversation);
router.patch("/conversations/:id/claim", authorizeRole(["admin", "super_admin"]), claimConversation);
router.patch("/conversations/:id/release", authorizeRole(["admin", "super_admin"]), releaseConversation);
router.patch("/conversations/:id/resolve", authorizeRole(["admin", "super_admin"]), resolveConversation);
export default router;
