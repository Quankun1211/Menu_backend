import mongoose from "mongoose";

const userBehaviorSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  guestId: { type: String, default: null },
  action: { type: String, enum: ['view', 'add_to_cart', 'order', 'view_recipe', 'order'] },
  targetId: { type: mongoose.Schema.Types.ObjectId }, 
  targetType: { type: String, enum: ['Product', 'Recipe', 'Menu', 'Order'] },
  weight: { type: Number, default: 1 } 
}, { timestamps: true });

export const UserBehavior = mongoose.model('userBehavior', userBehaviorSchema);
