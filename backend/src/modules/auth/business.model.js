import mongoose from 'mongoose'

const businessSchema = new mongoose.Schema(
  {
    businessId: {
      type: String,
      required: [true, 'Business identifier is required'],
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    name: {
      type: String,
      required: [true, 'Business name is required'],
      trim: true,
      minlength: [2, 'Business name must be at least 2 characters'],
      maxlength: [100, 'Business name cannot exceed 100 characters'],
    },
    businessType: {
      type: String,
      enum: {
        values: ['retail', 'wholesale', 'e-commerce', 'restaurant', 'services', 'other'],
        message: '{VALUE} is not a valid business type',
      },
      default: 'retail',
      index: true,
    },
    currency: {
      type: String,
      default: 'GBP',
      uppercase: true,
      trim: true,
      minlength: 3,
      maxlength: 3,
    },
    timeZone: {
      type: String,
      default: 'UTC',
      trim: true,
    },
    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    contactEmail: {
      type: String,
      lowercase: true,
      trim: true,
    },
    contactPhone: {
      type: String,
      trim: true,
    },
    address: {
      street: { type: String, trim: true, default: '' },
      city: { type: String, trim: true, default: '' },
      country: { type: String, trim: true, default: 'United Kingdom' },
      postalCode: { type: String, trim: true, default: '' },
    },
    settings: {
      defaultLowStockThreshold: { type: Number, default: 20, min: 1 },
      defaultTargetStock: { type: Number, default: 100, min: 1 },
      taxRatePercentage: { type: Number, default: 0, min: 0, max: 100 },
    },
    demoDataLoaded: {
      type: Boolean,
      default: false,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
  },
  {
    timestamps: true,
  }
)

export const Business = mongoose.models.Business || mongoose.model('Business', businessSchema)
export default Business
