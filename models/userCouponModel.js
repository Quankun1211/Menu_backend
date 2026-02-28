import mongoose from "mongoose";
const userCouponSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    couponId: { type: mongoose.Schema.Types.ObjectId, ref: 'Coupons', required: true },
    isUsed: { type: Boolean, default: false },
    usedAt: { type: Date },
    acquiredAt: { type: Date, default: Date.now }
});

export const UserCoupon = mongoose.model("UserCoupon", userCouponSchema);