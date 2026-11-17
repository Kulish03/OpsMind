import mongoose from 'mongoose'

const chunkSchema = new mongoose.Schema(
  {
    chunkId: { type: String, required: true },
    text: { type: String, required: true },
    keywords: [{ type: String }],
  },
  { _id: false }
)

const businessDocumentSchema = new mongoose.Schema(
  {
    businessId: {
      type: String,
      required: [true, 'Tenant businessId is strictly required'],
      index: true,
    },
    title: {
      type: String,
      required: [true, 'Document title is required'],
      trim: true,
    },
    category: {
      type: String,
      enum: ['POLICY', 'CONTRACT', 'SLA', 'OPERATIONS', 'GENERAL'],
      default: 'POLICY',
      index: true,
    },
    content: {
      type: String,
      required: [true, 'Document text content is required'],
    },
    chunks: [chunkSchema],
    metadata: {
      author: { type: String, default: 'Admin' },
      version: { type: String, default: '1.0' },
      tags: [{ type: String }],
    },
  },
  { timestamps: true }
)

businessDocumentSchema.index({ businessId: 1, title: 1 })
businessDocumentSchema.index({ businessId: 1, category: 1 })

const BusinessDocument = mongoose.model('BusinessDocument', businessDocumentSchema)

export default BusinessDocument
