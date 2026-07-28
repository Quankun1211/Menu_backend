import mongoose from "mongoose";

const cartSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User"
    },
}, {timestamps: true})

cartSchema.index({ userId: 1 }, { unique: true });

export const Cart = mongoose.model("Cart", cartSchema)
