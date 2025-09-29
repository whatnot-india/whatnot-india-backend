const mongoose = require("mongoose");

const categorySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true }, // ✅ Category name
    image: { type: String, default: null }, // optional category image
    parent: { type: mongoose.Schema.Types.ObjectId, ref: "Category", default: null }, // for sub-categories
    isActive: { type: Boolean, default: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "Admin" },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Category", categorySchema);
