import { redisClient } from "../config/redis.js";

const pendingInvalidationPatterns = new Set();
const inFlightCacheLoads = new Map();

const flushPendingInvalidations = async () => {
    if (!redisClient.isReady || pendingInvalidationPatterns.size === 0) return;
    const patterns = [...pendingInvalidationPatterns];
    pendingInvalidationPatterns.clear();
    await clearCache(patterns);
};

redisClient.on("ready", () => {
    void flushPendingInvalidations();
});

/**
 * @param {string} key - Khóa định danh trong Redis
 * @param {function} callback - Hàm chứa logic truy vấn Database (chỉ chạy khi cache miss)
 * @param {number} ttl - Thời gian sống của cache (mặc định 3600s = 1h)
 */
export const getOrSetCache = async (key, callback, ttl = 3600) => {
    if (redisClient.isReady) {
        try {
            const cachedData = await redisClient.get(key);
            if (cachedData !== null) return JSON.parse(cachedData);
        } catch (error) {
            console.error("Redis cache read failed:", error.message);
        }
    }

    if (inFlightCacheLoads.has(key)) return inFlightCacheLoads.get(key);

    const loadPromise = (async () => {
        const freshData = await callback();

        if (freshData !== null && freshData !== undefined && redisClient.isReady) {
            try {
                const ttlWithJitter = ttl + Math.floor(Math.random() * Math.max(1, ttl * 0.1));
                await redisClient.set(key, JSON.stringify(freshData), { EX: ttlWithJitter });
            } catch (error) {
                console.error("Redis cache write failed:", error.message);
            }
        }

        return freshData;
    })();

    inFlightCacheLoads.set(key, loadPromise);
    try {
        return await loadPromise;
    } finally {
        if (inFlightCacheLoads.get(key) === loadPromise) inFlightCacheLoads.delete(key);
    }
};
/**
 * Xóa cache theo pattern (dùng khi cập nhật dữ liệu)
 * @param {string|string[]} pattern *'
 */
export const clearCache = async (pattern) => {
    const patterns = Array.isArray(pattern) ? pattern : [pattern];
    if (!redisClient.isReady) {
        patterns.forEach((item) => pendingInvalidationPatterns.add(item));
        return 0;
    }
    try {
        let deletedCount = 0;

        for (const currentPattern of patterns) {
            for await (const result of redisClient.scanIterator({
                MATCH: currentPattern,
                COUNT: 100,
            })) {
                const keys = Array.isArray(result) ? result : [result];
                if (keys.length > 0) {
                    deletedCount += await redisClient.unlink(keys);
                }
            }
        }

        return deletedCount;
    } catch (error) {
        console.error("Clear Cache Error:", error);
        patterns.forEach((item) => pendingInvalidationPatterns.add(item));
        return 0;
    }
};
