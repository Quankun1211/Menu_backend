import mongoose from "mongoose";

const userSchema = new mongoose.Schema({
    name: {
        type: String,
        require: true
    },
    username: {
        type: String,
        require: true
    },
    password: {
        type: String,
        require: true,
        minlength: 6
    },
    email: {
        type: String,
        require: true
    },
    phone: {
      type: String,
    },
    role: {
        type: String,
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
  otp: { 
    type: String 
  },
  otpExpires: { 
    type: Date 
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {timestamps: true})

userSchema.index({ "viewHistory.categoryId": 1 });
userSchema.index({ "viewHistory.lastViewedAt": -1 });

export const User = mongoose.model("User", userSchema)