import mongoose from "mongoose";
const deviceTokenSchema = new mongoose.Schema({
  userId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true 
  },
  token: { type: String, required: true }, 
  platform: { type: String, enum: ['ios', 'android'] }, 
  lastUsed: { type: Date, default: Date.now }
});

deviceTokenSchema.index({ userId: 1, token: 1 }, { unique: true });

export const DeviceToken = mongoose.model('DeviceToken', deviceTokenSchema);