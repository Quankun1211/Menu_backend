import { Wallet } from "../models/walletSchema.js";
import { LevelReward } from "../models/levelModel.js";
import { RewardHistory } from "../models/rewardHistoryModel.js";

export const MAX_CUSTOMER_LEVEL = 50;
export const LEVEL_SEED_DIVIDER = 5000;
export const MILESTONE_LEVELS = Object.freeze([10, 20, 30, 40, 50]);

export const calculateEarnedSeeds = (totalPrice) => {
  const amount = Number(totalPrice);
  if (!Number.isFinite(amount) || amount <= 0) return 0;
  const rate = amount < 500_000 ? 0.01 : amount < 2_000_000 ? 0.02 : 0.03;
  return Math.floor(amount * rate);
};

export const calculateLevel = (totalSeeds) => Math.min(
  Math.floor(Math.sqrt(Math.max(Number(totalSeeds) || 0, 0) / LEVEL_SEED_DIVIDER)) + 1,
  MAX_CUSTOMER_LEVEL,
);

export const getClaimableMilestone = (level, lastClaimedMilestone = 0) =>
  MILESTONE_LEVELS.find(
    milestone => milestone <= level && milestone > lastClaimedMilestone,
  ) ?? null;

export const processCustomerOrderReward = async ({ userId, orderId, totalPrice, session }) => {
  const earnedSeeds = calculateEarnedSeeds(totalPrice);
  if (earnedSeeds <= 0) return { earnedSeeds: 0, levelsGained: [] };

  const wallet = await Wallet.findOneAndUpdate(
    { userId },
    { $setOnInsert: { userId } },
    { new: true, upsert: true, session, setDefaultsOnInsert: true },
  );
  const oldLevel = wallet.level;
  wallet.goldSeeds += earnedSeeds;
  wallet.totalSeedsAccumulated += earnedSeeds;
  const newLevel = calculateLevel(wallet.totalSeedsAccumulated);
  const levelsGained = [];

  for (let level = oldLevel + 1; level <= newLevel; level += 1) {
    const isMilestone = MILESTONE_LEVELS.includes(level);
    const reward = await LevelReward.findOne({
      rewardType: isMilestone ? "milestone" : "every_level",
      milestoneLevel: isMilestone ? level : null,
    }).session(session);
    if (reward) {
      await RewardHistory.updateOne(
        { userId, levelReached: level },
        { $setOnInsert: { userId, levelReached: level, rewardId: reward._id } },
        { upsert: true, session },
      );
    }
    levelsGained.push(level);
  }

  wallet.level = newLevel;
  wallet.recentActivities.push({
    type: newLevel > oldLevel ? "levelup" : "reward",
    seeds: earnedSeeds,
    orderId,
    description: newLevel > oldLevel
      ? `Tích lũy ${earnedSeeds} hạt từ đơn hàng #${orderId.toString().slice(-6)} và lên Level ${newLevel}.`
      : `Tích lũy ${earnedSeeds} hạt từ đơn hàng #${orderId.toString().slice(-6)}.`,
  });
  await wallet.save({ session });
  return { earnedSeeds, levelsGained, level: newLevel };
};
