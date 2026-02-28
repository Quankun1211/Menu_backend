import mongoose from "mongoose";

const MenuSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true
  },
  titleBanner: {
    type: String,
    required: true
  },
  description: String,
  image: String,
  category: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'CategoryMenu'
  },
  meta: {
    servings: { type: String, default: "2-3" }, 
    cookType: { type: String, default: "Tự nấu tại nhà" }, 
    isPrepped: { type: Boolean, default: false } 
  },
  recipes: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Recipe'
  }],
  cookTime: Number,
  totalPrice: {
    type: Number,
    default: 0
  }
}, { timestamps: true });

export const Menu = mongoose.model("Menu", MenuSchema)