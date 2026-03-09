import mongoose from "mongoose";

const notificationSchema = new mongoose.Schema({
  userId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true 
  },
  title: { type: String, required: true },
  body: { type: String, required: true },
  image: { type: String }, 
  
  type: { 
    type: String, 
    enum: ['ORDER_STATUS', 'PROMOTION', 'SYSTEM_UPDATE'], 
    default: 'SYSTEM_UPDATE' 
  },
  
  metadata: {
    orderId: { type: String },
    promotionCode: { type: String }
  },

  isRead: { type: Boolean, default: false }, 
  createdAt: { type: Date, default: Date.now }
});

notificationSchema.index({ userId: 1, createdAt: -1 });

export const Notification = mongoose.model('Notification', notificationSchema);