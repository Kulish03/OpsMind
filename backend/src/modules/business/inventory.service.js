import mongoose from 'mongoose'
import { Product } from './product.model.js'
import { InventoryMovement } from './inventoryMovement.model.js'

/**
 * Escapes regex special characters to prevent ReDoS / syntax errors
 */
const escapeRegex = (string) => {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * Retrieve paginated inventory stock levels enriched with valuation and health status
 */
export const getInventoryOverview = async (businessId, query = {}) => {
  const page = Math.max(1, parseInt(query.page, 10) || 1)
  const limit = Math.min(100, Math.max(1, parseInt(query.limit, 10) || 20))
  const skip = (page - 1) * limit

  const filter = { businessId, isActive: true }

  // Search across SKU, Name, and Category
  if (query.search && query.search.trim()) {
    const escaped = escapeRegex(query.search.trim())
    const searchRegex = new RegExp(escaped, 'i')
    filter.$or = [
      { sku: searchRegex },
      { name: searchRegex },
      { category: searchRegex },
    ]
  }

  // Category filter
  if (query.category && query.category.trim()) {
    filter.category = query.category.trim()
  }

  // Stock Status filters
  if (query.stockStatus && query.stockStatus !== 'all') {
    switch (query.stockStatus) {
      case 'out_of_stock':
        filter.currentStock = { $lte: 0 }
        break
      case 'low_stock':
        filter.$and = [
          { currentStock: { $gt: 0 } },
          { $expr: { $lte: ['$currentStock', '$reorderThreshold'] } },
        ]
        break
      case 'optimal':
        filter.$and = [
          { $expr: { $gt: ['$currentStock', '$reorderThreshold'] } },
          { $expr: { $lte: ['$currentStock', '$targetStock'] } },
        ]
        break
      case 'overstocked':
        filter.$expr = { $gt: ['$currentStock', '$targetStock'] }
        break
      default:
        break
    }
  }

  const sortBy = query.sortBy || 'currentStock'
  const sortOrder = query.sortOrder === 'desc' ? -1 : 1
  const sort = { [sortBy]: sortOrder }

  const [products, total] = await Promise.all([
    Product.find(filter).sort(sort).skip(skip).limit(limit).lean(),
    Product.countDocuments(filter),
  ])

  // Enrich products with computed operational valuation & stock statuses
  const enrichedProducts = products.map((prod) => {
    let stockStatus = 'OPTIMAL'
    if (prod.currentStock <= 0) {
      stockStatus = 'OUT_OF_STOCK'
    } else if (prod.currentStock <= prod.reorderThreshold) {
      stockStatus = 'LOW_STOCK'
    } else if (prod.currentStock > prod.targetStock) {
      stockStatus = 'OVERSTOCKED'
    }

    const inventoryValue = Number((Math.max(0, prod.currentStock) * prod.costPrice).toFixed(2))
    const potentialRevenue = Number((Math.max(0, prod.currentStock) * prod.sellingPrice).toFixed(2))

    return {
      ...prod,
      stockStatus,
      inventoryValue,
      potentialRevenue,
    }
  })

  const totalPages = Math.ceil(total / limit) || 1

  return {
    inventory: enrichedProducts,
    pagination: {
      total,
      page,
      limit,
      totalPages,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1,
    },
  }
}

/**
 * Record an inbound restock / purchase order from suppliers
 */
export const restockInventory = async (businessId, restockData) => {
  const { items, referenceId, reason } = restockData
  const ref = referenceId?.trim() || `RESTOCK-${Date.now()}`

  // Lookup all SKUs
  const skus = [...new Set(items.map((i) => i.productSku.trim().toUpperCase()))]
  const catalogProducts = await Product.find({ businessId, sku: { $in: skus } })
  const productMap = new Map(catalogProducts.map((p) => [p.sku, p]))

  // Validate all SKUs exist
  for (const item of items) {
    const sku = item.productSku.trim().toUpperCase()
    if (!productMap.has(sku)) {
      const error = new Error(`Product with SKU '${sku}' does not exist in your inventory catalog.`)
      error.statusCode = 400
      throw error
    }
  }

  const processedRestocks = []

  for (const item of items) {
    const sku = item.productSku.trim().toUpperCase()
    const product = productMap.get(sku)
    const quantity = Number(item.quantity)
    const unitCost =
      item.unitCost !== undefined && item.unitCost !== null
        ? Number(item.unitCost)
        : product.costPrice

    // Update product stock and optionally update cost price / supplier
    product.currentStock += quantity
    if (item.unitCost !== undefined && item.unitCost !== null) {
      product.costPrice = unitCost
    }
    if (item.supplierId) {
      product.supplierId = item.supplierId.trim()
    }
    await product.save()

    // Record movement ledger entry
    const movementId = `MOV-${Date.now()}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`
    const movement = await InventoryMovement.create({
      businessId,
      movementId,
      productSku: sku,
      movementType: 'INBOUND_PURCHASE',
      quantity, // Positive for inbound additions
      timestamp: new Date(),
      source: 'user_created',
      referenceId: ref,
      unitCost,
      reason: reason || `Supplier Restock PO ${ref}`,
    })

    processedRestocks.push({
      productSku: sku,
      quantityAdded: quantity,
      newStock: product.currentStock,
      unitCost,
      movementId: movement.movementId,
    })
  }

  return {
    referenceId: ref,
    itemsRestocked: processedRestocks.length,
    details: processedRestocks,
  }
}

/**
 * Manually reconcile or adjust stock levels (e.g. cycle counts, audit discrepancies)
 */
export const adjustStock = async (businessId, adjustmentData) => {
  const { productSku, newStock, adjustmentQuantity, reason, referenceId } = adjustmentData
  const sku = productSku.trim().toUpperCase()

  const product = await Product.findOne({ businessId, sku })
  if (!product) {
    const error = new Error(`Product with SKU '${sku}' not found in inventory.`)
    error.statusCode = 404
    throw error
  }

  const previousStock = product.currentStock
  let targetStock = previousStock
  let delta = 0

  if (newStock !== undefined && newStock !== null) {
    targetStock = Number(newStock)
    delta = targetStock - previousStock
  } else if (adjustmentQuantity !== undefined && adjustmentQuantity !== null) {
    delta = Number(adjustmentQuantity)
    targetStock = previousStock + delta
  }

  if (targetStock < 0) {
    const error = new Error(
      `Stock adjustment would result in a negative stock level (${targetStock}). Adjustment rejected.`
    )
    error.statusCode = 400
    throw error
  }

  product.currentStock = targetStock
  await product.save()

  // Record movement audit entry
  const movementId = `MOV-${Date.now()}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`
  const movement = await InventoryMovement.create({
    businessId,
    movementId,
    productSku: sku,
    movementType: 'ADJUSTMENT',
    quantity: delta,
    timestamp: new Date(),
    source: 'user_created',
    referenceId: referenceId?.trim() || `ADJ-${Date.now()}`,
    unitCost: product.costPrice,
    reason,
  })

  return {
    productSku: sku,
    productName: product.name,
    previousStock,
    currentStock: product.currentStock,
    adjustmentDelta: delta,
    movementId: movement.movementId,
    reason,
  }
}

/**
 * Write off damaged, expired, or lost stock
 */
export const writeOffStock = async (businessId, writeOffData) => {
  const { productSku, quantity, reason, referenceId } = writeOffData
  const sku = productSku.trim().toUpperCase()
  const writeOffQty = Number(quantity)

  const product = await Product.findOne({ businessId, sku })
  if (!product) {
    const error = new Error(`Product with SKU '${sku}' not found in inventory.`)
    error.statusCode = 404
    throw error
  }

  if (writeOffQty > product.currentStock) {
    const error = new Error(
      `Cannot write off ${writeOffQty} units of '${sku}'. Current on-hand stock is only ${product.currentStock}.`
    )
    error.statusCode = 400
    throw error
  }

  const previousStock = product.currentStock
  product.currentStock -= writeOffQty
  await product.save()

  // Record movement audit entry
  const movementId = `MOV-${Date.now()}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`
  const movement = await InventoryMovement.create({
    businessId,
    movementId,
    productSku: sku,
    movementType: 'ADJUSTMENT',
    quantity: -writeOffQty, // Signed negative for write-offs
    timestamp: new Date(),
    source: 'user_created',
    referenceId: referenceId?.trim() || `WRITEOFF-${Date.now()}`,
    unitCost: product.costPrice,
    reason: `Write-Off: ${reason}`,
  })

  return {
    productSku: sku,
    productName: product.name,
    previousStock,
    currentStock: product.currentStock,
    writtenOffUnits: writeOffQty,
    totalWriteOffCost: Number((writeOffQty * product.costPrice).toFixed(2)),
    movementId: movement.movementId,
    reason,
  }
}

/**
 * Query inventory movement audit ledger across all tenant activities
 */
export const getMovements = async (businessId, query = {}) => {
  const page = Math.max(1, parseInt(query.page, 10) || 1)
  const limit = Math.min(100, Math.max(1, parseInt(query.limit, 10) || 20))
  const skip = (page - 1) * limit

  const filter = { businessId }

  if (query.productSku && query.productSku.trim()) {
    filter.productSku = query.productSku.trim().toUpperCase()
  }

  if (query.movementType) {
    filter.movementType = query.movementType
  }

  if (query.startDate || query.endDate) {
    filter.timestamp = {}
    if (query.startDate) {
      filter.timestamp.$gte = new Date(query.startDate)
    }
    if (query.endDate) {
      const end = new Date(query.endDate)
      if (query.endDate.length <= 10) {
        end.setHours(23, 59, 59, 999)
      }
      filter.timestamp.$lte = end
    }
  }

  if (query.search && query.search.trim()) {
    const escaped = escapeRegex(query.search.trim())
    const searchRegex = new RegExp(escaped, 'i')
    filter.$or = [
      { productSku: searchRegex },
      { referenceId: searchRegex },
      { reason: searchRegex },
    ]
  }

  const sortBy = query.sortBy || 'timestamp'
  const sortOrder = query.sortOrder === 'asc' ? 1 : -1
  const sort = { [sortBy]: sortOrder }

  const [movements, total] = await Promise.all([
    InventoryMovement.find(filter).sort(sort).skip(skip).limit(limit).lean(),
    InventoryMovement.countDocuments(filter),
  ])

  const totalPages = Math.ceil(total / limit) || 1

  return {
    movements,
    pagination: {
      total,
      page,
      limit,
      totalPages,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1,
    },
  }
}

/**
 * Retrieve movement history for a single product SKU
 */
export const getMovementsBySku = async (businessId, sku, query = {}) => {
  return getMovements(businessId, { ...query, productSku: sku })
}

/**
 * Comprehensive inventory health & valuation metrics
 */
export const getInventorySummary = async (businessId) => {
  const products = await Product.find({ businessId, isActive: true }).lean()

  let totalSkus = 0
  let totalUnits = 0
  let totalCostValuation = 0
  let totalRetailValuation = 0
  let outOfStockCount = 0
  let lowStockCount = 0
  let optimalCount = 0
  let overstockedCount = 0

  for (const p of products) {
    totalSkus += 1
    const stock = Math.max(0, p.currentStock || 0)
    totalUnits += stock
    totalCostValuation += stock * (p.costPrice || 0)
    totalRetailValuation += stock * (p.sellingPrice || 0)

    if (p.currentStock <= 0) {
      outOfStockCount += 1
    } else if (p.currentStock <= p.reorderThreshold) {
      lowStockCount += 1
    } else if (p.currentStock > p.targetStock) {
      overstockedCount += 1
    } else {
      optimalCount += 1
    }
  }

  return {
    businessId,
    totalSkus,
    totalUnitsOnHand: totalUnits,
    totalValuationAtCost: Number(totalCostValuation.toFixed(2)),
    totalValuationAtRetail: Number(totalRetailValuation.toFixed(2)),
    potentialGrossProfit: Number((totalRetailValuation - totalCostValuation).toFixed(2)),
    healthCounts: {
      outOfStock: outOfStockCount,
      lowStock: lowStockCount,
      optimal: optimalCount,
      overstocked: overstockedCount,
    },
  }
}
