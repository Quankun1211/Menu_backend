import mongoose from "mongoose";

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
    status: {
        type: String,
        enum: [
            "pending", "assigned", "confirmed", "processing", 
            "shipping", "delivered", "cancelled", "refunded",
            "pending_cancel" 
        ],
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
    paymentStatus: {
        type: String,
        enum: ['pending', 'paid', 'failed', 'refunded'],
        default: 'pending'
    },
    paidAt: {
        type: Date
    },
    shippedAt: {
        type: Date
    },
    deliveredAt: {
        type: Date
    },
    lastKnownLocation: {
        latitude: Number,
        longitude: Number
    }
}, {timestamps: true})

export const Order = mongoose.model("Order", orderSchema)