import fs from "node:fs";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import mongoose from "mongoose";
import "dotenv/config";

const execFileAsync = promisify(execFile);

const MONGO_URI = process.env.MONGO_DB_URL;

if (!MONGO_URI) {
  throw new Error("MONGO_DB_URL chưa được cấu hình trong .env");
}

const BACKUP_ROOT = path.join(
  process.cwd(),
  ".data-reset-backups"
);

async function main() {
  let connection;

  try {
    const timestamp = new Date()
      .toISOString()
      .replace(/:/g, "-");

    const backupDir = path.join(
      BACKUP_ROOT,
      timestamp
    );

    fs.mkdirSync(backupDir, {
      recursive: true,
    });

    console.log("=================================");
    console.log("MongoDB Backup");
    console.log("=================================");
    console.log("Backup directory:");
    console.log(backupDir);
    console.log("");

    connection = await mongoose.connect(MONGO_URI);

    console.log("MongoDB connected");

    const db = mongoose.connection.db;

    const collections = await db
      .listCollections()
      .toArray();

    console.log(
      `Found ${collections.length} collections`
    );

    console.log("");

    let success = 0;
    let failed = 0;

    for (const collectionInfo of collections) {
      const collectionName = collectionInfo.name;

      if (collectionName.startsWith("system.")) {
        continue;
      }

      const outputFile = path.join(
        backupDir,
        `${collectionName}.json`
      );

      console.log(
        `[BACKUP] ${collectionName}`
      );

      try {
        await execFileAsync("mongoexport", [
          `--uri=${MONGO_URI}`,
          `--collection=${collectionName}`,
          `--out=${outputFile}`,
          "--jsonArray",
        ]);

        console.log(
          `  ✓ ${collectionName}.json`
        );

        success++;
      } catch (error) {
        console.error(
          `  ✗ Failed: ${collectionName}`
        );

        console.error(
          error.stderr || error.message
        );

        failed++;
      }
    }

    console.log("");
    console.log("=================================");
    console.log("BACKUP COMPLETED");
    console.log("=================================");
    console.log(`Success : ${success}`);
    console.log(`Failed  : ${failed}`);
    console.log(`Location: ${backupDir}`);
    console.log("=================================");

  } catch (error) {
    console.error("");
    console.error("BACKUP ERROR:");
    console.error(error);

    process.exitCode = 1;

  } finally {
    if (connection) {
      await mongoose.disconnect();
      console.log("MongoDB disconnected");
    }
  }
}

main();