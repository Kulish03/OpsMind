import { catchAsync } from '../../utils/catchAsync.js'
import { successResponse } from '../../utils/apiResponse.js'
import Sale from '../business/sale.model.js'
import Product from '../business/product.model.js'
import Expense from '../business/expense.model.js'
import InventoryMovement from '../business/inventoryMovement.model.js'
import AppError from '../../utils/AppError.js'

/**
 * Handle real-time POS transaction webhook (Shopify / Square / Lightspeed adapter)
 * POST /api/integrations/pos/webhook
 */
export const handlePOSWebhook = catchAsync(async (req, res) => {
  const { eventType, payload } = req.body
  const businessId = req.businessId || 'default_sme_retail'

  if (!payload || !payload.orderId || !Array.isArray(payload.items)) {
    throw new AppError('Invalid POS webhook payload. orderId and items array are required.', 400)
  }

  const items = payload.items.map((item) => ({
    productSku: (item.sku || 'GENERAL').toUpperCase().trim(),
    productName: item.name || item.description || item.sku || 'POS Item',
    quantity: Number(item.quantity) || 1,
    unitPrice: Number(item.price) || 0,
    lineTotal: (Number(item.quantity) || 1) * (Number(item.price) || 0),
  }))

  const totalAmount = items.reduce((acc, i) => acc + i.lineTotal, 0)
  const totalUnits = items.reduce((acc, i) => acc + Math.abs(i.quantity), 0)

  // 1. Create Sale transaction
  const sale = await Sale.create({
    businessId,
    invoiceId: `POS-${payload.orderId}`,
    transactionDate: payload.timestamp ? new Date(payload.timestamp) : new Date(),
    customerReference: payload.customerId || 'POS_WALKIN',
    billingCountry: payload.country || 'United Kingdom',
    items,
    totalAmount,
    totalUnits,
    status: 'completed',
    isCancellation: false,
  })

  // 2. Adjust Product stock and log movement
  for (const item of items) {
    await Product.findOneAndUpdate(
      { businessId, sku: item.productSku },
      { $inc: { currentStock: -item.quantity } }
    )

    await InventoryMovement.create({
      businessId,
      movementId: `MOV-POS-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      productSku: item.productSku,
      movementType: 'SALE_OUTFLOW',
      quantity: -item.quantity,
      unitCost: item.unitPrice * 0.6,
      referenceId: sale.invoiceId,
      reason: `Automated POS Webhook Sync: Order #${payload.orderId}`,
      timestamp: new Date(),
    })
  }

  return successResponse(
    res,
    {
      saleId: sale._id,
      invoiceId: sale.invoiceId,
      totalAmount,
      itemsCount: items.length,
      syncedAt: new Date(),
    },
    'POS Webhook transaction synced and processed successfully',
    201
  )
})

/**
 * Handle Accounting invoice/expense webhook (QuickBooks / Xero adapter)
 * POST /api/integrations/accounting/webhook
 */
export const handleAccountingWebhook = catchAsync(async (req, res) => {
  const { eventType, payload } = req.body
  const businessId = req.businessId || 'default_sme_retail'

  if (!payload || !payload.amount || !payload.category) {
    throw new AppError('Invalid accounting payload. amount and category are required.', 400)
  }

  const expense = await Expense.create({
    businessId,
    expenseId: `ACC-${payload.invoiceId || Date.now()}`,
    category: payload.category,
    amount: Number(payload.amount),
    description: payload.description || `Accounting Sync: ${payload.vendor || 'Vendor Bill'}`,
    date: payload.date ? new Date(payload.date) : new Date(),
    paymentMethod: payload.paymentMethod || 'BANK_TRANSFER',
  })

  return successResponse(
    res,
    {
      expenseId: expense.expenseId,
      amount: expense.amount,
      category: expense.category,
      syncedAt: new Date(),
    },
    'Accounting webhook expense synced successfully',
    201
  )
})

/**
 * Check Integration Status & Supported Adapters
 * GET /api/integrations/status
 */
export const getIntegrationStatus = catchAsync(async (req, res) => {
  const businessId = req.businessId

  const [posSyncCount, accSyncCount] = await Promise.all([
    Sale.countDocuments({ businessId, invoiceId: { $regex: /^POS-/ } }),
    Expense.countDocuments({ businessId, expenseId: { $regex: /^ACC-/ } }),
  ])

  return successResponse(
    res,
    {
      status: 'active',
      supportedAdapters: [
        { name: 'Shopify POS', type: 'POS', status: 'connected', webhookUrl: '/api/integrations/pos/webhook' },
        { name: 'Square POS', type: 'POS', status: 'connected', webhookUrl: '/api/integrations/pos/webhook' },
        { name: 'QuickBooks Online', type: 'ACCOUNTING', status: 'connected', webhookUrl: '/api/integrations/accounting/webhook' },
        { name: 'Xero Cloud Accounting', type: 'ACCOUNTING', status: 'connected', webhookUrl: '/api/integrations/accounting/webhook' },
      ],
      metrics: {
        totalPosOrdersSynced: posSyncCount,
        totalAccountingBillsSynced: accSyncCount,
        lastHealthCheck: new Date(),
      },
    },
    'Integration status and adapters retrieved successfully'
  )
})
