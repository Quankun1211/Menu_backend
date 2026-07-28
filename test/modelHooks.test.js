import assert from "node:assert/strict";
import test from "node:test";
import { User } from "../models/userModel.js";
import { Wallet } from "../models/walletSchema.js";

const runSaveHooks = (document) =>
  document.constructor.schema.s.hooks.execPre("save", document, []);

test("user save hook supports Mongoose 9 and caps view history", async () => {
  const user = new User({
    name: "Hook Test",
    username: "hook-test",
    email: "hook-test@example.com",
    password: "123456",
    viewHistory: Array.from({ length: 105 }, (_, index) => ({
      lastViewedAt: new Date(Date.now() - index * 1000),
    })),
  });

  await runSaveHooks(user);
  assert.equal(user.viewHistory.length, 100);
});

test("wallet save hook supports Mongoose 9 and keeps recent activities bounded", async () => {
  const wallet = new Wallet({
    userId: "507f1f77bcf86cd799439011",
    recentActivities: Array.from({ length: 105 }, (_, index) => ({
      type: "reward",
      seeds: index,
    })),
  });

  await runSaveHooks(wallet);
  assert.equal(wallet.recentActivities.length, 100);
  assert.equal(wallet.recentActivities[0].seeds, 5);
});
