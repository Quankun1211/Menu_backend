import { createClient } from "redis";
import "dotenv/config";

const client = createClient({
  url: process.env.REDIS_URL,
});

client.on("error", (err) => {
  console.error("Redis Error:", err);
});

async function main() {
  try {
    await client.connect();

    console.log("Redis connected");

    await client.flushAll();

    console.log("Redis cache cleared");

  } catch (error) {
    console.error("ERROR:", error);
  } finally {
    await client.quit();
  }
}

main();