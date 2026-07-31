import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import addressRoutes from "../routes/addressRoutes.js";
import adminRoutes from "../routes/adminRoutes.js";
import authRoutes from "../routes/authRoutes.js";
import cartRoutes from "../routes/cartRoutes.js";
import categoryRoutes from "../routes/categoryRoutes.js";
import chatbotRoutes from "../routes/chatbotRoutes.js";
import configRoutes from "../routes/configRoutes.js";
import couponRoutes from "../routes/couponRoutes.js";
import favouriteRoutes from "../routes/favouriteRoutes.js";
import notificationRoutes from "../routes/notificationRoutes.js";
import orderRoutes from "../routes/orderRoutes.js";
import productRoutes from "../routes/productRoutes.js";
import saleRoutes from "../routes/saleRoutes.js";
import shipperRoutes from "../routes/shipperRoutes.js";
import specialRoutes from "../routes/specialRoutes.js";
import userRoutes from "../routes/userRoutes.js";
import userRecipeRoutes from "../routes/userRecipeRoutes.js";
import categoryMenuRoutes from "../routes/menuRoutes/categoryMenuRoutes.js";
import ingredientRoutes from "../routes/menuRoutes/ingredientRoutes.js";
import menuRoutes from "../routes/menuRoutes/menuRoutes.js";
import recipeRoutes from "../routes/menuRoutes/recipeRoutes.js";
import {
  checkoutPreviewV1Routes,
  currentUserV1Routes,
  walletV1Routes,
} from "../routes/v1UtilityRoutes.js";

const v1Routers = {
  addresses: addressRoutes,
  admin: adminRoutes,
  auth: authRoutes,
  cart: cartRoutes,
  categories: categoryRoutes,
  chatbot: chatbotRoutes,
  settings: configRoutes,
  coupons: couponRoutes,
  favourites: favouriteRoutes,
  notifications: notificationRoutes,
  orders: orderRoutes,
  products: productRoutes,
  sales: saleRoutes,
  shippers: shipperRoutes,
  specials: specialRoutes,
  users: userRoutes,
  userRecipes: userRecipeRoutes,
  menuCategories: categoryMenuRoutes,
  ingredients: ingredientRoutes,
  menus: menuRoutes,
  recipes: recipeRoutes,
  checkoutPreviews: checkoutPreviewV1Routes,
  currentUser: currentUserV1Routes,
  wallets: walletV1Routes,
};

const actionSegment = /(^|\/)(get|create|update|delete|add|remove|send|read|claim|apply|assign|process|approve|request|ask|login|logout|register|verify|resend)(-|\/|$)/i;

test("v1 routers expose only resource-oriented paths", () => {
  for (const [name, router] of Object.entries(v1Routers)) {
    const paths = router.stack
      .filter((layer) => layer.route)
      .map((layer) => layer.route.path);

    for (const routePath of paths) {
      assert.equal(Array.isArray(routePath), false, `${name} still exposes legacy path aliases`);
      assert.doesNotMatch(routePath, actionSegment, `${name} exposes action-style route ${routePath}`);
    }
  }
});

test("server keeps no unversioned business API mounts", async () => {
  const source = await fs.readFile(new URL("../server.js", import.meta.url), "utf8");
  const unversionedMounts = [...source.matchAll(/app\.use\("(\/api\/(?!v1)[^"]+)"/g)]
    .map((match) => match[1]);

  assert.deepEqual(unversionedMounts, ["/api/order"]);
});
