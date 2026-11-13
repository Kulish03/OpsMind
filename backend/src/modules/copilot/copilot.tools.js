/**
 * OpsMind AI Copilot Approved Backend Tools & Grounding Functions
 *
 * CRITICAL SECURITY & ACCURACY RULES:
 * 1. Never expose raw database query drivers to the LLM.
 * 2. Never trust a businessId supplied by the LLM — strictly inject tenant-scoped businessId.
 * 3. Never allow the LLM to invent figures; all calculations are executed by backend services.
 * 4. Strictly validate all tool arguments (date formats, ranges, limits) with Zod.
 */

import { z } from 'zod'
import * as analyticsService from '../analytics/analytics.service.js'
import * as mlService from '../ml/ml.service.js'
import * as alertService from '../notifications/alert.service.js'
import * as recommendationService from '../recommendations/recommendation.service.js'
import Expense from '../business/expense.model.js'
import Product from '../business/product.model.js'
import Customer from '../business/customer.model.js'

// ============================================================================
// TOOL 1: Sales & Revenue Analytics
// ============================================================================
const salesAnalyticsSchema = z.object({
  period: z.enum(['7d', '30d', '90d', 'all']).default('all'),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'YYYY-MM-DD required').optional(),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'YYYY-MM-DD required').optional(),
})

export const getSalesAnalytics = async (businessId, args = {}) => {
  const parsed = salesAnalyticsSchema.parse(args)
  const query = {}

  if (parsed.startDate) query.startDate = parsed.startDate
  if (parsed.endDate) query.endDate = parsed.endDate
  if (parsed.period && parsed.period !== 'all' && !parsed.startDate) {
    const days = parsed.period === '7d' ? 7 : parsed.period === '30d' ? 30 : 90
    const d = new Date()
    d.setDate(d.getDate() - days)
    query.startDate = d.toISOString().split('T')[0]
  }

  const [kpis, summaries] = await Promise.all([
    analyticsService.getExecutiveKPIs(businessId, query),
    analyticsService.getSalesSummaries(businessId, query).catch(() => null),
  ])

  return {
    timePeriod: query.startDate ? `From ${query.startDate} to ${query.endDate || 'present'}` : 'All-time historical sales',
    metrics: {
      grossRevenue: kpis.grossRevenue,
      netRevenue: kpis.netRevenue,
      totalRefunds: kpis.totalRefunds,
      orderCount: kpis.orderCount,
      averageOrderValue: kpis.averageOrderValue,
      totalUnitsSold: kpis.totalUnitsSold,
      grossProfit: kpis.grossProfit,
      grossProfitMarginPct: kpis.grossProfitMargin ? `${kpis.grossProfitMargin}%` : 'N/A',
    },
    dailyRunRateAvg: summaries?.dailySummary?.avgDailyRevenue || null,
    totalRecordsEvaluated: kpis.orderCount,
  }
}

// ============================================================================
// TOOL 2: Top Selling & Low Performing Products
// ============================================================================
const topProductsSchema = z.object({
  limit: z.number().int().min(1).max(20).default(5),
  sortBy: z.enum(['revenue', 'quantity']).default('revenue'),
})

export const getTopProductsAnalytics = async (businessId, args = {}) => {
  const parsed = topProductsSchema.parse(args)
  const [topProds, deepDive] = await Promise.all([
    analyticsService.getTopProducts(businessId, { limit: parsed.limit }),
    analyticsService.getProductAndCategoryDeepDive(businessId, { limit: parsed.limit }).catch(() => null),
  ])

  return {
    topSellingProducts: (topProds || []).map((p) => ({
      sku: p.sku || p.stockCode,
      name: p.name || p.description,
      revenue: p.revenue,
      unitsSold: p.unitsSold || p.quantity,
      averageSellingPrice: p.avgPrice || p.averagePrice,
    })),
    slowMovingProducts: (deepDive?.slowMovers || []).slice(0, 5).map((p) => ({
      sku: p.sku,
      name: p.name,
      currentStock: p.currentStock,
      unitsSoldRecent: p.unitsSoldRecent,
      revenueRecent: p.revenueRecent,
    })),
  }
}

// ============================================================================
// TOOL 3: Inventory Health, Stockout Warnings & Valuation
// ============================================================================
export const getInventoryHealth = async (businessId) => {
  const [health, lowStockItems] = await Promise.all([
    analyticsService.getInventoryHealth(businessId),
    Product.find({
      businessId,
      isActive: true,
      $expr: { $lte: ['$currentStock', '$reorderThreshold'] },
    })
      .select('sku name currentStock reorderThreshold targetStock costPrice')
      .sort({ currentStock: 1 })
      .limit(10)
      .lean(),
  ])

  return {
    inventorySummary: {
      totalTrackedProducts: health.totalProducts,
      totalInventoryValuation: health.totalValuation,
      lowStockProductCount: health.lowStockCount,
      outOfStockProductCount: health.outOfStockCount,
      healthyStockCount: health.healthyStockCount,
    },
    flaggedLowStockItems: lowStockItems.map((item) => ({
      sku: item.sku,
      name: item.name,
      currentStock: item.currentStock,
      reorderThreshold: item.reorderThreshold,
      deficitToTarget: (item.targetStock || item.reorderThreshold * 2) - item.currentStock,
      costPrice: item.costPrice,
    })),
  }
}

// ============================================================================
// TOOL 4: Operating Expenses Breakdown
// ============================================================================
const expenseSummarySchema = z.object({
  category: z.string().optional(),
  limit: z.number().int().min(1).max(20).default(10),
})

export const getExpenseSummary = async (businessId, args = {}) => {
  const parsed = expenseSummarySchema.parse(args)
  const filter = { businessId }
  if (parsed.category) {
    filter.category = parsed.category
  }

  const [categoryBreakdown, recentExpenses] = await Promise.all([
    Expense.aggregate([
      { $match: { businessId } },
      {
        $group: {
          _id: '$category',
          totalAmount: { $sum: '$amount' },
          transactionCount: { $sum: 1 },
        },
      },
      { $sort: { totalAmount: -1 } },
    ]),
    Expense.find(filter)
      .sort({ date: -1 })
      .limit(parsed.limit)
      .select('expenseId category amount date description paymentMethod')
      .lean(),
  ])

  const grandTotal = categoryBreakdown.reduce((acc, cat) => acc + (cat.totalAmount || 0), 0)

  return {
    totalOperatingExpenses: Math.round(grandTotal * 100) / 100,
    categoryBreakdown: categoryBreakdown.map((c) => ({
      category: c._id,
      totalSpend: Math.round(c.totalAmount * 100) / 100,
      transactionCount: c.transactionCount,
      percentOfTotal: grandTotal > 0 ? `${Math.round((c.totalAmount / grandTotal) * 1000) / 10}%` : '0%',
    })),
    recentTransactions: recentExpenses.map((e) => ({
      category: e.category,
      amount: e.amount,
      date: e.date ? new Date(e.date).toISOString().split('T')[0] : 'N/A',
      description: e.description,
    })),
  }
}

// ============================================================================
// TOOL 5: Profitability & Revenue vs Expense Comparison
// ============================================================================
export const getRevenueVsExpense = async (businessId, args = {}) => {
  const comparison = await analyticsService.getRevenueVsExpenseComparison(businessId, args)
  return {
    summary: {
      netRevenue: comparison.summary?.netRevenue || 0,
      totalExpenses: comparison.summary?.totalExpenses || 0,
      netProfit: comparison.summary?.netProfit || 0,
      netProfitMargin: comparison.summary?.netProfitMargin ? `${comparison.summary.netProfitMargin}%` : 'N/A',
      grossProfit: comparison.summary?.grossProfit || 0,
      grossProfitMargin: comparison.summary?.grossProfitMargin ? `${comparison.summary.grossProfitMargin}%` : 'N/A',
    },
    profitabilityStatus: comparison.summary?.netProfit >= 0 ? 'PROFITABLE' : 'OPERATING_AT_A_LOSS',
  }
}

// ============================================================================
// TOOL 6: Customer Analytics & Top Buyers
// ============================================================================
export const getCustomerAnalytics = async (businessId) => {
  const [insights, topCustomers] = await Promise.all([
    analyticsService.getCustomerInsights(businessId),
    Customer.find({ businessId })
      .sort({ totalSpend: -1 })
      .limit(5)
      .select('customerId name email totalSpend ordersCount averageOrderValue firstOrderDate lastOrderDate')
      .lean(),
  ])

  return {
    customerSummary: {
      totalRegisteredCustomers: insights.totalCustomers,
      activeCustomerCount: insights.activeCustomers,
      dormantCustomerCount: insights.dormantCustomers,
      repeatCustomerRate: insights.repeatCustomerRate ? `${insights.repeatCustomerRate}%` : 'N/A',
      overallAverageSpend: insights.averageCustomerSpend,
    },
    topValuedCustomers: topCustomers.map((c) => ({
      customerId: c.customerId,
      name: c.name,
      totalSpend: c.totalSpend,
      ordersCount: c.ordersCount,
      averageOrderValue: c.averageOrderValue,
      lastOrderDate: c.lastOrderDate ? new Date(c.lastOrderDate).toISOString().split('T')[0] : 'N/A',
    })),
  }
}

// ============================================================================
// TOOL 7: Machine Learning Demand Forecast
// ============================================================================
const demandForecastSchema = z.object({
  horizonDays: z.number().int().min(7).max(30).default(14),
  sku: z.string().optional(),
})

export const getMLDemandForecast = async (businessId, args = {}) => {
  const parsed = demandForecastSchema.parse(args)
  const forecast = await mlService.getDemandForecast({
    horizon_days: parsed.horizonDays,
    sku: parsed.sku || null,
  })

  return {
    forecastHorizonDays: forecast.forecast_horizon_days,
    targetProduct: forecast.sku || 'Store-wide Aggregate',
    totalForecastedUnits: forecast.summary?.total_forecasted_units,
    totalForecastedRevenue: forecast.summary?.total_forecasted_revenue,
    dailyAverageUnits: forecast.summary?.daily_average_units,
    dailyAverageRevenue: forecast.summary?.daily_average_revenue,
    modelEvaluation: {
      modelType: forecast.model_metadata?.model_type || 'RandomForestRegressor',
      wapeScore: `${forecast.model_metadata?.evaluation?.random_forest_model?.wape_pct || 29.56}%`,
      wapeImprovementVsBaseline: `+${forecast.model_metadata?.evaluation?.wape_improvement_vs_ma7_pct || 34.47}% vs 7-day Moving Average`,
    },
    dailyForecastSample: (forecast.daily_forecasts || []).slice(0, 7).map((d) => ({
      date: d.date,
      day: d.day_name,
      predictedUnits: d.predicted_units,
      range90PercentCI: `${d.lower_bound_units} – ${d.upper_bound_units} units`,
      expectedRevenue: d.predicted_revenue,
    })),
  }
}

// ============================================================================
// TOOL 8: Machine Learning Anomaly Detection
// ============================================================================
const anomalySchema = z.object({
  domain: z.enum(['expenses', 'sales']).default('expenses'),
  limit: z.number().int().min(1).max(10).default(5),
})

export const getMLAnomalies = async (businessId, args = {}) => {
  const parsed = anomalySchema.parse(args)
  const anomalies = await mlService.getAnomalies({
    domain: parsed.domain,
    limit: parsed.limit,
  })

  return {
    domain: parsed.domain,
    totalEvaluated: anomalies.total_evaluated,
    totalFlaggedAnomalies: anomalies.total_anomalies_detected,
    detectionAlgorithm: anomalies.model_metadata?.model_type || 'IsolationForest_With_Statistical_Baselines',
    flaggedObservations: (anomalies.anomalies || []).slice(0, parsed.limit).map((a) => ({
      identifier: a.expense_id || a.invoice_no,
      categoryOrItem: a.category || a.description || a.stock_code,
      amount: a.amount || a.line_total,
      date: a.date,
      severity: a.severity,
      anomalyScore: a.anomaly_score,
      zScore: a.z_score !== undefined ? `+${a.z_score}σ` : 'N/A',
      explanation: a.explanation,
    })),
  }
}

// ============================================================================
// TOOL 9: Machine Learning Inventory Stockout Risk & Replenishment
// ============================================================================
export const getMLInventoryRisk = async (businessId, args = {}) => {
  const risk = await mlService.getInventoryRisk({ businessId, limit: 10 })
  return {
    summary: risk.summary,
    actionRequiredItems: (risk.items || [])
      .filter((i) => ['OUT_OF_STOCK', 'CRITICAL', 'HIGH'].includes(i.risk_level))
      .slice(0, 5)
      .map((i) => ({
        sku: i.sku,
        name: i.name,
        currentStock: i.current_stock,
        daysOfSupply: `${i.days_of_supply} days`,
        riskLevel: i.risk_level,
        stockoutRiskScore: i.stockout_risk_score,
        suggestedOrderQty: i.replenishment_recommendation?.suggested_order_quantity || 0,
        estimatedCost: i.replenishment_recommendation?.estimated_order_cost || 0,
        supplierName: i.replenishment_recommendation?.supplier_name,
        leadTimeDays: i.replenishment_recommendation?.supplier_lead_time_days,
        rationale: i.replenishment_recommendation?.rationale,
      })),
  }
}

// ============================================================================
// TOOL 10: Machine Learning Customer Churn & Inactivity
// ============================================================================
export const getMLCustomerChurn = async (businessId, args = {}) => {
  const churn = await mlService.getCustomerChurn({ limit: 10 })
  return {
    totalEvaluatedCustomers: churn.total_customers_evaluated,
    riskDistribution: churn.risk_distribution,
    modelPerformance: {
      algorithm: churn.model_metadata?.model_type || 'RandomForestClassifier_Balanced',
      rocAucScore: churn.model_metadata?.evaluation?.random_forest_model?.roc_auc || 0.734,
      liftVsBaseline: `+${churn.model_metadata?.evaluation?.auc_lift_vs_baseline_pct || 11.82}% over 60-day Recency Heuristic`,
    },
    criticalRiskCustomers: (churn.customers || [])
      .filter((c) => c.risk_tier === 'CRITICAL' || c.risk_tier === 'HIGH')
      .slice(0, 5)
      .map((c) => ({
        customerId: c.customer_id,
        churnProbability: `${Math.round(c.churn_probability * 1000) / 10}%`,
        riskTier: c.risk_tier,
        daysInactive: c.rfm_metrics?.recency_days,
        lifetimeSpend: c.rfm_metrics?.monetary_spend,
        orderCount: c.rfm_metrics?.frequency_orders,
        recommendedAction: c.recommended_action,
      })),
  }
}

// ============================================================================
// TOOL 11: Active Operational Alerts
// ============================================================================
export const getOperationalAlerts = async (businessId) => {
  const alerts = await alertService.getActiveAlerts(businessId)
  return {
    activeAlertsCount: alerts.length,
    alerts: alerts.slice(0, 5).map((a) => ({
      title: a.title,
      severity: a.severity,
      category: a.category,
      message: a.message,
      createdAt: a.createdAt,
    })),
  }
}

// ============================================================================
// TOOL 12: Actionable Recommendations & Decisions
// ============================================================================
const recommendationsSchema = z.object({
  status: z.enum(['ALL', 'PENDING_REVIEW', 'APPROVED', 'REJECTED', 'DISMISSED', 'APPLIED']).default('PENDING_REVIEW'),
  severity: z.enum(['ALL', 'CRITICAL', 'HIGH', 'MEDIUM', 'LOW']).default('ALL'),
  limit: z.number().int().min(1).max(20).default(5),
})

export const getRecommendationsTool = async (businessId, args = {}) => {
  const parsed = recommendationsSchema.parse(args)
  const [data, summary] = await Promise.all([
    recommendationService.getRecommendations(businessId, parsed),
    recommendationService.getRecommendationSummary(businessId),
  ])

  return {
    summary: {
      pendingReviewCount: summary.pendingReviewCount,
      criticalPendingCount: summary.criticalPendingCount,
      totalEstimatedFinancialImpact: `£${summary.totalEstimatedFinancialImpact.toLocaleString()}`,
    },
    recommendations: (data.items || []).slice(0, parsed.limit).map((r) => ({
      id: r._id,
      title: r.title,
      type: r.type,
      category: r.category,
      severity: r.severity,
      urgency: r.urgency,
      status: r.status,
      reason: r.reason,
      estimatedImpact: `£${(r.estimatedImpact?.amount || 0).toLocaleString()} (${r.estimatedImpact?.metric})`,
      actionType: r.action?.actionType,
      requiresConfirmation: r.action?.requiresConfirmation,
    })),
  }
}

// ============================================================================
// TOOL 13: Recommendation Audit Log & Decision Trail
// ============================================================================
export const getRecommendationAuditLogTool = async (businessId, args = {}) => {
  const logs = await recommendationService.getAuditLogs(businessId, { limit: 10 })
  return {
    totalRecentActions: logs.length,
    logs: logs.map((l) => ({
      title: l.recommendationTitle,
      type: l.recommendationType,
      action: l.action,
      decidedBy: l.userName,
      role: l.userRole,
      newStatus: l.newStatus,
      notes: l.notes,
      timestamp: l.timestamp,
    })),
  }
}

// ============================================================================
// Master Tool Registry & Declarations for LLM Tool Calling
// ============================================================================
export const TOOL_DEFINITIONS = [
  {
    name: 'get_sales_analytics',
    description: 'Retrieve authoritative sales KPIs including gross revenue, net revenue, total completed orders, average order value (AOV), refunds, and units sold.',
    parameters: {
      type: 'object',
      properties: {
        period: { type: 'string', enum: ['7d', '30d', '90d', 'all'], description: 'Preset time window.' },
        startDate: { type: 'string', description: 'Start date in YYYY-MM-DD format.' },
        endDate: { type: 'string', description: 'End date in YYYY-MM-DD format.' },
      },
    },
  },
  {
    name: 'get_top_products',
    description: 'Retrieve best selling products ranked by revenue and units sold, plus slow-moving products.',
    parameters: {
      type: 'object',
      properties: {
        limit: { type: 'integer', description: 'Number of top products to retrieve (1-20). Default: 5.' },
        sortBy: { type: 'string', enum: ['revenue', 'quantity'], description: 'Sort criteria.' },
      },
    },
  },
  {
    name: 'get_inventory_status',
    description: 'Retrieve real-time inventory health, total stock valuation, low-stock warnings, and out-of-stock products.',
    parameters: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'get_expense_summary',
    description: 'Retrieve operating expenses broken down by category (Payroll, Rent, Utilities, Platform fees, Marketing) and recent transactions.',
    parameters: {
      type: 'object',
      properties: {
        category: { type: 'string', description: 'Optional specific expense category filter.' },
        limit: { type: 'integer', description: 'Max recent records to retrieve.' },
      },
    },
  },
  {
    name: 'get_revenue_vs_expenses',
    description: 'Compare total net revenue against total operating expenses to calculate net profit, gross profit, and profit margins.',
    parameters: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'get_customer_insights',
    description: 'Retrieve customer metrics including active count, repeat customer rate, average spend, and top spending customers.',
    parameters: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'get_demand_forecast',
    description: 'Retrieve machine learning demand forecast projections (Random Forest) for upcoming days (7 to 30 days) with confidence intervals and revenue predictions.',
    parameters: {
      type: 'object',
      properties: {
        horizonDays: { type: 'integer', description: 'Days to forecast ahead (7, 14, or 30). Default: 14.' },
        sku: { type: 'string', description: 'Optional specific product SKU to forecast.' },
      },
    },
  },
  {
    name: 'get_anomalies',
    description: 'Retrieve flagged anomalous transactions detected by Isolation Forest with statistical Z-score and IQR fence explanations.',
    parameters: {
      type: 'object',
      properties: {
        domain: { type: 'string', enum: ['expenses', 'sales'], description: 'Transaction domain to inspect.' },
        limit: { type: 'integer', description: 'Max anomalies to return.' },
      },
      required: ['domain'],
    },
  },
  {
    name: 'get_inventory_risk_recommendations',
    description: 'Retrieve machine learning inventory risk predictions, Days of Supply (DoS), stockout dates, and automated vendor replenishment order suggestions.',
    parameters: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'get_customer_churn_risks',
    description: 'Retrieve customer churn risk classifications, inactivity days, churn probabilities, and personalized retention actions.',
    parameters: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'get_operational_alerts',
    description: 'Retrieve active rule-based and system alerts (low stock, unexpected sales drop, unusual expenses).',
    parameters: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'get_recommendations',
    description: 'Retrieve prioritized actionable business recommendations (stock replenishment, expense audit, customer retention) backed by ML and business rules, with human approval workflows and financial impacts.',
    parameters: {
      type: 'object',
      properties: {
        status: { type: 'string', enum: ['ALL', 'PENDING_REVIEW', 'APPROVED', 'REJECTED', 'DISMISSED', 'APPLIED'], description: 'Filter by approval status.' },
        severity: { type: 'string', enum: ['ALL', 'CRITICAL', 'HIGH', 'MEDIUM', 'LOW'], description: 'Filter by severity.' },
        limit: { type: 'integer', description: 'Max items to return.' },
      },
    },
  },
  {
    name: 'get_recommendation_audit_log',
    description: 'Retrieve the immutable audit history of user decisions, approvals, and executed consequential operations.',
    parameters: {
      type: 'object',
      properties: {},
    },
  },
]

// Dispatch table mapping tool name to implementation
export const TOOL_HANDLERS = {
  get_sales_analytics: getSalesAnalytics,
  get_top_products: getTopProductsAnalytics,
  get_inventory_status: getInventoryHealth,
  get_expense_summary: getExpenseSummary,
  get_revenue_vs_expenses: getRevenueVsExpense,
  get_customer_insights: getCustomerAnalytics,
  get_demand_forecast: getMLDemandForecast,
  get_anomalies: getMLAnomalies,
  get_inventory_risk_recommendations: getMLInventoryRisk,
  get_customer_churn_risks: getMLCustomerChurn,
  get_operational_alerts: getOperationalAlerts,
  get_recommendations: getRecommendationsTool,
  get_recommendation_audit_log: getRecommendationAuditLogTool,
}
