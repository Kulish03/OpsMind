import mongoose from 'mongoose'

const messageSchema = new mongoose.Schema(
  {
    role: {
      type: String,
      enum: ['user', 'assistant', 'system', 'tool'],
      required: true,
    },
    content: {
      type: String,
      required: true,
    },
    // Supporting metadata: tool executed, metrics cited, supporting records
    toolCalls: [
      {
        toolName: { type: String, required: true },
        args: { type: mongoose.Schema.Types.Mixed },
        resultSummary: { type: String },
        recordCount: { type: Number, default: 0 },
        executedAt: { type: Date, default: Date.now },
      },
    ],
    supportingData: {
      metrics: { type: mongoose.Schema.Types.Mixed },
      timePeriod: { type: String },
      records: [{ type: mongoose.Schema.Types.Mixed }],
    },
    timestamp: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false }
)

const copilotConversationSchema = new mongoose.Schema(
  {
    businessId: {
      type: String,
      required: [true, 'Tenant businessId is strictly required for copilot conversation'],
      index: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    title: {
      type: String,
      default: 'New Business Inquiry',
      trim: true,
    },
    messages: [messageSchema],
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
)

// Compound index for fast tenant + user conversation lookup
copilotConversationSchema.index({ businessId: 1, userId: 1, updatedAt: -1 })

const CopilotConversation = mongoose.model('CopilotConversation', copilotConversationSchema)

export default CopilotConversation
