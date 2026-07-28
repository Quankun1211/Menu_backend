import mongoose from "mongoose";

const WalletSchema = new mongoose.Schema({
  userId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true, 
    unique: true 
  },
  balance: { 
    type: Number, 
    default: 0,
    min: 0
  },
  goldSeeds: { 
    type: Number, 
    default: 0,
    min: 0 
  },
  totalSeedsAccumulated: { 
    type: Number, 
    default: 0 
  },
  level: {
    type: Number,
    default: 1
  },
  status: { 
    type: String, 
    enum: ['active', 'locked'], 
    default: 'active' 
  },
  recentActivities: [{
    type: { 
      type: String, 
      enum: ['deposit', 'withdraw', 'reward', 'purchase', 'refund', 'levelup'] 
    },
    amount: Number, 
    seeds: Number,  
    description: String,
    orderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Order' },
    createdAt: { type: Date, default: Date.now }
  }],
  lastClaimedMilestone: {
    type: Number,
    default: 0
  }
}, { timestamps: true });

WalletSchema.pre("save", function capRecentActivities(next) {
  if (this.recentActivities?.length > 100) {
    this.recentActivities = this.recentActivities.slice(-100);
  }
  next();
});

export const Wallet = mongoose.model('Wallet', WalletSchema);
