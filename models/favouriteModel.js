import mongoose from "mongoose";

const favouriteSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User"
    },
}, {timestamps: true})

export const Favourite = mongoose.model("Favourite", favouriteSchema)