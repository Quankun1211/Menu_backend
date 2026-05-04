import redis from "redis"

const client = redis.createClient({
    url: process.env.REDIS_URL || 'redis://localhost:6379'
});

client.on('error', (err) => console.error('Redis Client Error:', err));
client.on('connect', () => console.log('Redis Visualizing: Connecting...'));
client.on('ready', () => console.log('Redis Client Ready!'));
client.on('end', () => console.log('Redis Client Disconnected'));

export const connectRedis = async () => {
    if (!client.isOpen) {
        await client.connect();
    }
};

export const redisClient = client;