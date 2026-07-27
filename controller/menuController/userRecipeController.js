import {UserRecipe} from "../../models/menuModels/userRecipeModel.js"
import cloudinary from "../../config/cloudinary.js";
export const createUserRecipe = async (req, res) => {
  try {
    const { name, ingredients, instructions, cookTime, familyNotes } = req.body;

    let finalIngredients = [];
    let finalInstructions = [];

    try {
      const parsedIngredients = typeof ingredients === 'string' ? JSON.parse(ingredients) : ingredients;
      const parsedInstructions = typeof instructions === 'string' ? JSON.parse(instructions) : instructions;

      if (Array.isArray(parsedIngredients)) {
        finalIngredients = parsedIngredients
          .filter(i => i.name && String(i.name).trim() !== '')
          .map(i => ({
            name: String(i.name).trim(),
            quantity: String(i.quantity || '').trim()
          }));
      }

      if (Array.isArray(parsedInstructions)) {
        finalInstructions = parsedInstructions
          .filter(s => s.description && String(s.description).trim() !== '')
          .map((s, index) => ({
            step: Number(s.step) || (index + 1),
            description: String(s.description).trim()
          }));
      }
    } catch (parseError) {
      return res.status(400).json({ 
        success: false, 
        message: "Dữ liệu danh sách không hợp lệ." 
      });
    }

    if (!name || finalIngredients.length === 0 || finalInstructions.length === 0) {
      return res.status(400).json({ 
        success: false, 
        message: "Vui lòng nhập đầy đủ tên, nguyên liệu và cách làm." 
      });
    }

    let imageUrl = "";
    if (req.file) {
      const uploadResult = await cloudinary.uploader.upload(req.file.path, { 
        folder: "MyRecipe" 
      });
      imageUrl = uploadResult.secure_url;
    }

    const newRecipe = new UserRecipe({
      name: String(name).trim(),
      image: imageUrl,
      ingredients: finalIngredients,
      instructions: finalInstructions, 
      cookTime: Number(cookTime) || 0,
      owner: req.user.id, 
      familyNotes: familyNotes ? String(familyNotes).trim() : ""
    });

    const savedRecipe = await newRecipe.save();

    res.status(201).json({
      success: true,
      message: "Tạo công thức thành công!",
      data: savedRecipe
    });

  } catch (error) {
    console.error("LỖI LƯU DATABASE:", error);
    res.status(500).json({ 
      success: false, 
      message: "Lỗi máy chủ nội bộ", 
      error: error.message 
    });
  }
};

export const getRecipes = async (req, res) => {
  try {
    const { page = 1, limit = 10, search } = req.query;

    let query = { owner: req.user.id }; 

    if (search) {
      query.name = { $regex: search, $options: "i" };
    }

    const recipes = await UserRecipe.find(query)
      .limit(Number(limit))
      .skip((Number(page) - 1) * Number(limit))
      .sort({ createdAt: -1 });

    const count = await UserRecipe.countDocuments(query);

    res.status(200).json({
      success: true,
      data: recipes,
      totalPages: Math.ceil(count / Number(limit)),
      currentPage: Number(page),
      pagination: {
        totalItems: count,
        totalPages: Math.ceil(count / Number(limit)),
        currentPage: Number(page),
        pageSize: Number(limit),
        hasNextPage: Number(page) * Number(limit) < count,
      },
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: "Lỗi khi lấy danh sách công thức của bạn" 
    });
  }
};

export const getMyRecipeDetail = async (req, res) => {
  try {
    const { recipeId } = req.params;

    const recipe = await UserRecipe.findById(recipeId);

    if (!recipe) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy công thức món ăn."
      });
    }

    res.status(200).json({
      success: true,
      data: recipe
    });

  } catch (error) {
    if (error.kind === 'ObjectId') {
      return res.status(400).json({ 
        success: false, 
        message: "ID công thức không hợp lệ." 
      });
    }

    res.status(500).json({ 
      success: false, 
      message: "Lỗi hệ thống", 
      error: error.message 
    });
  }
};

export const updateUserRecipe = async (req, res) => {
  try {
    const { recipeId } = req.params;
    let { name, ingredients, instructions, cookTime, familyNotes } = req.body;

    const recipe = await UserRecipe.findById(recipeId);

    if (!recipe) {
      return res.status(404).json({ success: false, message: "Không tìm thấy công thức." });
    }

    if (recipe.owner.toString() !== req.user.id) {
      return res.status(403).json({ success: false, message: "Bạn không có quyền sửa công thức này." });
    }

    let finalIngredients = recipe.ingredients;
    let finalInstructions = recipe.instructions;

    try {
      if (ingredients) {
        const parsedIngredients = typeof ingredients === 'string' ? JSON.parse(ingredients) : ingredients;
        finalIngredients = Array.isArray(parsedIngredients)
          ? parsedIngredients
              .filter(i => i.name && String(i.name).trim() !== '')
              .map(i => ({
                name: String(i.name).trim(),
                quantity: String(i.quantity || '').trim()
              }))
          : finalIngredients;
      }

      if (instructions) {
        const parsedInstructions = typeof instructions === 'string' ? JSON.parse(instructions) : instructions;
        finalInstructions = Array.isArray(parsedInstructions)
          ? parsedInstructions
              .filter(s => s.description && String(s.description).trim() !== '')
              .map((s, index) => ({
                step: Number(s.step) || (index + 1),
                description: String(s.description).trim()
              }))
          : finalInstructions;
      }
    } catch (parseError) {
      return res.status(400).json({ success: false, message: "Định dạng danh sách không hợp lệ." });
    }

    let imageUrl = recipe.image;
    if (req.file) {
      const uploadResult = await cloudinary.uploader.upload(req.file.path, {
        folder: "MyRecipe"
      });
      imageUrl = uploadResult.secure_url;
    }

    const updatedRecipe = await UserRecipe.findByIdAndUpdate(
      recipeId,
      {
        name: name ? String(name).trim() : recipe.name,
        image: imageUrl,
        ingredients: finalIngredients,
        instructions: finalInstructions,
        cookTime: cookTime !== undefined ? Number(cookTime) : recipe.cookTime,
        familyNotes: familyNotes !== undefined ? String(familyNotes).trim() : recipe.familyNotes
      },
      { new: true, runValidators: true }
    );

    res.status(200).json({
      success: true,
      message: "Cập nhật công thức thành công!",
      data: updatedRecipe
    });

  } catch (error) {
    console.error("LỖI UPDATE RECIPE:", error);
    res.status(500).json({ success: false, message: "Lỗi máy chủ nội bộ", error: error.message });
  }
};

export const deleteUserRecipe = async (req, res) => {
  try {
    const { recipeId } = req.params;

    const recipe = await UserRecipe.findById(recipeId);

    if (!recipe) {
      return res.status(404).json({ 
        success: false, 
        message: "Không tìm thấy công thức để xóa." 
      });
    }

    if (recipe.owner.toString() !== req.user.id) {
      return res.status(403).json({ 
        success: false, 
        message: "Bạn không có quyền xóa công thức này." 
      });
    }

    if (recipe.image) {
      try {
        const publicId = recipe.image.split('/').slice(-2).join('/').split('.')[0];
        await cloudinary.uploader.destroy(publicId);
      } catch (cloudError) {
        console.error("Lỗi khi xóa ảnh trên Cloudinary:", cloudError);
      }
    }

    await UserRecipe.findByIdAndDelete(recipeId);

    res.status(200).json({
      success: true,
      message: "Đã xóa công thức thành công!"
    });

  } catch (error) {
    console.error("LỖI XÓA RECIPE:", error);
    res.status(500).json({ 
      success: false, 
      message: "Lỗi máy chủ khi thực hiện xóa", 
      error: error.message 
    });
  }
};
