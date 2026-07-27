import "dotenv/config";
import mongoose from "mongoose";
import slugify from "slugify";
import { Category } from "./models/categoriesModel.js";
import { Product } from "./models/productsModel.js";
import { Special } from "./models/specialModel.js";
import { CategoryRecipe } from "./models/RecipeModels/categoryRecipeModel.js";
import { Recipe } from "./models/menuModels/RecipeModel.js";
import { CategoryMenu } from "./models/menuModels/categoryMenuModel.js";
import { Menu } from "./models/menuModels/menuModel.js";

const toSlug = (value) => slugify(value, { lower: true, strict: true, locale: "vi" });
const imageUrl = (name) =>
  `https://images.unsplash.com/photo-1547592180-85f173990554?auto=format&fit=crop&w=1200&q=80&dish=${encodeURIComponent(name)}`;

const productCategories = [
  "Rau củ, trái cây",
  "Gạo & Nông sản",
  "Gia vị",
  "Thịt & Chăn nuôi",
  "Thủy hải sản",
];

const products = [
  { name: "Rau muống hữu cơ", category: "Rau củ, trái cây", region: "bac", price: 22000, origin: "Hà Nội" },
  { name: "Cải ngọt VietGAP", category: "Rau củ, trái cây", region: "nam", price: 28000, origin: "Lâm Đồng" },
  { name: "Cà chua Đà Lạt", category: "Rau củ, trái cây", region: "trung", price: 35000, origin: "Lâm Đồng" },
  { name: "Bưởi da xanh Bến Tre", category: "Rau củ, trái cây", region: "nam", price: 75000, origin: "Bến Tre" },
  { name: "Gạo ST25 Sóc Trăng", category: "Gạo & Nông sản", region: "nam", price: 185000, origin: "Sóc Trăng" },
  { name: "Gạo tám thơm Hải Hậu", category: "Gạo & Nông sản", region: "bac", price: 165000, origin: "Nam Định" },
  { name: "Nếp cái hoa vàng", category: "Gạo & Nông sản", region: "bac", price: 68000, origin: "Hải Dương" },
  { name: "Đậu xanh cà vỏ", category: "Gạo & Nông sản", region: "trung", price: 52000, origin: "Nghệ An" },
  { name: "Nước mắm nhĩ Phú Quốc", category: "Gia vị", region: "nam", price: 95000, origin: "Phú Quốc" },
  { name: "Tiêu đen Chư Sê", category: "Gia vị", region: "trung", price: 78000, origin: "Gia Lai" },
  { name: "Quế thanh Trà My", category: "Gia vị", region: "trung", price: 65000, origin: "Quảng Nam" },
  { name: "Mắm tôm Hậu Lộc", category: "Gia vị", region: "bac", price: 45000, origin: "Thanh Hóa" },
  { name: "Thịt ba chỉ heo", category: "Thịt & Chăn nuôi", region: "nam", price: 145000, origin: "Đồng Nai" },
  { name: "Bắp bò tươi", category: "Thịt & Chăn nuôi", region: "bac", price: 245000, origin: "Hòa Bình" },
  { name: "Gà ta thả vườn", category: "Thịt & Chăn nuôi", region: "trung", price: 175000, origin: "Quảng Nam" },
  { name: "Trứng gà ta", category: "Thịt & Chăn nuôi", region: "bac", price: 48000, origin: "Bắc Giang" },
  { name: "Tôm sú Cà Mau", category: "Thủy hải sản", region: "nam", price: 285000, origin: "Cà Mau" },
  { name: "Cá lóc đồng", category: "Thủy hải sản", region: "nam", price: 125000, origin: "An Giang" },
  { name: "Mực lá Phan Thiết", category: "Thủy hải sản", region: "trung", price: 265000, origin: "Bình Thuận" },
  { name: "Cá thu một nắng", category: "Thủy hải sản", region: "trung", price: 225000, origin: "Đà Nẵng" },
];

const specialties = [
  { name: "Chả cá Lã Vọng", region: "bac", price: 185000, origin: "Hà Nội" },
  { name: "Cá kho làng Vũ Đại", region: "bac", price: 295000, origin: "Hà Nam" },
  { name: "Bánh đa cua Hải Phòng", region: "bac", price: 70000, origin: "Hải Phòng" },
  { name: "Chả mực Hạ Long", region: "bac", price: 260000, origin: "Quảng Ninh" },
  { name: "Thịt trâu gác bếp", region: "bac", price: 420000, origin: "Tây Bắc" },
  { name: "Nem nắm Giao Thủy", region: "bac", price: 125000, origin: "Nam Định" },
  { name: "Bánh cáy làng Nguyễn", region: "bac", price: 85000, origin: "Thái Bình" },
  { name: "Cao lầu Hội An", region: "trung", price: 75000, origin: "Hội An" },
  { name: "Cơm hến Huế", region: "trung", price: 50000, origin: "Thừa Thiên Huế" },
  { name: "Nem lụi Huế", region: "trung", price: 95000, origin: "Thừa Thiên Huế" },
  { name: "Bánh bột lọc Huế", region: "trung", price: 70000, origin: "Thừa Thiên Huế" },
  { name: "Tré Bình Định", region: "trung", price: 115000, origin: "Bình Định" },
  { name: "Bê thui Cầu Mống", region: "trung", price: 210000, origin: "Quảng Nam" },
  { name: "Mực một nắng Phan Thiết", region: "trung", price: 390000, origin: "Bình Thuận" },
  { name: "Bánh pía Sóc Trăng", region: "nam", price: 105000, origin: "Sóc Trăng" },
  { name: "Nem Lai Vung", region: "nam", price: 95000, origin: "Đồng Tháp" },
  { name: "Bánh tét lá cẩm", region: "nam", price: 145000, origin: "Cần Thơ" },
  { name: "Khô cá lóc miền Tây", region: "nam", price: 230000, origin: "An Giang" },
  { name: "Lạp xưởng tươi Cần Đước", region: "nam", price: 195000, origin: "Long An" },
  { name: "Mắm châu đốc", region: "nam", price: 155000, origin: "An Giang" },
];

const recipeCategories = [
  {
    name: "Công thức miền Bắc",
    description: "Công thức món Bắc thanh vị, chú trọng nước dùng trong và hương gia vị cân bằng.",
  },
  {
    name: "Công thức miền Trung",
    description: "Công thức món Trung đậm đà, cay thơm và giàu bản sắc địa phương.",
  },
  {
    name: "Công thức miền Nam",
    description: "Công thức món Nam hài hòa vị ngọt, béo và nguyên liệu miệt vườn.",
  },
];

const menuCategories = [
  {
    name: "Thực đơn gia đình",
    title: "Mâm cơm Việt mỗi ngày",
    description: "Thực đơn cân đối cho bữa cơm gia đình từ hai đến sáu người.",
  },
  {
    name: "Thực đơn vùng miền",
    title: "Hương vị ba miền",
    description: "Thực đơn kết hợp các món tiêu biểu của miền Bắc, miền Trung và miền Nam.",
  },
  {
    name: "Thực đơn tiệc Việt",
    title: "Tiệc Việt sum vầy",
    description: "Thực đơn chỉn chu dành cho cuối tuần, sinh nhật và các dịp đoàn viên.",
  },
];

const recipeNames = [
  "Phở bò tái Hà Nội", "Phở gà ta", "Bún chả Hà Nội", "Bún riêu cua đồng",
  "Bánh cuốn chả quế", "Cá kho làng Vũ Đại", "Bún bò Huế giò heo",
  "Mì Quảng tôm thịt", "Cơm gà Hội An", "Bánh canh cá lóc",
  "Bánh xèo tôm nhảy", "Nem lụi Huế", "Cơm tấm sườn bì chả",
  "Hủ tiếu Nam Vang", "Bún thịt nướng chả giò", "Bò kho bánh mì",
  "Cá kho tộ", "Canh chua cá lóc", "Gỏi cuốn tôm thịt", "Lẩu mắm miền Tây",
];

const recipeDetails = {
  "Phở bò tái Hà Nội": ["xương bò", "thịt bò tái", "bánh phở", "hành tây", "gừng nướng", "quế hồi"],
  "Phở gà ta": ["gà ta", "bánh phở", "hành tây", "gừng", "hành lá", "rau mùi"],
  "Bún chả Hà Nội": ["thịt ba chỉ", "thịt nạc vai", "bún tươi", "đu đủ xanh", "cà rốt", "rau sống"],
  "Bún riêu cua đồng": ["cua đồng", "bún tươi", "cà chua", "đậu hũ", "mắm tôm", "rau muống"],
  "Bánh cuốn chả quế": ["bột gạo", "thịt heo xay", "mộc nhĩ", "hành tím", "chả quế", "rau thơm"],
  "Cá kho làng Vũ Đại": ["cá trắm", "thịt ba chỉ", "riềng", "gừng", "nước mắm", "nước cốt chanh"],
  "Bún bò Huế giò heo": ["bắp bò", "giò heo", "bún sợi lớn", "sả", "mắm ruốc", "ớt sa tế"],
  "Mì Quảng tôm thịt": ["mì Quảng", "tôm", "thịt ba chỉ", "trứng cút", "đậu phộng", "rau sống"],
  "Cơm gà Hội An": ["gà ta", "gạo", "nghệ", "hành tây", "rau răm", "đu đủ xanh"],
  "Bánh canh cá lóc": ["cá lóc", "bánh canh", "hành tím", "nghệ", "rau răm", "ớt"],
  "Bánh xèo tôm nhảy": ["bột gạo", "tôm đất", "thịt ba chỉ", "giá đỗ", "hành lá", "rau sống"],
  "Nem lụi Huế": ["thịt heo xay", "sả cây", "đậu phộng", "gan heo", "bánh tráng", "rau sống"],
  "Cơm tấm sườn bì chả": ["gạo tấm", "sườn cốt lết", "bì heo", "trứng", "mộc nhĩ", "đồ chua"],
  "Hủ tiếu Nam Vang": ["hủ tiếu", "xương heo", "thịt heo", "tôm", "trứng cút", "hẹ"],
  "Bún thịt nướng chả giò": ["bún tươi", "thịt nạc vai", "chả giò", "sả", "đậu phộng", "rau sống"],
  "Bò kho bánh mì": ["bắp bò", "cà rốt", "sả", "gừng", "hoa hồi", "bánh mì"],
  "Cá kho tộ": ["cá basa", "nước dừa", "hành tím", "nước mắm", "tiêu", "ớt"],
  "Canh chua cá lóc": ["cá lóc", "me", "thơm", "cà chua", "bạc hà", "giá đỗ"],
  "Gỏi cuốn tôm thịt": ["tôm", "thịt ba chỉ", "bánh tráng", "bún", "hẹ", "rau sống"],
  "Lẩu mắm miền Tây": ["mắm cá linh", "cá basa", "tôm", "mực", "cà tím", "rau đồng"],
};

const menuNames = [
  "Mâm cơm Bắc thanh vị", "Mâm cơm Trung đậm đà", "Mâm cơm Nam hào sảng",
  "Bữa sáng Hà Nội", "Bữa sáng xứ Huế", "Bữa sáng Sài Gòn",
  "Bữa trưa văn phòng món Việt", "Bữa tối gia đình ấm cúng",
  "Mâm cơm ngày mưa", "Mâm cơm mùa hè",
  "Thực đơn cuối tuần miền Bắc", "Thực đơn cuối tuần miền Trung",
  "Thực đơn cuối tuần miền Nam", "Tiệc gia đình ba miền",
  "Tiệc sinh nhật món Việt", "Tiệc cuối năm sum vầy",
  "Thực đơn đãi khách thanh lịch", "Thực đơn hải sản quê nhà",
  "Thực đơn món nước truyền thống", "Hành trình ẩm thực Việt",
];

function recipeInstructions(name) {
  if (/kho|bò kho/i.test(name)) {
    return [
      { step: 1, title: "Sơ chế", description: "Làm sạch nguyên liệu, cắt miếng vừa ăn và để ráo." },
      { step: 2, title: "Ướp", description: "Ướp nguyên liệu chính với nước mắm, hành, tiêu trong 25 phút." },
      { step: 3, title: "Kho", description: "Đảo săn rồi kho lửa nhỏ đến khi nguyên liệu mềm và nước sánh." },
      { step: 4, title: "Hoàn thiện", description: "Nêm lại vừa vị, thêm tiêu và dùng nóng với cơm hoặc bánh mì." },
    ];
  }
  return [
    { step: 1, title: "Sơ chế", description: "Rửa sạch, cân đủ và cắt các nguyên liệu theo kích thước phù hợp." },
    { step: 2, title: "Chuẩn bị nền vị", description: "Phi thơm hành tỏi hoặc nấu nước dùng, hớt bọt để vị trong thanh." },
    { step: 3, title: "Nấu món", description: "Cho nguyên liệu theo thứ tự lâu chín trước, điều chỉnh lửa và nêm vừa ăn." },
    { step: 4, title: "Trình bày", description: "Thêm rau thơm, sắp món gọn đẹp và thưởng thức ngay khi còn nóng." },
  ];
}

async function upsertBySlug(Model, documents) {
  for (const document of documents) {
    await Model.updateOne(
      { slug: document.slug },
      { $set: document },
      { upsert: true, runValidators: true },
    );
  }
}

async function seed() {
  if (!process.env.MONGO_DB_URL) throw new Error("MONGO_DB_URL is required");
  await mongoose.connect(process.env.MONGO_DB_URL);

  await upsertBySlug(Category, productCategories.map((name) => ({
    name,
    slug: toSlug(name),
    image: imageUrl(name),
    icon: "restaurant",
    isDeleted: false,
  })));
  const savedCategories = await Category.find({
    slug: { $in: productCategories.map(toSlug) },
  }).lean();
  const categoryIds = new Map(savedCategories.map((item) => [item.name, item._id]));

  await upsertBySlug(Product, products.map((item, index) => ({
    name: item.name,
    slug: toSlug(item.name),
    categoryId: categoryIds.get(item.category),
    price: item.price,
    unit: item.category === "Gạo & Nông sản"
      ? "túi"
      : item.category === "Gia vị"
        ? "chai/gói"
        : "kg",
    description: `${item.name} chế biến trong ngày từ nguyên liệu tươi, giữ đúng phong vị ${item.origin}.`,
    images: imageUrl(item.name),
    stock: 35 + index * 3,
    salePercent: null,
    soldCount: 45 + index * 17,
    viewCount: 180 + index * 41,
    favouriteCount: 15 + index * 7,
    region: item.region,
    nutrition: {
      calories: 320 + index * 13,
      protein: 16 + index % 15,
      fat: 8 + index % 12,
      carbs: 32 + index % 24,
    },
    usage_instruction: ["Dùng ngay khi còn nóng", "Bảo quản mát và sử dụng trong ngày"],
    isSpecialty: false,
    origin: item.origin,
    originDescription: `${item.name} đại diện cho nét ẩm thực đặc trưng của ${item.origin}.`,
    originFound: item.origin,
    story: `Công thức ${item.name} được gìn giữ theo lối nấu truyền thống và điều chỉnh phù hợp bữa ăn hiện đại.`,
    season: ["quanh năm"],
    isActive: true,
  })));

  await upsertBySlug(Special, specialties.map((item, index) => ({
    name: item.name,
    slug: toSlug(item.name),
    price: item.price,
    unit: "phần",
    description: `${item.name} chính gốc ${item.origin}, thích hợp dùng tại nhà hoặc làm quà ẩm thực.`,
    images: imageUrl(item.name),
    stock: 20 + index * 2,
    salePercent: null,
    soldCount: 30 + index * 13,
    viewCount: 150 + index * 37,
    favouriteCount: 18 + index * 5,
    region: item.region,
    nutrition: {
      calories: 280 + index * 12,
      protein: 12 + index % 18,
      fat: 7 + index % 14,
      carbs: 24 + index % 28,
    },
    usage_instruction: ["Làm nóng theo hướng dẫn trước khi dùng", "Bảo quản theo thông tin trên bao bì"],
    origin: item.origin,
    originDescription: `Đặc sản tiêu biểu được tuyển chọn từ ${item.origin}.`,
    originFound: item.origin,
    story: `${item.name} gắn với đời sống và tập quán ẩm thực lâu đời của người dân ${item.origin}.`,
    isActive: true,
  })));
  const savedProducts = await Product.find({
    slug: { $in: products.map((item) => toSlug(item.name)) },
  }).lean();
  const savedSpecialties = await Special.find({
    slug: { $in: specialties.map((item) => toSlug(item.name)) },
  }).lean();
  const productBySlug = new Map(savedProducts.map((item) => [item.slug, item]));
  const specialBySlug = new Map(savedSpecialties.map((item) => [item.slug, item]));
  const orderedProducts = products.map((item) => productBySlug.get(toSlug(item.name)));
  const orderedSpecialties = specialties.map((item) => specialBySlug.get(toSlug(item.name)));

  await upsertBySlug(CategoryRecipe, recipeCategories.map((item) => ({
    ...item,
    slug: toSlug(item.name),
    isDeleted: false,
  })));
  const savedRecipeCategories = await CategoryRecipe.find({
    slug: { $in: recipeCategories.map((item) => toSlug(item.name)) },
  }).lean();
  const recipeCategoryByRegion = {
    bac: savedRecipeCategories.find((item) => item.slug === toSlug("Công thức miền Bắc"))._id,
    trung: savedRecipeCategories.find((item) => item.slug === toSlug("Công thức miền Trung"))._id,
    nam: savedRecipeCategories.find((item) => item.slug === toSlug("Công thức miền Nam"))._id,
  };

  const recipeDocuments = recipeNames.map((name, index) => ({
    name: `Cách làm ${name}`,
    slug: toSlug(`Cách làm ${name}`),
    description: `Công thức ${name} chuẩn vị, định lượng rõ ràng cho bốn người.`,
    image: imageUrl(name),
    category: recipeCategoryByRegion[index < 6 ? "bac" : index < 12 ? "trung" : "nam"],
    ingredients: [
      {
        ingredientId: orderedProducts[index % orderedProducts.length]._id,
        itemType: "Product",
        quantity: 1,
        note: "Sản phẩm nguyên liệu chính có thể mua trực tiếp tại cửa hàng",
      },
      {
        ingredientId: orderedProducts[(index + 7) % orderedProducts.length]._id,
        itemType: "Product",
        quantity: 1,
        note: "Nguyên liệu bổ sung cho khẩu phần bốn người",
      },
      ...(index % 2 === 0 ? [{
        ingredientId: orderedSpecialties[index % orderedSpecialties.length]._id,
        itemType: "Special",
        quantity: 1,
        note: "Đặc sản gợi ý dùng kèm hoặc tham khảo hương vị vùng miền",
      }] : []),
    ],
    additionalIngredients: recipeDetails[name].map((ingredient, ingredientIndex) => ({
      name: ingredient,
      quantity: ingredientIndex === 0 ? "500" : ingredientIndex < 3 ? "200" : "30",
      unit: ingredientIndex < 3 ? "g" : "g",
    })),
    instructions: recipeInstructions(name),
    weatherTag: /lẩu|phở|bún|canh|hủ tiếu/i.test(name) ? "rainy" : "neutral",
    tips: {
      folkTips: ["Nguyên liệu phải thật ráo trước khi ướp", "Nêm nước mắm ở cuối để giữ hương thơm"],
      nutrition: {
        calories: 380 + index * 9,
        protein: 18 + index % 12,
        fat: 9 + index % 10,
        carbs: 35 + index % 20,
        description: "Giá trị dinh dưỡng tham khảo cho một khẩu phần.",
      },
    },
    suggestedSideDishes: {
      description: "Dùng cùng rau theo mùa và nước chấm pha trong ngày.",
      dishes: ["Rau thơm", "Dưa góp", "Trà tắc ít đường"],
    },
    meta: { servings: "4", cookType: "Tự nấu tại nhà", isPrepped: false },
    difficulty: index % 5 === 0 ? "Trung bình" : "Dễ",
    instructionUrl: "",
    cookTime: 35 + index * 3,
    isSystem: true,
    isDeleted: false,
  }));
  await upsertBySlug(Recipe, recipeDocuments);
  const savedRecipes = await Recipe.find({
    slug: { $in: recipeDocuments.map((item) => item.slug) },
  }).lean();

  await upsertBySlug(CategoryMenu, menuCategories.map((item) => ({
    ...item,
    slug: toSlug(item.name),
    isDeleted: false,
  })));
  const savedMenuCategories = await CategoryMenu.find({
    slug: { $in: menuCategories.map((item) => toSlug(item.name)) },
  }).lean();

  for (let index = 0; index < menuNames.length; index += 1) {
    const selectedRecipes = Array.from(
      { length: 4 },
      (_, offset) => savedRecipes[(index * 3 + offset * 5) % savedRecipes.length],
    );
    const category = savedMenuCategories[index % savedMenuCategories.length];
    await Menu.updateOne(
      { title: menuNames[index] },
      {
        $set: {
          title: menuNames[index],
          titleBanner: `${menuNames[index]} – trọn vị Việt`,
          description: `Bốn món Việt hài hòa, phù hợp cho gia đình và các dịp sum họp.`,
          image: imageUrl(menuNames[index]),
          category: category._id,
          meta: { servings: `${3 + index % 3}-${5 + index % 3}`, cookType: "Tự nấu tại nhà", isPrepped: false },
          recipes: selectedRecipes.map((recipe) => recipe._id),
          cookTime: 60 + index * 3,
          totalPrice: 220000 + index * 15000,
          isDeleted: false,
        },
      },
      { upsert: true, runValidators: true },
    );
  }

  console.log("Seed completed:", {
    productCategories: productCategories.length,
    products: products.length,
    specialties: specialties.length,
    menuCategories: menuCategories.length,
    menus: menuNames.length,
    recipeCategories: recipeCategories.length,
    recipes: recipeDocuments.length,
  });
}

seed()
  .catch((error) => {
    console.error("Seed failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
