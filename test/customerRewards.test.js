import assert from "node:assert/strict";
import test from "node:test";
import {
  calculateEarnedSeeds,
  calculateLevel,
  getClaimableMilestone,
} from "../services/customerRewardService.js";

test("calculates seeds at all reward-rate boundaries", () => {
  assert.equal(calculateEarnedSeeds(0), 0);
  assert.equal(calculateEarnedSeeds(499_999), 4_999);
  assert.equal(calculateEarnedSeeds(500_000), 10_000);
  assert.equal(calculateEarnedSeeds(1_999_999), 39_999);
  assert.equal(calculateEarnedSeeds(2_000_000), 60_000);
  assert.equal(calculateEarnedSeeds(-1), 0);
  assert.equal(calculateEarnedSeeds("invalid"), 0);
});

test("calculates quadratic levels and caps level at 50", () => {
  assert.equal(calculateLevel(0), 1);
  assert.equal(calculateLevel(4_999), 1);
  assert.equal(calculateLevel(5_000), 2);
  assert.equal(calculateLevel(20_000), 3);
  assert.equal(calculateLevel(Number.MAX_SAFE_INTEGER), 50);
});

test("returns skipped milestones in ascending claim order", () => {
  assert.equal(getClaimableMilestone(9, 0), null);
  assert.equal(getClaimableMilestone(21, 0), 10);
  assert.equal(getClaimableMilestone(21, 10), 20);
  assert.equal(getClaimableMilestone(50, 40), 50);
  assert.equal(getClaimableMilestone(50, 50), null);
});
