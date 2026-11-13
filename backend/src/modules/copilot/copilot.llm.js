/**
 * OpsMind LLM Gateway & Deterministic Semantic Reasoner
 * Handles API communication with OpenAI / Gemini or deterministic semantic fallback.
 * Enforces zero-hallucination guardrails and prompt-injection defense.
 */

import { TOOL_DEFINITIONS } from './copilot.tools.js'

const SYSTEM_PROMPT = `You are OpsMind AI Business Copilot, an authoritative operations, financial and inventory intelligence advisor for Small and Medium Enterprises (SMEs).

CRITICAL GROUNDING & OPERATIONAL RULES:
1. ONLY cite facts, numbers, dates and metrics provided in the Tool Execution Results.
2. NEVER guess, invent, fabricate, or extrapolate financial numbers, revenue, order totals or stock figures.
3. If an operational metric is zero, report it as zero. If a metric is missing or insufficient, state clearly that data is insufficient or unavailable.
4. Clearly distinguish between Gross Revenue, Net Revenue, Gross Profit, and Net Profit.
5. Highlight machine learning evaluation metrics (e.g. WAPE score, ROC-AUC lift, Z-score) when discussing predictions or anomalies to provide evidence and confidence.
6. Provide concise, professional, actionable business recommendations for the SME owner.
7. Maintain a polite, executive, and analytical tone.`

// ============================================================================
// 1. Prompt Injection & Security Guard
// ============================================================================
const INJECTION_PATTERNS = [
  /ignore\s+(all\s+)?(previous|prior)\s+instructions/i,
  /system\s+prompt/i,
  /reveal\s+(api\s+key|secret|password|credentials)/i,
  /drop\s+(database|table|collection)/i,
  /select\s+\*\s+from/i,
  /bypass\s+(sandbox|security|tenant)/i,
  /act\s+as\s+a\s+hacker/i,
  /as\s+an\s+unfiltered\s+ai/i,
]

export const checkPromptInjection = (text) => {
  if (!text || typeof text !== 'string') return false
  return INJECTION_PATTERNS.some((pattern) => pattern.test(text))
}

// ============================================================================
// 2. Deterministic Intent & Tool Selector (Offline / Fallback Reasoner)
// ============================================================================
export const determineSemanticIntent = (query) => {
  const q = query.toLowerCase()

  // 1. ML Demand Forecasting
  if (
    q.includes('forecast') ||
    q.includes('predict demand') ||
    q.includes('future sales') ||
    q.includes('next week') ||
    q.includes('next 14 days') ||
    q.includes('next month demand')
  ) {
    const horizon = q.includes('30') ? 30 : q.includes('7') ? 7 : 14
    return {
      toolName: 'get_demand_forecast',
      args: { horizonDays: horizon },
    }
  }

  // 2. ML Anomaly Detection
  if (
    q.includes('anomal') ||
    q.includes('unusual expense') ||
    q.includes('unusual sale') ||
    q.includes('irregular') ||
    q.includes('suspicious') ||
    q.includes('outlier')
  ) {
    const domain = q.includes('sale') ? 'sales' : 'expenses'
    return {
      toolName: 'get_anomalies',
      args: { domain, limit: 5 },
    }
  }

  // 3. ML Customer Churn / Retention
  if (
    q.includes('churn') ||
    q.includes('inactive customer') ||
    q.includes('retention') ||
    q.includes('dormant customer') ||
    q.includes('at-risk customer') ||
    q.includes('customer loss')
  ) {
    return {
      toolName: 'get_customer_churn_risks',
      args: {},
    }
  }

  // 4. ML Inventory Risk & Stockout Replenishment
  if (
    q.includes('reorder') ||
    q.includes('replenish') ||
    q.includes('stockout') ||
    q.includes('days of supply') ||
    q.includes('lead time') ||
    q.includes('order suggestion')
  ) {
    return {
      toolName: 'get_inventory_risk_recommendations',
      args: {},
    }
  }

  // 5. Inventory Status & Health
  if (
    q.includes('stock') ||
    q.includes('inventory') ||
    q.includes('low stock') ||
    q.includes('out of stock') ||
    q.includes('warehouse') ||
    q.includes('inventory valuation')
  ) {
    return {
      toolName: 'get_inventory_status',
      args: {},
    }
  }

  // 6. Revenue vs Expense & Profitability
  if (
    q.includes('profit') ||
    q.includes('margin') ||
    q.includes('revenue vs expense') ||
    q.includes('profitable') ||
    q.includes('net income') ||
    q.includes('loss')
  ) {
    return {
      toolName: 'get_revenue_vs_expenses',
      args: {},
    }
  }

  // 7. Operating Expenses Breakdown
  if (
    q.includes('expense') ||
    q.includes('spend') ||
    q.includes('cost') ||
    q.includes('overhead') ||
    q.includes('payroll') ||
    q.includes('utilities') ||
    q.includes('rent')
  ) {
    return {
      toolName: 'get_expense_summary',
      args: { limit: 10 },
    }
  }

  // 8. Top Selling / Best Products
  if (
    q.includes('top product') ||
    q.includes('best seller') ||
    q.includes('best-selling') ||
    q.includes('popular item') ||
    q.includes('slow mover') ||
    q.includes('highest selling')
  ) {
    return {
      toolName: 'get_top_products',
      args: { limit: 5 },
    }
  }

  // 9. Customer Insights & Directory
  if (
    q.includes('customer') ||
    q.includes('buyer') ||
    q.includes('client') ||
    q.includes('who spends the most')
  ) {
    return {
      toolName: 'get_customer_insights',
      args: {},
    }
  }

  // 10. Operational Alerts
  if (
    q.includes('alert') ||
    q.includes('warning') ||
    q.includes('notification') ||
    q.includes('issue')
  ) {
    return {
      toolName: 'get_operational_alerts',
      args: {},
    }
  }

  // 11. Recommendations & Action Items
  if (
    q.includes('recommendation') ||
    q.includes('what should i do') ||
    q.includes('action item') ||
    q.includes('suggested action') ||
    q.includes('consequential') ||
    q.includes('approval') ||
    q.includes('pending review')
  ) {
    return {
      toolName: 'get_recommendations',
      args: { status: 'PENDING_REVIEW', limit: 5 },
    }
  }

  // 12. Recommendation Decision & Audit Log Trail
  if (
    q.includes('audit log') ||
    q.includes('decision log') ||
    q.includes('audit trail') ||
    q.includes('who approved') ||
    q.includes('past decisions') ||
    q.includes('human approval history')
  ) {
    return {
      toolName: 'get_recommendation_audit_log',
      args: {},
    }
  }

  // 13. Sales Analytics (Default for revenue, sales, AOV, performance)
  if (
    q.includes('revenue') ||
    q.includes('sale') ||
    q.includes('order') ||
    q.includes('aov') ||
    q.includes('average order') ||
    q.includes('performance') ||
    q.includes('how is the business doing')
  ) {
    let period = 'all'
    if (q.includes('7 days') || q.includes('this week') || q.includes('past week')) period = '7d'
    else if (q.includes('30 days') || q.includes('this month') || q.includes('past month')) period = '30d'
    else if (q.includes('90 days') || q.includes('quarter')) period = '90d'

    return {
      toolName: 'get_sales_analytics',
      args: { period },
    }
  }

  return null
}

// ============================================================================
// 3. Evidence-Grounded Response Formatter (Deterministic Engine)
// ============================================================================
export const formatEvidenceBasedResponse = (toolName, toolResult, userQuery) => {
  const fmt = (n) =>
    typeof n === 'number'
      ? n.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
      : n

  switch (toolName) {
    case 'get_sales_analytics': {
      const m = toolResult.metrics || {}
      return `### 📊 Sales & Revenue Analysis (${toolResult.timePeriod})

Based on our authoritative sales transaction ledger:
- **Net Revenue:** £${fmt(m.netRevenue)} (Gross: £${fmt(m.grossRevenue)} minus £${fmt(m.totalRefunds)} refunds)
- **Completed Orders:** ${m.orderCount?.toLocaleString()} orders
- **Average Order Value (AOV):** £${fmt(m.averageOrderValue)}
- **Total Units Sold:** ${m.totalUnitsSold?.toLocaleString()} units
- **Gross Profit Margin:** ${m.grossProfitMarginPct} (£${fmt(m.grossProfit)})

${
  m.totalRefunds > 0
    ? `⚠️ **Refund Impact:** £${fmt(m.totalRefunds)} in refunds was deducted to reflect true earned net revenue.`
    : `✅ **No Return Deductions:** No cancellations were recorded in this period.`
}

*Supporting Records:* Calculated directly from ${m.orderCount} distinct invoice records in your sales ledger.`
    }

    case 'get_top_products': {
      const prods = toolResult.topSellingProducts || []
      const slow = toolResult.slowMovingProducts || []
      let text = `### 🏆 Top Performing Products by Revenue\n\n`
      prods.forEach((p, idx) => {
        text += `${idx + 1}. **${p.name}** (SKU: \`${p.sku}\`)\n   - **Revenue:** £${fmt(p.revenue)} | **Units Sold:** ${p.unitsSold.toLocaleString()} | **Avg Price:** £${fmt(p.averageSellingPrice)}\n`
      })
      if (slow.length > 0) {
        text += `\n### ⏳ Slow-Moving Inventory Alert\n`
        slow.forEach((s) => {
          text += `- **${s.name}** (\`${s.sku}\`): ${s.currentStock} units in stock with only ${s.unitsSoldRecent || 0} recent sales.\n`
        })
      }
      return text
    }

    case 'get_inventory_status': {
      const s = toolResult.inventorySummary || {}
      const low = toolResult.flaggedLowStockItems || []
      let text = `### 📦 Real-Time Inventory Health Status

- **Tracked Products:** ${s.totalTrackedProducts} SKUs
- **Total Stock Valuation:** £${fmt(s.totalInventoryValuation)}
- **Healthy Stock:** ${s.healthyStockCount} items
- **Low Stock Warnings:** ${s.lowStockProductCount} items
- **Out of Stock:** ${s.outOfStockProductCount} items\n\n`

      if (low.length > 0) {
        text += `#### 🚨 Priority Items At or Below Reorder Threshold:\n`
        low.slice(0, 5).forEach((item) => {
          text += `- **${item.name}** (\`${item.sku}\`): Current Stock: **${item.currentStock}** (Reorder Threshold: ${item.reorderThreshold})\n`
        })
      }
      return text
    }

    case 'get_expense_summary': {
      const cats = toolResult.categoryBreakdown || []
      let text = `### 💳 Operating Expenses Summary\n\n`
      text += `**Total Operating Expenses:** £${fmt(toolResult.totalOperatingExpenses)}\n\n`
      text += `#### Category Spend Breakdown:\n`
      cats.forEach((c) => {
        text += `- **${c.category}:** £${fmt(c.totalSpend)} (${c.percentOfTotal} of total, ${c.transactionCount} transactions)\n`
      })
      return text
    }

    case 'get_revenue_vs_expenses': {
      const s = toolResult.summary || {}
      return `### ⚖️ Revenue vs Expense Profitability Comparison

- **Net Revenue:** £${fmt(s.netRevenue)}
- **Total Operating Expenses:** £${fmt(s.totalExpenses)}
- **Net Profit:** £${fmt(s.netProfit)} (Margin: **${s.netProfitMargin}**)
- **Gross Profit:** £${fmt(s.grossProfit)} (Gross Margin: **${s.grossProfitMargin}**)

**Business Status:** ${
        toolResult.profitabilityStatus === 'PROFITABLE'
          ? `🟢 **Profitable Operations:** Business is currently generating a positive net margin of ${s.netProfitMargin}.`
          : `🔴 **Operating at a Loss:** Operating expenses exceed earned net revenue by £${fmt(Math.abs(s.netProfit))}.`
      }`
    }

    case 'get_demand_forecast': {
      const sample = toolResult.dailyForecastSample || []
      let text = `### 📈 Machine Learning Demand Forecast (${toolResult.forecastHorizonDays}-Day Horizon)

- **Target:** ${toolResult.targetProduct}
- **Forecasted Demand:** **${toolResult.totalForecastedUnits?.toLocaleString()} units**
- **Forecasted Revenue:** **£${fmt(toolResult.totalForecastedRevenue)}** (~£${fmt(toolResult.dailyAverageRevenue)} / day)
- **Model Evaluation:** ${toolResult.modelEvaluation?.modelType} achieved a WAPE of **${toolResult.modelEvaluation?.wapeScore}** (${toolResult.modelEvaluation?.wapeImprovementVsBaseline}).\n\n`

      text += `#### Upcoming Daily Projections Sample:\n`
      sample.forEach((d) => {
        text += `- **${d.date} (${d.day}):** ~${d.predictedUnits} units (90% CI: ${d.range90PercentCI}) → Expected Revenue: £${fmt(d.expectedRevenue)}\n`
      })
      return text
    }

    case 'get_anomalies': {
      const obs = toolResult.flaggedObservations || []
      let text = `### 🔍 Machine Learning Anomaly Detection (${toolResult.domain.toUpperCase()})

Evaluated ${toolResult.totalEvaluated} historical records using ${toolResult.detectionAlgorithm}. Flagged **${toolResult.totalFlaggedAnomalies} unusual observations**.\n\n`

      if (obs.length > 0) {
        text += `#### Flagged Outliers & Feature Explanations:\n`
        obs.forEach((a) => {
          text += `- **${a.categoryOrItem}** (£${fmt(a.amount)}) on ${a.date} [Severity: **${a.severity}**, Z-Score: ${a.zScore}]\n`
          if (a.explanation?.length) {
            a.explanation.forEach((exp) => (text += `  • *${exp}*\n`))
          }
        })
      } else {
        text += `✅ No severe anomalies detected in the current transaction window.`
      }
      return text
    }

    case 'get_inventory_risk_recommendations': {
      const items = toolResult.actionRequiredItems || []
      let text = `### ⚠️ Inventory Stockout Risk & Replenishment Recommendations\n\n`
      if (items.length > 0) {
        items.forEach((item, idx) => {
          text += `${idx + 1}. **${item.name}** (SKU: \`${item.sku}\`)\n`
          text += `   - **Status:** ${item.riskLevel} | **Days of Supply:** ${item.daysOfSupply}\n`
          text += `   - **Action:** Order **${item.suggestedOrderQty} units** from ${item.supplierName} (${item.leadTimeDays}d lead time)\n`
          text += `   - **Estimated Purchase Cost:** £${fmt(item.estimatedCost)}\n`
          text += `   - *Rationale:* ${item.rationale}\n\n`
        })
      } else {
        text += `✅ All evaluated products have sufficient supply covering current run-rates.`
      }
      return text
    }

    case 'get_customer_churn_risks': {
      const custs = toolResult.criticalRiskCustomers || []
      let text = `### 👥 Customer Inactivity & Churn Risk Scoring

Model: ${toolResult.modelPerformance?.algorithm} (ROC-AUC: **${toolResult.modelPerformance?.rocAucScore}**, ${toolResult.modelPerformance?.liftVsBaseline})\n\n`
      if (custs.length > 0) {
        text += `#### High-Priority At-Risk Customers:\n`
        custs.forEach((c) => {
          text += `- **Customer #${c.customerId}** (${c.riskTier} Risk: ${c.churnProbability} probability)\n`
          text += `  - Inactive for **${c.daysInactive} days** | Total historical spend: £${fmt(c.lifetimeSpend)} across ${c.orderCount} orders.\n`
          text += `  - 💡 **Recommended Action:** ${c.recommendedAction}\n`
        })
      } else {
        text += `✅ No high-priority churn risks identified.`
      }
      return text
    }

    case 'get_customer_insights': {
      const s = toolResult.customerSummary || {}
      const top = toolResult.topValuedCustomers || []
      let text = `### 👥 Customer Base Analytics

- **Total Registered Customers:** ${s.totalRegisteredCustomers}
- **Active Customers:** ${s.activeCustomerCount}
- **Repeat Purchase Rate:** ${s.repeatCustomerRate}
- **Average Customer Spend:** £${fmt(s.overallAverageSpend)}\n\n`

      if (top.length > 0) {
        text += `#### Top Spending Customers:\n`
        top.forEach((c) => {
          text += `- **${c.name}** (ID: ${c.customerId}): £${fmt(c.totalSpend)} across ${c.ordersCount} orders (Last active: ${c.lastOrderDate})\n`
        })
      }
      return text
    }

    case 'get_operational_alerts': {
      const alerts = toolResult.alerts || []
      if (alerts.length === 0) {
        return `✅ **No Active Alerts:** All operational systems and thresholds are operating normally.`
      }
      let text = `### 🚨 Active Operational Alerts (${toolResult.activeAlertsCount} Total)\n\n`
      alerts.forEach((a) => {
        text += `- **[${a.severity}] ${a.title}** (${a.category})\n  ${a.message}\n`
      })
      return text
    }

    case 'get_recommendations': {
      const recs = toolResult.recommendations || []
      const s = toolResult.summary || {}
      if (recs.length === 0) {
        return `✅ **No Action Items Pending:** There are currently 0 pending recommendations requiring review.`
      }
      let text = `### 💡 Prioritized Business Recommendations (${s.pendingReviewCount} Pending Review)\n\n`
      text += `**Estimated Financial Impact:** ${s.totalEstimatedFinancialImpact} | **Critical Actions:** ${s.criticalPendingCount}\n\n`
      recs.forEach((r, idx) => {
        text += `${idx + 1}. **[${r.severity}] ${r.title}** (${r.category})\n`
        text += `   - **Reason:** ${r.reason}\n`
        text += `   - **Estimated Impact:** ${r.estimatedImpact}\n`
        text += `   - **Action Type:** \`${r.actionType}\` ${r.requiresConfirmation ? '(⚠️ Consequential — Requires Human Confirmation)' : ''}\n`
        text += `   - **Status:** \`${r.status}\` | ID: \`${r.id}\`\n\n`
      })
      text += `*Note: You can review and approve or execute these recommendations in the **Recommendations Dashboard**.*`
      return text
    }

    case 'get_recommendation_audit_log': {
      const logs = toolResult.logs || []
      if (logs.length === 0) {
        return `ℹ️ **Audit Trail Empty:** No recommendation review or execution events recorded yet.`
      }
      let text = `### 📜 Recommendation Decision & Execution Audit Trail\n\n`
      logs.forEach((l, idx) => {
        text += `${idx + 1}. **${l.action}** by **${l.decidedBy}** (${l.role}) on ${new Date(l.timestamp).toLocaleString('en-GB')}\n`
        text += `   - Recommendation: "${l.title}" (\`${l.type}\`)\n`
        text += `   - New Status: \`${l.newStatus || 'N/A'}\`\n`
        if (l.notes) text += `   - Notes: *${l.notes}*\n`
        text += `\n`
      })
      return text
    }

    default:
      return `Operation ${toolName} completed. Results: ${JSON.stringify(toolResult, null, 2)}`
  }
}
