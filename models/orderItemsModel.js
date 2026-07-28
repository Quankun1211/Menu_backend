import mongoose from "mongoose";

const orderItemSchema = new mongoose.Schema({
    orderId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Order",
        required: true
    },
    productId: {
        type: mongoose.Schema.Types.ObjectId,
        refPath: "itemType",
        required: true
    },
    itemType: {
        type: String,
        enum: ["Product", "Special"],
        default: "Product",
        required: true
    },
    productName: {
        type: String,
        required: true
    },
    // Snapshot fields keep historical orders usable if a product changes or is removed.
    productImage: {
        type: String,
        default: ""
    },
    productUnit: {
        type: String,
        default: ""
    },
    originalPrice: {
        type: Number
    },
    salePercent: {
        type: Number,
        default: 0
    },
    price: {
        type: Number,
        required: true
    },
    quantity: {
        type: Number,
        required: true,
        min: 1
    }
}, {timestamps: true})

export const OrderItem = mongoose.model("OrderItem", orderItemSchema)
