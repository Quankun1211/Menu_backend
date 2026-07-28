import mongoose from "mongoose";
const userCouponSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    couponId: { type: mongoose.Schema.Types.ObjectId, ref: 'Coupons', required: true },
    isUsed: { type: Boolean, default: false },
    usedAt: { type: Date },
    acquiredAt: { type: Date, default: Date.now }
});

userCouponSchema.index({ userId: 1, couponId: 1 }, { unique: true });
userCouponSchema.index({ userId: 1, isUsed: 1, acquiredAt: -1 });

export const UserCoupon = mongoose.model("UserCoupon", userCouponSchema);
