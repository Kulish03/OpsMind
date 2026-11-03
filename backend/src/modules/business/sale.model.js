import mongoose from 'mongoose'

const saleItemSchema = new mongoose.Schema(
  {
    productSku: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
    },
    productName: {
      type: String,
      required: true,
      trim: true,
    },
    quantity: {
      type: Number,
      required: true,
    },
    unitPrice: {
      type: Number,
      required: true,
      min: 0,
    },
    lineTotal: {
      type: Number,
      required: true,
    },
  },
  { _id: false }
)

const saleSchema = new mongoose.Schema(
  {
    businessId: {
      type: String,
      required: true,
      index: true,
      default: 'default_sme_retail',
    },
    invoiceId: {
      type: String,
      required: true,
      trim: true,
    },
    transactionDate: {
      type: Date,
      required: true,
      index: true,
    },
    customerReference: {
      type: String,
      default: 'GUEST',
      trim: true,
      index: true,
    },
    billingCountry: {
      type: String,
      default: 'United Kingdom',
      trim: true,
      index: true,
    },
    status: {
      type: String,
      enum: ['completed', 'cancelled', 'refunded'],
      default: 'completed',
      index: true,
    },
    isCancellation: {
      type: Boolean,
      default: false,
      index: true,
    },
    totalAmount: {
      type: Number,
      required: true,
    },
    totalUnits: {
      type: Number,
      required: true,
    },
    items: {
      type: [saleItemSchema],
      required: true,
      validate: [
        (val) => val.length > 0,
        'Sale must contain at least one line item',
      ],
    },
    source: {
      type: String,
      enum: ['uci_retail', 'pos', 'synthetic'],
      default: 'uci_retail',
    },
  },
  {
    timestamps: true,
  }
)

// Compound Indexes for fast tenant-isolated operational querying
saleSchema.index({ businessId: 1, invoiceId: 1 }, { unique: true })
saleSchema.index({ businessId: 1, transactionDate: -1 })
saleSchema.index({ businessId: 1, customerReference: 1 })
saleSchema.index({ businessId: 1, 'items.productSku': 1 })

export const Sale = mongoose.models.Sale || mongoose.model('Sale', saleSchema)
export default Sale
