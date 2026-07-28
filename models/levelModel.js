import mongoose from "mongoose";
const LevelRewardSchema = new mongoose.Schema({
  rewardType: {
    type: String,
    enum: ['every_level', 'milestone'],
    required: true
  },
  milestoneLevel: {
    type: Number,
    default: null
  },
  voucherId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Coupons'
  },
  bonusBalance: {
    type: Number,
    default: 0
  },
  description: String
});

LevelRewardSchema.index({ rewardType: 1, milestoneLevel: 1 }, { unique: true });

export const LevelReward = mongoose.model('LevelReward', LevelRewardSchema);
