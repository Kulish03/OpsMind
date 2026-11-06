import dotenv from 'dotenv'
dotenv.config()

import mongoose from 'mongoose'
import connectDB from '../src/config/db.js'
import app from '../src/app.js'
import { User, Business } from '../src/modules/auth/index.js'
import { Product, Sale, Expense, Customer } from '../src/modules/business/index.js'
import { generateToken } from '../src/modules/auth/auth.service.js'

const PORT = 5073

const testAnalyticsApi = async () => {
  console.log('='.repeat(80))
  console.log(' OPSMIND BACKEND — STEP 13: BACKEND ANALYTICS CALCULATION VERIFICATION')
  console.log('='.repeat(80))

  let server
  const tenantAId = `tenant_ana_a_${Date.now()}`
  const tenantBId = `tenant_ana_b_${Date.now()}`

  try {
    await connectDB()
    console.log('[OK] Connected to MongoDB.')

    server = app.listen(PORT, () => {
      console.log(`[OK] Test server listening on http://127.0.0.1:${PORT}\n`)
    })

    const baseUrl = `http://127.0.0.1:${PORT}/api/analytics`

    // ---------------------------------------------------------
    // SEED TEST TENANTS & USERS
    // ---------------------------------------------------------
    await Business.create({
      businessId: tenantAId,
      name: 'Tenant A Highland Apparel',
      businessType: 'retail',
      currency: 'GBP',
    })

    const adminA = await User.create({
      businessId: tenantAId,
      name: 'Alice Admin',
      email: `alice_${Date.now()}@tenantA.com`,
      password: 'AdminPassword123!',
      role: 'admin',
    })
    const tokenAdminA = generateToken(adminA)

    await Business.create({
      businessId: tenantBId,
      name: 'Tenant B Competitor Store',
      businessType: 'retail',
      currency: 'USD',
    })

    const adminB = await User.create({
      businessId: tenantBId,
      name: 'Bob Competitor',
      email: `bob_${Date.now()}@tenantB.com`,
      password: 'CompetitorPassword123!',
      role: 'admin',
    })
    const tokenAdminB = generateToken(adminB)

    // Seed Products for Tenant A
    await Product.create({
      businessId: tenantAId,
      sku: 'PROD-A1',
      name: 'Harris Tweed Jacket',
      category: 'Apparel',
      sellingPrice: 50.00,
      costPrice: 20.00,
      currentStock: 100,
      reorderThreshold: 20,
      targetStock: 150,
    })

    await Product.create({
      businessId: tenantAId,
      sku: 'PROD-A2',
      name: 'Cashmere Beanie Hat',
      category: 'Accessories',
      sellingPrice: 30.00,
      costPrice: 10.00,
      currentStock: 5, // Low stock: <= 10
      reorderThreshold: 10,
      targetStock: 50,
    })

    // Seed Sales for Tenant A
    await Sale.create({
      businessId: tenantAId,
      invoiceId: 'INV-A-101',
      transactionDate: new Date('2026-02-01T10:00:00Z'),
      customerReference: 'CUST-A1',
      totalAmount: 100.00, // 2 * 50
      totalUnits: 2,
      status: 'completed',
      items: [
        {
          productSku: 'PROD-A1',
          productName: 'Harris Tweed Jacket',
          quantity: 2,
          unitPrice: 50.00,
          lineTotal: 100.00,
        },
      ],
    })

    await Sale.create({
      businessId: tenantAId,
      invoiceId: 'INV-A-102',
      transactionDate: new Date('2026-02-02T14:00:00Z'),
      customerReference: 'CUST-A1',
      totalAmount: 30.00, // 1 * 30
      totalUnits: 1,
      status: 'completed',
      items: [
        {
          productSku: 'PROD-A2',
          productName: 'Cashmere Beanie Hat',
          quantity: 1,
          unitPrice: 30.00,
          lineTotal: 30.00,
        },
      ],
    })

    // Seed Operating Expense for Tenant A
    await Expense.create({
      businessId: tenantAId,
      expenseId: 'EXP-A-01',
      category: 'Utilities',
      amount: 30.00,
      date: new Date('2026-02-03T12:00:00Z'),
      description: 'Electricity bill',
    })

    // Seed Customer for Tenant A
    await Customer.create({
      businessId: tenantAId,
      customerId: 'CUST-A1',
      name: 'Lord Lovat',
      totalSpend: 130.00,
      totalOrders: 2,
      rfm: { retentionStatus: 'ACTIVE' },
    })

    // Seed Foreign Tenant B Product & Sale
    await Product.create({
      businessId: tenantBId,
      sku: 'PROD-B1',
      name: 'Competitor Item',
      sellingPrice: 99.00,
      costPrice: 40.00,
      currentStock: 20,
    })

    await Sale.create({
      businessId: tenantBId,
      invoiceId: 'INV-B-999',
      transactionDate: new Date('2026-02-01T10:00:00Z'),
      totalAmount: 99.00,
      totalUnits: 1,
      status: 'completed',
      items: [
        {
          productSku: 'PROD-B1',
          productName: 'Competitor Item',
          quantity: 1,
          unitPrice: 99.00,
          lineTotal: 99.00,
        },
      ],
    })

    // ---------------------------------------------------------
    // TEST 1: EXECUTIVE KPIS (GET /api/analytics/kpis)
    // ---------------------------------------------------------
    console.log('--- 1. Testing GET /api/analytics/kpis (Executive KPIs) ---')
    const kpiRes = await fetch(`${baseUrl}/kpis`, {
      headers: { Authorization: `Bearer ${tokenAdminA}` },
    })
    const kpiData = await kpiRes.json()
    // Calculations:
    // Revenue: 100 + 30 = £130.00
    // COGS: (2 * 20) + (1 * 10) = 40 + 10 = £50.00
    // Gross Profit: 130 - 50 = £80.00
    // Gross Margin: (80 / 130) * 100 = 61.54%
    // Expenses: £30.00
    // Net Profit: 80 - 30 = £50.00
    // Net Margin: (50 / 130) * 100 = 38.46%
    // AOV: 130 / 2 = £65.00
    if (
      kpiRes.status === 200 &&
      kpiData.data.revenueAndOrders.totalRevenue === 130.00 &&
      kpiData.data.revenueAndOrders.totalOrders === 2 &&
      kpiData.data.revenueAndOrders.averageOrderValue === 65.00 &&
      kpiData.data.profitability.costOfGoodsSold === 50.00 &&
      kpiData.data.profitability.grossProfit === 80.00 &&
      kpiData.data.profitability.grossMarginPercentage === 61.54 &&
      kpiData.data.profitability.totalOperatingExpenses === 30.00 &&
      kpiData.data.profitability.netProfit === 50.00 &&
      kpiData.data.profitability.netProfitMarginPercentage === 38.46
    ) {
      console.log(`[PASS] Executive KPIs calculated accurately:`)
      console.log(`  - Total Revenue: £${kpiData.data.revenueAndOrders.totalRevenue}`)
      console.log(`  - AOV: £${kpiData.data.revenueAndOrders.averageOrderValue}`)
      console.log(`  - COGS: £${kpiData.data.profitability.costOfGoodsSold}`)
      console.log(`  - Gross Profit: £${kpiData.data.profitability.grossProfit} (${kpiData.data.profitability.grossMarginPercentage}%)`)
      console.log(`  - Operating Expenses: £${kpiData.data.profitability.totalOperatingExpenses}`)
      console.log(`  - Net Profit: £${kpiData.data.profitability.netProfit} (${kpiData.data.profitability.netProfitMarginPercentage}%)`)
    } else {
      throw new Error(`KPI calculation failed: ${JSON.stringify(kpiData)}`)
    }

    // ---------------------------------------------------------
    // TEST 2: REVENUE TRENDS (GET /api/analytics/revenue-trend)
    // ---------------------------------------------------------
    console.log('\n--- 2. Testing GET /api/analytics/revenue-trend (Time-Series) ---')
    const trendRes = await fetch(`${baseUrl}/revenue-trend?period=daily`, {
      headers: { Authorization: `Bearer ${tokenAdminA}` },
    })
    const trendData = await trendRes.json()
    if (
      trendRes.status === 200 &&
      trendData.data.trend.length === 2 &&
      trendData.data.trend[0].date === '2026-02-01' &&
      trendData.data.trend[0].revenue === 100.00 &&
      trendData.data.trend[1].date === '2026-02-02' &&
      trendData.data.trend[1].revenue === 30.00
    ) {
      console.log(`[PASS] Daily revenue trend verified: 2 points [2026-02-01: £100, 2026-02-02: £30]`)
    } else {
      throw new Error(`Revenue trend failed: ${JSON.stringify(trendData)}`)
    }

    // ---------------------------------------------------------
    // TEST 3: TOP PRODUCTS (GET /api/analytics/top-products)
    // ---------------------------------------------------------
    console.log('\n--- 3. Testing GET /api/analytics/top-products ---')
    const topRes = await fetch(`${baseUrl}/top-products?limit=5`, {
      headers: { Authorization: `Bearer ${tokenAdminA}` },
    })
    const topData = await topRes.json()
    if (
      topRes.status === 200 &&
      topData.data.topProducts.length === 2 &&
      topData.data.topProducts[0].sku === 'PROD-A1' &&
      topData.data.topProducts[0].totalRevenueGenerated === 100.00 &&
      topData.data.topProducts[1].sku === 'PROD-A2' &&
      topData.data.topProducts[1].totalRevenueGenerated === 30.00
    ) {
      console.log(`[PASS] Top products ranked by revenue: #1 ${topData.data.topProducts[0].productName} (£${topData.data.topProducts[0].totalRevenueGenerated}), #2 ${topData.data.topProducts[1].productName} (£${topData.data.topProducts[1].totalRevenueGenerated})`)
    } else {
      throw new Error(`Top products ranking failed: ${JSON.stringify(topData)}`)
    }

    // ---------------------------------------------------------
    // TEST 4: CATEGORY BREAKDOWN (GET /api/analytics/category-breakdown)
    // ---------------------------------------------------------
    console.log('\n--- 4. Testing GET /api/analytics/category-breakdown ---')
    const catRes = await fetch(`${baseUrl}/category-breakdown`, {
      headers: { Authorization: `Bearer ${tokenAdminA}` },
    })
    const catData = await catRes.json()
    if (
      catRes.status === 200 &&
      catData.data.categories.length === 2 &&
      catData.data.categories[0].category === 'Apparel' &&
      catData.data.categories[0].revenue === 100.00 &&
      catData.data.categories[0].revenueSharePercentage === 76.92
    ) {
      console.log(`[PASS] Category breakdown verified: Apparel: £100 (76.92%), Accessories: £30 (23.08%)`)
    } else {
      throw new Error(`Category breakdown failed: ${JSON.stringify(catData)}`)
    }

    // ---------------------------------------------------------
    // TEST 5: CUSTOMER INSIGHTS (GET /api/analytics/customer-insights)
    // ---------------------------------------------------------
    console.log('\n--- 5. Testing GET /api/analytics/customer-insights ---')
    const custRes = await fetch(`${baseUrl}/customer-insights`, {
      headers: { Authorization: `Bearer ${tokenAdminA}` },
    })
    const custData = await custRes.json()
    if (
      custRes.status === 200 &&
      custData.data.totalCustomers === 1 &&
      custData.data.rfmRetentionSegments.ACTIVE === 1 &&
      custData.data.trackedCustomerSpend === 130.00
    ) {
      console.log(`[PASS] Customer insights verified: 1 Active customer with £130 tracked spend`)
    } else {
      throw new Error(`Customer insights failed: ${JSON.stringify(custData)}`)
    }

    // ---------------------------------------------------------
    // TEST 6: INVENTORY HEALTH & STOCKOUT RISK (GET /api/analytics/inventory-health)
    // ---------------------------------------------------------
    console.log('\n--- 6. Testing GET /api/analytics/inventory-health ---')
    const invRes = await fetch(`${baseUrl}/inventory-health`, {
      headers: { Authorization: `Bearer ${tokenAdminA}` },
    })
    const invData = await invRes.json()
    // Capital tied: (100 * 20) + (5 * 10) = 2000 + 50 = 2050
    // Low stock: PROD-A2
    if (
      invRes.status === 200 &&
      invData.data.totalActiveProducts === 2 &&
      invData.data.capitalTiedInInventory === 2050.00 &&
      invData.data.statusCounts.lowStock === 1 &&
      invData.data.criticalReorderAlerts.some((a) => a.sku === 'PROD-A2')
    ) {
      console.log(`[PASS] Inventory health verified: Capital tied £${invData.data.capitalTiedInInventory}, Critical alert triggered for PROD-A2`)
    } else {
      throw new Error(`Inventory health failed: ${JSON.stringify(invData)}`)
    }

    // ---------------------------------------------------------
    // TEST 7: CROSS-TENANT DATA ISOLATION
    // ---------------------------------------------------------
    console.log('\n--- 7. Testing Cross-Tenant Data Isolation in Analytics ---')
    const tenantBKpiRes = await fetch(`${baseUrl}/kpis`, {
      headers: { Authorization: `Bearer ${tokenAdminB}` },
    })
    const tenantBKpiData = await tenantBKpiRes.json()
    if (
      tenantBKpiRes.status === 200 &&
      tenantBKpiData.data.revenueAndOrders.totalRevenue === 99.00 &&
      tenantBKpiData.data.revenueAndOrders.totalOrders === 1
    ) {
      console.log(`[PASS] Tenant B analytics completely isolated: Tenant B Revenue = £99.00 (Zero bleed from Tenant A)`)
    } else {
      throw new Error(`Cross-tenant analytics isolation failed: ${JSON.stringify(tenantBKpiData)}`)
    }

    // ---------------------------------------------------------
    // CLEANUP
    // ---------------------------------------------------------
    console.log('\n--- 8. Cleanup Test Artifacts ---')
    await Sale.deleteMany({ businessId: { $in: [tenantAId, tenantBId] } })
    await Product.deleteMany({ businessId: { $in: [tenantAId, tenantBId] } })
    await Expense.deleteMany({ businessId: { $in: [tenantAId, tenantBId] } })
    await Customer.deleteMany({ businessId: { $in: [tenantAId, tenantBId] } })
    await User.deleteMany({ businessId: { $in: [tenantAId, tenantBId] } })
    await Business.deleteMany({ businessId: { $in: [tenantAId, tenantBId] } })
    console.log('[PASS] Cleaned up test tenant records.')

    console.log('\n' + '='.repeat(80))
    console.log(' ALL BACKEND ANALYTICS CALCULATION TESTS PASSED (7/7)')
    console.log('='.repeat(80))
  } catch (error) {
    console.error('Analytics API verification error:', error)
    process.exit(1)
  } finally {
    if (server) server.close()
    await mongoose.connection.close()
    process.exit(0)
  }
}

testAnalyticsApi()
