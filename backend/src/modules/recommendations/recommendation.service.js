import Recommendation from './recommendation.model.js'
import RecommendationAudit from './recommendationAudit.model.js'
import * as mlService from '../ml/ml.service.js'
import * as analyticsService from '../analytics/analytics.service.js'
import Product from '../business/product.model.js'
import Supplier from '../business/supplier.model.js'
import Expense from '../business/expense.model.js'
import Customer from '../business/customer.model.js'
import InventoryMovement from '../business/inventoryMovement.model.js'
import AppError from '../../utils/AppError.js'

export const generateRecommendations = async (businessId) => {
  const generated = []

  // --------------------------------------------------------------------------
  // 1. INVENTORY REORDER RECOMMENDATIONS (Analytics + ML Risk)
  // --------------------------------------------------------------------------
  try {
    const invRisk = await mlService.getInventoryRisk({ businessId, limit: 100 })
    const items = invRisk?.items || []

    for (const item of items) {
      if (['OUT_OF_STOCK', 'CRITICAL', 'HIGH'].includes(item.risk_level)) {
        const recItem = item.replenishment_recommendation
        if (recItem && recItem.status === 'RECOMMENDED') {
          const title =
            item.risk_level === 'OUT_OF_STOCK'
              ? `Immediate Restock Required: ${item.name}`
              : `Stockout Risk Warning: Reorder ${item.name}`

          const estLoss = Math.round(
            (recItem.suggested_order_quantity || 50) * (item.sellingPrice || item.costPrice * 1.5 || 5) * 100
          ) / 100

          generated.push({
            businessId,
            title,
            type: 'INVENTORY_REORDER',
            category: 'Inventory',
            severity: item.risk_level === 'OUT_OF_STOCK' || item.risk_level === 'CRITICAL' ? 'CRITICAL' : 'HIGH',
            urgency: item.risk_level === 'OUT_OF_STOCK' ? 'IMMEDIATE' : 'THIS_WEEK',
            reason:
              item.risk_level === 'OUT_OF_STOCK'
                ? `Product '${item.name}' (SKU: ${item.sku}) is currently stocked out. Run-rate velocity requires immediate replenishment to avoid customer order cancellations.`
                : `Product '${item.name}' (SKU: ${item.sku}) has only ${item.days_of_supply} days of supply remaining, below vendor lead time (${item.supplier_lead_time_days || 7} days).`,
            evidence: {
              metrics: {
                currentStock: item.current_stock,
                daysOfSupply: item.days_of_supply,
                dailyDemandRunRate: item.daily_demand_velocity,
                supplierLeadTimeDays: item.supplier_lead_time_days,
                reorderThreshold: item.reorder_threshold,
              },
              supportingRecords: [item],
              generatedBy: 'INVENTORY_RISK',
            },
            estimatedImpact: {
              metric: 'Protected Sales Revenue',
              amount: estLoss,
              currency: 'GBP',
              explanation: `Prevents an estimated £${estLoss.toLocaleString()} in stockout-induced lost sales over the supplier transit window.`,
            },
            action: {
              actionType: 'PURCHASE_ORDER',
              targetEntity: {
                entityType: 'product',
                entityId: item.sku,
                sku: item.sku,
                name: item.name,
              },
              suggestedPayload: {
                sku: item.sku,
                productName: item.name,
                supplierId: recItem.supplier_id || 'SUP-101',
                supplierName: recItem.supplier_name || 'Designated Supplier',
                orderQty: recItem.suggested_order_quantity || 50,
                unitCost: item.costPrice || 2.5,
                estimatedTotalCost: recItem.estimated_order_cost || 125,
              },
              isConsequential: true,
              requiresConfirmation: true,
            },
          })
        }
      }
    }
  } catch (err) {
    console.warn('[Recommendations] Failed to evaluate inventory risk:', err.message)
  }

  // --------------------------------------------------------------------------
  // 2. EXPENSE ANOMALY AUDIT RECOMMENDATIONS (ML Isolation Forest)
  // --------------------------------------------------------------------------
  try {
    const anom = await mlService.getAnomalies({ domain: 'expenses', limit: 10 })
    const flagged = (anom?.anomalies || []).filter(
      (a) => a.severity === 'CRITICAL' || a.severity === 'HIGH'
    )

    for (const a of flagged) {
      const excess = Math.max(
        0,
        Math.round((a.amount - (a.baseline_stats?.category_median || a.amount * 0.4)) * 100) / 100
      )

      generated.push({
        businessId,
        title: `Unusual Expense Audit: ${a.category} (£${Number(a.amount).toLocaleString()})`,
        type: 'EXPENSE_AUDIT',
        category: 'Finance',
        severity: a.severity === 'CRITICAL' ? 'CRITICAL' : 'HIGH',
        urgency: 'THIS_WEEK',
        reason: `Isolation Forest flagged expense transaction (${a.expense_id}) of £${Number(
          a.amount
        ).toLocaleString()} in '${a.category}'. Z-Score of +${a.z_score} standard deviations above normal baseline.`,
        evidence: {
          metrics: {
            amount: a.amount,
            zScore: a.z_score,
            iqrRatio: a.iqr_ratio,
            anomalyScore: a.anomaly_score,
            categoryMedian: a.baseline_stats?.category_median,
          },
          supportingRecords: a.explanation || [],
          generatedBy: 'ML_ANOMALY',
        },
        estimatedImpact: {
          metric: 'Potential Operating Savings',
          amount: excess,
          currency: 'GBP',
          explanation: `Auditing this charge can reclaim or prevent an estimated £${excess.toLocaleString()} in anomalous category overspending.`,
        },
        action: {
          actionType: 'EXPENSE_REVIEW',
          targetEntity: {
            entityType: 'expense',
            entityId: a.expense_id,
            name: a.category,
          },
          suggestedPayload: {
            expenseId: a.expense_id,
            category: a.category,
            flaggedAmount: a.amount,
            recommendedAction: 'Verify invoice with finance department and vendor.',
          },
          isConsequential: false,
          requiresConfirmation: true,
        },
      })
    }
  } catch (err) {
    console.warn('[Recommendations] Failed to evaluate expense anomalies:', err.message)
  }

  // --------------------------------------------------------------------------
  // 3. CUSTOMER CHURN RETENTION INTERVENTIONS (ML RFM Classifier)
  // --------------------------------------------------------------------------
  try {
    const churn = await mlService.getCustomerChurn({ limit: 10 })
    const criticalCusts = (churn?.customers || []).filter(
      (c) => c.risk_tier === 'CRITICAL' && (c.rfm_metrics?.monetary_spend || 0) >= 100
    )

    for (const c of criticalCusts.slice(0, 5)) {
      const ltv = c.rfm_metrics?.monetary_spend || 0
      generated.push({
        businessId,
        title: `High-Value Customer Win-Back: Customer #${c.customer_id}`,
        type: 'CUSTOMER_RETENTION',
        category: 'Customers',
        severity: 'HIGH',
        urgency: 'THIS_WEEK',
        reason: `Customer #${c.customer_id} has been inactive for ${c.rfm_metrics?.recency_days} days. Historical spend of £${ltv.toLocaleString()} across ${
          c.rfm_metrics?.frequency_orders
        } orders indicates high churn risk (${Math.round(c.churn_probability * 100)}% probability).`,
        evidence: {
          metrics: {
            churnProbability: c.churn_probability,
            daysInactive: c.rfm_metrics?.recency_days,
            lifetimeSpend: ltv,
            orderCount: c.rfm_metrics?.frequency_orders,
          },
          supportingRecords: [c.recommended_action],
          generatedBy: 'ML_CHURN',
        },
        estimatedImpact: {
          metric: 'Recoverable Customer Lifetime Value',
          amount: ltv,
          currency: 'GBP',
          explanation: `Targeted re-engagement protects an estimated £${ltv.toLocaleString()} in future repeat order value.`,
        },
        action: {
          actionType: 'WINBACK_CAMPAIGN',
          targetEntity: {
            entityType: 'customer',
            entityId: c.customer_id,
            name: `Customer #${c.customer_id}`,
          },
          suggestedPayload: {
            customerId: c.customer_id,
            campaignType: 'PERSONALIZED_DISCOUNT',
            discountPercent: 10,
            recommendedOffer: c.recommended_action,
          },
          isConsequential: false,
          requiresConfirmation: true,
        },
      })
    }
  } catch (err) {
    console.warn('[Recommendations] Failed to evaluate customer churn:', err.message)
  }

  // --------------------------------------------------------------------------
  // 4. PERSISTENCE & DEDUPLICATION
  // --------------------------------------------------------------------------
  const saved = []
  for (const rec of generated) {
    // Check if an unapplied/pending recommendation for same entity and action already exists
    const existing = await Recommendation.findOne({
      businessId,
      type: rec.type,
      'action.targetEntity.entityId': rec.action.targetEntity.entityId,
      status: { $in: ['PENDING_REVIEW', 'APPROVED'] },
    })

    if (!existing) {
      const created = await Recommendation.create(rec)
      saved.push(created)

      // Audit log creation
      await RecommendationAudit.create({
        businessId,
        recommendationId: created._id,
        recommendationTitle: created.title,
        recommendationType: created.type,
        userId: '000000000000000000000000', // System engine user
        userName: 'OpsMind Recommendation Engine',
        userRole: 'system',
        action: 'GENERATED',
        newStatus: 'PENDING_REVIEW',
        notes: created.reason,
      })
    } else {
      // Update metrics & evidence on existing
      existing.evidence = rec.evidence
      existing.estimatedImpact = rec.estimatedImpact
      existing.action.suggestedPayload = rec.action.suggestedPayload
      await existing.save()
      saved.push(existing)
    }
  }

  return saved
}

export const getRecommendations = async (businessId, query = {}) => {
  const filter = { businessId }
  if (query.status && query.status !== 'ALL') {
    filter.status = query.status
  }
  if (query.type && query.type !== 'ALL') {
    filter.type = query.type
  }
  if (query.severity && query.severity !== 'ALL') {
    filter.severity = query.severity
  }

  const page = Math.max(1, parseInt(query.page, 10) || 1)
  const limit = Math.min(100, Math.max(1, parseInt(query.limit, 10) || 20))
  const skip = (page - 1) * limit

  const [items, total, summary] = await Promise.all([
    Recommendation.find(filter).sort({ severity: 1, urgency: 1, createdAt: -1 }).skip(skip).limit(limit).lean(),
    Recommendation.countDocuments(filter),
    getRecommendationSummary(businessId),
  ])

  return {
    items,
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    },
    summary,
  }
}

export const getRecommendationSummary = async (businessId) => {
  const [counts, totalImpact] = await Promise.all([
    Recommendation.aggregate([
      { $match: { businessId } },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]),
    Recommendation.aggregate([
      { $match: { businessId, status: { $in: ['PENDING_REVIEW', 'APPROVED'] } } },
      { $group: { _id: null, totalAmount: { $sum: '$estimatedImpact.amount' } } },
    ]),
  ])

  const statusMap = {
    PENDING_REVIEW: 0,
    APPROVED: 0,
    APPLIED: 0,
    DISMISSED: 0,
    REJECTED: 0,
  }
  counts.forEach((c) => {
    if (statusMap[c._id] !== undefined) statusMap[c._id] = c.count
  })

  const criticalCount = await Recommendation.countDocuments({
    businessId,
    status: 'PENDING_REVIEW',
    severity: 'CRITICAL',
  })

  return {
    pendingReviewCount: statusMap.PENDING_REVIEW,
    approvedCount: statusMap.APPROVED,
    appliedCount: statusMap.APPLIED,
    dismissedCount: statusMap.DISMISSED,
    rejectedCount: statusMap.REJECTED,
    criticalPendingCount: criticalCount,
    totalEstimatedFinancialImpact: Math.round((totalImpact[0]?.totalAmount || 0) * 100) / 100,
  }
}

export const reviewRecommendation = async (id, { status, notes, user, businessId }) => {
  if (!['APPROVED', 'REJECTED', 'DISMISSED'].includes(status)) {
    throw new AppError("Invalid review status. Allowed: 'APPROVED', 'REJECTED', 'DISMISSED'", 400)
  }

  const rec = await Recommendation.findOne({ _id: id, businessId })
  if (!rec) {
    throw new AppError('Recommendation not found', 404)
  }

  const prevStatus = rec.status
  rec.status = status
  rec.decision = {
    decidedBy: user._id,
    decidedByName: user.name,
    decidedAt: new Date(),
    decisionNotes: notes || '',
  }

  await rec.save()

  // Log audit trail
  await RecommendationAudit.create({
    businessId,
    recommendationId: rec._id,
    recommendationTitle: rec.title,
    recommendationType: rec.type,
    userId: user._id,
    userName: user.name,
    userRole: user.role || 'admin',
    action: status,
    previousStatus: prevStatus,
    newStatus: status,
    notes: notes || `Recommendation ${status.toLowerCase()} by user.`,
  })

  return rec
}

export const executeConsequentialAction = async (id, { confirmed, executionPayload, user, businessId }) => {
  if (confirmed !== true) {
    throw new AppError(
      'Human confirmation is strictly required to execute consequential business operations.',
      400
    )
  }

  const rec = await Recommendation.findOne({ _id: id, businessId })
  if (!rec) {
    throw new AppError('Recommendation not found', 404)
  }

  if (rec.status === 'APPLIED') {
    throw new AppError('This recommendation action has already been executed.', 400)
  }

  const prevStatus = rec.status
  const payload = executionPayload || rec.action.suggestedPayload || {}
  let executionResult = null

  // Execute Domain Action deterministically
  if (rec.action.actionType === 'PURCHASE_ORDER') {
    const sku = rec.action.targetEntity?.sku || payload.sku
    const orderQty = Number(payload.orderQty) || 50
    const unitCost = Number(payload.unitCost) || 2.5

    // 1. Create an audit ledger Inventory Movement for the restocking order
    const movement = await InventoryMovement.create({
      businessId,
      movementId: `MOV-PO-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      productSku: sku,
      movementType: 'INBOUND_PURCHASE',
      quantity: orderQty,
      unitCost,
      referenceId: `PO-${Date.now().toString().slice(-6)}`,
      reason: `Human Confirmed Purchase Order: ${rec.title}`,
      timestamp: new Date(),
    })

    // 2. Adjust Product stock level
    const updatedProd = await Product.findOneAndUpdate(
      { businessId, sku },
      { $inc: { currentStock: orderQty } },
      { new: true }
    )

    executionResult = {
      action: 'PURCHASE_ORDER_EXECUTED',
      poNumber: movement.referenceId,
      unitsRestocked: orderQty,
      supplierName: payload.supplierName || 'Designated Vendor',
      totalOrderCost: Math.round(orderQty * unitCost * 100) / 100,
      newCurrentStock: updatedProd ? updatedProd.currentStock : 'N/A',
    }
  } else if (rec.action.actionType === 'THRESHOLD_UPDATE') {
    const sku = rec.action.targetEntity?.sku
    const newThreshold = Number(payload.newThreshold) || 50

    await Product.findOneAndUpdate({ businessId, sku }, { reorderThreshold: newThreshold })

    executionResult = {
      action: 'REORDER_THRESHOLD_UPDATED',
      sku,
      newReorderThreshold: newThreshold,
    }
  } else if (rec.action.actionType === 'EXPENSE_REVIEW') {
    executionResult = {
      action: 'EXPENSE_AUDIT_LOGGED',
      expenseId: rec.action.targetEntity?.entityId,
      auditedBy: user.name,
      notes: payload.notes || 'Audited and verified against operational budget.',
    }
  } else if (rec.action.actionType === 'WINBACK_CAMPAIGN') {
    executionResult = {
      action: 'WINBACK_INTERVENTION_DISPATCHED',
      customerId: rec.action.targetEntity?.entityId,
      campaignType: payload.campaignType || 'PERSONALIZED_DISCOUNT',
      discountOffer: `${payload.discountPercent || 10}% replenishment discount`,
    }
  } else {
    executionResult = {
      action: 'GENERAL_ACTION_APPLIED',
      payload,
    }
  }

  // Update recommendation status to APPLIED
  rec.status = 'APPLIED'
  rec.decision = {
    decidedBy: user._id,
    decidedByName: user.name,
    decidedAt: new Date(),
    decisionNotes: payload.notes || 'Action confirmed and applied by user.',
    appliedActionResults: executionResult,
  }

  await rec.save()

  // Immutable audit log of the execution
  await RecommendationAudit.create({
    businessId,
    recommendationId: rec._id,
    recommendationTitle: rec.title,
    recommendationType: rec.type,
    userId: user._id,
    userName: user.name,
    userRole: user.role || 'admin',
    action: 'ACTION_EXECUTED',
    previousStatus: prevStatus,
    newStatus: 'APPLIED',
    executionPayload: payload,
    executionResult,
    notes: `Human user explicitly confirmed and executed action: ${rec.action.actionType}.`,
  })

  return {
    recommendation: rec,
    executionResult,
  }
}

export const getAuditLogs = async (businessId, query = {}) => {
  const filter = { businessId }
  if (query.recommendationId) {
    filter.recommendationId = query.recommendationId
  }

  const limit = Math.min(100, Math.max(1, parseInt(query.limit, 10) || 50))
  const logs = await RecommendationAudit.find(filter).sort({ timestamp: -1 }).limit(limit).lean()

  return logs
}
