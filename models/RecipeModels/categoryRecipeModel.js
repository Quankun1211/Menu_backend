import mongoose from "mongoose";

const categoryRecipeSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true
    },
    slug: {
        type: String,
        required: true,
        unique: true
    },
    description: {
        type: String,
        required: true
    }
})

export const CategoryRecipe = mongoose.model("CategoryRecipe", categoryRecipeSchema)