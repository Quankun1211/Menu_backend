import { redisClient } from "../config/redis.js";

/**
 * Hàm hỗ trợ lấy dữ liệu từ cache hoặc set cache mới nếu chưa có
 * @param {string} key - Khóa định danh trong Redis
 * @param {function} callback - Hàm chứa logic truy vấn Database (chỉ chạy khi cache miss)
 * @param {number} ttl - Thời gian sống của cache (mặc định 3600s = 1h)
 */
export const getOrSetCache = async (key, callback, ttl = 3600) => {
    try {
        const cachedData = await redisClient.get(key);

        if (cachedData) {
            // LOG KHI LẤY TỪ CACHE (CACHE HIT)
            console.log(`\x1b[32m[Redis] CACHE HIT:\x1b[0m Key = ${key}`);
            return JSON.parse(cachedData);
        }

        // LOG KHI KHÔNG CÓ TRONG CACHE (CACHE MISS)
        console.log(`\x1b[33m[Redis] CACHE MISS:\x1b[0m Key = ${key}. Fetching from DB...`);
        
        const freshData = await callback();

        if (freshData) {
            await redisClient.set(key, JSON.stringify(freshData), {
                EX: ttl
            });
            console.log(`\x1b[36m[Redis] CACHE SET:\x1b[0m Data stored for Key = ${key}`);
        }

        return freshData;
    } catch (error) {
        console.error("\x1b[31m[Redis] ERROR:\x1b[0m", error);
        return await callback();
    }
};
/**
 * Xóa cache theo pattern (dùng khi cập nhật dữ liệu)
 * @param {string} pattern - Ví dụ: 'categories:*'
 */
export const clearCache = async (pattern) => {
    try {
        const keys = await redisClient.keys(pattern);
        if (keys.length > 0) {
            await redisClient.del(keys);
        }
    } catch (error) {
        console.error("Clear Cache Error:", error);
    }
};