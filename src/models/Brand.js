const mongoose = require("mongoose");

const brandSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true }, // ✅ brand name
    image: { type: String, required: true }, // ✅ brand logo/image
    banner: { type: String, default: null }, // ✅ optional brand banner
    isActive: { type: Boolean, default: true }, // enable/disable brand
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "Admin" }, // who uploaded
  },
  { timestamps: true }
);

module.exports = mongoose.model("Brand", brandSchema);
