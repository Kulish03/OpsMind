import dotenv from 'dotenv'
dotenv.config()

import mongoose from 'mongoose'
import connectDB from '../src/config/db.js'
import app from '../src/app.js'
import { User, Business } from '../src/modules/auth/index.js'
import { Product, Sale, InventoryMovement, Customer } from '../src/modules/business/index.js'
import { generateToken } from '../src/modules/auth/auth.service.js'

const PORT = 5068

const testSalesApi = async () => {
  console.log('='.repeat(80))
  console.log(' OPSMIND BACKEND — STEP 7: SALES CRUD APIS VERIFICATION')
  console.log('='.repeat(80))

  let server
  const tenantAId = `tenant_sales_a_${Date.now()}`
  const tenantBId = `tenant_sales_b_${Date.now()}`

  try {
    await connectDB()
    console.log('[OK] Connected to MongoDB.')

    server = app.listen(PORT, () => {
      console.log(`[OK] Test server listening on http://127.0.0.1:${PORT}\n`)
    })

    const baseUrl = `http://127.0.0.1:${PORT}/api/sales`

    // ---------------------------------------------------------
    // SEED TEST TENANTS, USERS, PRODUCTS & CUSTOMERS
    // ---------------------------------------------------------
    await Business.create({
      businessId: tenantAId,
      name: 'Tenant A Cashmere & Woollens',
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

    // Seed Products for Tenant A
    const prodA1 = await Product.create({
      businessId: tenantAId,
      sku: 'SKU-A1',
      name: 'Highland Tartan Scarf',
      category: 'Accessories',
      sellingPrice: 20.00,
      costPrice: 8.00,
      currentStock: 100,
      reorderThreshold: 15,
    })

    const prodA2 = await Product.create({
      businessId: tenantAId,
      sku: 'SKU-A2',
      name: 'Leather Driving Gloves',
      category: 'Accessories',
      sellingPrice: 35.00,
      costPrice: 15.00,
      currentStock: 50,
      reorderThreshold: 10,
    })

    // Seed Customer for Tenant A
    await Customer.create({
      businessId: tenantAId,
      customerId: 'CUST-1001',
      name: 'Sir Arthur Conan Doyle',
      country: 'United Kingdom',
    })

    // Seed Product for Tenant B
    await Product.create({
      businessId: tenantBId,
      sku: 'SKU-B1',
      name: 'Generic Competitor Scarf',
      sellingPrice: 18.00,
      currentStock: 25,
    })

    // ---------------------------------------------------------
    // TEST 1: CREATE SALE (Staff POS Transaction)
    // ---------------------------------------------------------
    console.log('--- 1. Testing POST /api/sales (Staff POS Transaction) ---')
    const createSaleRes = await fetch(`${baseUrl}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenStaffA}`,
      },
      body: JSON.stringify({
        invoiceId: 'INV-TEST-001',
        customerReference: 'CUST-1001',
        items: [
          { productSku: 'SKU-A1', quantity: 2 }, // Price auto-fetched from catalog (20.00 * 2 = 40.00)
          { productSku: 'SKU-A2', quantity: 1, unitPrice: 30.00 }, // Override unit price (30.00 * 1 = 30.00)
        ],
      }),
    })
    const createSaleData = await createSaleRes.json()
    if (
      createSaleRes.status === 201 &&
      createSaleData.success &&
      createSaleData.data.totalAmount === 70.00 &&
      createSaleData.data.totalUnits === 3 &&
      createSaleData.data.items.length === 2
    ) {
      console.log(`[PASS] Sale recorded: Invoice ${createSaleData.data.invoiceId}, Total: £${createSaleData.data.totalAmount}, Units: ${createSaleData.data.totalUnits}`)
    } else {
      throw new Error(`Create sale failed: ${JSON.stringify(createSaleData)}`)
    }
    const saleAId = createSaleData.data._id

    // ---------------------------------------------------------
    // TEST 2: INVENTORY STOCK DEDUCTION & MOVEMENT LEDGER
    // ---------------------------------------------------------
    console.log('\n--- 2. Verifying Inventory Deduction & Movement Ledger ---')
    const updatedProdA1 = await Product.findOne({ businessId: tenantAId, sku: 'SKU-A1' })
    const updatedProdA2 = await Product.findOne({ businessId: tenantAId, sku: 'SKU-A2' })

    const movements = await InventoryMovement.find({
      businessId: tenantAId,
      referenceId: 'INV-TEST-001',
      movementType: 'SALE_OUTFLOW',
    })

    if (
      updatedProdA1.currentStock === 98 &&
      updatedProdA2.currentStock === 49 &&
      movements.length === 2 &&
      movements[0].quantity < 0
    ) {
      console.log(`[PASS] Inventory stock deducted: SKU-A1 (100 -> ${updatedProdA1.currentStock}), SKU-A2 (50 -> ${updatedProdA2.currentStock})`)
      console.log(`[PASS] Inventory movements logged: ${movements.length} SALE_OUTFLOW entries linked to INV-TEST-001`)
    } else {
      throw new Error(`Inventory deduction failed! ProdA1 Stock: ${updatedProdA1?.currentStock}, ProdA2 Stock: ${updatedProdA2?.currentStock}, Movements: ${movements.length}`)
    }

    // ---------------------------------------------------------
    // TEST 3: CUSTOMER AGGREGATE METRICS UPDATE
    // ---------------------------------------------------------
    console.log('\n--- 3. Verifying Customer Aggregate Metrics ---')
    const updatedCust = await Customer.findOne({ businessId: tenantAId, customerId: 'CUST-1001' })
    if (updatedCust.totalOrders === 1 && updatedCust.totalSpend === 70.00 && updatedCust.totalUnitsPurchased === 3) {
      console.log(`[PASS] Customer metrics updated: Total Spend £${updatedCust.totalSpend}, Orders: ${updatedCust.totalOrders}, Units: ${updatedCust.totalUnitsPurchased}`)
    } else {
      throw new Error(`Customer metrics update failed: ${JSON.stringify(updatedCust)}`)
    }

    // ---------------------------------------------------------
    // TEST 4: NON-EXISTENT SKU REJECTION (400 Bad Request)
    // ---------------------------------------------------------
    console.log('\n--- 4. Testing Non-Existent SKU Rejection ---')
    const badSkuRes = await fetch(`${baseUrl}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenStaffA}`,
      },
      body: JSON.stringify({
        items: [{ productSku: 'SKU-DOESNOTEXIST', quantity: 1 }],
      }),
    })
    const badSkuData = await badSkuRes.json()
    if (badSkuRes.status === 400 && !badSkuData.success) {
      console.log(`[PASS] Non-existent SKU rejected with HTTP 400: "${badSkuData.message}"`)
    } else {
      throw new Error(`Non-existent SKU check failed: ${JSON.stringify(badSkuData)}`)
    }

    // ---------------------------------------------------------
    // TEST 5: DUPLICATE INVOICE ID REJECTION (409 Conflict)
    // ---------------------------------------------------------
    console.log('\n--- 5. Testing Duplicate Invoice ID Rejection ---')
    const dupInvoiceRes = await fetch(`${baseUrl}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenAdminA}`,
      },
      body: JSON.stringify({
        invoiceId: 'INV-TEST-001', // Duplicate
        items: [{ productSku: 'SKU-A1', quantity: 1 }],
      }),
    })
    const dupInvoiceData = await dupInvoiceRes.json()
    if (dupInvoiceRes.status === 409 && !dupInvoiceData.success) {
      console.log(`[PASS] Duplicate invoice ID rejected with HTTP 409 Conflict: "${dupInvoiceData.message}"`)
    } else {
      throw new Error(`Duplicate invoice check failed: ${JSON.stringify(dupInvoiceData)}`)
    }

    // ---------------------------------------------------------
    // TEST 6: MULTI-TENANT INVOICE INDEPENDENCE
    // ---------------------------------------------------------
    console.log('\n--- 6. Testing Multi-Tenant Invoice Independence (Tenant B uses INV-TEST-001) ---')
    const tenantBInvoiceRes = await fetch(`${baseUrl}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenAdminB}`,
      },
      body: JSON.stringify({
        invoiceId: 'INV-TEST-001', // Identical invoice ID in Tenant B
        items: [{ productSku: 'SKU-B1', quantity: 1 }],
      }),
    })
    const tenantBInvoiceData = await tenantBInvoiceRes.json()
    if (
      tenantBInvoiceRes.status === 201 &&
      tenantBInvoiceData.data.businessId === tenantBId &&
      tenantBInvoiceData.data.invoiceId === 'INV-TEST-001'
    ) {
      console.log(`[PASS] Tenant B successfully created INV-TEST-001 independently without collision`)
    } else {
      throw new Error(`Multi-tenant invoice independence failed: ${JSON.stringify(tenantBInvoiceData)}`)
    }

    // ---------------------------------------------------------
    // TEST 7: CROSS-TENANT DATA ISOLATION
    // ---------------------------------------------------------
    console.log('\n--- 7. Testing Cross-Tenant Data Isolation ---')
    const crossReadRes = await fetch(`${baseUrl}/${saleAId}`, {
      headers: { Authorization: `Bearer ${tokenAdminB}` },
    })
    const crossReadData = await crossReadRes.json()
    if (crossReadRes.status === 404) {
      console.log(`[PASS] Cross-tenant read rejected with HTTP 404 Not Found`)
    } else {
      throw new Error(`Cross-tenant read check failed: ${JSON.stringify(crossReadData)}`)
    }

    // ---------------------------------------------------------
    // TEST 8: QUERY SALES (FILTERING, SEARCH, METRICS)
    // ---------------------------------------------------------
    console.log('\n--- 8. Testing Sales Listing, Filtering & Search ---')
    const listRes = await fetch(`${baseUrl}?search=TEST-001&productSku=SKU-A1`, {
      headers: { Authorization: `Bearer ${tokenAdminA}` },
    })
    const listData = await listRes.json()
    if (
      listRes.status === 200 &&
      listData.data.sales.length === 1 &&
      listData.data.filteredTotals.totalRevenue === 70.00
    ) {
      console.log(`[PASS] Sales search returned matching invoice; filtered totals: £${listData.data.filteredTotals.totalRevenue}`)
    } else {
      throw new Error(`Sales query failed: ${JSON.stringify(listData)}`)
    }

    // ---------------------------------------------------------
    // TEST 9: RBAC ON CANCELLATION (STAFF BLOCKED)
    // ---------------------------------------------------------
    console.log('\n--- 9. Testing RBAC: Staff Blocked from Cancelling Sale ---')
    const staffCancelRes = await fetch(`${baseUrl}/${saleAId}/cancel`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenStaffA}`,
      },
      body: JSON.stringify({ reason: 'Customer requested cancellation' }),
    })
    const staffCancelData = await staffCancelRes.json()
    if (staffCancelRes.status === 403 && !staffCancelData.success) {
      console.log(`[PASS] Staff blocked from cancelling sale: HTTP 403 Forbidden`)
    } else {
      throw new Error(`Staff cancel check failed: ${JSON.stringify(staffCancelData)}`)
    }

    // ---------------------------------------------------------
    // TEST 10: SALE CANCELLATION & INVENTORY STOCK RESTORATION
    // ---------------------------------------------------------
    console.log('\n--- 10. Testing Admin Sale Cancellation & Inventory Restoration ---')
    const adminCancelRes = await fetch(`${baseUrl}/${saleAId}/cancel`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenAdminA}`,
      },
      body: JSON.stringify({ reason: 'Damaged item return', status: 'cancelled' }),
    })
    const adminCancelData = await adminCancelRes.json()

    const restoredProdA1 = await Product.findOne({ businessId: tenantAId, sku: 'SKU-A1' })
    const restoredProdA2 = await Product.findOne({ businessId: tenantAId, sku: 'SKU-A2' })
    const returnMovements = await InventoryMovement.find({
      businessId: tenantAId,
      referenceId: 'INV-TEST-001',
      movementType: 'CUSTOMER_RETURN',
    })
    const reversedCust = await Customer.findOne({ businessId: tenantAId, customerId: 'CUST-1001' })

    if (
      adminCancelRes.status === 200 &&
      adminCancelData.data.status === 'cancelled' &&
      adminCancelData.data.isCancellation === true &&
      restoredProdA1.currentStock === 100 &&
      restoredProdA2.currentStock === 50 &&
      returnMovements.length === 2 &&
      returnMovements[0].quantity > 0 &&
      reversedCust.totalSpend === 0
    ) {
      console.log(`[PASS] Sale cancelled successfully: status = 'cancelled', isCancellation = true`)
      console.log(`[PASS] Inventory stock completely restored: SKU-A1 (100), SKU-A2 (50)`)
      console.log(`[PASS] Movement ledger recorded 2 CUSTOMER_RETURN entries`)
      console.log(`[PASS] Customer total spend reversed to £${reversedCust.totalSpend}`)
    } else {
      throw new Error(`Sale cancellation failed! Status: ${adminCancelRes.status}, Data: ${JSON.stringify(adminCancelData)}`)
    }

    // ---------------------------------------------------------
    // TEST 11: SALES SUMMARY ENDPOINT (GET /api/sales/summary)
    // ---------------------------------------------------------
    console.log('\n--- 11. Testing Sales Performance Summary Endpoint ---')
    // Seed one completed sale to test summary calculation
    await fetch(`${baseUrl}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenAdminA}`,
      },
      body: JSON.stringify({
        invoiceId: 'INV-TEST-002',
        customerReference: 'CUST-1001',
        items: [{ productSku: 'SKU-A1', quantity: 2 }], // 2 * 20.00 = 40.00
      }),
    })

    const summaryRes = await fetch(`${baseUrl}/summary`, {
      headers: { Authorization: `Bearer ${tokenAdminA}` },
    })
    const summaryData = await summaryRes.json()
    if (
      summaryRes.status === 200 &&
      summaryData.data.totalRevenue === 40.00 &&
      summaryData.data.totalUnits === 2 &&
      summaryData.data.totalInvoices === 1 &&
      summaryData.data.averageOrderValue === 40.00
    ) {
      console.log(`[PASS] Summary calculated: Revenue £${summaryData.data.totalRevenue}, Invoices: ${summaryData.data.totalInvoices}, AOV: £${summaryData.data.averageOrderValue}`)
    } else {
      throw new Error(`Summary endpoint failed: ${JSON.stringify(summaryData)}`)
    }

    // ---------------------------------------------------------
    // CLEANUP
    // ---------------------------------------------------------
    console.log('\n--- 12. Cleanup Test Artifacts ---')
    await Sale.deleteMany({ businessId: { $in: [tenantAId, tenantBId] } })
    await InventoryMovement.deleteMany({ businessId: { $in: [tenantAId, tenantBId] } })
    await Product.deleteMany({ businessId: { $in: [tenantAId, tenantBId] } })
    await Customer.deleteMany({ businessId: { $in: [tenantAId, tenantBId] } })
    await User.deleteMany({ businessId: { $in: [tenantAId, tenantBId] } })
    await Business.deleteMany({ businessId: { $in: [tenantAId, tenantBId] } })
    console.log('[PASS] Cleaned up test tenant records.')

    console.log('\n' + '='.repeat(80))
    console.log(' ALL SALES CRUD & INVENTORY INTEGRATION TESTS PASSED (11/11)')
    console.log('='.repeat(80))
  } catch (error) {
    console.error('Sales API verification error:', error)
    process.exit(1)
  } finally {
    if (server) server.close()
    await mongoose.connection.close()
    process.exit(0)
  }
}

testSalesApi()
