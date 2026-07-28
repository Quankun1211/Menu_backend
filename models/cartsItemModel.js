import mongoose from "mongoose";

const cartItemsSchema = new mongoose.Schema({
    productId: {
        type: mongoose.Schema.Types.ObjectId,
        refPath: "itemType"
    },
    itemType: {
        type: String,
        enum: ["Product", "Special"],
        default: "Product",
        required: true
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

cartItemsSchema.index(
    { cartId: 1, productId: 1, itemType: 1 },
    { unique: true }
);

export const CartItems = mongoose.model("cartItems", cartItemsSchema)
