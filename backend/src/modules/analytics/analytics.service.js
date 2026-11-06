import mongoose from 'mongoose'
import { Sale } from '../business/sale.model.js'
import { Product } from '../business/product.model.js'
import { Expense } from '../business/expense.model.js'
import { Customer } from '../business/customer.model.js'

/**
 * Calculate comprehensive financial and operational KPIs for an SME tenant
 */
export const getExecutiveKPIs = async (businessId, query = {}) => {
  const saleFilter = { businessId, status: 'completed' }
  const expenseFilter = { businessId }

  if (query.startDate || query.endDate) {
    saleFilter.transactionDate = {}
    expenseFilter.date = {}
    if (query.startDate) {
      const start = new Date(query.startDate)
      saleFilter.transactionDate.$gte = start
      expenseFilter.date.$gte = start
    }
    if (query.endDate) {
      const end = new Date(query.endDate)
      if (query.endDate.length <= 10) {
        end.setHours(23, 59, 59, 999)
      }
      saleFilter.transactionDate.$lte = end
      expenseFilter.date.$lte = end
    }
  }

  // 1. Sales & Revenue Aggregation
  const salesAggPromise = Sale.aggregate([
    { $match: saleFilter },
    {
      $group: {
        _id: null,
        totalRevenue: { $sum: '$totalAmount' },
        totalOrders: { $sum: 1 },
        totalUnits: { $sum: '$totalUnits' },
      },
    },
  ])

  // 2. Cost of Goods Sold (COGS) Calculation from line items joined with product costs
  const cogsAggPromise = Sale.aggregate([
    { $match: saleFilter },
    { $unwind: '$items' },
    {
      $lookup: {
        from: 'products',
        let: { sku: '$items.productSku', biz: '$businessId' },
        pipeline: [
          { $match: { $expr: { $and: [{ $eq: ['$sku', '$$sku'] }, { $eq: ['$businessId', '$$biz'] }] } } },
          { $project: { costPrice: 1 } },
        ],
        as: 'productInfo',
      },
    },
    {
      $project: {
        quantity: '$items.quantity',
        costPrice: {
          $ifNull: [{ $arrayElemAt: ['$productInfo.costPrice', 0] }, 0],
        },
      },
    },
    {
      $group: {
        _id: null,
        totalCOGS: { $sum: { $multiply: ['$quantity', '$costPrice'] } },
      },
    },
  ])

  // 3. Operating Expenses Aggregation
  const expenseAggPromise = Expense.aggregate([
    { $match: expenseFilter },
    {
      $group: {
        _id: null,
        totalExpenses: { $sum: '$amount' },
        expensesCount: { $sum: 1 },
      },
    },
  ])

  // 4. Current Inventory Valuation & Product Counts
  const inventoryAggPromise = Product.aggregate([
    { $match: { businessId, isActive: true } },
    {
      $group: {
        _id: null,
        totalValuationAtCost: { $sum: { $multiply: [{ $max: ['$currentStock', 0] }, '$costPrice'] } },
        totalValuationAtRetail: { $sum: { $multiply: [{ $max: ['$currentStock', 0] }, '$sellingPrice'] } },
        totalActiveSkus: { $sum: 1 },
      },
    },
  ])

  // 5. Customer Metrics
  const customersCountPromise = Customer.countDocuments({ businessId })

  const [salesAgg, cogsAgg, expenseAgg, inventoryAgg, totalCustomers] = await Promise.all([
    salesAggPromise,
    cogsAggPromise,
    expenseAggPromise,
    inventoryAggPromise,
    customersCountPromise,
  ])

  const sales = salesAgg[0] || { totalRevenue: 0, totalOrders: 0, totalUnits: 0 }
  const totalRevenue = Number(sales.totalRevenue.toFixed(2))
  const totalOrders = sales.totalOrders
  const totalUnitsSold = sales.totalUnits
  const aov = totalOrders > 0 ? Number((totalRevenue / totalOrders).toFixed(2)) : 0

  const totalCOGS = Number((cogsAgg[0]?.totalCOGS || 0).toFixed(2))
  const grossProfit = Number((totalRevenue - totalCOGS).toFixed(2))
  const grossMarginPercentage =
    totalRevenue > 0 ? Number(((grossProfit / totalRevenue) * 100).toFixed(2)) : 0

  const totalOperatingExpenses = Number((expenseAgg[0]?.totalExpenses || 0).toFixed(2))
  const netProfit = Number((grossProfit - totalOperatingExpenses).toFixed(2))
  const netProfitMarginPercentage =
    totalRevenue > 0 ? Number(((netProfit / totalRevenue) * 100).toFixed(2)) : 0

  const inventory = inventoryAgg[0] || {
    totalValuationAtCost: 0,
    totalValuationAtRetail: 0,
    totalActiveSkus: 0,
  }

  return {
    businessId,
    period: {
      startDate: query.startDate || null,
      endDate: query.endDate || null,
    },
    revenueAndOrders: {
      totalRevenue,
      totalOrders,
      totalUnitsSold,
      averageOrderValue: aov,
    },
    profitability: {
      costOfGoodsSold: totalCOGS,
      grossProfit,
      grossMarginPercentage,
      totalOperatingExpenses,
      netProfit,
      netProfitMarginPercentage,
    },
    balanceMetrics: {
      inventoryValuationAtCost: Number(inventory.totalValuationAtCost.toFixed(2)),
      inventoryValuationAtRetail: Number(inventory.totalValuationAtRetail.toFixed(2)),
      totalActiveSkus: inventory.totalActiveSkus,
      totalCustomers,
    },
  }
}

/**
 * Aggregate sales revenue and volume trends over time
 */
export const getRevenueTrend = async (businessId, query = {}) => {
  const filter = { businessId, status: 'completed' }

  if (query.startDate || query.endDate) {
    filter.transactionDate = {}
    if (query.startDate) filter.transactionDate.$gte = new Date(query.startDate)
    if (query.endDate) {
      const end = new Date(query.endDate)
      if (query.endDate.length <= 10) end.setHours(23, 59, 59, 999)
      filter.transactionDate.$lte = end
    }
  }

  let dateFormat = '%Y-%m-%d'
  if (query.period === 'monthly') {
    dateFormat = '%Y-%m'
  } else if (query.period === 'weekly') {
    dateFormat = '%Y-W%V'
  }

  const trends = await Sale.aggregate([
    { $match: filter },
    {
      $group: {
        _id: { $dateToString: { format: dateFormat, date: '$transactionDate' } },
        revenue: { $sum: '$totalAmount' },
        ordersCount: { $sum: 1 },
        unitsSold: { $sum: '$totalUnits' },
      },
    },
    { $sort: { _id: 1 } },
  ])

  return {
    businessId,
    granularity: query.period || 'daily',
    trend: trends.map((t) => ({
      date: t._id,
      revenue: Number(t.revenue.toFixed(2)),
      ordersCount: t.ordersCount,
      unitsSold: t.unitsSold,
      averageOrderValue: t.ordersCount > 0 ? Number((t.revenue / t.ordersCount).toFixed(2)) : 0,
    })),
  }
}

/**
 * Top selling products by revenue and quantity
 */
export const getTopProducts = async (businessId, query = {}) => {
  const limit = Math.min(50, Math.max(1, parseInt(query.limit, 10) || 10))
  const filter = { businessId, status: 'completed' }

  if (query.startDate || query.endDate) {
    filter.transactionDate = {}
    if (query.startDate) filter.transactionDate.$gte = new Date(query.startDate)
    if (query.endDate) {
      const end = new Date(query.endDate)
      if (query.endDate.length <= 10) end.setHours(23, 59, 59, 999)
      filter.transactionDate.$lte = end
    }
  }

  const topProducts = await Sale.aggregate([
    { $match: filter },
    { $unwind: '$items' },
    {
      $group: {
        _id: '$items.productSku',
        productName: { $first: '$items.productName' },
        totalQuantitySold: { $sum: '$items.quantity' },
        totalRevenueGenerated: { $sum: '$items.lineTotal' },
        invoiceAppearances: { $sum: 1 },
      },
    },
    { $sort: { totalRevenueGenerated: -1 } },
    { $limit: limit },
  ])

  return {
    businessId,
    topProducts: topProducts.map((p) => ({
      sku: p._id,
      productName: p.productName,
      totalQuantitySold: p.totalQuantitySold,
      totalRevenueGenerated: Number(p.totalRevenueGenerated.toFixed(2)),
      invoiceAppearances: p.invoiceAppearances,
    })),
  }
}

/**
 * Sales distribution grouped by product category
 */
export const getCategoryBreakdown = async (businessId, query = {}) => {
  const filter = { businessId, status: 'completed' }

  if (query.startDate || query.endDate) {
    filter.transactionDate = {}
    if (query.startDate) filter.transactionDate.$gte = new Date(query.startDate)
    if (query.endDate) {
      const end = new Date(query.endDate)
      if (query.endDate.length <= 10) end.setHours(23, 59, 59, 999)
      filter.transactionDate.$lte = end
    }
  }

  const categoryAgg = await Sale.aggregate([
    { $match: filter },
    { $unwind: '$items' },
    {
      $lookup: {
        from: 'products',
        let: { sku: '$items.productSku', biz: '$businessId' },
        pipeline: [
          { $match: { $expr: { $and: [{ $eq: ['$sku', '$$sku'] }, { $eq: ['$businessId', '$$biz'] }] } } },
          { $project: { category: 1 } },
        ],
        as: 'product',
      },
    },
    {
      $project: {
        category: {
          $ifNull: [{ $arrayElemAt: ['$product.category', 0] }, 'Uncategorized'],
        },
        lineTotal: '$items.lineTotal',
        quantity: '$items.quantity',
      },
    },
    {
      $group: {
        _id: '$category',
        revenue: { $sum: '$lineTotal' },
        unitsSold: { $sum: '$quantity' },
      },
    },
    { $sort: { revenue: -1 } },
  ])

  const totalRevenue = categoryAgg.reduce((acc, cat) => acc + cat.revenue, 0)

  return {
    businessId,
    totalRevenue: Number(totalRevenue.toFixed(2)),
    categories: categoryAgg.map((cat) => ({
      category: cat._id,
      revenue: Number(cat.revenue.toFixed(2)),
      unitsSold: cat.unitsSold,
      revenueSharePercentage:
        totalRevenue > 0 ? Number(((cat.revenue / totalRevenue) * 100).toFixed(2)) : 0,
    })),
  }
}

/**
 * Customer analytics, RFM distribution & loyalty insights
 */
export const getCustomerInsights = async (businessId) => {
  const [rfmDistribution, totalCustomers, totalOrders] = await Promise.all([
    Customer.aggregate([
      { $match: { businessId } },
      {
        $group: {
          _id: '$rfm.retentionStatus',
          count: { $sum: 1 },
          totalSpend: { $sum: '$totalSpend' },
        },
      },
    ]),
    Customer.countDocuments({ businessId }),
    Sale.countDocuments({ businessId, status: 'completed' }),
  ])

  const segmentMap = { ACTIVE: 0, DORMANT: 0, AT_RISK: 0, CHURNED: 0 }
  let trackedSpend = 0

  for (const seg of rfmDistribution) {
    if (seg._id && segmentMap[seg._id] !== undefined) {
      segmentMap[seg._id] = seg.count
    }
    trackedSpend += seg.totalSpend || 0
  }

  return {
    businessId,
    totalCustomers,
    totalCompletedOrders: totalOrders,
    trackedCustomerSpend: Number(trackedSpend.toFixed(2)),
    rfmRetentionSegments: segmentMap,
  }
}

/**
 * Inventory health, reorder urgency, and capital risk
 */
export const getInventoryHealth = async (businessId) => {
  const products = await Product.find({ businessId, isActive: true }).lean()

  let outOfStock = 0
  let lowStock = 0
  let optimal = 0
  let overstocked = 0
  let totalCostValuation = 0

  const highRiskSkus = []

  for (const p of products) {
    const stock = p.currentStock || 0
    totalCostValuation += Math.max(0, stock) * (p.costPrice || 0)

    if (stock <= 0) {
      outOfStock += 1
      highRiskSkus.push({
        sku: p.sku,
        name: p.name,
        currentStock: stock,
        reorderThreshold: p.reorderThreshold,
        status: 'OUT_OF_STOCK',
      })
    } else if (stock <= p.reorderThreshold) {
      lowStock += 1
      highRiskSkus.push({
        sku: p.sku,
        name: p.name,
        currentStock: stock,
        reorderThreshold: p.reorderThreshold,
        status: 'LOW_STOCK',
      })
    } else if (stock > p.targetStock) {
      overstocked += 1
    } else {
      optimal += 1
    }
  }

  // Sort high risk items by lowest stock first
  highRiskSkus.sort((a, b) => a.currentStock - b.currentStock)

  return {
    businessId,
    totalActiveProducts: products.length,
    capitalTiedInInventory: Number(totalCostValuation.toFixed(2)),
    statusCounts: {
      outOfStock,
      lowStock,
      optimal,
      overstocked,
    },
    criticalReorderAlerts: highRiskSkus.slice(0, 10),
  }
}
