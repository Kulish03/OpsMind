import mongoose from 'mongoose'

const alertSchema = new mongoose.Schema(
  {
    businessId: {
      type: String,
      required: true,
      index: true,
      default: 'default_sme_retail',
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    type: {
      type: String,
      enum: [
        'LOW_STOCK',
        'UNUSUAL_EXPENSE',
        'SALES_DROP',
        'STOCKOUT_RISK',
        'CHURN_RISK',
        'BUSINESS_INSIGHT',
      ],
      required: true,
      index: true,
    },
    severity: {
      type: String,
      enum: ['INFO', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL'],
      default: 'MEDIUM',
      index: true,
    },
    description: {
      type: String,
      required: true,
      trim: true,
    },
    supportingData: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    recommendedAction: {
      type: String,
      required: true,
      trim: true,
    },
    actionType: {
      type: String,
      enum: [
        'REORDER_STOCK',
        'AUDIT_EXPENSE',
        'ENGAGE_CUSTOMER',
        'PRICE_ADJUSTMENT',
        'REVIEW_METRIC',
        'DISMISS',
      ],
      default: 'REVIEW_METRIC',
    },
    status: {
      type: String,
      enum: ['OPEN', 'IN_REVIEW', 'ACTIONED', 'DISMISSED'],
      default: 'OPEN',
      index: true,
    },
    resolvedAt: {
      type: Date,
      default: null,
    },
    resolvedBy: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
  }
)

alertSchema.index({ businessId: 1, status: 1, severity: 1 })
alertSchema.index({ businessId: 1, createdAt: -1 })

export const Alert = mongoose.models.Alert || mongoose.model('Alert', alertSchema)
export default Alert
