import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import mongoose from "mongoose";
import slugify from "slugify";
import { Category } from "./models/categoriesModel.js";
import { Product } from "./models/productsModel.js";
import { SaleItem } from "./models/saleItemModel.js";
import { Ingredient } from "./models/menuModels/ingredientModel.js";
import { CategoryRecipe } from "./models/RecipeModels/categoryRecipeModel.js";
import { Recipe } from "./models/menuModels/RecipeModel.js";
import { CategoryMenu } from "./models/menuModels/categoryMenuModel.js";
import { Menu } from "./models/menuModels/menuModel.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const seedSource = fs.readFileSync(path.join(__dirname, "seed.js"), "utf8");
const slug = (value) => slugify(value, { lower: true, strict: true, locale: "vi" });

function section(start, end) {
  const startIndex = seedSource.indexOf(start);
  const endIndex = seedSource.indexOf(end, startIndex);
  if (startIndex === -1 || endIndex === -1) {
    throw new Error(`Cannot read seed identifiers between "${start}" and "${end}"`);
  }
  return seedSource.slice(startIndex + start.length, endIndex);
}

function quotedValues(source) {
  return [...source.matchAll(/"([^"]+)"/g)].map((match) => match[1]);
}

function productNames() {
  const source = section("const productGroups = {", "const ingredientNames = [");
  return [...source.matchAll(/\["([^"]+)",\s*"[^"]+"\]/g)].map((match) => match[1]);
}

const seededProductNames = productNames();
const seededProductSlugs = seededProductNames.map(slug);
const seededIngredientNames = quotedValues(
  section("const ingredientNames = [", "const recipeCategoryNames = ["),
);
const seededCategoryNames = quotedValues(
  section("const categoryNames = [", "const productGroups = {"),
);
const seededRecipeCategoryNames = quotedValues(
  section("const recipeCategoryNames = [", "const menuCategoryNames = ["),
);
const seededMenuCategoryNames = quotedValues(
  section("const menuCategoryNames = [", "const menuNames = ["),
);
const seededMenuNames = quotedValues(
  section("const menuNames = [", "function cookingInstructions"),
);
const promotionBaseDate = new Date("2026-01-01T00:00:00.000Z");
const promotionEndDate = new Date("2027-12-31T23:59:59.000Z");
const promotionFilters = Array.from({ length: 15 }, (_, index) => ({
  percent: [10, 15, 20, 25, 30, 35, 40][index % 7],
  startDate: new Date(promotionBaseDate.getTime() + index * 7 * 86400000),
  endDate: promotionEndDate,
}));

async function buildTargets(session) {
  const products = await Product.find(
    { slug: { $in: seededProductSlugs } },
    { _id: 1, name: 1, slug: 1 },
    { session },
  ).lean();
  const productIds = products.map((item) => item._id);

  return {
    menus: { title: { $in: seededMenuNames } },
    recipes: {
      slug: { $in: seededProductNames.map((name) => slug(`Cách làm ${name}`)) },
      isSystem: true,
    },
    ingredients: {
      slug: { $in: seededIngredientNames.map(slug) },
      creatorId: null,
    },
    products: { _id: { $in: productIds } },
    categoryMenus: { slug: { $in: seededMenuCategoryNames.map(slug) } },
    categoryRecipes: { slug: { $in: seededRecipeCategoryNames.map(slug) } },
    categories: { slug: { $in: seededCategoryNames.map(slug) } },
    promotions: { $or: promotionFilters },
  };
}

async function countTargets(targets, session) {
  return {
    menus: await Menu.countDocuments(targets.menus).session(session),
    recipes: await Recipe.countDocuments(targets.recipes).session(session),
    ingredients: await Ingredient.countDocuments(targets.ingredients).session(session),
    products: await Product.countDocuments(targets.products).session(session),
    categoryMenus: await CategoryMenu.countDocuments(targets.categoryMenus).session(session),
    categoryRecipes: await CategoryRecipe.countDocuments(targets.categoryRecipes).session(session),
    categories: await Category.countDocuments(targets.categories).session(session),
    promotions: await SaleItem.countDocuments(targets.promotions).session(session),
  };
}

async function removeTargets(targets, session) {
  const options = { session };
  const results = {};

  results.menus = (await Menu.deleteMany(targets.menus, options)).deletedCount;
  results.recipes = (await Recipe.deleteMany(targets.recipes, options)).deletedCount;
  results.ingredients = (await Ingredient.deleteMany(targets.ingredients, options)).deletedCount;
  results.products = (await Product.deleteMany(targets.products, options)).deletedCount;
  results.categoryMenus = (await CategoryMenu.deleteMany(targets.categoryMenus, options)).deletedCount;
  results.categoryRecipes = (await CategoryRecipe.deleteMany(targets.categoryRecipes, options)).deletedCount;
  results.categories = (await Category.deleteMany(targets.categories, options)).deletedCount;
  results.promotions = (await SaleItem.deleteMany(targets.promotions, options)).deletedCount;

  return results;
}

async function rollback() {
  if (!process.env.MONGO_DB_URL) throw new Error("MONGO_DB_URL is required");

  const shouldApply = process.argv.includes("--apply");
  await mongoose.connect(process.env.MONGO_DB_URL);

  const session = await mongoose.startSession();
  try {
    if (!shouldApply) {
      const targets = await buildTargets(null);
      const counts = await countTargets(targets, null);
      console.log("DRY RUN - no data was deleted.");
      console.table(counts);
      console.log("Review the counts, then run: node rollback-seed.js --apply");
      return;
    }

    let deletedCounts;
    await session.withTransaction(async () => {
      const targets = await buildTargets(session);
      const beforeCounts = await countTargets(targets, session);
      console.log("Deleting these seeded documents:");
      console.table(beforeCounts);
      deletedCounts = await removeTargets(targets, session);
    });

    console.log("Rollback completed:");
    console.table(deletedCounts);
  } finally {
    await session.endSession();
  }
}

rollback()
  .catch((error) => {
    console.error("Rollback failed; transaction was aborted:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
