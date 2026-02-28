import mongoose from "mongoose";

const favouriteItemSchema = new mongoose.Schema({
    productId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Product"
    },
    favouriteId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Favourite"
    },
}, {timestamps: true})

export const FavouriteItem = mongoose.model("FavouriteItem", favouriteItemSchema)