import mongoose from "mongoose";

const specialSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
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
    required: true,
    min: 0
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
  soldCount: { type: Number, default: 0, min: 0 },
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
  origin: {
    type: String,
    required: true
  },
  originDescription: {
    type: String,
    required: true
  },
  originFound: {
    type: String,
    required: true
  },
  story: {
    type: String,
    required: true
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, { timestamps: true })

// specialSchema.index({ slug: 1 }, { unique: true })

specialSchema.index({ isActive: 1 })

specialSchema.index({
  region: 1,
  isActive: 1,
  soldCount: -1
})

specialSchema.index({
  isActive: 1,
  soldCount: -1,
  favouriteCount: -1
})

specialSchema.index({ salePercent: 1 })

export const Special = mongoose.model("Special", specialSchema)
