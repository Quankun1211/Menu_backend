import mongoose from "mongoose";
import { SupportConversation } from "../models/supportConversationModel.js";

const cleanContent = (value) => typeof value === "string" ? value.trim() : "";
const validId = (id) => mongoose.isValidObjectId(id);

const emitUpdate = (req, conversation, message = null) => {
  const io = req.app.get("io");
  if (!io) return;
  const customerId = conversation.customer?._id || conversation.customer;
  const payload = { conversationId: conversation._id, customerId, message, status: conversation.status, assignedAdmin: conversation.assignedAdmin };
  io.to(String(customerId)).emit("support_message", payload);
  io.to("admins").emit("support_conversation_updated", payload);
};

export const getMyConversation = async (req, res, next) => {
  try { res.json({ success: true, data: await SupportConversation.findOne({ customer: req.user._id }) }); }
  catch (error) { next(error); }
};

export const sendCustomerMessage = async (req, res, next) => {
  try {
    const content = cleanContent(req.body.content);
    if (!content || content.length > 2000) return res.status(400).json({ success: false, message: "Tin nhắn phải có từ 1 đến 2000 ký tự" });
    const existing = await SupportConversation.findOne({ customer: req.user._id }).select("status").lean();
    const reopen = existing?.status === "resolved" ? { status: "waiting", assignedAdmin: null, assignedAt: null, resolvedAt: null } : {};
    const update = {
      $push: { messages: { sender: req.user._id, senderRole: "user", content } },
      $set: { lastMessage: content, lastMessageAt: new Date(), ...reopen },
      $inc: { unreadByAdmin: 1 },
    };
    if (!existing) update.$setOnInsert = { status: "waiting" };
    const conversation = await SupportConversation.findOneAndUpdate(
      { customer: req.user._id },
      update,
      { new: true, upsert: true, setDefaultsOnInsert: true },
    );
    const message = conversation.messages.at(-1);
    emitUpdate(req, conversation, message);
    res.status(201).json({ success: true, data: message });
  } catch (error) { next(error); }
};

export const readCustomerConversation = async (req, res, next) => {
  try { await SupportConversation.updateOne({ customer: req.user._id }, { $set: { unreadByCustomer: 0 } }); res.json({ success: true }); }
  catch (error) { next(error); }
};

export const listConversations = async (req, res, next) => {
  try {
    const conversations = await SupportConversation.find({ messages: { $ne: [] } })
      .populate("customer", "name email avatar").populate("assignedAdmin", "name email avatar").sort({ lastMessageAt: -1 });
    const unreadCount = conversations.reduce((total, item) => {
      const status = item.status || "waiting";
      const relevant = status === "waiting" || (status === "assigned" && item.assignedAdmin?._id?.equals(req.user._id));
      return total + (relevant && item.unreadByAdmin > 0 ? 1 : 0);
    }, 0);
    res.json({ success: true, data: conversations, unreadCount });
  } catch (error) { next(error); }
};

export const getAdminConversation = async (req, res, next) => {
  try {
    if (!validId(req.params.id)) return res.status(400).json({ success: false, message: "Mã hội thoại không hợp lệ" });
    const conversation = await SupportConversation.findById(req.params.id).populate("customer", "name email avatar").populate("assignedAdmin", "name email avatar");
    if (!conversation) return res.status(404).json({ success: false, message: "Không tìm thấy hội thoại" });
    res.json({ success: true, data: conversation });
  } catch (error) { next(error); }
};

export const sendAdminMessage = async (req, res, next) => {
  try {
    if (!validId(req.params.id)) return res.status(400).json({ success: false, message: "Yêu cầu không hợp lệ" });
    const content = cleanContent(req.body.content);
    if (!content || content.length > 2000) return res.status(400).json({ success: false, message: "Tin nhắn phải có từ 1 đến 2000 ký tự" });
    const conversation = await SupportConversation.findOneAndUpdate(
      { _id: req.params.id, status: "assigned", assignedAdmin: req.user._id },
      { $push: { messages: { sender: req.user._id, senderRole: "admin", content } }, $set: { lastMessage: content, lastMessageAt: new Date() }, $inc: { unreadByCustomer: 1 } },
      { new: true },
    );
    if (!conversation) return res.status(409).json({ success: false, message: "Bạn cần nhận xử lý hội thoại trước khi trả lời" });
    const message = conversation.messages.at(-1);
    emitUpdate(req, conversation, message);
    res.status(201).json({ success: true, data: message });
  } catch (error) { next(error); }
};

export const readAdminConversation = async (req, res, next) => {
  try { await SupportConversation.updateOne({ _id: req.params.id, assignedAdmin: req.user._id }, { $set: { unreadByAdmin: 0 } }); res.json({ success: true }); }
  catch (error) { next(error); }
};

export const claimConversation = async (req, res, next) => {
  try {
    if (!validId(req.params.id)) return res.status(400).json({ success: false, message: "Mã hội thoại không hợp lệ" });
    const conversation = await SupportConversation.findOneAndUpdate(
      { _id: req.params.id, assignedAdmin: null, status: { $in: ["waiting", null] } },
      { $set: { status: "assigned", assignedAdmin: req.user._id, assignedAt: new Date(), resolvedAt: null, unreadByAdmin: 0 } }, { new: true },
    ).populate("customer", "name email avatar").populate("assignedAdmin", "name email avatar");
    if (!conversation) return res.status(409).json({ success: false, message: "Hội thoại đã được quản trị viên khác nhận xử lý" });
    emitUpdate(req, conversation); res.json({ success: true, data: conversation });
  } catch (error) { next(error); }
};

export const releaseConversation = async (req, res, next) => {
  try {
    if (!validId(req.params.id)) return res.status(400).json({ success: false, message: "Mã hội thoại không hợp lệ" });
    const filter = { _id: req.params.id, status: "assigned" };
    if (req.user.role !== "super_admin") filter.assignedAdmin = req.user._id;
    const conversation = await SupportConversation.findOneAndUpdate(filter, { $set: { status: "waiting", assignedAdmin: null, assignedAt: null } }, { new: true });
    if (!conversation) return res.status(409).json({ success: false, message: "Bạn không phụ trách hội thoại này" });
    emitUpdate(req, conversation); res.json({ success: true, data: conversation });
  } catch (error) { next(error); }
};

export const resolveConversation = async (req, res, next) => {
  try {
    if (!validId(req.params.id)) return res.status(400).json({ success: false, message: "Mã hội thoại không hợp lệ" });
    const conversation = await SupportConversation.findOneAndUpdate(
      { _id: req.params.id, status: "assigned", assignedAdmin: req.user._id },
      { $set: { status: "resolved", resolvedAt: new Date(), unreadByAdmin: 0 } }, { new: true },
    );
    if (!conversation) return res.status(409).json({ success: false, message: "Bạn không phụ trách hội thoại này" });
    emitUpdate(req, conversation); res.json({ success: true, data: conversation });
  } catch (error) { next(error); }
};
