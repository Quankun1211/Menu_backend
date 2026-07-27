import mongoose from "mongoose";

const userSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true
    },
    username: {
        type: String,
        required: true,
        trim: true,
        unique: true,
        lowercase: true
    },
    password: {
        type: String,
        required: true,
        minlength: 6
    },
    email: {
        type: String,
        required: true,
        trim: true,
        unique: true,
        lowercase: true
    },
    phone: {
      type: String,
    },
    role: {
        type: String,
        enum: ["user", "shipper", "admin", "super_admin"],
        default: "user"
    }, 
    avatar: {
        type: String,
    },
    isOnline: {
        type: Boolean,
        default: false
    },
    viewHistory: [
    {
      categoryId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Category",
        index: true,
      },
      viewCount: {
        type: Number,
        default: 1,
      },
      lastViewedAt: {
        type: Date,
        default: Date.now,
      },
    },
  ],
  savedRecipes: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: "Recipe"
  }],
  isVerified: { 
    type: Boolean, 
    default: false 
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {timestamps: true})

userSchema.index({ "viewHistory.lastViewedAt": -1 });

export const User = mongoose.model("User", userSchema)
