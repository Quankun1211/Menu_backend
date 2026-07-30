import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import cookieParser from "cookie-parser";
import request from "supertest";
import { authorizeRole } from "../middleware/protectRoute.js";
import { csrfProtection } from "../middleware/csrf.js";
import { validate } from "../middleware/validate.js";
import {
  adminCancelSchema,
  cancelOrderSchema,
  orderSchema,
  paginationQuery,
  shippingFeeSchema,
} from "../validation/schemas.js";
import { validateRequestEnvelope } from "../middleware/requestEnvelope.js";
import { getCsrfToken } from "../controller/authController.js";

const app = express();
app.use(express.json());
app.use(cookieParser());
app.post("/envelope", validateRequestEnvelope, (_req, res) => res.json({ ok: true }));
app.post("/mutate", csrfProtection, (_req, res) => res.json({ ok: true }));
app.post("/api/v1/auth/login", csrfProtection, (_req, res) => res.json({ ok: true }));
app.get("/auth/csrf", getCsrfToken);
app.post(
  "/admin",
  (req, _res, next) => { req.user = { role: req.get("x-test-role") || "user" }; next(); },
  authorizeRole(["admin", "super_admin"]),
  (_req, res) => res.json({ ok: true }),
);
app.post("/order", validate(orderSchema), (_req, res) => res.status(201).json({ ok: true }));
app.get("/pagination", validate(paginationQuery, "query"), (req, res) => res.json(req.query));
app.put("/shipping", validate(shippingFeeSchema), (req, res) => res.json(req.body));
app.post("/cancel", validate(cancelOrderSchema), (req, res) => res.json(req.body));
app.patch("/admin-cancel", validate(adminCancelSchema), (req, res) => res.json(req.body));

test("CSRF blocks mutation without matching cookie and header", async () => {
  const response = await request(app).post("/mutate").send({});
  assert.equal(response.status, 403);
});

test("CSRF accepts matching double-submit token", async () => {
  const response = await request(app)
    .post("/mutate")
    .set("Cookie", "csrf_token=test-token")
    .set("X-CSRF-Token", "test-token")
    .send({});
  assert.equal(response.status, 200);
});

test("CSRF allows public v1 authentication mutations", async () => {
  const response = await request(app).post("/api/v1/auth/login").send({});
  assert.equal(response.status, 200);
});

test("CSRF bootstrap endpoint returns a token and matching cookie", async () => {
  const agent = request.agent(app);
  const bootstrap = await agent.get("/auth/csrf");
  assert.equal(bootstrap.status, 200);
  const token = bootstrap.body.data.csrfToken;
  assert.match(token, /^[a-f0-9]{48}$/);
  assert.ok(bootstrap.headers["set-cookie"]?.some((cookie) => cookie.startsWith("csrf_token=")));

  const mutation = await agent
    .post("/mutate")
    .set("X-CSRF-Token", token)
    .send({});
  assert.equal(mutation.status, 200);
});

test("RBAC rejects user and accepts admin", async () => {
  assert.equal((await request(app).post("/admin").set("x-test-role", "user")).status, 403);
  assert.equal((await request(app).post("/admin").set("x-test-role", "admin")).status, 200);
});

test("order validation rejects client shippingFee and invalid quantities", async () => {
  const response = await request(app).post("/order").send({
    items: [{ productId: "507f1f77bcf86cd799439011", quantity: 0 }],
    address: "507f1f77bcf86cd799439012",
    source: "cart",
    paymentMethod: "cod",
    shippingFee: -50000,
  });
  assert.equal(response.status, 400);
});

test("order validation requires idempotency and rejects duplicate products", async () => {
  const objectId = "507f1f77bcf86cd799439011";
  const baseOrder = {
    items: [{ productId: objectId, quantity: 1 }],
    address: objectId,
    source: "cart",
    paymentMethod: "vnpay",
    platform: "web",
  };

  const missingKey = await request(app).post("/order").send(baseOrder);
  assert.equal(missingKey.status, 400);

  const duplicateItems = await request(app).post("/order").send({
    ...baseOrder,
    checkoutSessionId: "af7b92c2-7ac8-4f9a-847b-2ac433a89422",
    items: [
      { productId: objectId, quantity: 1 },
      { productId: objectId, quantity: 1 },
    ],
  });
  assert.equal(duplicateItems.status, 400);
});

test("request envelope rejects Mongo operators and excessive nesting", async () => {
  const operatorResponse = await request(app).post("/envelope").send({
    filter: { $where: "malicious" },
  });
  assert.equal(operatorResponse.status, 400);

  let nested = "value";
  for (let index = 0; index < 10; index += 1) nested = { child: nested };
  const depthResponse = await request(app).post("/envelope").send(nested);
  assert.equal(depthResponse.status, 400);
});

test("query validation converts and caps pagination", async () => {
  const valid = await request(app).get("/pagination?page=2&limit=25");
  assert.equal(valid.status, 200);
  assert.equal(valid.body.page, 2);
  assert.equal(valid.body.limit, 25);
  assert.equal((await request(app).get("/pagination?region=all&sort=newest")).status, 200);
  assert.equal((await request(app).get("/pagination?region=bac&sort=sold_desc")).status, 200);
  assert.equal((await request(app).get("/pagination?categoryId=all&page=1&limit=12")).status, 200);
  assert.equal((await request(app).get("/pagination?limit=1000")).status, 400);
});

test("shipping fee validation accepts free shipping and rejects invalid values", async () => {
  const freeShipping = await request(app).put("/shipping").send({ shippingFee: 0 });
  assert.equal(freeShipping.status, 200);
  assert.equal(freeShipping.body.shippingFee, 0);
  assert.equal((await request(app).put("/shipping").send({ shippingFee: -1 })).status, 400);
  assert.equal((await request(app).put("/shipping").send({ shippingFee: 10_000_001 })).status, 400);
});

test("customer cancellation requires a reason of at least five characters", async () => {
  assert.equal((await request(app).post("/cancel").send({ reason: "đổi" })).status, 400);
  const valid = await request(app).post("/cancel").send({ reason: "  Đặt nhầm món  " });
  assert.equal(valid.status, 200);
  assert.equal(valid.body.reason, "Đặt nhầm món");
});

test("admin cancellation accepts the same action values sent by the admin UI", async () => {
  const payload = { orderId: "507f1f77bcf86cd799439011" };
  assert.equal(
    (await request(app).patch("/admin-cancel").send({ ...payload, action: "accept" })).status,
    200,
  );
  assert.equal(
    (await request(app).patch("/admin-cancel").send({ ...payload, action: "approve" })).status,
    400,
  );
});
