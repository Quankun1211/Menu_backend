import mongoose from "mongoose";

const categoryMenuSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true
    },
    slug: {
        type: String,
        required: true,
        unique: true
    },
    title: {
        type: String,
        required: true
    },
    description: {
        type: String,
        required: true
    },
    isDeleted: { type: Boolean, default: false },
})

export const CategoryMenu = mongoose.model("CategoryMenu", categoryMenuSchema)
