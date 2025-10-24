const express = require("express");
const multer = require("multer");
const fs = require("fs");
const path = require("path");
const Ledger = require("../models/Ledger");
const Order = require("../models/Order");
const { protect } = require("../middleware/authMiddleware");
const { authorizeRoles } = require("../middleware/roleMiddleware");

const router = express.Router();

// ⚙️ Multer setup for PDF upload
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadPath = path.join(__dirname, "../uploads/ledgers");
    fs.mkdirSync(uploadPath, { recursive: true });
    cb(null, uploadPath);
  },
  filename: function (req, file, cb) {
    cb(null, `${Date.now()}-${file.originalname}`);
  },
});

const fileFilter = (req, file, cb) => {
  if (file.mimetype === "application/pdf") cb(null, true);
  else cb(new Error("Only PDF files are allowed"), false);
};

const upload = multer({ storage, fileFilter });

/* -------------------------------------------------------------
   1️⃣ ADMIN: Upload Ledger for Order
------------------------------------------------------------- */
router.post(
  "/upload/:orderId",
  protect,
  authorizeRoles("Admin"),
  upload.single("ledgerPdf"),
  async (req, res) => {
    try {
      const order = await Order.findById(req.params.orderId);
      if (!order) return res.status(404).json({ message: "Order not found" });

      const ledger = new Ledger({
        order: order._id,
        customer: order.customer,
        uploadedBy: req.user._id,
        pdfUrl: `/uploads/ledgers/${req.file.filename}`,
      });

      await ledger.save();
      res.status(201).json({ message: "Ledger PDF uploaded successfully", ledger });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  }
);

/* -------------------------------------------------------------
   2️⃣ ADMIN: View All Ledgers
------------------------------------------------------------- */
router.get("/", protect, authorizeRoles("Admin"), async (req, res) => {
  try {
    const ledgers = await Ledger.find()
      .populate("order", "totalAmount status createdAt")
      .populate("customer", "name email")
      .sort({ createdAt: -1 });
    res.json({ ledgers });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

/* -------------------------------------------------------------
   3️⃣ CUSTOMER: View Own Ledgers
------------------------------------------------------------- */
router.get("/my-ledgers", protect, async (req, res) => {
  try {
    const ledgers = await Ledger.find({ customer: req.user._id })
      .populate("order", "totalAmount status createdAt")
      .sort({ createdAt: -1 });
    res.json({ ledgers });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

/* -------------------------------------------------------------
   4️⃣ VIEW SINGLE LEDGER (Customer/Admin)
------------------------------------------------------------- */
router.get("/:id", protect, async (req, res) => {
  try {
    const ledger = await Ledger.findById(req.params.id)
      .populate("order", "totalAmount status")
      .populate("customer", "name email");

    if (!ledger) return res.status(404).json({ message: "Ledger not found" });

    // Restrict access
    if (
      req.user.role !== "Admin" &&
      ledger.customer._id.toString() !== req.user._id.toString()
    ) {
      return res.status(403).json({ message: "Not authorized to view this ledger" });
    }

    res.json({ ledger });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

/* -------------------------------------------------------------
   5️⃣ DOWNLOAD LEDGER PDF (Customer/Admin)
------------------------------------------------------------- */
router.get("/download/:id", protect, async (req, res) => {
  try {
    const ledger = await Ledger.findById(req.params.id);
    if (!ledger) return res.status(404).json({ message: "Ledger not found" });

    // Restrict access
    if (
      req.user.role !== "Admin" &&
      ledger.customer.toString() !== req.user._id.toString()
    ) {
      return res.status(403).json({ message: "Not authorized to download this ledger" });
    }

    const filePath = path.join(__dirname, "..", ledger.pdfUrl);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ message: "File not found" });
    }

    res.download(filePath, (err) => {
      if (err) console.error("File download error:", err);
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

/* -------------------------------------------------------------
   6️⃣ UPDATE LEDGER PDF (Replace file)
------------------------------------------------------------- */
router.put(
  "/update/:id",
  protect,
  authorizeRoles("Admin"),
  upload.single("ledgerPdf"),
  async (req, res) => {
    try {
      const ledger = await Ledger.findById(req.params.id);
      if (!ledger) return res.status(404).json({ message: "Ledger not found" });

      // Delete old file if exists
      const oldPath = path.join(__dirname, "..", ledger.pdfUrl);
      if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);

      // Update with new PDF
      ledger.pdfUrl = `/uploads/ledgers/${req.file.filename}`;
      await ledger.save();

      res.json({ message: "Ledger PDF updated successfully", ledger });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  }
);

/* -------------------------------------------------------------
   7️⃣ DELETE LEDGER (Admin)
------------------------------------------------------------- */
router.delete("/delete/:id", protect, authorizeRoles("Admin"), async (req, res) => {
  try {
    const ledger = await Ledger.findById(req.params.id);
    if (!ledger) return res.status(404).json({ message: "Ledger not found" });

    const filePath = path.join(__dirname, "..", ledger.pdfUrl);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

    await ledger.deleteOne();
    res.json({ message: "Ledger deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
