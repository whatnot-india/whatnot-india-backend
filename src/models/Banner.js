const mongoose = require("mongoose");

const bannerSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    description: { type: String }, // ✅ new field
    image: { type: String, required: true }, // path to uploaded file
    isActive: { type: Boolean, default: true }, // enable/disable banner
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "Admin" }, // who uploaded
  },
  { timestamps: true }
);

module.exports = mongoose.model("Banner", bannerSchema);
