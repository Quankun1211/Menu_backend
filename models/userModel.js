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
        minlength: 6
    },
    email: {
        type: String,
        required: true,
        trim: true,
        unique: true,
        lowercase: true
    },
    emailNeedsVerification: {
      type: Boolean,
      default: false,
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
    authProviders: [{
      _id: false,
      provider: {
        type: String,
        enum: ["google", "facebook"],
        required: true,
      },
      providerUserId: {
        type: String,
        required: true,
      },
      linkedAt: {
        type: Date,
        default: Date.now,
      },
    }],
    lastLoginAt: {
      type: Date,
    },
    isOnline: {
        type: Boolean,
        default: false
    },
    lastKnownLocation: {
      latitude: Number,
      longitude: Number,
      updatedAt: Date,
    },
    serviceAreas: [{ type: String, trim: true }],
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

userSchema.index(
  { "authProviders.provider": 1, "authProviders.providerUserId": 1 },
  { unique: true, sparse: true },
);

userSchema.pre("save", function capViewHistory() {
  if (this.viewHistory?.length > 100) {
    this.viewHistory = this.viewHistory
      .sort((left, right) => right.lastViewedAt - left.lastViewedAt)
      .slice(0, 100);
  }
});

export const User = mongoose.model("User", userSchema)
