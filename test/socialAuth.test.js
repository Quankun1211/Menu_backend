import test from "node:test";
import assert from "node:assert/strict";
import { User } from "../models/userModel.js";
import { socialLoginSchema } from "../validation/schemas.js";

test("social login validation accepts provider tokens and rejects short input", () => {
  const accepted = socialLoginSchema.validate({
    token: "a".repeat(40),
    clientType: "spa",
  });
  assert.equal(accepted.error, undefined);

  const rejected = socialLoginSchema.validate({ token: "too-short" });
  assert.ok(rejected.error);
});

test("social users can be valid without a local password", async () => {
  const user = new User({
    name: "Social User",
    username: "socialuser",
    email: "social@example.com",
    isVerified: true,
    authProviders: [{
      provider: "google",
      providerUserId: "google-subject-123",
    }],
  });

  await user.validate();
  assert.equal(user.password, undefined);
  assert.equal(user.authProviders[0].provider, "google");
});

test("social identity requires a supported provider and provider user id", async () => {
  const user = new User({
    name: "Invalid Social User",
    username: "invalidsocial",
    email: "invalid-social@example.com",
    isVerified: true,
    authProviders: [{ provider: "unsupported" }],
  });

  await assert.rejects(user.validate());
});
