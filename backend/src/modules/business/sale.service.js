import mongoose from 'mongoose'
import { Sale } from './sale.model.js'
import { Product } from './product.model.js'
import { InventoryMovement } from './inventoryMovement.model.js'
import { Customer } from './customer.model.js'

/**
 * Escapes regex special characters to prevent ReDoS / syntax errors
 */
const escapeRegex = (string) => {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * List sales for a specific business tenant with filtering, date range, search and pagination
 */
export const listSales = async (businessId, query = {}) => {
  const page = Math.max(1, parseInt(query.page, 10) || 1)
  const limit = Math.min(100, Math.max(1, parseInt(query.limit, 10) || 20))
  const skip = (page - 1) * limit

  const filter = { businessId }

  // Status filter
  if (query.status) {
    filter.status = query.status
  }

  // Date range filter
  if (query.startDate || query.endDate) {
    filter.transactionDate = {}
    if (query.startDate) {
      filter.transactionDate.$gte = new Date(query.startDate)
    }
    if (query.endDate) {
      const end = new Date(query.endDate)
      // If time not specified, include full day
      if (query.endDate.length <= 10) {
        end.setHours(23, 59, 59, 999)
      }
      filter.transactionDate.$lte = end
    }
  }

  // SKU filter across sale line items
  if (query.productSku && query.productSku.trim()) {
    filter['items.productSku'] = query.productSku.trim().toUpperCase()
  }

  // Customer reference filter
  if (query.customerReference && query.customerReference.trim()) {
    filter.customerReference = query.customerReference.trim()
  }

  // General search across invoice ID and customer reference
  if (query.search && query.search.trim()) {
    const escaped = escapeRegex(query.search.trim())
    const searchRegex = new RegExp(escaped, 'i')
    filter.$or = [
      { invoiceId: searchRegex },
      { customerReference: searchRegex },
    ]
  }

  // Sorting
  const sortBy = query.sortBy || 'transactionDate'
  const sortOrder = query.sortOrder === 'asc' ? 1 : -1
  const sort = { [sortBy]: sortOrder }

  const [sales, total, summaryAgg] = await Promise.all([
    Sale.find(filter).sort(sort).skip(skip).limit(limit).lean(),
    Sale.countDocuments(filter),
    Sale.aggregate([
      { $match: filter },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: '$totalAmount' },
          totalUnits: { $sum: '$totalUnits' },
        },
      },
    ]),
  ])

  const totalPages = Math.ceil(total / limit) || 1
  const totals = summaryAgg[0] || { totalRevenue: 0, totalUnits: 0 }

  return {
    sales,
    pagination: {
      total,
      page,
      limit,
      totalPages,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1,
    },
    filteredTotals: {
      totalRevenue: Number(totals.totalRevenue.toFixed(2)),
      totalUnits: totals.totalUnits,
    },
  }
}

/**
 * Fetch a single sale invoice by MongoDB ID
 */
export const getSaleById = async (businessId, saleId) => {
  if (!mongoose.Types.ObjectId.isValid(saleId)) {
    const error = new Error(`Invalid sale ID: ${saleId}`)
    error.statusCode = 400
    throw error
  }

  const sale = await Sale.findOne({ _id: saleId, businessId })
  if (!sale) {
    const error = new Error(`Sale not found with ID: ${saleId}`)
    error.statusCode = 404
    throw error
  }

  return sale
}

/**
 * Fetch a single sale invoice by tenant-scoped Invoice ID
 */
export const getSaleByInvoiceId = async (businessId, invoiceId) => {
  const formattedInvoiceId = invoiceId.trim()
  const sale = await Sale.findOne({ businessId, invoiceId: formattedInvoiceId })

  if (!sale) {
    const error = new Error(`Sale invoice not found with ID: ${formattedInvoiceId}`)
    error.statusCode = 404
    throw error
  }

  return sale
}

/**
 * Record a new sale transaction
 * Automatically computes line totals, validates SKUs, updates product stock,
 * and records inventory movement ledger entries.
 */
export const createSale = async (businessId, saleData) => {
  // Generate invoiceId if not provided
  const invoiceId =
    saleData.invoiceId?.trim() ||
    `INV-${Date.now()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`

  // Check invoice ID collision within tenant
  const existingInvoice = await Sale.findOne({ businessId, invoiceId })
  if (existingInvoice) {
    const error = new Error(`Sale invoice with ID '${invoiceId}' already exists in your business.`)
    error.statusCode = 409
    throw error
  }

  // Deduplicate and look up products in catalog
  const skus = [...new Set(saleData.items.map((i) => i.productSku.trim().toUpperCase()))]
  const catalogProducts = await Product.find({ businessId, sku: { $in: skus } }).lean()
  const productMap = new Map(catalogProducts.map((p) => [p.sku, p]))

  // Validate every line item against catalog
  const processedItems = []
  for (const item of saleData.items) {
    const sku = item.productSku.trim().toUpperCase()
    const product = productMap.get(sku)

    if (!product) {
      const error = new Error(`Product with SKU '${sku}' does not exist in your inventory.`)
      error.statusCode = 400
      throw error
    }

    const productName = item.productName || product.name
    const unitPrice =
      item.unitPrice !== undefined && item.unitPrice !== null
        ? Number(item.unitPrice)
        : product.sellingPrice
    const quantity = Number(item.quantity)
    const lineTotal = Number((quantity * unitPrice).toFixed(2))

    processedItems.push({
      productSku: sku,
      productName,
      quantity,
      unitPrice,
      lineTotal,
    })
  }

  // Calculate order aggregations
  const totalAmount = Number(
    processedItems.reduce((acc, it) => acc + it.lineTotal, 0).toFixed(2)
  )
  const totalUnits = processedItems.reduce((acc, it) => acc + it.quantity, 0)
  const transactionDate = saleData.transactionDate ? new Date(saleData.transactionDate) : new Date()

  const sale = new Sale({
    businessId, // Invariant: strict tenant scoping
    invoiceId,
    transactionDate,
    customerReference: saleData.customerReference || 'GUEST',
    billingCountry: saleData.billingCountry || 'United Kingdom',
    status: saleData.status || 'completed',
    isCancellation: false,
    totalAmount,
    totalUnits,
    items: processedItems,
    source: saleData.source || 'pos',
  })

  await sale.save()

  // If sale is completed, deduct inventory and log movements
  if (sale.status === 'completed') {
    for (const item of processedItems) {
      // 1. Decrement product stock
      await Product.updateOne(
        { businessId, sku: item.productSku },
        { $inc: { currentStock: -item.quantity } }
      )

      // 2. Record movement ledger entry
      const movementId = `MOV-${Date.now()}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`
      const catalogProd = productMap.get(item.productSku)

      await InventoryMovement.create({
        businessId,
        movementId,
        productSku: item.productSku,
        movementType: 'SALE_OUTFLOW',
        quantity: -item.quantity,
        timestamp: transactionDate,
        source: 'user_created',
        referenceId: invoiceId,
        unitCost: catalogProd?.costPrice || 0,
        reason: `Sale Invoice ${invoiceId}`,
      })
    }

    // 3. Update customer aggregate metrics if registered
    if (sale.customerReference && sale.customerReference !== 'GUEST') {
      await Customer.findOneAndUpdate(
        { businessId, customerId: sale.customerReference },
        {
          $inc: {
            totalOrders: 1,
            totalSpend: totalAmount,
            totalUnitsPurchased: totalUnits,
          },
          $set: { lastPurchaseDate: transactionDate },
        }
      )
    }
  }

  return sale
}

/**
 * Cancel or refund an existing sale invoice
 * Reverses inventory stock and records CUSTOMER_RETURN movement ledger entries.
 */
export const cancelOrRefundSale = async (businessId, identifier, { status = 'cancelled', reason = '' } = {}) => {
  let sale = null
  if (mongoose.Types.ObjectId.isValid(identifier)) {
    sale = await Sale.findOne({ _id: identifier, businessId })
  }
  if (!sale) {
    sale = await Sale.findOne({ invoiceId: identifier.trim(), businessId })
  }

  if (!sale) {
    const error = new Error(`Sale not found with ID or Invoice ID: ${identifier}`)
    error.statusCode = 404
    throw error
  }

  if (sale.status === 'cancelled' || sale.status === 'refunded' || sale.isCancellation) {
    const error = new Error(`Sale ${sale.invoiceId} is already marked as ${sale.status}.`)
    error.statusCode = 400
    throw error
  }

  // Update sale state
  sale.status = status
  sale.isCancellation = true
  await sale.save()

  // Reverse inventory adjustments and log movement
  for (const item of sale.items) {
    // 1. Increment product stock back
    await Product.updateOne(
      { businessId, sku: item.productSku },
      { $inc: { currentStock: item.quantity } }
    )

    // 2. Record customer return movement
    const movementId = `MOV-${Date.now()}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`
    await InventoryMovement.create({
      businessId,
      movementId,
      productSku: item.productSku,
      movementType: 'CUSTOMER_RETURN',
      quantity: item.quantity,
      timestamp: new Date(),
      source: 'user_created',
      referenceId: sale.invoiceId,
      reason: reason || `Cancelled / Refunded invoice ${sale.invoiceId}`,
    })
  }

  // Reverse customer metrics if registered
  if (sale.customerReference && sale.customerReference !== 'GUEST') {
    await Customer.findOneAndUpdate(
      { businessId, customerId: sale.customerReference },
      {
        $inc: {
          totalOrders: -1,
          totalSpend: -sale.totalAmount,
          totalUnitsPurchased: -sale.totalUnits,
        },
      }
    )
  }

  return {
    message: `Sale invoice ${sale.invoiceId} successfully marked as ${status}. Stock restored.`,
    sale,
  }
}

/**
 * Calculate tenant-scoped sales performance KPIs
 */
export const getSalesSummary = async (businessId, query = {}) => {
  const filter = { businessId, status: 'completed' }

  if (query.startDate || query.endDate) {
    filter.transactionDate = {}
    if (query.startDate) {
      filter.transactionDate.$gte = new Date(query.startDate)
    }
    if (query.endDate) {
      const end = new Date(query.endDate)
      if (query.endDate.length <= 10) {
        end.setHours(23, 59, 59, 999)
      }
      filter.transactionDate.$lte = end
    }
  }

  const agg = await Sale.aggregate([
    { $match: filter },
    {
      $group: {
        _id: null,
        totalRevenue: { $sum: '$totalAmount' },
        totalUnits: { $sum: '$totalUnits' },
        completedSalesCount: { $sum: 1 },
      },
    },
  ])

  const stats = agg[0] || { totalRevenue: 0, totalUnits: 0, completedSalesCount: 0 }
  const aov =
    stats.completedSalesCount > 0
      ? Number((stats.totalRevenue / stats.completedSalesCount).toFixed(2))
      : 0

  return {
    businessId,
    totalRevenue: Number(stats.totalRevenue.toFixed(2)),
    totalUnits: stats.totalUnits,
    totalInvoices: stats.completedSalesCount,
    averageOrderValue: aov,
  }
}
