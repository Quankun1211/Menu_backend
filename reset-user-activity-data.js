import "dotenv/config";
import fs from "node:fs/promises";
import path from "node:path";
import { EJSON } from "bson";
import mongoose from "mongoose";

const shouldApply = process.argv.includes("--apply");

if (!process.env.MONGO_DB_URL) {
  throw new Error("MONGO_DB_URL is required");
}

const COLLECTIONS_TO_CLEAR = [
  "addresses",
  "authsessions",
  "cartitems",
  "carts",
  "favouriteitems",
  "favourites",
  "ingredients",
  "notifications",
  "orderitems",
  "orders",
  "paymentattempts",
  "rewardhistories",
  "transactions",
  "userbehaviors",
  "usercoupons",
  "userrecipes",
  "wallets",
];
const MUTATED_COLLECTIONS = ["users", "products", "specials", "coupons"];
const BACKUP_ROOT = path.resolve(".data-reset-backups");
const timestampForPath = () => new Date().toISOString().replaceAll(":", "-");

const getExistingCollectionNames = async (db) => {
  const collections = await db.listCollections({}, { nameOnly: true }).toArray();
  return new Set(collections.map(({ name }) => name));
};

const countCollections = async (db, names, existingNames) => Object.fromEntries(
  await Promise.all(names.map(async (name) => [
    name,
    existingNames.has(name) ? await db.collection(name).countDocuments() : 0,
  ])),
);

const backupCollections = async (db, names, existingNames) => {
  const backupDirectory = path.join(BACKUP_ROOT, timestampForPath());
  await fs.mkdir(backupDirectory, { recursive: true });

  for (const name of names) {
    if (!existingNames.has(name)) continue;
    const documents = await db.collection(name).find({}).toArray();
    await fs.writeFile(
      path.join(backupDirectory, `${name}.json`),
      EJSON.stringify(documents, { relaxed: false, indent: 2 }),
      "utf8",
    );
  }

  await fs.writeFile(
    path.join(backupDirectory, "manifest.json"),
    JSON.stringify({
      createdAt: new Date().toISOString(),
      database: db.databaseName,
      clearedCollections: COLLECTIONS_TO_CLEAR,
      mutatedCollections: MUTATED_COLLECTIONS,
    }, null, 2),
    "utf8",
  );
  return backupDirectory;
};

const buildInventoryRestoration = async (db, existingNames) => {
  if (!existingNames.has("orders") || !existingNames.has("orderitems")) return [];

  return db.collection("orderitems").aggregate([
    {
      $lookup: {
        from: "orders",
        localField: "orderId",
        foreignField: "_id",
        as: "order",
      },
    },
    { $unwind: "$order" },
    {
      $match: {
        "order.inventoryReleasedAt": { $eq: null },
        itemType: { $in: ["Product", "Special"] },
      },
    },
    {
      $group: {
        _id: { itemType: "$itemType", productId: "$productId" },
        stockToRestore: { $sum: "$quantity" },
        soldCountToRestore: {
          $sum: {
            $cond: [{ $eq: ["$order.soldCountCommitted", true] }, "$quantity", 0],
          },
        },
      },
    },
  ]).toArray();
};

await mongoose.connect(process.env.MONGO_DB_URL);

try {
  const db = mongoose.connection.db;
  const existingNames = await getExistingCollectionNames(db);
  const inventoryRestoration = await buildInventoryRestoration(db, existingNames);
  const countsBefore = await countCollections(db, COLLECTIONS_TO_CLEAR, existingNames);

  if (!shouldApply) {
    console.log(JSON.stringify({
      mode: "dry-run",
      database: db.databaseName,
      collectionsFound: [...existingNames].sort(),
      documentsToDelete: countsBefore,
      inventoryRecordsToRestore: inventoryRestoration.length,
      userFieldsToReset: ["viewHistory", "savedRecipes", "isOnline", "lastLoginAt"],
      productFieldsToReset: ["soldCount", "viewCount", "favouriteCount"],
      couponFieldsToReset: ["usedCount"],
      nextCommand: "node reset-user-activity-data.js --apply",
    }, null, 2));
  } else {
    const backupDirectory = await backupCollections(
      db,
      [...new Set([...COLLECTIONS_TO_CLEAR, ...MUTATED_COLLECTIONS])],
      existingNames,
    );
    const session = await mongoose.startSession();

    try {
      await session.withTransaction(async () => {
        for (const restoration of inventoryRestoration) {
          const collectionName = restoration._id.itemType === "Special"
            ? "specials"
            : "products";
          await db.collection(collectionName).updateOne(
            { _id: restoration._id.productId },
            {
              $inc: {
                stock: restoration.stockToRestore,
                soldCount: -restoration.soldCountToRestore,
              },
            },
            { session },
          );
        }

        if (existingNames.has("users")) {
          await db.collection("users").updateMany(
            {},
            {
              $set: {
                viewHistory: [],
                savedRecipes: [],
                isOnline: false,
                lastLoginAt: null,
              },
            },
            { session },
          );
        }

        for (const collectionName of ["products", "specials"]) {
          if (!existingNames.has(collectionName)) continue;
          await db.collection(collectionName).updateMany(
            {},
            { $set: { soldCount: 0, viewCount: 0, favouriteCount: 0 } },
            { session },
          );
        }

        if (existingNames.has("coupons")) {
          await db.collection("coupons").updateMany(
            {},
            { $set: { usedCount: 0 } },
            { session },
          );
        }

        for (const collectionName of COLLECTIONS_TO_CLEAR) {
          if (!existingNames.has(collectionName)) continue;
          await db.collection(collectionName).deleteMany({}, { session });
        }
      });
    } finally {
      await session.endSession();
    }

    console.log(JSON.stringify({
      mode: "applied",
      database: db.databaseName,
      backupDirectory,
      documentsBefore: countsBefore,
      documentsAfter: await countCollections(db, COLLECTIONS_TO_CLEAR, existingNames),
      inventoryRecordsRestored: inventoryRestoration.length,
    }, null, 2));
  }
} finally {
  await mongoose.disconnect();
}
