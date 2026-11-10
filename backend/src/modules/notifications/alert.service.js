import mongoose from 'mongoose'
import { Alert } from './alert.model.js'
import { Product } from '../business/product.model.js'
import { Expense } from '../business/expense.model.js'
import { Sale } from '../business/sale.model.js'
import { AppError } from '../../utils/AppError.js'

/**
 * Rule 1: Evaluate Low-Stock and Stockout Risk Detection
 */
export const evaluateLowStockRules = async (businessId) => {
  const products = await Product.find({ businessId, isActive: true }).lean()
  const generatedAlerts = []

  for (const prod of products) {
    const stock = prod.currentStock || 0
    const threshold = prod.reorderThreshold || 10
    const targetStock = prod.targetStock || threshold * 2
    const shortfall = Math.max(0, targetStock - stock)
    const costPrice = prod.costPrice || 0
    const sellingPrice = prod.sellingPrice || 0
    const potentialLostRevenue = Number((shortfall * sellingPrice).toFixed(2))
    const estimatedReorderCost = Number((shortfall * costPrice).toFixed(2))

    if (stock <= 0) {
      // Stockout detected
      generatedAlerts.push({
        businessId,
        title: `Stockout Detected: SKU ${prod.sku}`,
        type: 'STOCKOUT_RISK',
        severity: 'CRITICAL',
        description: `Product "${prod.name}" is completely out of stock (0 units on hand). Immediate reorder required.`,
        supportingData: {
          sku: prod.sku,
          productName: prod.name,
          category: prod.category || 'General',
          currentStock: stock,
          reorderThreshold: threshold,
          targetStock,
          shortfall,
          unitCost: costPrice,
          sellingPrice,
          estimatedReorderCost,
          potentialLostRevenue,
          ruleTriggered: 'CURRENT_STOCK_ZERO',
        },
        recommendedAction: `Procure ${shortfall} units from vendor to restore target stock.`,
        actionType: 'REORDER_STOCK',
      })
    } else if (stock <= Math.floor(threshold * 0.5)) {
      // Critically low stock (<= 50% of reorder threshold)
      generatedAlerts.push({
        businessId,
        title: `Critically Low Stock: SKU ${prod.sku}`,
        type: 'LOW_STOCK',
        severity: 'HIGH',
        description: `Product "${prod.name}" has only ${stock} units remaining (below 50% of safety threshold: ${threshold}).`,
        supportingData: {
          sku: prod.sku,
          productName: prod.name,
          category: prod.category || 'General',
          currentStock: stock,
          reorderThreshold: threshold,
          targetStock,
          shortfall,
          unitCost: costPrice,
          sellingPrice,
          estimatedReorderCost,
          potentialLostRevenue,
          ruleTriggered: 'STOCK_BELOW_HALF_THRESHOLD',
        },
        recommendedAction: `Create purchase order for ${shortfall} units.`,
        actionType: 'REORDER_STOCK',
      })
    } else if (stock <= threshold) {
      // Moderate low stock (<= reorder threshold)
      generatedAlerts.push({
        businessId,
        title: `Reorder Threshold Reached: SKU ${prod.sku}`,
        type: 'LOW_STOCK',
        severity: 'MEDIUM',
        description: `Product "${prod.name}" stock (${stock}) has breached the reorder threshold of ${threshold} units.`,
        supportingData: {
          sku: prod.sku,
          productName: prod.name,
          category: prod.category || 'General',
          currentStock: stock,
          reorderThreshold: threshold,
          targetStock,
          shortfall,
          unitCost: costPrice,
          sellingPrice,
          estimatedReorderCost,
          potentialLostRevenue,
          ruleTriggered: 'STOCK_AT_OR_BELOW_THRESHOLD',
        },
        recommendedAction: `Plan replenishment order of ${shortfall} units with primary supplier.`,
        actionType: 'REORDER_STOCK',
      })
    }
  }

  return generatedAlerts
}

/**
 * Rule 2: Rule-Based Unusual Expense Detection (Statistical Mean + StdDev & Large Expense Detection)
 */
export const evaluateUnusualExpenseRules = async (businessId) => {
  const expenses = await Expense.find({ businessId }).sort({ date: -1 }).lean()
  if (expenses.length < 3) return []

  // 1. Group expenses by category to compute statistical baseline
  const categoryStats = new Map()
  for (const exp of expenses) {
    const cat = exp.category || 'Other'
    if (!categoryStats.has(cat)) {
      categoryStats.set(cat, [])
    }
    categoryStats.get(cat).push(exp.amount)
  }

  const generatedAlerts = []

  // Compute total average monthly volume for relative size checking
  const totalAmount = expenses.reduce((sum, e) => sum + e.amount, 0)
  const avgExpense = totalAmount / expenses.length

  for (const exp of expenses) {
    const cat = exp.category || 'Other'
    const amounts = categoryStats.get(cat) || []

    const count = amounts.length
    const mean = amounts.reduce((a, b) => a + b, 0) / count
    const variance =
      count > 1 ? amounts.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / (count - 1) : 0
    const stdDev = Math.sqrt(variance)

    const zScore = stdDev > 0 ? (exp.amount - mean) / stdDev : 0
    const deviationMultiple = mean > 0 ? Number((exp.amount / mean).toFixed(2)) : 0

    // Rule A: Outlier by standard deviation (z-score > 2.5) or multiple of mean (> 2.5x with > £100 value)
    const isStatOutlier = (zScore >= 2.5 || deviationMultiple >= 3.0) && exp.amount >= mean + 50
    const isSingleMassiveExpense = exp.amount > avgExpense * 3 && exp.amount >= 200

    if (isStatOutlier || isSingleMassiveExpense) {
      const severity = exp.amount >= mean * 4 || zScore >= 3.5 ? 'HIGH' : 'MEDIUM'
      const expTitle = exp.description || exp.title || 'Operating Expense'

      generatedAlerts.push({
        businessId,
        title: `Unusual Expense Flagged: ${expTitle}`,
        type: 'UNUSUAL_EXPENSE',
        severity,
        description: `Expense of £${exp.amount.toFixed(2)} in "${cat}" deviates significantly from category mean of £${mean.toFixed(2)} (${deviationMultiple}x category average).`,
        supportingData: {
          expenseId: exp.expenseId || exp._id.toString(),
          title: expTitle,
          category: cat,
          amount: exp.amount,
          categoryMean: Number(mean.toFixed(2)),
          categoryStdDev: Number(stdDev.toFixed(2)),
          zScore: Number(zScore.toFixed(2)),
          deviationMultiple,
          vendor: exp.vendor || 'Unknown',
          date: exp.date,
          ruleTriggered: zScore >= 2.5 ? 'Z_SCORE_THRESHOLD_EXCEEDED' : 'LARGE_EXPENSE_ANOMALY',
        },
        recommendedAction: `Audit receipt, review approval chain, and verify invoice line items.`,
        actionType: 'AUDIT_EXPENSE',
      })
    }
  }

  return generatedAlerts
}

/**
 * Rule 3: Rule-Based Unexpected Sales Change Detection (Rolling 7-day Comparison)
 */
export const evaluateSalesChangeRules = async (businessId) => {
  const now = new Date()

  // Current 7 days: [now - 7d, now]
  const currentEnd = new Date(now)
  const currentStart = new Date(now)
  currentStart.setDate(currentStart.getDate() - 7)

  // Prior 7 days: [now - 14d, now - 7d]
  const priorEnd = new Date(currentStart)
  const priorStart = new Date(currentStart)
  priorStart.setDate(priorStart.getDate() - 7)

  const [currentSales, priorSales] = await Promise.all([
    Sale.aggregate([
      {
        $match: {
          businessId,
          status: 'completed',
          transactionDate: { $gte: currentStart, $lte: currentEnd },
        },
      },
      {
        $group: {
          _id: null,
          revenue: { $sum: '$totalAmount' },
          orders: { $sum: 1 },
        },
      },
    ]),
    Sale.aggregate([
      {
        $match: {
          businessId,
          status: 'completed',
          transactionDate: { $gte: priorStart, $lte: priorEnd },
        },
      },
      {
        $group: {
          _id: null,
          revenue: { $sum: '$totalAmount' },
          orders: { $sum: 1 },
        },
      },
    ]),
  ])

  const curRev = currentSales[0]?.revenue || 0
  const curOrders = currentSales[0]?.orders || 0
  const priRev = priorSales[0]?.revenue || 0
  const priOrders = priorSales[0]?.orders || 0

  const generatedAlerts = []

  // Check sales drop rule: Require baseline of at least £50 in prior period
  if (priRev >= 50 && priOrders >= 1) {
    const dropAmount = priRev - curRev
    const dropPercentage = (dropAmount / priRev) * 100

    if (dropPercentage >= 30.0) {
      generatedAlerts.push({
        businessId,
        title: `Significant Sales Drop: -${dropPercentage.toFixed(1)}% vs Prior Week`,
        type: 'SALES_DROP',
        severity: dropPercentage >= 50.0 ? 'HIGH' : 'MEDIUM',
        description: `Completed sales revenue dropped by ${dropPercentage.toFixed(1)}% over the last 7 days (£${curRev.toFixed(2)} vs £${priRev.toFixed(2)} in previous week).`,
        supportingData: {
          current7DaysRevenue: Number(curRev.toFixed(2)),
          prior7DaysRevenue: Number(priRev.toFixed(2)),
          revenueDelta: Number((-dropAmount).toFixed(2)),
          percentageDrop: Number(dropPercentage.toFixed(1)),
          currentOrders: curOrders,
          priorOrders: priOrders,
          ordersDelta: curOrders - priOrders,
          window: '7_DAYS_ROLLING',
          ruleTriggered: 'SALES_DROP_EXCEEDS_30_PERCENT',
        },
        recommendedAction: `Inspect stock availability on top-selling SKUs, verify checkout funnel, and launch re-engagement campaign.`,
        actionType: 'REVIEW_METRIC',
      })
    } else if (curRev >= priRev * 1.5 && (curOrders >= 2 || curRev >= 100)) {
      // Sales surge insight (+50% increase)
      const growthPct = ((curRev - priRev) / priRev) * 100
      generatedAlerts.push({
        businessId,
        title: `Sales Surge Detected: +${growthPct.toFixed(1)}% vs Prior Week`,
        type: 'BUSINESS_INSIGHT',
        severity: 'INFO',
        description: `Weekly sales velocity expanded by ${growthPct.toFixed(1)}% (£${curRev.toFixed(2)} vs £${priRev.toFixed(2)}).`,
        supportingData: {
          current7DaysRevenue: Number(curRev.toFixed(2)),
          prior7DaysRevenue: Number(priRev.toFixed(2)),
          percentageGrowth: Number(growthPct.toFixed(1)),
          currentOrders: curOrders,
          priorOrders: priOrders,
          ruleTriggered: 'SALES_GROWTH_EXCEEDS_50_PERCENT',
        },
        recommendedAction: `Verify inventory replenishment schedules to avoid premature stockouts.`,
        actionType: 'REVIEW_METRIC',
      })
    }
  }

  return generatedAlerts
}

/**
 * Master Alert Evaluation Engine
 * Evaluates all rules, deduplicates against existing open alerts, and persists records
 */
export const evaluateAllRules = async (businessId) => {
  const [stockAlerts, expenseAlerts, salesAlerts] = await Promise.all([
    evaluateLowStockRules(businessId),
    evaluateUnusualExpenseRules(businessId),
    evaluateSalesChangeRules(businessId),
  ])

  const allCandidateAlerts = [...stockAlerts, ...expenseAlerts, ...salesAlerts]
  const processedAlerts = []

  for (const candidate of allCandidateAlerts) {
    let duplicateQuery = {
      businessId,
      type: candidate.type,
      status: { $in: ['OPEN', 'IN_REVIEW'] },
    }

    if (candidate.type === 'LOW_STOCK' || candidate.type === 'STOCKOUT_RISK') {
      duplicateQuery['supportingData.sku'] = candidate.supportingData.sku
    } else if (candidate.type === 'UNUSUAL_EXPENSE') {
      duplicateQuery['supportingData.expenseId'] = candidate.supportingData.expenseId
    } else if (candidate.type === 'SALES_DROP' || candidate.type === 'BUSINESS_INSIGHT') {
      duplicateQuery.type = candidate.type
    }

    const existing = await Alert.findOne(duplicateQuery)

    if (existing) {
      // Update existing open alert with newest supporting calculations
      existing.title = candidate.title
      existing.severity = candidate.severity
      existing.description = candidate.description
      existing.supportingData = candidate.supportingData
      existing.recommendedAction = candidate.recommendedAction
      await existing.save()
      processedAlerts.push(existing)
    } else {
      // Create new Alert
      const created = await Alert.create(candidate)
      processedAlerts.push(created)
    }
  }

  return {
    businessId,
    totalEvaluated: allCandidateAlerts.length,
    activeAlerts: processedAlerts,
  }
}

/**
 * Query Alerts with filtration, search, and pagination
 */
export const listAlerts = async (businessId, query = {}) => {
  const page = Math.max(1, parseInt(query.page, 10) || 1)
  const limit = Math.min(100, Math.max(1, parseInt(query.limit, 10) || 20))
  const skip = (page - 1) * limit

  const filter = { businessId }

  if (query.status && query.status !== 'all') {
    filter.status = query.status.toUpperCase()
  } else if (!query.status) {
    // Default to active alerts (OPEN and IN_REVIEW)
    filter.status = { $in: ['OPEN', 'IN_REVIEW'] }
  }

  if (query.severity && query.severity !== 'all') {
    filter.severity = query.severity.toUpperCase()
  }

  if (query.type && query.type !== 'all') {
    filter.type = query.type.toUpperCase()
  }

  // Sorting: Critical first, then newest
  const severityWeight = {
    CRITICAL: 5,
    HIGH: 4,
    MEDIUM: 3,
    LOW: 2,
    INFO: 1,
  }

  const [alerts, total] = await Promise.all([
    Alert.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    Alert.countDocuments(filter),
  ])

  // Sort in-memory by severity hierarchy, then date
  alerts.sort((a, b) => {
    const weightA = severityWeight[a.severity] || 0
    const weightB = severityWeight[b.severity] || 0
    if (weightB !== weightA) return weightB - weightA
    return new Date(b.createdAt) - new Date(a.createdAt)
  })

  const totalPages = Math.ceil(total / limit) || 1

  return {
    alerts,
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
 * Update Alert Status (e.g. IN_REVIEW, ACTIONED, DISMISSED)
 */
export const updateAlertStatus = async (businessId, alertId, updateData = {}) => {
  const alert = await Alert.findOne({ _id: alertId, businessId })
  if (!alert) {
    throw new AppError(`Alert with ID ${alertId} not found`, 404)
  }

  const allowedStatuses = ['OPEN', 'IN_REVIEW', 'ACTIONED', 'DISMISSED']
  if (updateData.status && allowedStatuses.includes(updateData.status.toUpperCase())) {
    alert.status = updateData.status.toUpperCase()
    if (['ACTIONED', 'DISMISSED'].includes(alert.status)) {
      alert.resolvedAt = new Date()
      alert.resolvedBy = updateData.resolvedBy || 'user'
    } else {
      alert.resolvedAt = null
      alert.resolvedBy = null
    }
  }

  await alert.save()
  return alert
}

/**
 * Alert Summary KPI metrics for badge counters and dashboard overview
 */
export const getAlertSummary = async (businessId) => {
  const activeAlerts = await Alert.find({
    businessId,
    status: { $in: ['OPEN', 'IN_REVIEW'] },
  }).lean()

  let criticalCount = 0
  let highCount = 0
  let mediumCount = 0
  let infoCount = 0

  const typeCounts = {
    LOW_STOCK: 0,
    STOCKOUT_RISK: 0,
    UNUSUAL_EXPENSE: 0,
    SALES_DROP: 0,
    BUSINESS_INSIGHT: 0,
    CHURN_RISK: 0,
  }

  for (const a of activeAlerts) {
    if (a.severity === 'CRITICAL') criticalCount += 1
    else if (a.severity === 'HIGH') highCount += 1
    else if (a.severity === 'MEDIUM') mediumCount += 1
    else if (a.severity === 'INFO' || a.severity === 'LOW') infoCount += 1

    if (typeCounts[a.type] !== undefined) {
      typeCounts[a.type] += 1
    }
  }

  return {
    businessId,
    totalActiveAlerts: activeAlerts.length,
    bySeverity: {
      critical: criticalCount,
      high: highCount,
      medium: mediumCount,
      info: infoCount,
    },
    byType: typeCounts,
    recentTopAlerts: activeAlerts.slice(0, 5),
  }
}
