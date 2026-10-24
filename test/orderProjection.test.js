import test from "node:test";
import assert from "node:assert/strict";
import { Order } from "../models/ordersModel.js";

test("order list projection does not collide with the hidden delivery OTP path", () => {
  const query = Order.find({}).select(
    "-currentPaymentRef -paymentRequestDate -paymentCheckAttempts -inventoryReleasedAt -soldCountCommitted -checkoutSessionId",
  );
  query._applyPaths();

  assert.equal(query._fields.deliveryVerification, undefined);
  assert.equal(query._fields["deliveryVerification.otpHash"], 0);
});
