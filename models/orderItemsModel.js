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
