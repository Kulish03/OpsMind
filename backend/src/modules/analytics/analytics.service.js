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

/**
 * 1. Daily, Weekly, and Monthly Sales Summaries (with refund/cancellation handling)
 */
export const getSalesSummaries = async (businessId, query = {}) => {
  const granularity = query.period || 'daily' // 'daily', 'weekly', 'monthly'
  let dateFormat = '%Y-%m-%d'
  if (granularity === 'monthly') {
    dateFormat = '%Y-%m'
  } else if (granularity === 'weekly') {
    dateFormat = '%Y-W%V'
  }

  const matchFilter = { businessId }
  if (query.startDate || query.endDate) {
    matchFilter.transactionDate = {}
    if (query.startDate) matchFilter.transactionDate.$gte = new Date(query.startDate)
    if (query.endDate) {
      const end = new Date(query.endDate)
      if (query.endDate.length <= 10) end.setHours(23, 59, 59, 999)
      matchFilter.transactionDate.$lte = end
    }
  }

  const summaries = await Sale.aggregate([
    { $match: matchFilter },
    {
      $group: {
        _id: { $dateToString: { format: dateFormat, date: '$transactionDate' } },
        completedRevenue: {
          $sum: { $cond: [{ $eq: ['$status', 'completed'] }, '$totalAmount', 0] },
        },
        completedOrders: {
          $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] },
        },
        completedUnits: {
          $sum: { $cond: [{ $eq: ['$status', 'completed'] }, '$totalUnits', 0] },
        },
        cancelledRevenue: {
          $sum: { $cond: [{ $in: ['$status', ['cancelled', 'refunded']] }, '$totalAmount', 0] },
        },
        cancelledOrders: {
          $sum: { $cond: [{ $in: ['$status', ['cancelled', 'refunded']] }, 1, 0] },
        },
        totalOrdersCount: { $sum: 1 },
      },
    },
    { $sort: { _id: 1 } },
  ])

  let totalCompletedRevenue = 0
  let totalCompletedOrders = 0
  let totalCancelledRevenue = 0
  let totalCancelledOrders = 0

  const timeline = summaries.map((s) => {
    const rev = Number(s.completedRevenue.toFixed(2))
    const orders = s.completedOrders
    const aov = orders > 0 ? Number((rev / orders).toFixed(2)) : 0
    const refundRev = Number(s.cancelledRevenue.toFixed(2))
    const refundOrders = s.cancelledOrders

    totalCompletedRevenue += rev
    totalCompletedOrders += orders
    totalCancelledRevenue += refundRev
    totalCancelledOrders += refundOrders

    return {
      date: s._id,
      completedRevenue: rev,
      completedOrders: orders,
      completedUnits: s.completedUnits,
      averageOrderValue: aov,
      cancelledRevenue: refundRev,
      cancelledOrders: refundOrders,
      refundRatePercentage:
        s.totalOrdersCount > 0
          ? Number(((refundOrders / s.totalOrdersCount) * 100).toFixed(2))
          : 0,
    }
  })

  return {
    businessId,
    granularity,
    totals: {
      completedRevenue: Number(totalCompletedRevenue.toFixed(2)),
      completedOrders: totalCompletedOrders,
      averageOrderValue:
        totalCompletedOrders > 0
          ? Number((totalCompletedRevenue / totalCompletedOrders).toFixed(2))
          : 0,
      cancelledRevenue: Number(totalCancelledRevenue.toFixed(2)),
      cancelledOrders: totalCancelledOrders,
      overallRefundRatePercentage:
        totalCompletedOrders + totalCancelledOrders > 0
          ? Number(
              (
                (totalCancelledOrders / (totalCompletedOrders + totalCancelledOrders)) *
                100
              ).toFixed(2)
            )
          : 0,
    },
    timeline,
  }
}

/**
 * 2. Revenue versus Expense Comparisons (Authoritative Profitability Breakdown)
 */
export const getRevenueVsExpenseComparison = async (businessId, query = {}) => {
  const granularity = query.period || 'monthly' // 'monthly' | 'weekly' | 'daily'
  let dateFormat = '%Y-%m'
  if (granularity === 'weekly') {
    dateFormat = '%Y-W%V'
  } else if (granularity === 'daily') {
    dateFormat = '%Y-%m-%d'
  }

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
      if (query.endDate.length <= 10) end.setHours(23, 59, 59, 999)
      saleFilter.transactionDate.$lte = end
      expenseFilter.date.$lte = end
    }
  }

  // 1. Group Sales & COGS by period
  const salesAgg = await Sale.aggregate([
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
        as: 'prod',
      },
    },
    {
      $project: {
        periodDate: { $dateToString: { format: dateFormat, date: '$transactionDate' } },
        lineTotal: '$items.lineTotal',
        quantity: '$items.quantity',
        costPrice: { $ifNull: [{ $arrayElemAt: ['$prod.costPrice', 0] }, 0] },
        hasMissingCost: {
          $cond: [{ $lte: [{ $ifNull: [{ $arrayElemAt: ['$prod.costPrice', 0] }, 0] }, 0] }, 1, 0],
        },
      },
    },
    {
      $group: {
        _id: '$periodDate',
        totalRevenue: { $sum: '$lineTotal' },
        totalCOGS: { $sum: { $multiply: ['$quantity', '$costPrice'] } },
        missingCostItemsCount: { $sum: '$hasMissingCost' },
        itemsCount: { $sum: 1 },
      },
    },
  ])

  // 2. Group Expenses by period
  const expenseAgg = await Expense.aggregate([
    { $match: expenseFilter },
    {
      $group: {
        _id: { $dateToString: { format: dateFormat, date: '$date' } },
        totalExpenses: { $sum: '$amount' },
        expenseCount: { $sum: 1 },
      },
    },
  ])

  // Map into merged timeline
  const periodMap = new Map()

  for (const s of salesAgg) {
    periodMap.set(s._id, {
      period: s._id,
      revenue: Number(s.totalRevenue.toFixed(2)),
      cogs: Number(s.totalCOGS.toFixed(2)),
      grossProfit: Number((s.totalRevenue - s.totalCOGS).toFixed(2)),
      grossMarginPercentage:
        s.totalRevenue > 0
          ? Number((((s.totalRevenue - s.totalCOGS) / s.totalRevenue) * 100).toFixed(2))
          : 0,
      operatingExpenses: 0,
      netProfit: Number((s.totalRevenue - s.totalCOGS).toFixed(2)),
      netMarginPercentage: 0,
      missingCostItemsCount: s.missingCostItemsCount,
    })
  }

  for (const e of expenseAgg) {
    const existing = periodMap.get(e._id) || {
      period: e._id,
      revenue: 0,
      cogs: 0,
      grossProfit: 0,
      grossMarginPercentage: 0,
      operatingExpenses: 0,
      netProfit: 0,
      netMarginPercentage: 0,
      missingCostItemsCount: 0,
    }

    const expenses = Number(e.totalExpenses.toFixed(2))
    existing.operatingExpenses = expenses
    existing.netProfit = Number((existing.grossProfit - expenses).toFixed(2))
    existing.netMarginPercentage =
      existing.revenue > 0
        ? Number(((existing.netProfit / existing.revenue) * 100).toFixed(2))
        : 0

    periodMap.set(e._id, existing)
  }

  const comparison = Array.from(periodMap.values()).sort((a, b) => a.period.localeCompare(b.period))

  return {
    businessId,
    granularity,
    timeline: comparison,
  }
}

/**
 * 3. Date-Over-Date Business Performance Comparisons
 * e.g. Last 7 Days vs Prior 7 Days, or Last 30 Days vs Prior 30 Days
 */
export const getDateOverDateComparison = async (businessId, query = {}) => {
  const windowDays = parseInt(query.days, 10) || (query.period === '7d' ? 7 : 30)

  // Current window: [now - windowDays, now]
  const now = new Date()
  const currentEnd = new Date(now)
  const currentStart = new Date(now)
  currentStart.setDate(currentStart.getDate() - windowDays)

  // Prior window: [now - 2 * windowDays, now - windowDays]
  const priorEnd = new Date(currentStart)
  const priorStart = new Date(currentStart)
  priorStart.setDate(priorStart.getDate() - windowDays)

  // Fetch KPI snapshots for both windows
  const [currentKPIs, priorKPIs] = await Promise.all([
    getExecutiveKPIs(businessId, {
      startDate: currentStart.toISOString(),
      endDate: currentEnd.toISOString(),
    }),
    getExecutiveKPIs(businessId, {
      startDate: priorStart.toISOString(),
      endDate: priorEnd.toISOString(),
    }),
  ])

  // Helper to compute absolute & percentage delta safely
  const calculateDelta = (currentVal, priorVal, isCurrency = false) => {
    const cur = Number(currentVal || 0)
    const pri = Number(priorVal || 0)
    const diff = Number((cur - pri).toFixed(2))

    let percentChange = 0
    if (pri > 0) {
      percentChange = Number((((cur - pri) / pri) * 100).toFixed(1))
    } else if (pri === 0 && cur > 0) {
      percentChange = 100.0
    }

    return {
      current: isCurrency ? Number(cur.toFixed(2)) : cur,
      prior: isCurrency ? Number(pri.toFixed(2)) : pri,
      absoluteDelta: diff,
      percentageDelta: percentChange,
      trend: diff > 0 ? 'UP' : diff < 0 ? 'DOWN' : 'FLAT',
    }
  }

  return {
    businessId,
    comparisonWindowDays: windowDays,
    currentPeriod: {
      startDate: currentStart.toISOString().split('T')[0],
      endDate: currentEnd.toISOString().split('T')[0],
    },
    priorPeriod: {
      startDate: priorStart.toISOString().split('T')[0],
      endDate: priorEnd.toISOString().split('T')[0],
    },
    metrics: {
      revenue: calculateDelta(
        currentKPIs.revenueAndOrders.totalRevenue,
        priorKPIs.revenueAndOrders.totalRevenue,
        true
      ),
      orders: calculateDelta(
        currentKPIs.revenueAndOrders.totalOrders,
        priorKPIs.revenueAndOrders.totalOrders
      ),
      averageOrderValue: calculateDelta(
        currentKPIs.revenueAndOrders.averageOrderValue,
        priorKPIs.revenueAndOrders.averageOrderValue,
        true
      ),
      unitsSold: calculateDelta(
        currentKPIs.revenueAndOrders.totalUnitsSold,
        priorKPIs.revenueAndOrders.totalUnitsSold
      ),
      grossProfit: calculateDelta(
        currentKPIs.profitability.grossProfit,
        priorKPIs.profitability.grossProfit,
        true
      ),
      operatingExpenses: calculateDelta(
        currentKPIs.profitability.totalOperatingExpenses,
        priorKPIs.profitability.totalOperatingExpenses,
        true
      ),
      netProfit: calculateDelta(
        currentKPIs.profitability.netProfit,
        priorKPIs.profitability.netProfit,
        true
      ),
    },
  }
}

/**
 * 4. Product Performance Deep-Dive & Category Analysis
 * Returns top-performing products, slow-moving items, and category profitability
 */
export const getProductAndCategoryDeepDive = async (businessId, query = {}) => {
  const limit = Math.min(50, Math.max(1, parseInt(query.limit, 10) || 10))

  const saleFilter = { businessId, status: 'completed' }
  if (query.startDate || query.endDate) {
    saleFilter.transactionDate = {}
    if (query.startDate) saleFilter.transactionDate.$gte = new Date(query.startDate)
    if (query.endDate) {
      const end = new Date(query.endDate)
      if (query.endDate.length <= 10) end.setHours(23, 59, 59, 999)
      saleFilter.transactionDate.$lte = end
    }
  }

  // 1. Product Sales Aggregation joined with Product catalog info
  const productAgg = await Sale.aggregate([
    { $match: saleFilter },
    { $unwind: '$items' },
    {
      $lookup: {
        from: 'products',
        let: { sku: '$items.productSku', biz: '$businessId' },
        pipeline: [
          { $match: { $expr: { $and: [{ $eq: ['$sku', '$$sku'] }, { $eq: ['$businessId', '$$biz'] }] } } },
          { $project: { costPrice: 1, sellingPrice: 1, category: 1, currentStock: 1 } },
        ],
        as: 'catalog',
      },
    },
    {
      $project: {
        sku: '$items.productSku',
        name: '$items.productName',
        quantity: '$items.quantity',
        revenue: '$items.lineTotal',
        costPrice: { $ifNull: [{ $arrayElemAt: ['$catalog.costPrice', 0] }, 0] },
        category: { $ifNull: [{ $arrayElemAt: ['$catalog.category', 0] }, 'Uncategorized'] },
        currentStock: { $ifNull: [{ $arrayElemAt: ['$catalog.currentStock', 0] }, 0] },
      },
    },
    {
      $group: {
        _id: '$sku',
        productName: { $first: '$name' },
        category: { $first: '$category' },
        currentStock: { $first: '$currentStock' },
        totalQuantitySold: { $sum: '$quantity' },
        totalRevenue: { $sum: '$revenue' },
        totalCost: { $sum: { $multiply: ['$quantity', '$costPrice'] } },
      },
    },
  ])

  // Compute profit and margins
  const analyzedProducts = productAgg.map((p) => {
    const rev = Number(p.totalRevenue.toFixed(2))
    const cost = Number(p.totalCost.toFixed(2))
    const profit = Number((rev - cost).toFixed(2))
    const margin = rev > 0 ? Number(((profit / rev) * 100).toFixed(2)) : 0

    return {
      sku: p._id,
      name: p.productName,
      category: p.category,
      currentStock: p.currentStock,
      totalQuantitySold: p.totalQuantitySold,
      totalRevenue: rev,
      totalCost: cost,
      grossProfit: profit,
      grossMarginPercentage: margin,
    }
  })

  // Top products by revenue
  const topByRevenue = [...analyzedProducts]
    .sort((a, b) => b.totalRevenue - a.totalRevenue)
    .slice(0, limit)

  // Top products by units sold
  const topByVolume = [...analyzedProducts]
    .sort((a, b) => b.totalQuantitySold - a.totalQuantitySold)
    .slice(0, limit)

  // Bottom / slow-moving products: active catalog products with lowest/zero units sold
  const soldSkusSet = new Set(analyzedProducts.map((p) => p.sku))
  const zeroSalesCatalogProducts = await Product.find({
    businessId,
    isActive: true,
    sku: { $nin: Array.from(soldSkusSet) },
  })
    .limit(limit)
    .select('sku name category costPrice sellingPrice currentStock')
    .lean()

  const bottomMovers = zeroSalesCatalogProducts.map((p) => ({
    sku: p.sku,
    name: p.name,
    category: p.category,
    currentStock: p.currentStock,
    totalQuantitySold: 0,
    totalRevenue: 0,
    grossProfit: 0,
    grossMarginPercentage: 0,
  }))

  // If not enough zero-sales, supplement with lowest positive sales
  if (bottomMovers.length < limit) {
    const lowestSales = [...analyzedProducts]
      .sort((a, b) => a.totalQuantitySold - b.totalQuantitySold)
      .slice(0, limit - bottomMovers.length)
    bottomMovers.push(...lowestSales)
  }

  // Category Profitability Analysis
  const categoryMap = new Map()
  for (const p of analyzedProducts) {
    const cat = p.category || 'General'
    const cur = categoryMap.get(cat) || {
      category: cat,
      revenue: 0,
      cogs: 0,
      unitsSold: 0,
      skusCount: 0,
    }
    cur.revenue += p.totalRevenue
    cur.cogs += p.totalCost
    cur.unitsSold += p.totalQuantitySold
    cur.skusCount += 1
    categoryMap.set(cat, cur)
  }

  const categoryPerformance = Array.from(categoryMap.values()).map((c) => {
    const rev = Number(c.revenue.toFixed(2))
    const cogs = Number(c.cogs.toFixed(2))
    const profit = Number((rev - cogs).toFixed(2))
    const margin = rev > 0 ? Number(((profit / rev) * 100).toFixed(2)) : 0

    return {
      category: c.category,
      revenue: rev,
      cogs,
      grossProfit: profit,
      grossMarginPercentage: margin,
      unitsSold: c.unitsSold,
      activeSkusCount: c.skusCount,
    }
  }).sort((a, b) => b.revenue - a.revenue)

  return {
    businessId,
    topByRevenue,
    topByVolume,
    bottomMovers: bottomMovers.slice(0, limit),
    categoryPerformance,
  }
}

