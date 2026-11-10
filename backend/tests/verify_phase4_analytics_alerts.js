import dotenv from 'dotenv'
dotenv.config()

import mongoose from 'mongoose'
import connectDB from '../src/config/db.js'
import app from '../src/app.js'
import { User, Business } from '../src/modules/auth/index.js'
import { Product, Sale, Expense } from '../src/modules/business/index.js'
import { Alert } from '../src/modules/notifications/index.js'
import { generateToken } from '../src/modules/auth/auth.service.js'

const PORT = 5074

const testPhase4 = async () => {
  console.log('='.repeat(80))
  console.log(' OPSMIND BACKEND — PHASE 4: BUSINESS ANALYTICS & RULE-BASED ALERTS')
  console.log('='.repeat(80))

  let server
  const tenantId = `tenant_p4_${Date.now()}`
  const tenantBId = `tenant_p4_b_${Date.now()}`

  try {
    await connectDB()
    console.log('[OK] Connected to MongoDB.')

    server = app.listen(PORT, () => {
      console.log(`[OK] Phase 4 test server running on http://127.0.0.1:${PORT}\n`)
    })

    const baseUrl = `http://127.0.0.1:${PORT}/api`

    // ---------------------------------------------------------
    // SEED TEST TENANT
    // ---------------------------------------------------------
    await Business.create({
      businessId: tenantId,
      name: 'Highland Fine Goods',
      businessType: 'retail',
      currency: 'GBP',
    })

    const adminUser = await User.create({
      businessId: tenantId,
      name: 'Eleanor Admin',
      email: `eleanor_${Date.now()}@highland.com`,
      password: 'AdminPassword123!',
      role: 'admin',
    })
    const token = generateToken(adminUser)

    // Seed Products:
    // 1. In Stock Normal
    await Product.create({
      businessId: tenantId,
      sku: 'SKU-001',
      name: 'Wool Cardigan',
      category: 'Apparel',
      costPrice: 20.00,
      sellingPrice: 50.00,
      currentStock: 100,
      reorderThreshold: 20,
      targetStock: 150,
      isActive: true,
    })

    // 2. Low Stock (Stock 5 <= threshold 10)
    await Product.create({
      businessId: tenantId,
      sku: 'SKU-LOW',
      name: 'Cashmere Scarf',
      category: 'Accessories',
      costPrice: 15.00,
      sellingPrice: 40.00,
      currentStock: 4, // <= 10 * 0.5 -> HIGH LOW_STOCK
      reorderThreshold: 10,
      targetStock: 30,
      isActive: true,
    })

    // 3. Stockout (Stock 0)
    await Product.create({
      businessId: tenantId,
      sku: 'SKU-OUT',
      name: 'Silk Cravat',
      category: 'Accessories',
      costPrice: 10.00,
      sellingPrice: 25.00,
      currentStock: 0, // CRITICAL STOCKOUT_RISK
      reorderThreshold: 15,
      targetStock: 40,
      isActive: true,
    })

    // 4. Zero sales product (for bottom movers)
    await Product.create({
      businessId: tenantId,
      sku: 'SKU-SLOW',
      name: 'Vintage Walking Cane',
      category: 'Heritage',
      costPrice: 30.00,
      sellingPrice: 70.00,
      currentStock: 15,
      reorderThreshold: 5,
      targetStock: 20,
      isActive: true,
    })

    // Seed Sales:
    // Prior week (days 8-14 ago): High sales (£600)
    const d10Ago = new Date()
    d10Ago.setDate(d10Ago.getDate() - 10)
    await Sale.create({
      businessId: tenantId,
      invoiceId: 'INV-PRIOR-01',
      transactionDate: d10Ago,
      totalAmount: 600.00,
      totalUnits: 12,
      status: 'completed',
      items: [
        {
          productSku: 'SKU-001',
          productName: 'Wool Cardigan',
          quantity: 12,
          unitPrice: 50.00,
          lineTotal: 600.00,
        },
      ],
    })

    // Current week (days 1-3 ago): Low sales (£50) -> will trigger SALES_DROP (>30% drop)!
    const d2Ago = new Date()
    d2Ago.setDate(d2Ago.getDate() - 2)
    await Sale.create({
      businessId: tenantId,
      invoiceId: 'INV-CURR-01',
      transactionDate: d2Ago,
      totalAmount: 50.00,
      totalUnits: 1,
      status: 'completed',
      items: [
        {
          productSku: 'SKU-001',
          productName: 'Wool Cardigan',
          quantity: 1,
          unitPrice: 50.00,
          lineTotal: 50.00,
        },
      ],
    })

    // Cancelled sale (to test refund/cancellation handling)
    await Sale.create({
      businessId: tenantId,
      invoiceId: 'INV-CURR-CANCELLED',
      transactionDate: d2Ago,
      totalAmount: 40.00,
      totalUnits: 1,
      status: 'cancelled',
      items: [
        {
          productSku: 'SKU-LOW',
          productName: 'Cashmere Scarf',
          quantity: 1,
          unitPrice: 40.00,
          lineTotal: 40.00,
        },
      ],
    })

    // Seed Expenses:
    // Normal recurring expenses (£30, £40, £35 in Utilities)
    await Expense.create({
      businessId: tenantId,
      expenseId: 'EXP-NORM-1',
      description: 'Water utilities bill',
      category: 'Utilities',
      amount: 30.00,
      date: d10Ago,
    })
    await Expense.create({
      businessId: tenantId,
      expenseId: 'EXP-NORM-2',
      description: 'Broadband internet subscription',
      category: 'Utilities',
      amount: 40.00,
      date: d10Ago,
    })
    await Expense.create({
      businessId: tenantId,
      expenseId: 'EXP-NORM-3',
      description: 'Office supplies paper and toner',
      category: 'Utilities',
      amount: 35.00,
      date: d2Ago,
    })

    // Extreme Unusual Expense in Utilities (£650, which is > 15x mean)
    await Expense.create({
      businessId: tenantId,
      expenseId: 'EXP-ANOMALY-1',
      description: 'Emergency Server Hardware Replacement',
      category: 'Utilities',
      amount: 650.00,
      date: d2Ago,
    })

    // ---------------------------------------------------------
    // TEST 1: GET /api/analytics/sales-summaries
    // ---------------------------------------------------------
    console.log('--- 1. Testing GET /api/analytics/sales-summaries ---')
    const summariesRes = await fetch(`${baseUrl}/analytics/sales-summaries?period=daily`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    const summariesData = await summariesRes.json()
    if (
      summariesRes.status === 200 &&
      summariesData.data.totals.completedRevenue === 650.00 &&
      summariesData.data.totals.completedOrders === 2 &&
      summariesData.data.totals.cancelledRevenue === 40.00 &&
      summariesData.data.totals.cancelledOrders === 1
    ) {
      console.log(`[PASS] Sales summaries verified:`)
      console.log(`  - Completed Revenue: £${summariesData.data.totals.completedRevenue}`)
      console.log(`  - Cancelled/Refunded: £${summariesData.data.totals.cancelledRevenue} (${summariesData.data.totals.cancelledOrders} orders)`)
      console.log(`  - Refund Rate: ${summariesData.data.totals.overallRefundRatePercentage}%`)
    } else {
      throw new Error(`Sales summaries failed: ${JSON.stringify(summariesData)}`)
    }

    // ---------------------------------------------------------
    // TEST 2: GET /api/analytics/revenue-vs-expense
    // ---------------------------------------------------------
    console.log('\n--- 2. Testing GET /api/analytics/revenue-vs-expense ---')
    const revExpRes = await fetch(`${baseUrl}/analytics/revenue-vs-expense?period=monthly`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    const revExpData = await revExpRes.json()
    if (revExpRes.status === 200 && revExpData.data.timeline.length > 0) {
      const point = revExpData.data.timeline[0]
      console.log(`[PASS] Revenue vs Expense comparison verified:`)
      console.log(`  - Period: ${point.period}`)
      console.log(`  - Revenue: £${point.revenue}`)
      console.log(`  - COGS: £${point.cogs}`)
      console.log(`  - Gross Profit: £${point.grossProfit} (${point.grossMarginPercentage}%)`)
      console.log(`  - Operating Expenses: £${point.operatingExpenses}`)
      console.log(`  - Net Profit: £${point.netProfit}`)
    } else {
      throw new Error(`Revenue vs expense failed: ${JSON.stringify(revExpData)}`)
    }

    // ---------------------------------------------------------
    // TEST 3: GET /api/analytics/date-comparison
    // ---------------------------------------------------------
    console.log('\n--- 3. Testing GET /api/analytics/date-comparison ---')
    const dateCompRes = await fetch(`${baseUrl}/analytics/date-comparison?period=7d`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    const dateCompData = await dateCompRes.json()
    if (
      dateCompRes.status === 200 &&
      dateCompData.data.metrics.revenue.trend === 'DOWN' &&
      dateCompData.data.metrics.revenue.percentageDelta < 0
    ) {
      console.log(`[PASS] Date-over-date comparison verified:`)
      console.log(`  - Revenue Current: £${dateCompData.data.metrics.revenue.current}`)
      console.log(`  - Revenue Prior: £${dateCompData.data.metrics.revenue.prior}`)
      console.log(`  - Delta: ${dateCompData.data.metrics.revenue.percentageDelta}% (${dateCompData.data.metrics.revenue.trend})`)
    } else {
      throw new Error(`Date comparison failed: ${JSON.stringify(dateCompData)}`)
    }

    // ---------------------------------------------------------
    // TEST 4: GET /api/analytics/product-deep-dive
    // ---------------------------------------------------------
    console.log('\n--- 4. Testing GET /api/analytics/product-deep-dive ---')
    const deepDiveRes = await fetch(`${baseUrl}/analytics/product-deep-dive`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    const deepDiveData = await deepDiveRes.json()
    if (
      deepDiveRes.status === 200 &&
      deepDiveData.data.topByRevenue.some((p) => p.sku === 'SKU-001') &&
      deepDiveData.data.bottomMovers.some((p) => p.sku === 'SKU-SLOW') &&
      deepDiveData.data.categoryPerformance.length > 0
    ) {
      console.log(`[PASS] Product & category deep-dive verified:`)
      console.log(`  - Top Product: ${deepDiveData.data.topByRevenue[0].name} (£${deepDiveData.data.topByRevenue[0].totalRevenue})`)
      console.log(`  - Slow Mover Detected: ${deepDiveData.data.bottomMovers[0].name} (Units: 0)`)
      console.log(`  - Category Performance: ${deepDiveData.data.categoryPerformance[0].category} (Gross Profit: £${deepDiveData.data.categoryPerformance[0].grossProfit})`)
    } else {
      throw new Error(`Product deep dive failed: ${JSON.stringify(deepDiveData)}`)
    }

    // ---------------------------------------------------------
    // TEST 5: POST /api/alerts/evaluate (Rule-Based Alerts Engine)
    // ---------------------------------------------------------
    console.log('\n--- 5. Testing POST /api/alerts/evaluate ---')
    const evalRes = await fetch(`${baseUrl}/alerts/evaluate`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    })
    const evalData = await evalRes.json()
    if (evalRes.status === 200 && evalData.data.activeAlerts.length >= 3) {
      console.log(`[PASS] Evaluated and generated ${evalData.data.activeAlerts.length} rule-based alerts:`)
      evalData.data.activeAlerts.forEach((a) => {
        console.log(`  - [${a.severity}] ${a.type}: ${a.title}`)
      })

      // Verify rule types
      const types = evalData.data.activeAlerts.map((a) => a.type)
      if (!types.includes('STOCKOUT_RISK')) throw new Error('Missing STOCKOUT_RISK alert')
      if (!types.includes('LOW_STOCK')) throw new Error('Missing LOW_STOCK alert')
      if (!types.includes('UNUSUAL_EXPENSE')) throw new Error('Missing UNUSUAL_EXPENSE alert')
      if (!types.includes('SALES_DROP')) throw new Error('Missing SALES_DROP alert')
    } else {
      throw new Error(`Alert evaluation failed: ${JSON.stringify(evalData)}`)
    }

    // ---------------------------------------------------------
    // TEST 6: GET /api/alerts & GET /api/alerts/summary
    // ---------------------------------------------------------
    console.log('\n--- 6. Testing GET /api/alerts & GET /api/alerts/summary ---')
    const summaryRes = await fetch(`${baseUrl}/alerts/summary`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    const summaryData = await summaryRes.json()

    const listRes = await fetch(`${baseUrl}/alerts?status=OPEN`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    const listData = await listRes.json()

    if (
      summaryRes.status === 200 &&
      summaryData.data.totalActiveAlerts >= 3 &&
      summaryData.data.bySeverity.critical >= 1 &&
      listRes.status === 200 &&
      listData.data.alerts.length >= 3
    ) {
      console.log(`[PASS] Alert query and summary counts verified:`)
      console.log(`  - Total Active Alerts: ${summaryData.data.totalActiveAlerts}`)
      console.log(`  - Critical: ${summaryData.data.bySeverity.critical}, High: ${summaryData.data.bySeverity.high}, Medium: ${summaryData.data.bySeverity.medium}`)
    } else {
      throw new Error(`Alert summary/list failed: ${JSON.stringify(summaryData)}`)
    }

    // ---------------------------------------------------------
    // TEST 7: PATCH /api/alerts/:id/status (Lifecycle Update)
    // ---------------------------------------------------------
    console.log('\n--- 7. Testing PATCH /api/alerts/:id/status (Resolve / Dismiss) ---')
    const firstAlert = listData.data.alerts[0]
    const patchRes = await fetch(`${baseUrl}/alerts/${firstAlert._id}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ status: 'ACTIONED', notes: 'PO created' }),
    })
    const patchData = await patchRes.json()
    if (patchRes.status === 200 && patchData.data.status === 'ACTIONED' && patchData.data.resolvedAt) {
      console.log(`[PASS] Alert status transition verified: ID ${firstAlert._id} -> ACTIONED (resolvedAt: ${patchData.data.resolvedAt})`)
    } else {
      throw new Error(`Alert status update failed: ${JSON.stringify(patchData)}`)
    }

    // ---------------------------------------------------------
    // CLEANUP
    // ---------------------------------------------------------
    console.log('\n--- 8. Cleanup Test Tenant Artifacts ---')
    await Alert.deleteMany({ businessId: { $in: [tenantId, tenantBId] } })
    await Sale.deleteMany({ businessId: { $in: [tenantId, tenantBId] } })
    await Product.deleteMany({ businessId: { $in: [tenantId, tenantBId] } })
    await Expense.deleteMany({ businessId: { $in: [tenantId, tenantBId] } })
    await User.deleteMany({ businessId: { $in: [tenantId, tenantBId] } })
    await Business.deleteMany({ businessId: { $in: [tenantId, tenantBId] } })
    console.log('[PASS] Test cleanup complete.')

    console.log('\n' + '='.repeat(80))
    console.log(' ALL PHASE 4 BACKEND ANALYTICS & ALERTS TESTS PASSED (7/7)')
    console.log('='.repeat(80))
  } catch (error) {
    console.error('Phase 4 verification error:', error)
    process.exit(1)
  } finally {
    if (server) server.close()
    await mongoose.connection.close()
    process.exit(0)
  }
}

testPhase4()
