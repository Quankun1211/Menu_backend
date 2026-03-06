import mongoose from "mongoose";

const categorySchema = new mongoose.Schema({
    name: {
        type: String,
        required: true
    },
    slug: {
        type: String,
        required: true,
        unique: true
    },
    image: {
        type: String,
        default: null
    },
    icon: {
        type: String,
    },
    isDeleted: { type: Boolean, default: false },
})

export const Category = mongoose.model("Category", categorySchema)
