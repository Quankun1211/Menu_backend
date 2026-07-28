import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import mongoose from "mongoose";
import slugify from "slugify";

const apply = process.argv.includes("--apply");
const report = {
  mode: apply ? "apply" : "dry-run",
  startedAt: new Date().toISOString(),
  checks: [],
  backfills: {},
  indexesCreated: [],
  indexesDropped: [],
  collectionsDropped: [],
  collectionsSkipped: [],
};

const indexSpecs = [
  ["orders", { userId: 1, status: 1, createdAt: -1 }, {}],
  ["orders", { shipperId: 1, status: 1, updatedAt: -1 }, {}],
  ["orders", { status: 1, createdAt: -1 }, {}],
  ["orders", { paymentMethod: 1, paymentStatus: 1, paymentExpiresAt: 1, inventoryReleasedAt: 1 }, {}],
  ["orderitems", { orderId: 1 }, {}],
  ["carts", { userId: 1 }, { unique: true }],
  ["cartitems", { cartId: 1, productId: 1, itemType: 1 }, { unique: true }],
  ["favourites", { userId: 1 }, { unique: true }],
  ["favouriteitems", { favouriteId: 1, productId: 1 }, { unique: true }],
  ["favouriteitems", { favouriteId: 1, createdAt: -1 }, {}],
  ["usercoupons", { userId: 1, couponId: 1 }, { unique: true }],
  ["usercoupons", { userId: 1, isUsed: 1, acquiredAt: -1 }, {}],
  ["rewardhistories", { userId: 1, levelReached: 1 }, { unique: true }],
  ["levelrewards", { rewardType: 1, milestoneLevel: 1 }, { unique: true }],
  ["notifications", { userId: 1, isRead: 1 }, {}],
  ["saleitems", { startDate: 1, endDate: 1 }, {}],
  ["menus", { slug: 1 }, { unique: true }],
  ["userbehaviors", { userId: 1, createdAt: -1 }, {}],
  ["userbehaviors", { guestId: 1, createdAt: -1 }, {}],
  ["userbehaviors", { targetType: 1, targetId: 1, action: 1, createdAt: -1 }, {}],
  ["authsessions", { cleanupAt: 1 }, { expireAfterSeconds: 0 }],
];

const uniqueChecks = [
  ["carts", ["userId"]],
  ["cartitems", ["cartId", "productId", "itemType"]],
  ["favourites", ["userId"]],
  ["favouriteitems", ["favouriteId", "productId"]],
  ["usercoupons", ["userId", "couponId"]],
  ["rewardhistories", ["userId", "levelReached"]],
  ["levelrewards", ["rewardType", "milestoneLevel"]],
];

const staleIndexes = [
  ["saleitems", "isActive_1"],
  ["users", "viewHistory.categoryId_1"],
  ["users", "viewHistory.lastViewedAt_-1"],
  ["ingredients", "customName_1"],
];

const deadCollections = [
  "comments",
  "nutritiontags",
  "saletags",
  "stories",
  "devicetokens",
  "refunds",
];

const indexName = (key) =>
  Object.entries(key).map(([field, direction]) => `${field}_${direction}`).join("_");

const findDuplicates = async (collection, fields) => {
  const id = Object.fromEntries(fields.map((field) => [field, `$${field}`]));
  return collection.aggregate([
    { $group: { _id: id, count: { $sum: 1 } } },
    { $match: { count: { $gt: 1 } } },
    { $limit: 5 },
  ]).toArray();
};

if (!process.env.MONGO_DB_URL) throw new Error("MONGO_DB_URL is required");
await mongoose.connect(process.env.MONGO_DB_URL);

try {
  const db = mongoose.connection.db;
  const existingNames = new Set(
    (await db.listCollections({}, { nameOnly: true }).toArray()).map(({ name }) => name),
  );

  for (const [name, fields] of uniqueChecks) {
    if (!existingNames.has(name)) continue;
    const duplicates = await findDuplicates(db.collection(name), fields);
    report.checks.push({ collection: name, fields, duplicateGroups: duplicates.length });
    if (duplicates.length) {
      throw new Error(`Cannot create unique index on ${name}: duplicate data exists`);
    }
  }

  if (existingNames.has("menus")) {
    const menus = await db.collection("menus").find({
      $or: [{ slug: { $exists: false } }, { slug: null }, { slug: "" }],
    }).project({ _id: 1, title: 1 }).toArray();
    report.backfills.menuSlugs = menus.length;
    if (apply) {
      const reserved = new Set(
        (await db.collection("menus").find({ slug: { $type: "string", $ne: "" } })
          .project({ slug: 1 }).toArray()).map(({ slug }) => slug),
      );
      for (const menu of menus) {
        const base = slugify(menu.title || `menu-${menu._id}`, {
          lower: true,
          strict: true,
          locale: "vi",
        }) || `menu-${menu._id}`;
        let slug = base;
        if (reserved.has(slug)) slug = `${base}-${menu._id.toString().slice(-6)}`;
        reserved.add(slug);
        await db.collection("menus").updateOne({ _id: menu._id }, { $set: { slug } });
      }
    }
  }

  if (existingNames.has("authsessions")) {
    const cleanupAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const revokedWithoutCleanup = await db.collection("authsessions").countDocuments({
      revokedAt: { $ne: null },
      cleanupAt: { $exists: false },
    });
    report.backfills.revokedSessionCleanup = revokedWithoutCleanup;
    if (apply && revokedWithoutCleanup) {
      await db.collection("authsessions").updateMany(
        { revokedAt: { $ne: null }, cleanupAt: { $exists: false } },
        { $set: { cleanupAt } },
      );
    }
  }

  if (apply) {
    for (const [name, key, options] of indexSpecs) {
      if (!existingNames.has(name)) continue;
      const created = await db.collection(name).createIndex(key, options);
      report.indexesCreated.push({ collection: name, index: created });
    }

    for (const [name, nameToDrop] of staleIndexes) {
      if (!existingNames.has(name)) continue;
      const indexes = await db.collection(name).indexes();
      if (indexes.some((index) => index.name === nameToDrop)) {
        await db.collection(name).dropIndex(nameToDrop);
        report.indexesDropped.push({ collection: name, index: nameToDrop });
      }
    }

    for (const name of deadCollections) {
      if (!existingNames.has(name)) continue;
      const count = await db.collection(name).estimatedDocumentCount();
      if (count === 0) {
        await db.collection(name).drop();
        report.collectionsDropped.push(name);
      } else {
        report.collectionsSkipped.push({ name, count, reason: "not_empty" });
      }
    }
  } else {
    report.indexesCreated = indexSpecs.map(([collection, key]) => ({
      collection,
      index: indexName(key),
      planned: true,
    }));
  }

  report.completedAt = new Date().toISOString();
  const reportPath = path.resolve(`db-optimization-${apply ? "apply" : "dry-run"}.json`);
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  console.log(`Report: ${reportPath}`);
} finally {
  await mongoose.disconnect();
}
