import { Product } from "../models/productsModel.js";
import { Special } from "../models/specialModel.js";

const PRODUCT_FIELDS = [
    "_id",
    "name",
    "slug",
    "price",
    "unit",
    "description",
    "images",
    "stock",
    "salePercent",
    "region",
    "nutrition",
    "usage_instruction",
    "isSpecialty",
    "origin",
    "originDescription",
    "originFound",
    "story",
    "season",
    "isActive",
    "favouriteCount",
    "soldCount",
].join(" ");

const SPECIAL_FIELDS = [
    "_id",
    "name",
    "slug",
    "price",
    "unit",
    "description",
    "images",
    "stock",
    "salePercent",
    "region",
    "nutrition",
    "usage_instruction",
    "origin",
    "originDescription",
    "originFound",
    "story",
    "isActive",
    "favouriteCount",
    "soldCount",
    "viewCount",
].join(" ");

const normalizeProduct = (item, type) => ({
    _id: item._id,
    type,
    name: item.name,
    slug: item.slug,
    price: item.price,
    unit: item.unit,
    description: item.description,
    images: item.images,
    stock: item.stock,
    salePercent: item.salePercent,
    region: item.region,
    nutrition: item.nutrition,
    usageInstruction: item.usage_instruction,
    isSpecialty: item.isSpecialty,
    origin: item.origin,
    originDescription: item.originDescription,
    originFound: item.originFound,
    story: item.story,
    season: item.season,
    isActive: item.isActive,
    favouriteCount: item.favouriteCount,
    soldCount: item.soldCount,
    viewCount: item.viewCount,
});

export const searchProducts = async ({
    keyword = "",
    region = "",
    location = "",
    limit = 10,
}) => {
    const search = keyword.trim();
    const normalizedRegion = region.trim().toLowerCase();
    const normalizedLocation = location.trim();

    const buildQuery = () => {
        const query = {
            isActive: true,
        };


        if (search) {
            const regex = {
                $regex: search,
                $options: "i",
            };

            query.$or = [
                { name: regex },
                { description: regex },
                { slug: regex },
                { origin: regex },
                { originDescription: regex },
                { originFound: regex },
            ];
        }


        if (normalizedRegion) {
            query.region = normalizedRegion;
        }

        if (normalizedLocation) {
            const locationRegex = {
                $regex: normalizedLocation,
                $options: "i",
            };

            query.$and = [
                {
                    $or: [
                        { origin: locationRegex },
                        { originDescription: locationRegex },
                        { originFound: locationRegex },
                    ],
                },
            ];
        }

        return query;
    };

    const [products, specials] = await Promise.all([
        Product.find(buildQuery())
            .select(PRODUCT_FIELDS)
            .limit(limit)
            .lean(),

        Special.find(buildQuery())
            .select(SPECIAL_FIELDS)
            .limit(limit)
            .lean(),
    ]);

    return [
        ...products.map((item) => normalizeProduct(item, "product")),
        ...specials.map((item) => normalizeProduct(item, "special")),
    ].slice(0, limit);
};

export const getProductByKeyword = async (keyword) => {
    const search = keyword.trim();

    if (!search) {
        return null;
    }

    const regex = {
        $regex: search,
        $options: "i",
    };

    const [product, special] = await Promise.all([
        Product.findOne({
            isActive: true,
            $or: [
                { name: regex },
                { slug: regex },
            ],
        })
            .select(PRODUCT_FIELDS)
            .lean(),

        Special.findOne({
            isActive: true,
            $or: [
                { name: regex },
                { slug: regex },
            ],
        })
            .select(SPECIAL_FIELDS)
            .lean(),
    ]);

    if (product) {
        return normalizeProduct(product, "product");
    }

    if (special) {
        return normalizeProduct(special, "special");
    }

    return null;
};

export const getProductStock = async (keyword) => {
    const product = await getProductByKeyword(keyword);

    if (!product) {
        return null;
    }

    return {
        _id: product._id,
        type: product.type,
        name: product.name,
        stock: product.stock,
        unit: product.unit,
    };
};