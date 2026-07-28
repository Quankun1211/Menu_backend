import mongoose from "mongoose";
import { ORDER_STATUSES } from "../domain/orderStatus.js";

const orderSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User"
    },
    shipperId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        default: null
    },
    subTotal: {
        type: Number,
        required: true
    },
    couponCode: {
        type: String
    },
    couponDiscount: {
        type: Number,
        default: 0
    },
    totalPrice: {
        type: Number,
        required: true
    },
    shippingFee: {
        type: Number,
        required: true,
        min: 0,
        default: 25000
    },
    status: {
        type: String,
        enum: ORDER_STATUSES,
        default: "pending"
    },
    cancelRequest: {
        reason: { type: String }, 
        requestedAt: { type: Date },
        adminNote: { type: String },
        isAccepted: { type: Boolean, default: false }
    },
    cancelReason: {
        type: String,
        trim: true,
        maxlength: 255
    },

    cancelledAt: {
        type: Date
    },

    cancelledBy: {
        type: String,
        enum: ["user", "admin"]
    },

    address: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Address"
    },
    paymentMethod: {
        type: String,
        enum: ['cod', 'vnpay', 'momo', 'stripe', 'wallet'],
        default: 'cod'
    },
    source: {
        type: String,
        enum: ["cart", "buy_now", "menu", "recipe"],
        default: "cart"
    },
    paymentStatus: {
        type: String,
        enum: ['pending', 'paid', 'failed', 'refunded'],
        default: 'pending'
    },
    paidAt: {
        type: Date
    },
    paymentExpiresAt: Date,
    inventoryReleasedAt: Date,
    shippedAt: {
        type: Date
    },
    deliveredAt: {
        type: Date
    },
    isSeedRewarded: {
        type: Boolean,
        default: false
    },
    lastKnownLocation: {
        latitude: Number,
        longitude: Number
    }
}, {timestamps: true})

orderSchema.index({ userId: 1, status: 1, createdAt: -1 });
orderSchema.index({ shipperId: 1, status: 1, updatedAt: -1 });
orderSchema.index({ status: 1, createdAt: -1 });
orderSchema.index({
    paymentMethod: 1,
    paymentStatus: 1,
    paymentExpiresAt: 1,
    inventoryReleasedAt: 1
});

export const Order = mongoose.model("Order", orderSchema)
