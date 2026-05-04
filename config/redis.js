import redis from "redis"

const client = redis.createClient({
    url: process.env.REDIS_URL || 'redis://localhost:6379',
    socket: {
        tls: process.env.REDIS_URL?.startsWith('rediss://') ? true : false,
        reconnectStrategy: (retries) => Math.min(retries * 100, 3000)
    }
});

client.on('error', (err) => console.error('Redis Client Error:', err));
client.on('connect', () => console.log('Redis Visualizing: Connecting...'));
client.on('ready', () => console.log('Redis Client Ready!'));
console.log("Redis Target URL:", process.env.REDIS_URL ? "Upstash Cloud" : "Localhost");

export const connectRedis = async () => {
    try {
        if (!client.isOpen) {
            await client.connect();
        }
    } catch (err) {
        console.error("Could not connect to Redis:", err);
    }
};

export const redisClient = client;