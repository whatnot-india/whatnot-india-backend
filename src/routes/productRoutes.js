const express = require("express");
const fs = require("fs");
const path = require("path");
const multer = require("multer");
const Product = require("../models/Product");
const Category = require("../models/Category");
const { protect } = require("../middleware/authMiddleware");
const { authorizeRoles } = require("../middleware/roleMiddleware");
const { attachBusinessType } = require("../middleware/businessTypeMiddleware");

const router = express.Router();

// ------------------- MULTER STORAGE -------------------
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadPath = path.join(__dirname, "..", "uploads", "products");
    fs.mkdirSync(uploadPath, { recursive: true });
    cb(null, uploadPath);
  },
  filename: function (req, file, cb) {
    const uniqueName = Date.now() + "-" + file.originalname;
    cb(null, uniqueName);
  },
});

const upload = multer({ storage });

// ✅ Helper to generate absolute image URL
const makeImageUrl = (req, filename) =>
  `${req.protocol}://${req.get("host")}/uploads/products/${filename}`;

// ✅ Helper to normalize image URLs
const normalizeImageUrls = (req, product) => {
  const mapImg = (img) =>
    img.startsWith("http")
      ? img
      : `${req.protocol}://${req.get("host")}/uploads/products/${path.basename(img)}`;

  const images = product.images?.map(mapImg);
  const variants = product.variants?.map((v) => ({
    ...v,
    images: v.images?.map(mapImg),
  }));

  return { ...product, images, variants };
};

// ------------------- CREATE PRODUCT -------------------
router.post(
  "/",
  protect,
  authorizeRoles("Admin"),
  upload.array("images", 10),
  async (req, res) => {
    try {
      let data = { ...req.body };

      // Parse complex fields
      const parseField = (field) => {
        if (!data[field]) return undefined;
        try {
          return typeof data[field] === "string" ? JSON.parse(data[field]) : data[field];
        } catch {
          throw new Error(`Invalid ${field} format`);
        }
      };

      data.prices = parseField("prices") || {};
      data.variants = parseField("variants") || [];

      const product = new Product({
        ...data,
        images: req.files.map((f) => makeImageUrl(req, f.filename)),
        createdBy: req.user._id,
      });

      await product.save();
      res.status(201).json({ message: "Product created successfully", product });
    } catch (error) {
      res.status(400).json({ message: error.message });
    }
  }
);

router.get("/categories/by-brand/:brandId", protect, async (req, res) => {
  try {
    const { brandId } = req.params;

    // find all distinct categories used in products of that brand
    const categoryIds = await Product.distinct("category", { brand: brandId });

    // fetch category documents
    const categories = await Category.find({ _id: { $in: categoryIds } });

    res.json(categories);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});


// ------------------- GET ALL PRODUCTS (with filters) -------------------
router.get("/", protect, attachBusinessType, async (req, res) => {
  try {
    const { category, brand, search, isActive } = req.query;

    const filter = {};
    if (category) filter.category = category;
    if (brand) filter.brand = brand;
    if (isActive !== undefined) filter.isActive = isActive === "true";
    if (search) filter.name = { $regex: search, $options: "i" };

    const products = await Product.find(filter)
      .populate("brand", "name")
      .populate("category", "name")
      .sort({ createdAt: -1 })
      .lean();

    const formatted = products.map((p) => {
      const { images, variants } = normalizeImageUrls(req, p);

      if (req.user.role === "Customer" && req.businessType) {
        return {
          ...p,
          images,
          variants,
          price: p.prices?.[req.businessType],
          prices: undefined,
        };
      }
      return { ...p, images, variants };
    });

    res.json(formatted);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ------------------- GET SINGLE PRODUCT -------------------
router.get("/:id", protect, attachBusinessType, async (req, res) => {
  try {
    const product = await Product.findById(req.params.id)
      .populate("brand", "name")
      .populate("category", "name")
      .lean();

    if (!product) return res.status(404).json({ message: "Product not found" });

    const { images, variants } = normalizeImageUrls(req, product);

    if (req.user.role === "Customer" && req.businessType) {
      return res.json({
        ...product,
        images,
        variants,
        price: product.prices?.[req.businessType],
        prices: undefined,
      });
    }

    res.json({ ...product, images, variants });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ------------------- UPDATE PRODUCT -------------------
router.put(
  "/:id",
  protect,
  authorizeRoles("Admin"),
  upload.array("images", 10),
  async (req, res) => {
    try {
      const product = await Product.findById(req.params.id);
      if (!product) return res.status(404).json({ message: "Product not found" });

      let updates = { ...req.body };

      // Parse JSON fields safely
      const safeParse = (field) => {
        if (!updates[field]) return undefined;
        try {
          return typeof updates[field] === "string" ? JSON.parse(updates[field]) : updates[field];
        } catch {
          throw new Error(`Invalid ${field} format`);
        }
      };

      updates.prices = safeParse("prices") || product.prices;
      updates.variants = safeParse("variants") || product.variants;

      // Handle image additions
      if (req.files && req.files.length > 0) {
        updates.images = [
          ...(product.images || []),
          ...req.files.map((f) => makeImageUrl(req, f.filename)),
        ];
      }

      // Handle image removals
      if (updates.removeImages) {
        let removeList = [];
        try {
          removeList =
            typeof updates.removeImages === "string"
              ? JSON.parse(updates.removeImages)
              : updates.removeImages;
        } catch {
          throw new Error("Invalid removeImages format");
        }

        product.images.forEach((img) => {
          if (removeList.includes(img)) {
            const imgPath = path.join(__dirname, "..", "uploads", "products", path.basename(img));
            if (fs.existsSync(imgPath)) fs.unlinkSync(imgPath);
          }
        });

        updates.images = product.images.filter((img) => !removeList.includes(img));
      }

      Object.assign(product, updates);
      await product.save();

      res.json({ message: "Product updated successfully", product });
    } catch (error) {
      res.status(400).json({ message: error.message });
    }
  }
);

// ------------------- DELETE PRODUCT -------------------
router.delete("/:id", protect, authorizeRoles("Admin"), async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ message: "Product not found" });

    // Delete product and variant images
    const allImages = [
      ...(product.images || []),
      ...(product.variants || []).flatMap((v) => v.images || []),
    ];

    allImages.forEach((img) => {
      const imgPath = path.join(__dirname, "..", "uploads", "products", path.basename(img));
      if (fs.existsSync(imgPath)) fs.unlinkSync(imgPath);
    });

    await product.deleteOne();
    res.json({ message: "Product deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
