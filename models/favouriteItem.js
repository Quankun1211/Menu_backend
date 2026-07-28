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

favouriteItemSchema.index(
    { favouriteId: 1, productId: 1 },
    { unique: true }
);
favouriteItemSchema.index({ favouriteId: 1, createdAt: -1 });

export const FavouriteItem = mongoose.model("FavouriteItem", favouriteItemSchema)
