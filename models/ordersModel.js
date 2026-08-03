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
        isAccepted: { type: Boolean, default: false },
        previousStatus: { type: String, enum: ORDER_STATUSES }
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
        enum: ["user", "admin", "system"]
    },

    address: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Address"
    },
    deliveryAddress: {
        name: { type: String, trim: true },
        phone: { type: String, trim: true },
        address: { type: String, trim: true },
        province: { type: String, trim: true },
        district: { type: String, trim: true },
        ward: { type: String, trim: true },
        latitude: Number,
        longitude: Number,
    },
    statusHistory: [{
        _id: false,
        status: { type: String, enum: ORDER_STATUSES, required: true },
        at: { type: Date, default: Date.now },
        actorId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        actorRole: {
            type: String,
            enum: ["user", "shipper", "admin", "super_admin", "system"],
            default: "system",
        },
        note: { type: String, trim: true, maxlength: 500 },
    }],
    assignment: {
        assignedAt: Date,
        expiresAt: Date,
        acceptedAt: Date,
        reassignedAt: Date,
        previousShipperId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        reassignmentReason: { type: String, trim: true, maxlength: 500 },
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
        enum: ['pending', 'checking', 'paid', 'failed', 'cancelled', 'refunded'],
        default: 'pending'
    },
    refundStatus: {
        type: String,
        enum: ['none', 'processing', 'gateway_completed', 'completed', 'failed'],
        default: 'none'
    },
    refundRequestedAt: Date,
    refundedAt: Date,
    paidAt: {
        type: Date
    },
    paymentExpiresAt: Date,
    paymentRequestDate: String,
    currentPaymentRef: String,
    paymentCheckAttempts: {
        type: Number,
        default: 0
    },
    checkoutSessionId: {
        type: String,
        trim: true
    },
    inventoryReleasedAt: Date,
    soldCountCommitted: {
        type: Boolean,
        default: false
    },
    shippedAt: {
        type: Date
    },
    deliveredAt: {
        type: Date
    },
    deliveryVerification: {
        otpHash: { type: String, select: false },
        otpExpiresAt: Date,
        verifiedAt: Date,
        proofImage: String,
        recipientName: { type: String, trim: true, maxlength: 255 },
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
orderSchema.index({ status: 1, "assignment.expiresAt": 1 });
orderSchema.index({
    paymentMethod: 1,
    paymentStatus: 1,
    paymentExpiresAt: 1,
    inventoryReleasedAt: 1
});
orderSchema.index(
    { userId: 1, checkoutSessionId: 1 },
    { unique: true, partialFilterExpression: { checkoutSessionId: { $type: "string" } } }
);

orderSchema.pre("save", function appendStatusHistory() {
    if (!this.isModified("status")) return;
    const latest = this.statusHistory?.[this.statusHistory.length - 1];
    if (latest?.status === this.status) return;
    const actor = this.$locals?.statusActor || {};
    this.statusHistory.push({
        status: this.status,
        at: new Date(),
        actorId: actor.actorId,
        actorRole: actor.actorRole || "system",
        note: actor.note,
    });
});

export const Order = mongoose.model("Order", orderSchema)
