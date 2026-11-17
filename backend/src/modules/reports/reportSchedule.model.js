import mongoose from 'mongoose'

const reportScheduleSchema = new mongoose.Schema(
  {
    businessId: {
      type: String,
      required: [true, 'Tenant businessId is strictly required'],
      index: true,
    },
    reportType: {
      type: String,
      enum: ['EXECUTIVE_SUMMARY', 'INVENTORY_HEALTH', 'EXPENSE_AUDIT', 'SALES_DIGEST'],
      required: true,
    },
    frequency: {
      type: String,
      enum: ['DAILY', 'WEEKLY', 'MONTHLY'],
      default: 'WEEKLY',
    },
    recipients: [
      {
        type: String,
        trim: true,
        lowercase: true,
      },
    ],
    nextRunDate: {
      type: Date,
      default: () => {
        const d = new Date()
        d.setDate(d.getDate() + 7)
        return d
      },
    },
    lastRunDate: {
      type: Date,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    executionHistory: [
      {
        executedAt: { type: Date, default: Date.now },
        status: { type: String, enum: ['SUCCESS', 'FAILED'], default: 'SUCCESS' },
        summaryDetails: { type: String },
      },
    ],
  },
  { timestamps: true }
)

reportScheduleSchema.index({ businessId: 1, isActive: 1 })

const ReportSchedule = mongoose.model('ReportSchedule', reportScheduleSchema)

export default ReportSchedule
