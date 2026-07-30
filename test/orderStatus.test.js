import assert from "node:assert/strict";
import test from "node:test";
import {
  canRequestShipperCancellation,
  canShipperTransitionOrder,
  canTransitionOrder,
  isTerminalOrderStatus,
  ORDER_STATUSES,
} from "../domain/orderStatus.js";

test("order statuses include every persisted status", () => {
  assert.equal(ORDER_STATUSES.includes("completed"), true);
  assert.equal(ORDER_STATUSES.includes("pending_cancel"), true);
  assert.equal(ORDER_STATUSES.includes("payment_failed"), true);
  assert.equal(isTerminalOrderStatus("payment_failed"), false);
  assert.equal(canTransitionOrder("payment_failed", "pending"), true);
});

test("shipper can only move an assigned order through the delivery workflow", () => {
  assert.equal(canShipperTransitionOrder("assigned", "confirmed"), true);
  assert.equal(canShipperTransitionOrder("confirmed", "shipping"), true);
  assert.equal(canShipperTransitionOrder("processing", "shipping"), true);
  assert.equal(canShipperTransitionOrder("shipping", "delivered"), true);
});

test("shipper cannot skip or reverse order statuses", () => {
  assert.equal(canShipperTransitionOrder("assigned", "shipping"), false);
  assert.equal(canShipperTransitionOrder("confirmed", "delivered"), false);
  assert.equal(canShipperTransitionOrder("delivered", "shipping"), false);
  assert.equal(canShipperTransitionOrder("pending_cancel", "shipping"), false);
});

test("terminal statuses cannot be moved except into the explicit refund flow", () => {
  assert.equal(isTerminalOrderStatus("delivered"), true);
  assert.equal(canTransitionOrder("delivered", "shipping"), false);
  assert.equal(canTransitionOrder("delivered", "refunded"), true);
  assert.equal(canTransitionOrder("refunded", "pending"), false);
});

test("shipper cancellation requests are restricted to pre-pickup statuses", () => {
  assert.equal(canRequestShipperCancellation("assigned"), true);
  assert.equal(canRequestShipperCancellation("confirmed"), true);
  assert.equal(canRequestShipperCancellation("shipping"), false);
});
