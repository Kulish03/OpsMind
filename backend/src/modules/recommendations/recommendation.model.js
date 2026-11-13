import mongoose from 'mongoose'

const recommendationSchema = new mongoose.Schema(
  {
    businessId: {
      type: String,
      required: [true, 'Tenant businessId is strictly required'],
      index: true,
    },
    title: {
      type: String,
      required: [true, 'Recommendation title is required'],
      trim: true,
    },
    type: {
      type: String,
      enum: [
        'INVENTORY_REORDER',
        'EXPENSE_AUDIT',
        'CUSTOMER_RETENTION',
        'PRICING_OPTIMIZATION',
        'SALES_OPPORTUNITY',
      ],
      required: true,
      index: true,
    },
    category: {
      type: String,
      enum: ['Inventory', 'Finance', 'Customers', 'Pricing', 'Operations'],
      required: true,
    },
    severity: {
      type: String,
      enum: ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'],
      default: 'MEDIUM',
      index: true,
    },
    urgency: {
      type: String,
      enum: ['IMMEDIATE', 'THIS_WEEK', 'ROUTINE', 'MONITOR'],
      default: 'ROUTINE',
      index: true,
    },
    status: {
      type: String,
      enum: ['PENDING_REVIEW', 'APPROVED', 'REJECTED', 'DISMISSED', 'APPLIED'],
      default: 'PENDING_REVIEW',
      index: true,
    },
    reason: {
      type: String,
      required: [true, 'Recommendation rationale is required'],
    },
    evidence: {
      metrics: {
        type: mongoose.Schema.Types.Mixed,
        default: {},
      },
      supportingRecords: {
        type: [mongoose.Schema.Types.Mixed],
        default: [],
      },
      generatedBy: {
        type: String,
        enum: ['BUSINESS_RULES', 'ML_FORECAST', 'ML_ANOMALY', 'ML_CHURN', 'INVENTORY_RISK'],
        default: 'BUSINESS_RULES',
      },
    },
    estimatedImpact: {
      metric: { type: String, default: 'Operational Efficiency' },
      amount: { type: Number, default: 0 },
      currency: { type: String, default: 'GBP' },
      explanation: { type: String, default: '' },
    },
    action: {
      actionType: {
        type: String,
        enum: [
          'PURCHASE_ORDER',
          'EXPENSE_REVIEW',
          'WINBACK_CAMPAIGN',
          'PRICE_ADJUSTMENT',
          'THRESHOLD_UPDATE',
        ],
        required: true,
      },
      targetEntity: {
        entityType: {
          type: String,
          enum: ['product', 'expense', 'customer', 'supplier', 'general'],
          default: 'general',
        },
        entityId: { type: String },
        sku: { type: String },
        name: { type: String },
      },
      suggestedPayload: {
        type: mongoose.Schema.Types.Mixed,
        default: {},
      },
      isConsequential: {
        type: Boolean,
        default: true,
      },
      requiresConfirmation: {
        type: Boolean,
        default: true,
      },
    },
    decision: {
      decidedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
      decidedByName: { type: String },
      decidedAt: { type: Date },
      decisionNotes: { type: String },
      appliedActionResults: {
        type: mongoose.Schema.Types.Mixed,
      },
    },
  },
  {
    timestamps: true,
  }
)

// Compound indexes for fast tenant queries
recommendationSchema.index({ businessId: 1, status: 1, severity: 1 })
recommendationSchema.index({ businessId: 1, type: 1, 'action.targetEntity.entityId': 1 })

const Recommendation = mongoose.model('Recommendation', recommendationSchema)

export default Recommendation
