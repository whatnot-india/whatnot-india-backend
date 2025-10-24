const mongoose = require("mongoose");

const variantSchema = new mongoose.Schema({
  color: { type: String, required: true },
  skuId: { type: String, default: null },
  images: [{ type: String }],
  price: { type: Number, default: 0 },
  quantity: { type: Number, default: 0 },
});

const productSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    skuId: { type: String, unique: true, sparse: true },
    eanCode: { type: String, default: null },
    serialNumber: { type: String, default: null },

    // 📝 Product info
    productInfo: { type: String, default: "" },
    productDescription: { type: String, default: "" },
    productDetails: { type: String, default: "" },
    productNotes: { type: String, default: "" },
    cancellationPolicy: { type: String, default: "" },
    warranty: { type: String, default: "" },
    returnPolicy: { type: String, default: "7 Days Return Available" },

    // 💰 Pricing
    originalPrice: { type: Number, default: 0 },
    offerPrice: { type: Number, default: 0 },
    prices: {
      PVT_LTD: { type: Number, default: 0 },
      LLP: { type: Number, default: 0 },
      SOLE_PROPRIETORSHIP: { type: Number, default: 0 },
    },

    // 🎨 Variants
    variants: [variantSchema],

    // 🖼 Default images
    images: [{ type: String }],

    // Total stock (optional aggregate)
    quantity: { type: Number, default: 0 },

    brand: { type: mongoose.Schema.Types.ObjectId, ref: "Brand", default: null },
    category: { type: mongoose.Schema.Types.ObjectId, ref: "Category", default: null },

    isActive: { type: Boolean, default: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "Admin", default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Product", productSchema);
