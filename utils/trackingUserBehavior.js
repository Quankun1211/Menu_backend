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
    const cleanTargetId = (!targetId || targetId === "undefined") ? "general" : targetId;

    if (!userId || userId === "undefined") {
        console.warn("[AI] Bỏ qua trigger: userId không hợp lệ.");
        return;
    }

    const now = Date.now();
    const COOLDOWN_TIME = 30 * 1000; 

    const userHistory = userLastActionCache.get(userId);

    if (userHistory) {
        if (userHistory.lastTargetId !== cleanTargetId) {
            console.log(`[AI] Đổi sản phẩm: ${userHistory.lastTargetId} -> ${cleanTargetId}. RESET COOLDOWN.`);
        } 
        else if (now - userHistory.lastTimestamp < COOLDOWN_TIME) {
            return;
        }
    }

    const url = `https://mc-prod.onrender.com/recommend/${userId}`;
    
    try {
        userLastActionCache.set(userId, {
            lastTargetId: cleanTargetId,
            lastTimestamp: now
        });

        axios.get(url)
            .then(res => {
                console.log(`[AI] Update thành công User: ${userId} | Context: ${cleanTargetId}`);
            })
            .catch(err => {
                userLastActionCache.delete(userId);
                console.error(`[AI] Lỗi kết nối Render: ${err.message}`);
            });

    } catch (e) {
        console.error("[AI] Runtime Error:", e);
    }
};