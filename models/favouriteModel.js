import mongoose from "mongoose";

const favouriteSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User"
    },
}, {timestamps: true})

favouriteSchema.index({ userId: 1 }, { unique: true });

export const Favourite = mongoose.model("Favourite", favouriteSchema)
