import mongoose from 'mongoose'

const productSchema = new mongoose.Schema(
  {
    businessId: {
      type: String,
      required: true,
      index: true,
      default: 'default_sme_retail',
    },
    sku: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    category: {
      type: String,
      default: 'General Merchandise',
      trim: true,
      index: true,
    },
    sellingPrice: {
      type: Number,
      required: true,
      min: 0,
    },
    costPrice: {
      type: Number,
      default: 0,
      min: 0,
    },
    currentStock: {
      type: Number,
      default: 0,
    },
    reorderThreshold: {
      type: Number,
      default: 20,
      min: 0,
    },
    targetStock: {
      type: Number,
      default: 100,
      min: 0,
    },
    supplierId: {
      type: String,
      default: null,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    source: {
      type: String,
      enum: ['uci_retail', 'user_created', 'synthetic'],
      default: 'uci_retail',
    },
  },
  {
    timestamps: true,
  }
)

// Compound index: unique SKU per business tenant
productSchema.index({ businessId: 1, sku: 1 }, { unique: true })
// Index for fast low-stock queries
productSchema.index({ businessId: 1, currentStock: 1 })

export const Product = mongoose.models.Product || mongoose.model('Product', productSchema)
export default Product
