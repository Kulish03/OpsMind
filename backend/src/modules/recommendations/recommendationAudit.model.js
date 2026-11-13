import mongoose from 'mongoose'

const recommendationAuditSchema = new mongoose.Schema(
  {
    businessId: {
      type: String,
      required: [true, 'Tenant businessId is strictly required'],
      index: true,
    },
    recommendationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Recommendation',
      required: true,
      index: true,
    },
    recommendationTitle: {
      type: String,
      required: true,
    },
    recommendationType: {
      type: String,
      required: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    userName: {
      type: String,
      required: true,
    },
    userRole: {
      type: String,
      default: 'admin',
    },
    action: {
      type: String,
      enum: [
        'GENERATED',
        'VIEWED',
        'APPROVED',
        'REJECTED',
        'DISMISSED',
        'ACTION_CONFIRMED',
        'ACTION_EXECUTED',
      ],
      required: true,
    },
    previousStatus: {
      type: String,
    },
    newStatus: {
      type: String,
    },
    notes: {
      type: String,
      default: '',
    },
    executionPayload: {
      type: mongoose.Schema.Types.Mixed,
    },
    executionResult: {
      type: mongoose.Schema.Types.Mixed,
    },
    timestamp: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  {
    timestamps: false,
  }
)

recommendationAuditSchema.index({ businessId: 1, timestamp: -1 })

const RecommendationAudit = mongoose.model('RecommendationAudit', recommendationAuditSchema)

export default RecommendationAudit
