import mongoose from "mongoose";

const UserRecipeSchema = new mongoose.Schema({
  name: { type: String, required: true },
  image: String,
  ingredients: [{
    name: { type: String, required: true },
    quantity: { type: String } 
  }],
  instructions: [{
    step: { type: Number },
    description: { type: String, required: true }
  }],
  cookTime: Number, 
  owner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
  familyNotes: {
    type: String
  }
}, { timestamps: true });

export const UserRecipe = mongoose.model("UserRecipe", UserRecipeSchema);