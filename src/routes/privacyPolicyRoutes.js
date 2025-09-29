const express = require("express");
const router = express.Router();
const PrivacyPolicy = require("../models/PrivacyPolicy");
const { protect, adminOnly } = require("../middleware/authMiddleware");

/**
 * @route   POST /api/privacy-policy
 * @desc    Create new Privacy Policy (Admin only)
 */
router.post("/", protect, adminOnly, async (req, res) => {
  try {
    const { title, content } = req.body;
    if (!title || !content) {
      return res.status(400).json({ success: false, message: "Title and content are required" });
    }

    const policy = new PrivacyPolicy({
      title,
      content,
      createdBy: req.user._id,
    });

    await policy.save();
    res.status(201).json({ success: true, data: policy });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * @route   GET /api/privacy-policy
 * @desc    Get all Privacy Policies (Public)
 */
router.get("/", async (req, res) => {
  try {
    const policies = await PrivacyPolicy.find().populate("createdBy", "name email");
    res.json({ success: true, count: policies.length, data: policies });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * @route   GET /api/privacy-policy/:id
 * @desc    Get single Privacy Policy by ID (Public)
 */
router.get("/:id", async (req, res) => {
  try {
    const policy = await PrivacyPolicy.findById(req.params.id).populate("createdBy", "name email");
    if (!policy) {
      return res.status(404).json({ success: false, message: "Privacy policy not found" });
    }

    res.json({ success: true, data: policy });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * @route   PUT /api/privacy-policy/:id
 * @desc    Update Privacy Policy (Admin only)
 */
router.put("/:id", protect, adminOnly, async (req, res) => {
  try {
    const { title, content } = req.body;

    let policy = await PrivacyPolicy.findById(req.params.id);
    if (!policy) {
      return res.status(404).json({ success: false, message: "Privacy policy not found" });
    }

    policy.title = title || policy.title;
    policy.content = content || policy.content;

    await policy.save();
    res.json({ success: true, data: policy });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * @route   DELETE /api/privacy-policy/:id
 * @desc    Delete Privacy Policy (Admin only)
 */
router.delete("/:id", protect, adminOnly, async (req, res) => {
  try {
    const policy = await PrivacyPolicy.findById(req.params.id);
    if (!policy) {
      return res.status(404).json({ success: false, message: "Privacy policy not found" });
    }

    await policy.deleteOne();
    res.json({ success: true, message: "Privacy policy deleted successfully" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
