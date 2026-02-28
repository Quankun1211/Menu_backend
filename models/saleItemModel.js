import mongoose from "mongoose";

const saleItemSchema = new mongoose.Schema({
    percent: {
        type: Number,
        required: true,
        min: 1,
        max: 90
    },
    startDate: {
        type: Date,
        required: true
    },
    endDate: {
        type: Date,
        required: true
    }
}, {timestamps: true})

saleItemSchema.index({ percent: -1 })
saleItemSchema.index({ isActive: 1 })

export const SaleItem = mongoose.model("saleItems", saleItemSchema)