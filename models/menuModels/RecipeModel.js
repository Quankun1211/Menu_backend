import mongoose from "mongoose";

const RecipeSchema = new mongoose.Schema({
  name: { type: String, required: true },
  slug: { type: String, required: true, unique: true },
  description: { type: String, required: true },
  image: String,
  category: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "CategoryRecipe",
  },
  ingredients: [{
    ingredientId: { 
      type: mongoose.Schema.Types.ObjectId, 
      required: true,
      refPath: 'ingredients.itemType' 
    },
    itemType: {
      type: String,
      required: true,
      enum: ['Product', 'Ingredient'],
      default: 'Ingredient'
    },
    quantity: { type: Number, required: true }, 
    note: String 
  }],
  additionalIngredients: [{
    name: { type: String, required: true },
    quantity: { type: String }, 
    unit: { type: String }      
  }],
  instructions: [{
    step: { type: Number, required: true }, 
    title: { type: String, required: true }, 
    description: { type: String, required: true },
  }],
  weatherTag: { 
    type: String, 
    enum: ['hot', 'cold', 'rainy', 'neutral'], 
    default: 'neutral' 
  },
  tips: {
    folkTips: [String],
    nutrition: {
      calories: Number,
      protein: Number,
      fat: Number,
      carbs: Number,
      description: String 
    }
  },
  suggestedSideDishes: {
    description: String,
    dishes: [String]
  },
  meta: {
    servings: { type: String, default: "2-3" },
    cookType: { type: String, default: "Tự nấu tại nhà" },
    isPrepped: { type: Boolean, default: false }
  },
  difficulty: {
    type: String,
    enum: ['Dễ', 'Trung bình', 'Khó'],
    default: 'Dễ'
  },
  instructionUrl: String,
  cookTime: Number,
  isSystem: {
    type: Boolean,
    default: true // Luôn mặc định là true khi tạo từ Admin
  },
  isDeleted: { type: Boolean, default: false }
}, { timestamps: true });

export const Recipe = mongoose.model("Recipe", RecipeSchema);