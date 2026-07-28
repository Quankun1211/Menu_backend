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

userSchema.pre("save", function capViewHistory(next) {
  if (this.viewHistory?.length > 100) {
    this.viewHistory = this.viewHistory
      .sort((left, right) => right.lastViewedAt - left.lastViewedAt)
      .slice(0, 100);
  }
  next();
});

export const User = mongoose.model("User", userSchema)
