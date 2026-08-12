import { Wallet } from "../models/walletSchema.js";
import { LevelReward } from "../models/levelModel.js";
import { RewardHistory } from "../models/rewardHistoryModel.js";
import { UserCoupon } from "../models/userCouponModel.js";
import { Coupons } from "../models/couponsModel.js";
import mongoose from "mongoose";
import {generateRandomCode} from "../utils/helper.js"
import {
    LEVEL_SEED_DIVIDER,
    MAX_CUSTOMER_LEVEL,
    getClaimableMilestone,
} from "../services/customerRewardService.js";
export const getMyWallet = async (req, res) => {
    try {
        const userId = req.user.id;
        let wallet = await Wallet.findOne({ userId });
        if (!wallet) wallet = await Wallet.create({ userId });

        const currentLevel = wallet.level;
        const claimableMilestone = getClaimableMilestone(currentLevel, wallet.lastClaimedMilestone);
        const isNewMilestone = Boolean(claimableMilestone);

        let milestoneReward = null;
        if (isNewMilestone) {
            milestoneReward = await LevelReward.findOne({
                rewardType: 'milestone',
                milestoneLevel: claimableMilestone
            });
        }

        const maxLevel = MAX_CUSTOMER_LEVEL;
        const nextLevel = Math.min(currentLevel + 1, maxLevel);
        
        const currentLevelThreshold = Math.pow(currentLevel - 1, 2) * LEVEL_SEED_DIVIDER;
        const nextLevelThreshold = Math.pow(nextLevel - 1, 2) * LEVEL_SEED_DIVIDER;

        const seedsToNextLevel = currentLevel >= maxLevel 
            ? 0 
            : Math.max(nextLevelThreshold - wallet.totalSeedsAccumulated, 0);

        let progressPercentage = 100;
        if (currentLevel < maxLevel) {
            const range = nextLevelThreshold - currentLevelThreshold;
            const currentProgress = wallet.totalSeedsAccumulated - currentLevelThreshold;
            progressPercentage = Math.min(Math.max((currentProgress / range) * 100, 0), 100);
        }

        res.status(200).json({
            success: true,
            data: {
                ...wallet._doc,
                hasUnclaimedReward: isNewMilestone && milestoneReward?.bonusBalance > 0,
                milestoneReward,
                seedsToNextLevel,
                progressPercentage: parseFloat(progressPercentage.toFixed(2))
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

export const giftVoucherToUser = async (userId, voucherId, session) => {
    const coupon = await Coupons.findById(voucherId).session(session);
    if (!coupon) return;

    if (coupon.isPrivate) {
        await Coupons.findByIdAndUpdate(
            voucherId,
            { $addToSet: { allowedUsers: userId } },
            { session }
        );
    }

    await UserCoupon.create([{
        userId,
        couponId: voucherId,
        isUsed: false,
        acquiredAt: new Date()
    }], { session });
};

export const getMyCoupons = async (req, res) => {
    try {
        const userId = req.user.id;
        const myCoupons = await UserCoupon.find({ userId, isUsed: false })
            .populate('couponId')
            .sort({ acquiredAt: -1 });

        const activeCoupons = myCoupons.filter(item => {
            const cp = item.couponId;
            return cp && cp.isActive && new Date(cp.endDate) > new Date();
        });

        res.status(200).json({ success: true, data: activeCoupons });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

export const claimMilestoneReward = async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
        const userId = req.user.id;
        const wallet = await Wallet.findOne({ userId }).session(session);

        if (!wallet) throw new Error("Không tìm thấy ví người dùng");
        
        const claimableMilestone = getClaimableMilestone(wallet.level, wallet.lastClaimedMilestone);
        if (!claimableMilestone) {
            throw new Error("Cấp độ hiện tại chưa đạt mốc nhận quà");
        }

        const rewardConfig = await LevelReward.findOne({
            rewardType: 'milestone',
            milestoneLevel: claimableMilestone
        }).session(session);

        if (!rewardConfig) throw new Error("Chưa có cấu hình phần thưởng cho mốc này");
        
        if (rewardConfig.bonusBalance <= 0) {
            throw new Error("Mốc này hiện chưa có phần thưởng khả dụng");
        }

        const uniqueCode = `LV${claimableMilestone}-${generateRandomCode()}`;
        
        const newCouponArray = await Coupons.create([{
            code: uniqueCode,
            type: 'fixed', 
            value: rewardConfig.bonusBalance, 
            description: `Voucher quà tặng thăng cấp: ${rewardConfig.description}`,
            usageLimit: 1,
            userLimit: 1,
            minOrderValue: 0, 
            startDate: new Date(),
            endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
            isPrivate: true,
            allowedUsers: [userId],
            isActive: true
        }], { session });

        const newCoupon = newCouponArray[0];

        await UserCoupon.create([{
            userId,
            couponId: newCoupon._id,
            isUsed: false,
            acquiredAt: new Date()
        }], { session });

        wallet.lastClaimedMilestone = claimableMilestone;
        await RewardHistory.updateOne(
            { userId, levelReached: claimableMilestone },
            { $set: { claimedAt: new Date() } },
            { session }
        );
        wallet.recentActivities.push({
            type: 'reward',
            description: `Đã nhận Voucher ${rewardConfig.bonusBalance.toLocaleString()}đ từ mốc ${rewardConfig.description}`
        });

        await wallet.save({ session });

        await session.commitTransaction();
        res.status(200).json({ 
            success: true, 
            message: `Chúc mừng! Bạn đã nhận được Voucher ${rewardConfig.bonusBalance.toLocaleString()}đ`,
            data: {
                code: uniqueCode,
                description: rewardConfig.description
            }
        });
    } catch (error) {
        await session.abortTransaction();
        res.status(500).json({ success: false, message: error.message });
    } finally {
        session.endSession();
    }
};
