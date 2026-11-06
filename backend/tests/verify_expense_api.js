import dotenv from 'dotenv'
dotenv.config()

import mongoose from 'mongoose'
import connectDB from '../src/config/db.js'
import app from '../src/app.js'
import { User, Business } from '../src/modules/auth/index.js'
import { Expense } from '../src/modules/business/index.js'
import { generateToken } from '../src/modules/auth/auth.service.js'

const PORT = 5072

const testExpenseApi = async () => {
  console.log('='.repeat(80))
  console.log(' OPSMIND BACKEND — STEP 11: EXPENSE CRUD APIS VERIFICATION')
  console.log('='.repeat(80))

  let server
  const tenantAId = `tenant_exp_a_${Date.now()}`
  const tenantBId = `tenant_exp_b_${Date.now()}`

  try {
    await connectDB()
    console.log('[OK] Connected to MongoDB.')

    server = app.listen(PORT, () => {
      console.log(`[OK] Test server listening on http://127.0.0.1:${PORT}\n`)
    })

    const baseUrl = `http://127.0.0.1:${PORT}/api/expenses`

    // ---------------------------------------------------------
    // SEED TEST TENANTS & USERS
    // ---------------------------------------------------------
    await Business.create({
      businessId: tenantAId,
      name: 'Tenant A Edinburgh Bookstore',
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

    const staffA = await User.create({
      businessId: tenantAId,
      name: 'Sam Staff',
      email: `sam_${Date.now()}@tenantA.com`,
      password: 'StaffPassword123!',
      role: 'staff',
    })
    const tokenStaffA = generateToken(staffA)

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

    // Seed Expense in Tenant A
    const expA1 = await Expense.create({
      businessId: tenantAId,
      expenseId: 'EXP-A1',
      category: 'Rent',
      amount: 1500.00,
      description: 'Storefront Monthly Rent',
      date: new Date('2026-01-01'),
      paymentMethod: 'Direct Debit',
    })

    // Seed Expense in Tenant B with identical expenseId to test multi-tenant independence
    await Expense.create({
      businessId: tenantBId,
      expenseId: 'EXP-A1',
      category: 'Marketing',
      amount: 800.00,
      description: 'Google Ads & Promotion',
      date: new Date('2026-01-01'),
      paymentMethod: 'Credit Card',
    })

    // ---------------------------------------------------------
    // TEST 1: CREATE EXPENSE WITH CUSTOM ID (ADMIN)
    // ---------------------------------------------------------
    console.log('--- 1. Testing POST /api/expenses (Create Expense) ---')
    const createRes1 = await fetch(`${baseUrl}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenAdminA}`,
      },
      body: JSON.stringify({
        expenseId: 'EXP-A2',
        category: 'Utilities',
        amount: 240.50,
        description: 'Electricity & Heating Q1',
        paymentMethod: 'Bank Transfer',
        date: '2026-01-15',
      }),
    })
    const createData1 = await createRes1.json()
    if (
      createRes1.status === 201 &&
      createData1.success &&
      createData1.data.expenseId === 'EXP-A2' &&
      createData1.data.businessId === tenantAId &&
      createData1.data.amount === 240.50
    ) {
      console.log(`[PASS] Expense created: ID: ${createData1.data.expenseId}, Category: "${createData1.data.category}", Amount: £${createData1.data.amount}`)
    } else {
      throw new Error(`Create expense failed: ${JSON.stringify(createData1)}`)
    }

    // ---------------------------------------------------------
    // TEST 2: AUTO-GENERATE EXPENSE ID WHEN OMITTED
    // ---------------------------------------------------------
    console.log('\n--- 2. Testing Expense Creation with Auto-Generated ID ---')
    const createRes2 = await fetch(`${baseUrl}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenAdminA}`,
      },
      body: JSON.stringify({
        category: 'Software & Subscriptions',
        amount: 89.99,
        description: 'Inventory Management SaaS Subscription',
        paymentMethod: 'Credit Card',
      }),
    })
    const createData2 = await createRes2.json()
    if (
      createRes2.status === 201 &&
      createData2.data.expenseId.startsWith('EXP-') &&
      createData2.data.amount === 89.99
    ) {
      console.log(`[PASS] Expense auto-assigned ID: '${createData2.data.expenseId}' ("${createData2.data.description}")`)
    } else {
      throw new Error(`Auto expense ID creation failed: ${JSON.stringify(createData2)}`)
    }
    const autoExpId = createData2.data.expenseId

    // ---------------------------------------------------------
    // TEST 3: DUPLICATE EXPENSE ID REJECTION (409 Conflict)
    // ---------------------------------------------------------
    console.log('\n--- 3. Testing Duplicate Expense ID Collision within Tenant A ---')
    const dupRes = await fetch(`${baseUrl}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenAdminA}`,
      },
      body: JSON.stringify({
        expenseId: 'EXP-A1', // Collides in Tenant A
        category: 'Rent',
        amount: 1500.00,
        description: 'Duplicate Rent Record',
      }),
    })
    const dupData = await dupRes.json()
    if (dupRes.status === 409 && !dupData.success) {
      console.log(`[PASS] Duplicate expense ID rejected with HTTP 409 Conflict: "${dupData.message}"`)
    } else {
      throw new Error(`Duplicate expense check failed: ${JSON.stringify(dupData)}`)
    }

    // ---------------------------------------------------------
    // TEST 4: MULTI-TENANT EXPENSE ID INDEPENDENCE
    // ---------------------------------------------------------
    console.log('\n--- 4. Testing Multi-Tenant Expense ID Independence ---')
    const expTenantA = await Expense.findOne({ businessId: tenantAId, expenseId: 'EXP-A1' })
    const expTenantB = await Expense.findOne({ businessId: tenantBId, expenseId: 'EXP-A1' })
    if (expTenantA && expTenantB && expTenantA.category === 'Rent' && expTenantB.category === 'Marketing') {
      console.log(`[PASS] Multi-tenant isolation verified: 'EXP-A1' exists independently in Tenant A (${expTenantA.category}: £${expTenantA.amount}) and Tenant B (${expTenantB.category}: £${expTenantB.amount})`)
    } else {
      throw new Error(`Multi-tenant expense isolation failed!`)
    }

    // ---------------------------------------------------------
    // TEST 5: LIST EXPENSES (SEARCH, CATEGORY FILTER & TOTALS)
    // ---------------------------------------------------------
    console.log('\n--- 5. Testing Expense Listing, Filtering & Filtered Totals ---')
    const listRes = await fetch(`${baseUrl}?search=Heating`, {
      headers: { Authorization: `Bearer ${tokenAdminA}` },
    })
    const listData = await listRes.json()
    if (
      listRes.status === 200 &&
      listData.data.expenses.length === 1 &&
      listData.data.expenses[0].expenseId === 'EXP-A2'
    ) {
      console.log(`[PASS] Search by 'Heating' returned 1 matching expense ('EXP-A2')`)
    } else {
      throw new Error(`Expense search failed: ${JSON.stringify(listData)}`)
    }

    const categoryRes = await fetch(`${baseUrl}?category=Rent`, {
      headers: { Authorization: `Bearer ${tokenAdminA}` },
    })
    const categoryData = await categoryRes.json()
    if (
      categoryRes.status === 200 &&
      categoryData.data.expenses.length === 1 &&
      categoryData.data.filteredTotals.totalAmount === 1500.00
    ) {
      console.log(`[PASS] Category filter ?category=Rent returned £${categoryData.data.filteredTotals.totalAmount}`)
    } else {
      throw new Error(`Category filter failed: ${JSON.stringify(categoryData)}`)
    }

    // ---------------------------------------------------------
    // TEST 6: GET EXPENSE BY ID & BY EXPENSE_ID
    // ---------------------------------------------------------
    console.log('\n--- 6. Testing Get Expense by ID & by ExpenseId ---')
    const getByIdRes = await fetch(`${baseUrl}/${expA1._id}`, {
      headers: { Authorization: `Bearer ${tokenAdminA}` },
    })
    const getByIdData = await getByIdRes.json()

    const getByCodeRes = await fetch(`${baseUrl}/EXP-A1`, {
      headers: { Authorization: `Bearer ${tokenAdminA}` },
    })
    const getByCodeData = await getByCodeRes.json()

    if (
      getByIdRes.status === 200 &&
      getByCodeRes.status === 200 &&
      getByIdData.data.expenseId === 'EXP-A1' &&
      getByCodeData.data.expenseId === 'EXP-A1'
    ) {
      console.log(`[PASS] Expense fetched via both MongoDB _id and expenseId ('EXP-A1')`)
    } else {
      throw new Error(`Expense fetch by identifier failed: ${JSON.stringify(getByIdData)}`)
    }

    // ---------------------------------------------------------
    // TEST 7: CROSS-TENANT DATA ISOLATION
    // ---------------------------------------------------------
    console.log('\n--- 7. Testing Cross-Tenant Data Isolation ---')
    // Tenant B attempts to fetch Tenant A's expense 'EXP-A2'
    const crossReadRes = await fetch(`${baseUrl}/EXP-A2`, {
      headers: { Authorization: `Bearer ${tokenAdminB}` },
    })
    const crossReadData = await crossReadRes.json()
    if (crossReadRes.status === 404 && !crossReadData.success) {
      console.log(`[PASS] Cross-tenant read rejected with HTTP 404 Not Found (Data Isolation Enforced)`)
    } else {
      throw new Error(`Cross-tenant expense read failed: ${JSON.stringify(crossReadData)}`)
    }

    // ---------------------------------------------------------
    // TEST 8: UPDATE EXPENSE RECORD
    // ---------------------------------------------------------
    console.log('\n--- 8. Testing PUT /api/expenses/:id (Update Expense) ---')
    const updateRes = await fetch(`${baseUrl}/EXP-A2`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenAdminA}`,
      },
      body: JSON.stringify({
        amount: 260.00,
        description: 'Electricity & Heating Q1 (Adjusted tariff)',
      }),
    })
    const updateData = await updateRes.json()
    const updatedExpA2 = await Expense.findOne({ businessId: tenantAId, expenseId: 'EXP-A2' })
    if (
      updateRes.status === 200 &&
      updatedExpA2.amount === 260.00 &&
      updatedExpA2.description.includes('Adjusted tariff')
    ) {
      console.log(`[PASS] Expense updated: Amount -> £${updatedExpA2.amount}, Description -> "${updatedExpA2.description}"`)
    } else {
      throw new Error(`Update expense failed: ${JSON.stringify(updateData)}`)
    }

    // ---------------------------------------------------------
    // TEST 9: DELETE EXPENSE RECORD
    // ---------------------------------------------------------
    console.log('\n--- 9. Testing DELETE /api/expenses/:id ---')
    const deleteRes = await fetch(`${baseUrl}/${autoExpId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${tokenAdminA}` },
    })
    const deleteData = await deleteRes.json()
    const checkDeleted = await Expense.findOne({ businessId: tenantAId, expenseId: autoExpId })
    if (deleteRes.status === 200 && !checkDeleted) {
      console.log(`[PASS] Expense record ('${autoExpId}') deleted successfully`)
    } else {
      throw new Error(`Delete expense failed: ${JSON.stringify(deleteData)}`)
    }

    // ---------------------------------------------------------
    // TEST 10: RBAC: STAFF BLOCKED FROM EXPENSE MUTATIONS
    // ---------------------------------------------------------
    console.log('\n--- 10. Testing RBAC: Staff Blocked from Modifying Expenses ---')
    const staffCreateRes = await fetch(`${baseUrl}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenStaffA}`,
      },
      body: JSON.stringify({
        category: 'Travel',
        amount: 50.00,
        description: 'Unauthorized expense submission',
      }),
    })
    const staffCreateData = await staffCreateRes.json()
    if (staffCreateRes.status === 403) {
      console.log(`[PASS] Staff blocked from creating expense: HTTP 403 Forbidden`)
    } else {
      throw new Error(`Staff create check failed: ${JSON.stringify(staffCreateData)}`)
    }

    const staffReadRes = await fetch(`${baseUrl}`, {
      headers: { Authorization: `Bearer ${tokenStaffA}` },
    })
    const staffReadData = await staffReadRes.json()
    if (staffReadRes.status === 200 && staffReadData.success) {
      console.log(`[PASS] Staff permitted read-only access to expense records: HTTP 200 OK`)
    } else {
      throw new Error(`Staff read check failed: ${JSON.stringify(staffReadData)}`)
    }

    // ---------------------------------------------------------
    // TEST 11: EXPENSE ANALYTICS SUMMARY & MONTHLY TRENDS
    // ---------------------------------------------------------
    console.log('\n--- 11. Testing Expense Summary & Analytics Endpoint ---')
    const summaryRes = await fetch(`${baseUrl}/summary`, {
      headers: { Authorization: `Bearer ${tokenAdminA}` },
    })
    const summaryData = await summaryRes.json()
    // Current Tenant A records:
    // EXP-A1: Rent £1500
    // EXP-A2: Utilities £260
    // Total = £1760.00, count = 2
    if (
      summaryRes.status === 200 &&
      summaryData.data.totalExpensesCount === 2 &&
      summaryData.data.totalExpensesAmount === 1760.00 &&
      summaryData.data.categoryBreakdown.length === 2 &&
      summaryData.data.monthlyTrend.length >= 1
    ) {
      console.log(`[PASS] Expense summary verified:`)
      console.log(`  - Total Expenses: £${summaryData.data.totalExpensesAmount} (${summaryData.data.totalExpensesCount} entries)`)
      console.log(`  - Average Expense: £${summaryData.data.averageExpenseAmount}`)
      console.log(`  - Top Category: ${summaryData.data.categoryBreakdown[0].category} (£${summaryData.data.categoryBreakdown[0].totalAmount})`)
      console.log(`  - Monthly Trend: ${summaryData.data.monthlyTrend[0].month} (£${summaryData.data.monthlyTrend[0].totalAmount})`)
    } else {
      throw new Error(`Expense summary failed: ${JSON.stringify(summaryData)}`)
    }

    // ---------------------------------------------------------
    // TEST 12: DISTINCT EXPENSE CATEGORIES
    // ---------------------------------------------------------
    console.log('\n--- 12. Testing /meta/categories Endpoint ---')
    const catRes = await fetch(`${baseUrl}/meta/categories`, {
      headers: { Authorization: `Bearer ${tokenAdminA}` },
    })
    const catData = await catRes.json()
    if (
      catRes.status === 200 &&
      Array.isArray(catData.data) &&
      catData.data.includes('Rent') &&
      catData.data.includes('Utilities')
    ) {
      console.log(`[PASS] Distinct categories returned: [${catData.data.join(', ')}]`)
    } else {
      throw new Error(`Expense categories failed: ${JSON.stringify(catData)}`)
    }

    // ---------------------------------------------------------
    // CLEANUP
    // ---------------------------------------------------------
    console.log('\n--- 13. Cleanup Test Artifacts ---')
    await Expense.deleteMany({ businessId: { $in: [tenantAId, tenantBId] } })
    await User.deleteMany({ businessId: { $in: [tenantAId, tenantBId] } })
    await Business.deleteMany({ businessId: { $in: [tenantAId, tenantBId] } })
    console.log('[PASS] Cleaned up test tenant records.')

    console.log('\n' + '='.repeat(80))
    console.log(' ALL EXPENSE CRUD & ANALYTICS INTEGRATION TESTS PASSED (12/12)')
    console.log('='.repeat(80))
  } catch (error) {
    console.error('Expense API verification error:', error)
    process.exit(1)
  } finally {
    if (server) server.close()
    await mongoose.connection.close()
    process.exit(0)
  }
}

testExpenseApi()
