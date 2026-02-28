import mongoose from "mongoose";

const couponSchema = new mongoose.Schema({
    code: {
        type: String,
        required: true,
        unique: true,
        uppercase: true,
        trim: true
    },
    type: {
        type: String,
        enum: ['percentage', 'fixed'],
        required: true
    },
    value: {
        type: Number,
        required: true
    },
    maxDiscount: {
        type: Number,
        default: 0 
    },
    minOrderValue: {
        type: Number,
        default: 0
    },
    applicableProducts: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Product'
    }],
    applicableCategories: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Category'
    }],
    usageLimit: {
        type: Number,
        required: true
    },
    usedCount: {
        type: Number,
        default: 0
    },
    userLimit: {
        type: Number,
        default: 1 
    },
    startDate: {
        type: Date,
        required: true
    },
    endDate: {
        type: Date,
        required: true
    },
    isPrivate: { 
        type: Boolean, 
        default: false 
    },
    allowedUsers: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }],
    isActive: {
        type: Boolean,
        default: true
    },
}, { timestamps: true });

export const Coupons = mongoose.model("Coupons", couponSchema)