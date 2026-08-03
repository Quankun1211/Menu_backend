import assert from "node:assert/strict";
import test from "node:test";
import { Order } from "../models/ordersModel.js";
import { createDeliveryOtp, verifyDeliveryOtp } from "../utils/deliveryVerification.js";

const runSaveHooks = (document) =>
  document.constructor.schema.s.hooks.execPre("save", document, []);

test("order status changes append an auditable history entry", async () => {
  process.env.JWT_SECRET ||= "test-secret";
  const order = new Order({
    userId: "507f1f77bcf86cd799439011",
    subTotal: 100000,
    totalPrice: 125000,
    shippingFee: 25000,
    status: "assigned",
  });
  order.$locals.statusActor = {
    actorId: "507f191e810c19729de860ea",
    actorRole: "admin",
    note: "Test assignment",
  };
  await runSaveHooks(order);
  assert.equal(order.statusHistory.at(-1).status, "assigned");
  assert.equal(order.statusHistory.at(-1).actorRole, "admin");
  assert.equal(order.statusHistory.at(-1).note, "Test assignment");
});

test("delivery OTP accepts only the generated six-digit code", () => {
  process.env.JWT_SECRET ||= "test-secret";
  const otp = createDeliveryOtp();
  assert.match(otp.code, /^\d{6}$/);
  assert.equal(verifyDeliveryOtp(otp.code, otp.otpHash), true);
  assert.equal(verifyDeliveryOtp("000000", otp.otpHash), false);
});
