import "dotenv/config";
import mongoose from "mongoose";

if (!process.env.MONGO_DB_URL) {
  throw new Error("MONGO_DB_URL is required");
}

await mongoose.connect(process.env.MONGO_DB_URL);

try {
  const db = mongoose.connection.db;
  const orders = db.collection("orders");
  const paymentAttempts = db.collection("paymentattempts");

  const backfill = await orders.updateMany(
    {
      soldCountCommitted: { $exists: false },
      inventoryReleasedAt: null,
      status: { $nin: ["cancelled", "payment_failed"] },
    },
    { $set: { soldCountCommitted: true } },
  );

  await orders.createIndex(
    { userId: 1, checkoutSessionId: 1 },
    {
      name: "userId_1_checkoutSessionId_1",
      unique: true,
      partialFilterExpression: { checkoutSessionId: { $type: "string" } },
    },
  );
  await orders.createIndex(
    {
      paymentMethod: 1,
      paymentStatus: 1,
      paymentExpiresAt: 1,
      inventoryReleasedAt: 1,
    },
    {},
  );
  await paymentAttempts.createIndex(
    { attemptRef: 1 },
    { name: "attemptRef_1", unique: true },
  );
  await paymentAttempts.createIndex(
    { orderId: 1, createdAt: -1 },
    { name: "orderId_1_createdAt_-1" },
  );
  await paymentAttempts.createIndex(
    { status: 1 },
    { name: "status_1" },
  );

  console.log(JSON.stringify({
    success: true,
    soldCountOrdersBackfilled: backfill.modifiedCount,
  }, null, 2));
} finally {
  await mongoose.disconnect();
}
