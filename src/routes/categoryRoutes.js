const express = require("express");
const fs = require("fs");
const path = require("path");
const multer = require("multer");
const Category = require("../models/Category");
const Product = require("../models/Product");
const { protect } = require("../middleware/authMiddleware");
const { authorizeRoles } = require("../middleware/roleMiddleware");

const router = express.Router();

// ------------------- MULTER STORAGE -------------------
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadPath = path.join(__dirname, "..", "uploads", "categories");
    fs.mkdirSync(uploadPath, { recursive: true });
    cb(null, uploadPath);
  },
  filename: function (req, file, cb) {
    const uniqueName = Date.now() + "-" + file.originalname;
    cb(null, uniqueName);
  },
});

const upload = multer({ storage });

// ------------------- CREATE CATEGORY -------------------
router.post(
  "/",
  protect,
  authorizeRoles("Admin"),
  upload.single("image"),
  async (req, res) => {
    try {
      const category = new Category({
        name: req.body.name,
        image: req.file ? `/uploads/categories/${req.file.filename}` : null,
        parent: req.body.parent || null,
        createdBy: req.user._id,
      });

      await category.save();
      res.status(201).json({ message: "Category created successfully", category });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  }
);

// ------------------- GET ALL CATEGORIES -------------------
router.get("/", async (req, res) => {
  try {
    const categories = await Category.find()
      .populate("parent", "name")
      .sort({ createdAt: -1 });
    res.json(categories);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ------------------- GET SINGLE CATEGORY -------------------
router.get("/:id", async (req, res) => {
  try {
    const category = await Category.findById(req.params.id).populate("parent", "name");
    if (!category) return res.status(404).json({ message: "Category not found" });
    res.json(category);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ✅ Get categories by brand (NEW)
router.get("/by-brand/:brandId", protect, async (req, res) => {
  try {
    const { brandId } = req.params;

    // Find all products with that brand
    const products = await Product.find({ brand: brandId }).select("category");

    // Extract unique category IDs
    const categoryIds = [...new Set(products.map((p) => p.category?.toString()))];

    // Fetch category details
    const categories = await Category.find({ _id: { $in: categoryIds } });

    res.json(categories);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});


// ------------------- UPDATE CATEGORY -------------------
router.put(
  "/:id",
  protect,
  authorizeRoles("Admin"),
  upload.single("image"),
  async (req, res) => {
    try {
      const category = await Category.findById(req.params.id);
      if (!category) return res.status(404).json({ message: "Category not found" });

      if (req.body.name !== undefined) category.name = req.body.name;
      if (req.body.isActive !== undefined) {
        category.isActive = req.body.isActive === "true" || req.body.isActive === true;
      }
      if (req.body.parent !== undefined) category.parent = req.body.parent || null;

      // ✅ Handle image upload
      if (req.file) {
        if (category.image) {
          const oldPath = path.join(__dirname, "..", category.image);
          if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
        }
        category.image = `/uploads/categories/${req.file.filename}`;
      }

      // ✅ Handle image removal
      if (req.body.removeImage === "true" && category.image) {
        const oldPath = path.join(__dirname, "..", category.image);
        if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
        category.image = null;
      }

      await category.save();
      res.json({ message: "Category updated successfully", category });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  }
);

// ------------------- DELETE CATEGORY -------------------
router.delete("/:id", protect, authorizeRoles("Admin"), async (req, res) => {
  try {
    const category = await Category.findById(req.params.id);
    if (!category) return res.status(404).json({ message: "Category not found" });

    if (category.image) {
      const imagePath = path.join(__dirname, "..", category.image);
      if (fs.existsSync(imagePath)) fs.unlinkSync(imagePath);
    }

    await category.deleteOne();
    res.json({ message: "Category deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
