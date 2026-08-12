import mongoose from "mongoose";

const RewardHistorySchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  levelReached: { type: Number, required: true },
  rewardId: { type: mongoose.Schema.Types.ObjectId, ref: 'LevelReward' },
  receivedAt: { type: Date, default: Date.now },
  claimedAt: { type: Date, default: null }
});

RewardHistorySchema.index({ userId: 1, levelReached: 1 }, { unique: true });

export const RewardHistory = mongoose.model('RewardHistory', RewardHistorySchema);
