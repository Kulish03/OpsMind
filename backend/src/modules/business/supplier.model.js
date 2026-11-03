import mongoose from 'mongoose'

const supplierSchema = new mongoose.Schema(
  {
    businessId: {
      type: String,
      required: true,
      index: true,
      default: 'default_sme_retail',
    },
    supplierId: {
      type: String,
      required: true,
      trim: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    category: {
      type: String,
      trim: true,
      default: 'General Wholesale',
    },
    contactPerson: {
      type: String,
      trim: true,
    },
    email: {
      type: String,
      trim: true,
    },
    phone: {
      type: String,
      trim: true,
    },
    city: {
      type: String,
      trim: true,
    },
    country: {
      type: String,
      default: 'United Kingdom',
      trim: true,
    },
    leadTimeDays: {
      type: Number,
      default: 7,
      min: 1,
    },
    minimumOrderQty: {
      type: Number,
      default: 50,
      min: 1,
    },
    source: {
      type: String,
      enum: ['synthetic', 'user_created'],
      default: 'synthetic',
    },
  },
  { timestamps: true }
)

supplierSchema.index({ businessId: 1, supplierId: 1 }, { unique: true })

export const Supplier = mongoose.models.Supplier || mongoose.model('Supplier', supplierSchema)
export default Supplier
