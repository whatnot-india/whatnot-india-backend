const Product = require("../models/Product");

// ✅ Deduct stock from specific variant
async function holdStock(products) {
  for (const item of products) {
    const product = await Product.findById(item.product);
    if (!product) throw new Error(`Product not found: ${item.product}`);

    if (item.variantId) {
      const variant = product.variants.id(item.variantId);
      if (!variant) throw new Error(`Variant not found for product ${product.name}`);
      if (variant.quantity < item.quantity)
        throw new Error(`Insufficient stock for ${product.name} (${variant.color})`);
      variant.quantity -= item.quantity;
    } else {
      if (product.quantity < item.quantity)
        throw new Error(`Insufficient stock for ${product.name}`);
      product.quantity -= item.quantity;
    }

    await product.save();
  }
}

// ✅ Restore stock if payment fails
async function unholdStock(products) {
  for (const item of products) {
    const product = await Product.findById(item.product);
    if (!product) continue;

    if (item.variantId) {
      const variant = product.variants.id(item.variantId);
      if (variant) variant.quantity += item.quantity;
    } else {
      product.quantity += item.quantity;
    }

    await product.save();
  }
}

module.exports = { holdStock, unholdStock };
