import mongoose, { mongo } from "mongoose";

const productSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  categoryId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Category",
    // required: true
  },
  price: {
    type: Number,
    required: true
  },
  unit: {
    type: String,
    required: true
  },
  description: {
    type: String,
    required: true
  },
  images: {
    type: String,
    required: true
  },
  stock: {
    type: Number,
    required: true
  },
  salePercent: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "saleItems"
  },
  slug: {
    type: String,
    required: true,
    unique: true
  },
  soldCount: Number,
  viewCount: Number,
  favouriteCount: Number,
  region: {
    type: String,
    enum: ["bac", "trung", "nam"],
    required: true,
    index: true
  },
  nutrition: {
    calories: Number,
    protein: Number,
    fat: Number,
    carbs: Number,
  },
  usage_instruction: [String],
  isSpecialty: {
    type: Boolean,
    default: false
  },
  origin: {
    type: String,
    required: true
  },
  originDescription: {
    type: String,
  },
  originFound: {
    type: String,
  },
  story: {
    type: String,
  },
  season: {
    type: [String],
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, { timestamps: true })

productSchema.index({ slug: 1 }, { unique: true })

productSchema.index({ isActive: 1 })

productSchema.index({
  region: 1,
  isActive: 1,
  soldCount: -1
})

productSchema.index({
  isActive: 1,
  soldCount: -1,
  favouriteCount: -1
})

productSchema.index({ salePercent: 1 })

export const Product = mongoose.model("Product", productSchema)