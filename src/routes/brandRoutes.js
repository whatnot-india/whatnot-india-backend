const express = require("express");
const fs = require("fs");
const path = require("path");
const multer = require("multer");
const Brand = require("../models/Brand");
const { protect } = require("../middleware/authMiddleware");
const { authorizeRoles } = require("../middleware/roleMiddleware");

const router = express.Router();

// ------------------- MULTER STORAGE -------------------
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadPath = path.join(__dirname, "..", "uploads", "brands");
    fs.mkdirSync(uploadPath, { recursive: true });
    cb(null, uploadPath);
  },
  filename: function (req, file, cb) {
    const uniqueName = Date.now() + "-" + file.originalname;
    cb(null, uniqueName);
  },
});

const upload = multer({ storage });

// ------------------- CREATE BRAND -------------------
router.post(
  "/",
  protect,
  authorizeRoles("Admin"),
  upload.fields([
    { name: "image", maxCount: 1 }, // required
    { name: "banner", maxCount: 1 }, // optional
  ]),
  async (req, res) => {
    try {
      if (!req.files.image)
        return res.status(400).json({ message: "Brand image is required" });

      const brand = new Brand({
        name: req.body.name,
        image: `/uploads/brands/${req.files.image[0].filename}`,
        banner: req.files.banner
          ? `/uploads/brands/${req.files.banner[0].filename}`
          : null,
        createdBy: req.user._id,
      });

      await brand.save();
      res.status(201).json({ message: "Brand created successfully", brand });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  }
);

// ------------------- GET ALL BRANDS -------------------
router.get("/", async (req, res) => {
  try {
    const brands = await Brand.find().sort({ createdAt: -1 });
    res.json(brands);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ------------------- GET SINGLE BRAND -------------------
router.get("/:id", async (req, res) => {
  try {
    const brand = await Brand.findById(req.params.id);
    if (!brand) return res.status(404).json({ message: "Brand not found" });
    res.json(brand);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ------------------- UPDATE BRAND -------------------
router.put(
  "/:id",
  protect,
  authorizeRoles("Admin"),
  upload.fields([
    { name: "image", maxCount: 1 },
    { name: "banner", maxCount: 1 },
  ]),
  async (req, res) => {
    try {
      const brand = await Brand.findById(req.params.id);
      if (!brand) return res.status(404).json({ message: "Brand not found" });

      // ✅ Handle name & isActive from body (works with JSON or formData)
      if (req.body.name !== undefined) brand.name = req.body.name;
      if (req.body.isActive !== undefined) {
        brand.isActive =
          req.body.isActive === "true" || req.body.isActive === true;
      }

      // ✅ Handle logo upload
      if (req.files && req.files.image) {
        const oldPath = path.join(__dirname, "..", brand.image);
        if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
        brand.image = `/uploads/brands/${req.files.image[0].filename}`;
      }

      // ✅ Handle banner upload
      if (req.files && req.files.banner) {
        if (brand.banner) {
          const oldPath = path.join(__dirname, "..", brand.banner);
          if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
        }
        brand.banner = `/uploads/brands/${req.files.banner[0].filename}`;
      }

      // ✅ Handle banner removal
      if (req.body.removeBanner === "true" && brand.banner) {
        const oldPath = path.join(__dirname, "..", brand.banner);
        if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
        brand.banner = null;
      }

      await brand.save();
      res.json({ message: "Brand updated successfully", brand });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  }
);


// ------------------- DELETE BRAND -------------------
router.delete("/:id", protect, authorizeRoles("Admin"), async (req, res) => {
  try {
    const brand = await Brand.findById(req.params.id);
    if (!brand) return res.status(404).json({ message: "Brand not found" });

    // Delete image
    if (brand.image) {
      const imagePath = path.join(__dirname, "..", brand.image);
      if (fs.existsSync(imagePath)) fs.unlinkSync(imagePath);
    }

    // Delete banner (if exists)
    if (brand.banner) {
      const bannerPath = path.join(__dirname, "..", brand.banner);
      if (fs.existsSync(bannerPath)) fs.unlinkSync(bannerPath);
    }

    await brand.deleteOne();
    res.json({ message: "Brand deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
