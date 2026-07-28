import mongoose from "mongoose";

const userBehaviorSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  guestId: { type: String, default: null },
  action: {
    type: String,
    enum: [
      'view', 'view_recipe', 'view_category', 'view_region', 'search',
      'add_to_cart', 'update_cart', 'remove_from_cart',
      'favourite', 'unfavourite', 'order', 'cancel'
    ],
    required: true
  },
  targetId: { type: mongoose.Schema.Types.ObjectId },
  queryText: { type: String, trim: true, maxlength: 300 },
  targetType: { type: String, enum: ['Product', 'Recipe', 'Menu', 'Order'] },
  weight: { type: Number, default: 1 },
  context: { type: mongoose.Schema.Types.Mixed, default: {} }
}, { timestamps: true });

userBehaviorSchema.index({ userId: 1, createdAt: -1 });
userBehaviorSchema.index({ guestId: 1, createdAt: -1 });
userBehaviorSchema.index({ targetType: 1, targetId: 1, action: 1, createdAt: -1 });

export const UserBehavior = mongoose.model('userBehavior', userBehaviorSchema);
