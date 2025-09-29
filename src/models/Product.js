const mongoose = require("mongoose");

const productSchema = new mongoose.Schema(
  {
    name: { type: String, required: true }, // keep only name required
    skuId: { type: String, unique: true, sparse: true }, // optional but unique if present
    eanCode: { type: String, default: null },
    serialNumber: { type: String, default: null },

    description: { type: String, default: "" },
    productTitle: { type: String, default: "" },
    productContent: { type: String, default: "" },
    productDetails: { type: String, default: "" },

    originalPrice: { type: Number, default: 0 },
    offerPrice: { type: Number, default: 0 },

    // ✅ Optional pricing tiers
    prices: {
      PVT_LTD: { type: Number, default: 0 },
      LLP: { type: Number, default: 0 },
      SOLE_PROPRIETORSHIP: { type: Number, default: 0 },
    },

    quantity: { type: Number, default: 0 },

    // ✅ Relations optional
    brand: { type: mongoose.Schema.Types.ObjectId, ref: "Brand", default: null },
    category: { type: mongoose.Schema.Types.ObjectId, ref: "Category", default: null },

    // ✅ Multiple images
    images: [{ type: String }],

    isActive: { type: Boolean, default: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "Admin", default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Product", productSchema);
