import mongoose from 'mongoose'

const expenseSchema = new mongoose.Schema(
  {
    businessId: {
      type: String,
      required: true,
      index: true,
      default: 'default_sme_retail',
    },
    expenseId: {
      type: String,
      required: true,
      trim: true,
    },
    category: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    date: {
      type: Date,
      required: true,
      index: true,
    },
    description: {
      type: String,
      required: true,
      trim: true,
    },
    paymentMethod: {
      type: String,
      default: 'Direct Debit',
      trim: true,
    },
    source: {
      type: String,
      enum: ['synthetic', 'uci_retail', 'user_created'],
      default: 'synthetic',
      index: true,
    },
  },
  { timestamps: true }
)

expenseSchema.index({ businessId: 1, expenseId: 1 }, { unique: true })
expenseSchema.index({ businessId: 1, date: -1 })
expenseSchema.index({ businessId: 1, category: 1 })

export const Expense = mongoose.models.Expense || mongoose.model('Expense', expenseSchema)
export default Expense
