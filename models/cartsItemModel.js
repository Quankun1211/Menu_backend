import mongoose from "mongoose";

const cartItemsSchema = new mongoose.Schema({
    productId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Product"
    },
    cartId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Cart"
    },
    quantity: {
        type: Number,
        required: true
    }
}, {timestamps: true})

export const CartItems = mongoose.model("cartItems", cartItemsSchema)