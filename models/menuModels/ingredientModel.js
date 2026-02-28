import mongoose from "mongoose";

const IngredientSchema = new mongoose.Schema({
  slug: {
    type: String,
    unique: true 
  },
  customName: {
    type: String,
    required: true,
  },
  creatorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null 
  },
  price: {
    type: Number,
    default: 0
  },
  image: {
    type: String,
    default: ""
  },
  unit: {
    type: String, 
    required: true, 
  }
}, { timestamps: true });

export const Ingredient = mongoose.model("Ingredient", IngredientSchema);