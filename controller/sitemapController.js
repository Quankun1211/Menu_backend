import { Product } from "../models/productsModel.js";
import { Special } from "../models/specialModel.js";
import { Menu } from "../models/menuModels/menuModel.js";
import { Recipe } from "../models/menuModels/RecipeModel.js";

const escapeXml = (value) => String(value)
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;")
  .replaceAll("'", "&apos;");

export const dynamicSitemap = async (_req, res) => {
  const base = (process.env.WEB_URL || "http://localhost:5173").replace(/\/$/, "");
  const [products, specials, menus, recipes] = await Promise.all([
    Product.find({ isActive: true }).select("slug updatedAt").lean(),
    Special.find({ isActive: true }).select("slug updatedAt").lean(),
    Menu.find({ isDeleted: false }).select("slug updatedAt").lean(),
    Recipe.find({ isDeleted: false }).select("slug updatedAt").lean(),
  ]);
  const staticPaths = ["/", "/explore/product", "/explore/special", "/explore/menu", "/explore/recipe", "/sale"];
  const dynamic = [
    ...products.map((item) => [`/explore/product-detail/${item.slug}`, item.updatedAt]),
    ...specials.map((item) => [`/explore/special-detail/${item.slug}`, item.updatedAt]),
    ...menus.map((item) => [`/explore/menu-detail/${item.slug}`, item.updatedAt]),
    ...recipes.map((item) => [`/explore/recipe-detail/${item.slug}`, item.updatedAt]),
  ];
  const urls = [
    ...staticPaths.map((path) => [path, null]),
    ...dynamic,
  ].map(([path, updatedAt]) => (
    `<url><loc>${escapeXml(`${base}${path}`)}</loc>${updatedAt ? `<lastmod>${new Date(updatedAt).toISOString()}</lastmod>` : ""}</url>`
  )).join("");
  res.type("application/xml").send(`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls}</urlset>`);
};
