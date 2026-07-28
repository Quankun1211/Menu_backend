import mongoose from "mongoose";

const authSessionSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  familyId: { type: String, required: true, index: true },
  tokenHash: { type: String, required: true, unique: true },
  expiresAt: { type: Date, required: true, index: { expires: 0 } },
  cleanupAt: { type: Date, index: { expires: 0 } },
  revokedAt: Date,
  replacedByHash: String,
  userAgent: String,
  ipAddress: String,
}, { timestamps: true });

export const AuthSession = mongoose.model("AuthSession", authSessionSchema);
