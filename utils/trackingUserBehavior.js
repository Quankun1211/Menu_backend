import { UserBehavior } from "../models/userBehaviorModel.js";
import axios from "axios";
export const trackBehavior = (action, targetType) => {
  return async (req, res, next) => {
    next(); 

    try {
      const userId = req.user?._id;
      const guestId = req.headers['x-guest-id'] || req.ip;

      const targetId = 
        req.params?.orderId || 
        req.params?.id || 
        req.params?.recipeId || 
        req.query?.q || 
        req.body?.productId || 
        req.body?.items?.[0]?.productId || 
        req.body?.orderId;

      if (targetId) {
        const behaviorData = {
          action,
          targetId: String(targetId),
          targetType,
          weight: action === 'order' ? 5 : (action === 'search' ? 2 : 1)
        };

        if (userId) {
          behaviorData.userId = userId;
        } else {
          behaviorData.guestId = guestId;
        }

        await UserBehavior.create(behaviorData);
      }
    } catch (error) {
      console.error("ML Tracking Error (Silent):", error.message);
    }
  };
};

const userLastActionCache = new Map();

export const triggerAIUpdate = async (userId, targetId = "general") => {
    if (!userId) return;

    const now = Date.now();
    const COOLDOWN_TIME = 30 * 1000; 

    const userHistory = userLastActionCache.get(userId);

    if (userHistory) {
        if (userHistory.lastTargetId !== targetId) {
            console.log(`[AI] Phát hiện đổi sản phẩm: ${userHistory.lastTargetId} -> ${targetId}. RESET COOLDOWN.`);
        } 
        else if (now - userHistory.lastTimestamp < COOLDOWN_TIME) {
            console.log(`[AI] Cooldown ACTIVE cho cùng sản phẩm ${targetId}. Bỏ qua.`);
            return;
        }
    }

    const url = `http://localhost:8000/recommend/${userId}`;

    try {
        userLastActionCache.set(userId, {
            lastTargetId: targetId,
            lastTimestamp: now
        });

        axios.get(url)
            .then(res => console.log(`[AI] Cập nhật thành công cho User: ${userId} với context: ${targetId}`))
            .catch(err => {
                userLastActionCache.delete(userId);
                console.error(`[AI] Lỗi kết nối: ${err.message}`);
            });

    } catch (e) {
        console.error("[AI] Runtime Error:", e);
    }
};