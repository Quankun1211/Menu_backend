import mongoose from "mongoose";

const cartSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User"
    },
}, {timestamps: true})

export const Cart = mongoose.model("Cart", cartSchema)