const express = require("express");
const fs = require("fs");
const path = require("path");
const multer = require("multer");
const Product = require("../models/Product");
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

// ------------------- CREATE PRODUCT -------------------
router.post(
  "/",
  protect,
  authorizeRoles("Admin"),
  upload.array("images", 5),
  async (req, res) => {
    try {
      let data = { ...req.body };

      // Parse prices if provided
      if (data.prices) {
        try {
          data.prices = typeof data.prices === "string" ? JSON.parse(data.prices) : data.prices;
        } catch (e) {
          return res.status(400).json({ message: "Invalid prices format" });
        }
      }

      const product = new Product({
        ...data,
        images: req.files.map((f) => makeImageUrl(req, f.filename)),
        createdBy: req.user._id,
      });

      await product.save();
      res.status(201).json({ message: "Product created successfully", product });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  }
);

// ------------------- GET ALL PRODUCTS -------------------
router.get("/", protect, attachBusinessType, async (req, res) => {
  try {
    const products = await Product.find()
      .populate("brand", "name")
      .populate("category", "name")
      .sort({ createdAt: -1 })
      .lean();

    const formatted = products.map((p) => {
      const images = p.images?.map((img) =>
        img.startsWith("http")
          ? img
          : `${req.protocol}://${req.get("host")}/uploads/products/${path.basename(img)}`
      );

      if (req.user.role === "Customer" && req.businessType) {
        return {
          ...p,
          images,
          price: p.prices[req.businessType],
          prices: undefined,
        };
      }
      return { ...p, images };
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

    const images = product.images?.map((img) =>
      img.startsWith("http")
        ? img
        : `${req.protocol}://${req.get("host")}/uploads/products/${path.basename(img)}`
    );

    if (req.user.role === "Customer" && req.businessType) {
      return res.json({
        ...product,
        images,
        price: product.prices[req.businessType],
        prices: undefined,
      });
    }

    res.json({ ...product, images });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ------------------- UPDATE PRODUCT -------------------
router.put(
  "/:id",
  protect,
  authorizeRoles("Admin"),
  upload.array("images", 5),
  async (req, res) => {
    try {
      const product = await Product.findById(req.params.id);
      if (!product) return res.status(404).json({ message: "Product not found" });

      let updates = { ...req.body };

      // Parse prices
      if (updates.prices) {
        try {
          updates.prices =
            typeof updates.prices === "string" ? JSON.parse(updates.prices) : updates.prices;
        } catch (e) {
          return res.status(400).json({ message: "Invalid prices format" });
        }
      }

      // Add new images
      if (req.files && req.files.length > 0) {
        updates.images = [
          ...(product.images || []),
          ...req.files.map((f) => makeImageUrl(req, f.filename)),
        ];
      }

      // Handle removeImages
      if (updates.removeImages) {
        let removeList = [];
        try {
          removeList =
            typeof updates.removeImages === "string"
              ? JSON.parse(updates.removeImages)
              : updates.removeImages;
        } catch (e) {
          return res.status(400).json({ message: "Invalid removeImages format" });
        }

        product.images.forEach((img) => {
          if (removeList.includes(img)) {
            const imgPath = path.join(__dirname, "..", "uploads", "products", path.basename(img));
            if (fs.existsSync(imgPath)) fs.unlinkSync(imgPath);
          }
        });

        updates.images = product.images.filter((img) => !removeList.includes(img));
      }

      // Merge and save
      Object.assign(product, updates);
      await product.save();

      res.json({ message: "Product updated successfully", product });
    } catch (error) {
      console.error("Update error:", error);
      res.status(500).json({ message: error.message });
    }
  }
);

// ------------------- DELETE PRODUCT -------------------
router.delete("/:id", protect, authorizeRoles("Admin"), async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ message: "Product not found" });

    product.images.forEach((img) => {
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
