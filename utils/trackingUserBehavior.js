import { UserBehavior } from "../models/userBehaviorModel.js";
import axios from "axios";
import { redisClient } from "../config/redis.js";
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

    const COOLDOWN_TIME = 30; 
    const cooldownKey = `ai:cooldown:${userId}`;

    try {
        const lastAction = await redisClient.get(cooldownKey);
        
        if (lastAction) {
            const history = JSON.parse(lastAction);
            if (history.lastTargetId === cleanTargetId) {
                return;
            }
            console.log(`[AI] Đổi sản phẩm: ${history.lastTargetId} -> ${cleanTargetId}. RESET COOLDOWN.`);
        }

        const url = `https://mc-prod.onrender.com/recommend/${userId}`;
        
        await redisClient.setEx(cooldownKey, COOLDOWN_TIME, JSON.stringify({
            lastTargetId: cleanTargetId,
            lastTimestamp: Date.now()
        }));

        axios.get(url)
            .then(async (res) => {
                console.log(`[AI] Update thành công User: ${userId}`);
                
                const pattern = `products:suggested:${userId}:*`;
                const keys = await redisClient.keys(pattern);
                if (keys.length > 0) {
                    await redisClient.del(keys);
                    console.log(`[AI] Đã xóa ${keys.length} cache cũ của User ${userId}`);
                }
            })
            .catch(async (err) => {
                await redisClient.del(cooldownKey);
                console.error(`[AI] Lỗi kết nối Render: ${err.message}`);
            });

    } catch (e) {
        console.error("[AI] Runtime Error:", e);
    }
};