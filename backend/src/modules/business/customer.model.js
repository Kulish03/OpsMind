import mongoose from 'mongoose'

const customerSchema = new mongoose.Schema(
  {
    businessId: {
      type: String,
      required: true,
      index: true,
      default: 'default_sme_retail',
    },
    customerId: {
      type: String,
      required: true,
      trim: true,
    },
    name: {
      type: String,
      trim: true,
      default: function () {
        return `Customer ${this.customerId}`
      },
    },
    country: {
      type: String,
      default: 'United Kingdom',
      trim: true,
      index: true,
    },
    firstPurchaseDate: {
      type: Date,
    },
    lastPurchaseDate: {
      type: Date,
    },
    totalOrders: {
      type: Number,
      default: 0,
      min: 0,
    },
    totalUnitsPurchased: {
      type: Number,
      default: 0,
    },
    totalSpend: {
      type: Number,
      default: 0,
    },
    rfm: {
      recencyDays: {
        type: Number,
        default: 0,
      },
      frequency: {
        type: Number,
        default: 0,
      },
      monetary: {
        type: Number,
        default: 0,
      },
      retentionStatus: {
        type: String,
        enum: ['ACTIVE', 'DORMANT', 'AT_RISK', 'CHURNED'],
        default: 'ACTIVE',
        index: true,
      },
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

// Compound index: unique CustomerID per business tenant
customerSchema.index({ businessId: 1, customerId: 1 }, { unique: true })
customerSchema.index({ businessId: 1, 'rfm.retentionStatus': 1 })
customerSchema.index({ businessId: 1, totalSpend: -1 })

export const Customer = mongoose.models.Customer || mongoose.model('Customer', customerSchema)
export default Customer
