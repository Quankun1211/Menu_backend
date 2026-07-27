import mongoose from "mongoose";

const systemSettingSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true, trim: true },
  value: { type: mongoose.Schema.Types.Mixed, required: true },
  description: String,
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
}, { timestamps: true });

export const SystemSetting = mongoose.model("SystemSetting", systemSettingSchema);
