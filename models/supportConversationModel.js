import mongoose from "mongoose";

const supportMessageSchema = new mongoose.Schema({
  sender: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  senderRole: { type: String, enum: ["user", "admin"], required: true },
  content: { type: String, required: true, trim: true, maxlength: 2000 },
}, { timestamps: true });

const supportConversationSchema = new mongoose.Schema({
  customer: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, unique: true },
  messages: { type: [supportMessageSchema], default: [] },
  lastMessage: { type: String, default: "" },
  lastMessageAt: { type: Date, default: Date.now },
  unreadByAdmin: { type: Number, default: 0, min: 0 },
  unreadByCustomer: { type: Number, default: 0, min: 0 },
  status: { type: String, enum: ["waiting", "assigned", "resolved"], default: "waiting", index: true },
  assignedAdmin: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null, index: true },
  assignedAt: { type: Date, default: null },
  resolvedAt: { type: Date, default: null },
}, { timestamps: true });

supportConversationSchema.index({ lastMessageAt: -1 });

export const SupportConversation = mongoose.model("SupportConversation", supportConversationSchema);
