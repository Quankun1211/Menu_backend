import test from "node:test";
import assert from "node:assert/strict";
import { securityHeaders } from "../middleware/security.js";

test("securityHeaders sets baseline browser protections", () => {
  const headers = {};
  const res = { setHeader: (name, value) => { headers[name] = value; } };
  let continued = false;
  securityHeaders({}, res, () => { continued = true; });
  assert.equal(headers["X-Content-Type-Options"], "nosniff");
  assert.equal(headers["X-Frame-Options"], "DENY");
  assert.equal(continued, true);
});
