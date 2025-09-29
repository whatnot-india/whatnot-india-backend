const express = require("express");
const fs = require("fs");
const path = require("path");
const multer = require("multer");
const Banner = require("../models/Banner");
const { protect } = require("../middleware/authMiddleware");
const { authorizeRoles } = require("../middleware/roleMiddleware");

const router = express.Router();

// ------------------- MULTER STORAGE -------------------
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadPath = path.join(__dirname, "..", "uploads", "banners");
    fs.mkdirSync(uploadPath, { recursive: true });
    cb(null, uploadPath);
  },
  filename: function (req, file, cb) {
    const uniqueName = Date.now() + "-" + file.originalname;
    cb(null, uniqueName);
  },
});

const upload = multer({ storage });

// ------------------- CREATE BANNER -------------------
router.post(
  "/",
  protect,
  authorizeRoles("Admin"),
  upload.single("image"),
  async (req, res) => {
    try {
      if (!req.file) return res.status(400).json({ message: "Image is required" });

      const banner = new Banner({
        title: req.body.title,
        description: req.body.description, // ✅
        image: `/uploads/banners/${req.file.filename}`,
        createdBy: req.user._id,
      });

      await banner.save();
      res.status(201).json({ message: "Banner created successfully", banner });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  }
);



// ------------------- GET ALL BANNERS -------------------
router.get("/", async (req, res) => {
  try {
    const banners = await Banner.find().sort({ createdAt: -1 });
    res.json(banners);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ------------------- GET SINGLE BANNER -------------------
router.get("/:id", async (req, res) => {
  try {
    const banner = await Banner.findById(req.params.id);
    if (!banner) return res.status(404).json({ message: "Banner not found" });
    res.json(banner);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});


// ------------------- UPDATE BANNER -------------------
router.put(
  "/:id",
  protect,
  authorizeRoles("Admin"),
  upload.single("image"),
  async (req, res) => {
    try {
      const banner = await Banner.findById(req.params.id);
      if (!banner) return res.status(404).json({ message: "Banner not found" });

      // ✅ Update or clear fields
      banner.title = req.body.title !== undefined ? req.body.title : banner.title;
      banner.description = req.body.description !== undefined ? req.body.description : banner.description;
      banner.isActive = req.body.isActive ?? banner.isActive;

      // ✅ Handle new image upload
      if (req.file) {
        // Delete old file
        const oldPath = path.join(__dirname, "..", banner.image);
        if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);

        banner.image = `/uploads/banners/${req.file.filename}`;
      }

      // ✅ If user wants to remove image explicitly
      if (req.body.removeImage === "true" && banner.image) {
        const oldPath = path.join(__dirname, "..", banner.image);
        if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
        banner.image = null;
      }

      await banner.save();
      res.json({ message: "Banner updated successfully", banner });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  }
);



// ------------------- DELETE BANNER -------------------
router.delete(
  "/:id",
  protect,
  authorizeRoles("Admin"),
  async (req, res) => {
    try {
      const banner = await Banner.findById(req.params.id);
      if (!banner) return res.status(404).json({ message: "Banner not found" });

      // Delete image file
      const filePath = path.join(__dirname, "..", banner.image);
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

      await banner.deleteOne();
      res.json({ message: "Banner deleted successfully" });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  }
);

module.exports = router;
