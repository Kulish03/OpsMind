import mongoose from 'mongoose'

const inventoryMovementSchema = new mongoose.Schema(
  {
    businessId: {
      type: String,
      required: true,
      index: true,
      default: 'default_sme_retail',
    },
    movementId: {
      type: String,
      required: true,
      trim: true,
    },
    productSku: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      index: true,
    },
    movementType: {
      type: String,
      enum: ['OPENING_BALANCE', 'INBOUND_PURCHASE', 'SALE_OUTFLOW', 'CUSTOMER_RETURN', 'ADJUSTMENT'],
      required: true,
      index: true,
    },
    quantity: {
      type: Number,
      required: true, // Signed: positive for additions, negative for reductions
    },
    timestamp: {
      type: Date,
      required: true,
      index: true,
    },
    source: {
      type: String,
      enum: ['synthetic', 'uci_retail', 'user_created'],
      default: 'synthetic',
    },
    referenceId: {
      type: String,
      trim: true,
      default: null,
    },
    unitCost: {
      type: Number,
      default: 0,
      min: 0,
    },
    reason: {
      type: String,
      trim: true,
      default: null,
    },
  },
  { timestamps: true }
)

inventoryMovementSchema.index({ businessId: 1, movementId: 1 }, { unique: true })
inventoryMovementSchema.index({ businessId: 1, productSku: 1, timestamp: -1 })
inventoryMovementSchema.index({ businessId: 1, movementType: 1 })

export const InventoryMovement = mongoose.models.InventoryMovement || mongoose.model('InventoryMovement', inventoryMovementSchema)
export default InventoryMovement
