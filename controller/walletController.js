import { Wallet } from "../models/walletSchema.js";
import { LevelReward } from "../models/levelModel.js";
import { RewardHistory } from "../models/rewardHistoryModel.js";
import { Order } from "../models/ordersModel.js";
import { UserCoupon } from "../models/userCouponModel.js";
import { Coupons } from "../models/couponsModel.js";
import mongoose from "mongoose";
import {generateRandomCode} from "../utils/helper.js"
export const processLevelUpAndRewards = async (userId, orderId, totalPrice, session) => {
    const wallet = await Wallet.findOne({ userId }).session(session);
    if (!wallet) return;

    let rewardRate = 0;
    if (totalPrice < 500000) {
        rewardRate = 0.01; 
    } else if (totalPrice < 2000000) {
        rewardRate = 0.02;
    } else {
        rewardRate = 0.03;
    }

    const earnedSeeds = Math.floor(totalPrice * rewardRate);
    if (earnedSeeds <= 0) return;

    wallet.goldSeeds += earnedSeeds;
    wallet.totalSeedsAccumulated += earnedSeeds;

    const calculatedLevel = Math.floor(Math.sqrt(wallet.totalSeedsAccumulated / 5000)) + 1;
    const newLevel = Math.min(calculatedLevel, 50);

    if (newLevel > wallet.level) {
        const oldLevel = wallet.level;
        
        for (let currentLv = oldLevel + 1; currentLv <= newLevel; currentLv++) {
            const isMilestone = [10, 20, 30, 40, 50].includes(currentLv);
            
            let reward = await LevelReward.findOne({ 
                rewardType: isMilestone ? 'milestone' : 'every_level', 
                ...(isMilestone && { milestoneLevel: currentLv })
            }).session(session);

            if (reward) {
                await RewardHistory.create([{
                    userId,
                    levelReached: currentLv,
                    rewardId: reward._id
                }], { session });
            }
        }

        wallet.level = newLevel;
        wallet.recentActivities.push({
            type: 'levelup',
            seeds: earnedSeeds,
            description: `Chúc mừng! Bạn đã thăng cấp lên Level ${newLevel}.`
        });
    } else {
        wallet.recentActivities.push({
            type: 'reward',
            seeds: earnedSeeds,
            orderId: orderId,
            description: `Tích lũy ${earnedSeeds} hạt (${(rewardRate * 100)}%) từ đơn hàng #${orderId.toString().slice(-6)}`
        });
    }

    await wallet.save({ session });
};
export const markOrderAsDelivered = async (req, res) => {
    const { orderId } = req.params;
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const order = await Order.findById(orderId).session(session);
        
        if (!order || order.status === 'delivered' || order.isSeedRewarded) {
            throw new Error("Đơn hàng không hợp lệ hoặc đã được cộng thưởng");
        }

        order.status = 'delivered';
        order.deliveredAt = new Date();
        order.isSeedRewarded = true;
        
        await processLevelUpAndRewards(order.userId, order._id, order.totalPrice, session);

        await order.save({ session });

        await session.commitTransaction();
        res.status(200).json({ success: true, message: "Xác nhận thành công & Đã trao thưởng" });
    } catch (error) {
        await session.abortTransaction();
        res.status(500).json({ success: false, message: error.message });
    } finally {
        session.endSession();
    }
};

export const getMyWallet = async (req, res) => {
    try {
        const userId = req.user.id;
        let wallet = await Wallet.findOne({ userId });
        if (!wallet) wallet = await Wallet.create({ userId });

        const currentLevel = wallet.level;
        const milestoneLevels = [10, 20, 30, 40, 50];
        const DIVIDER = 5000; 
        
        const isNewMilestone = milestoneLevels.includes(currentLevel) && 
                               wallet.lastClaimedMilestone < currentLevel;

        let milestoneReward = null;
        if (isNewMilestone) {
            milestoneReward = await LevelReward.findOne({
                rewardType: 'milestone',
                milestoneLevel: currentLevel
            });
        }

        const maxLevel = 50;
        const nextLevel = Math.min(currentLevel + 1, maxLevel);
        
        const currentLevelThreshold = Math.pow(currentLevel - 1, 2) * DIVIDER;
        const nextLevelThreshold = Math.pow(nextLevel - 1, 2) * DIVIDER;

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
        
        const milestoneLevels = [10, 20, 30, 40, 50];
        if (!milestoneLevels.includes(wallet.level)) {
            throw new Error("Cấp độ hiện tại chưa đạt mốc nhận quà");
        }
        
        if (wallet.lastClaimedMilestone >= wallet.level) {
            throw new Error("Bạn đã nhận quà cho mốc này rồi");
        }

        const rewardConfig = await LevelReward.findOne({
            rewardType: 'milestone',
            milestoneLevel: wallet.level
        }).session(session);

        if (!rewardConfig) throw new Error("Chưa có cấu hình phần thưởng cho mốc này");
        
        if (rewardConfig.bonusBalance <= 0) {
            throw new Error("Mốc này hiện chưa có phần thưởng khả dụng");
        }

        const uniqueCode = `LV${wallet.level}-${generateRandomCode()}`;
        
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

        wallet.lastClaimedMilestone = wallet.level;
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