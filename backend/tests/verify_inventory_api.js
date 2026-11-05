import dotenv from 'dotenv'
dotenv.config()

import mongoose from 'mongoose'
import connectDB from '../src/config/db.js'
import app from '../src/app.js'
import { User, Business } from '../src/modules/auth/index.js'
import { Product, InventoryMovement } from '../src/modules/business/index.js'
import { generateToken } from '../src/modules/auth/auth.service.js'

const PORT = 5069

const testInventoryApi = async () => {
  console.log('='.repeat(80))
  console.log(' OPSMIND BACKEND — STEP 8: INVENTORY CRUD & MOVEMENTS VERIFICATION')
  console.log('='.repeat(80))

  let server
  const tenantAId = `tenant_inv_a_${Date.now()}`
  const tenantBId = `tenant_inv_b_${Date.now()}`

  try {
    await connectDB()
    console.log('[OK] Connected to MongoDB.')

    server = app.listen(PORT, () => {
      console.log(`[OK] Test server listening on http://127.0.0.1:${PORT}\n`)
    })

    const baseUrl = `http://127.0.0.1:${PORT}/api/inventory`

    // ---------------------------------------------------------
    // SEED TEST TENANTS, USERS & PRODUCTS
    // ---------------------------------------------------------
    await Business.create({
      businessId: tenantAId,
      name: 'Tenant A Highland Crafts',
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
    await Product.create({
      businessId: tenantAId,
      sku: 'INV-SKU-1',
      name: 'Highland Ceramic Mug',
      category: 'Kitchenware',
      sellingPrice: 15.00,
      costPrice: 5.00,
      currentStock: 10, // Low stock: <= 15
      reorderThreshold: 15,
      targetStock: 50,
    })

    await Product.create({
      businessId: tenantAId,
      sku: 'INV-SKU-2',
      name: 'Loch Ness Plush Toy',
      category: 'Toys & Souvenirs',
      sellingPrice: 24.00,
      costPrice: 8.00,
      currentStock: 0, // Out of stock: 0
      reorderThreshold: 10,
      targetStock: 30,
    })

    // Seed Product for Tenant B
    await Product.create({
      businessId: tenantBId,
      sku: 'INV-SKU-1',
      name: 'Competitor Mug',
      category: 'Kitchenware',
      sellingPrice: 12.00,
      costPrice: 4.00,
      currentStock: 100,
      reorderThreshold: 20,
      targetStock: 150,
    })

    // ---------------------------------------------------------
    // TEST 1: GET /api/inventory (ENRICHED INVENTORY OVERVIEW)
    // ---------------------------------------------------------
    console.log('--- 1. Testing GET /api/inventory (Enriched Overview) ---')
    const invRes = await fetch(`${baseUrl}?sortBy=currentStock&sortOrder=asc`, {
      headers: { Authorization: `Bearer ${tokenAdminA}` },
    })
    const invData = await invRes.json()
    if (
      invRes.status === 200 &&
      invData.data.inventory.length === 2 &&
      invData.data.inventory[0].sku === 'INV-SKU-2' &&
      invData.data.inventory[0].stockStatus === 'OUT_OF_STOCK' &&
      invData.data.inventory[1].sku === 'INV-SKU-1' &&
      invData.data.inventory[1].stockStatus === 'LOW_STOCK' &&
      invData.data.inventory[1].inventoryValue === 50.00
    ) {
      console.log(`[PASS] Inventory overview retrieved: 2 items enriched with stockStatus and valuations`)
      console.log(`  - INV-SKU-2: Status = ${invData.data.inventory[0].stockStatus}, Stock = ${invData.data.inventory[0].currentStock}`)
      console.log(`  - INV-SKU-1: Status = ${invData.data.inventory[1].stockStatus}, Stock = ${invData.data.inventory[1].currentStock}, Valuation = £${invData.data.inventory[1].inventoryValue}`)
    } else {
      throw new Error(`Inventory overview failed: ${JSON.stringify(invData)}`)
    }

    // ---------------------------------------------------------
    // TEST 2: GET /api/inventory?stockStatus=low_stock
    // ---------------------------------------------------------
    console.log('\n--- 2. Testing Stock Status Filter (?stockStatus=low_stock) ---')
    const lowStockFilterRes = await fetch(`${baseUrl}?stockStatus=low_stock`, {
      headers: { Authorization: `Bearer ${tokenAdminA}` },
    })
    const lowStockFilterData = await lowStockFilterRes.json()
    if (
      lowStockFilterRes.status === 200 &&
      lowStockFilterData.data.inventory.length === 1 &&
      lowStockFilterData.data.inventory[0].sku === 'INV-SKU-1'
    ) {
      console.log(`[PASS] Filter ?stockStatus=low_stock returned only low-stock item ('INV-SKU-1')`)
    } else {
      throw new Error(`Stock status filter failed: ${JSON.stringify(lowStockFilterData)}`)
    }

    // ---------------------------------------------------------
    // TEST 3: POST /api/inventory/restock (INBOUND PURCHASE)
    // ---------------------------------------------------------
    console.log('\n--- 3. Testing POST /api/inventory/restock (Inbound Purchase) ---')
    const restockRes = await fetch(`${baseUrl}/restock`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenAdminA}`,
      },
      body: JSON.stringify({
        referenceId: 'PO-2026-001',
        reason: 'Monthly Supplier Restock Order',
        items: [
          { productSku: 'INV-SKU-1', quantity: 40, unitCost: 4.50, supplierId: 'SUP-01' },
          { productSku: 'INV-SKU-2', quantity: 25, unitCost: 7.50, supplierId: 'SUP-02' },
        ],
      }),
    })
    const restockData = await restockRes.json()

    const restockedProd1 = await Product.findOne({ businessId: tenantAId, sku: 'INV-SKU-1' })
    const restockedProd2 = await Product.findOne({ businessId: tenantAId, sku: 'INV-SKU-2' })
    const inboundMovements = await InventoryMovement.find({
      businessId: tenantAId,
      referenceId: 'PO-2026-001',
      movementType: 'INBOUND_PURCHASE',
    })

    if (
      restockRes.status === 200 &&
      restockedProd1.currentStock === 50 && // 10 + 40
      restockedProd1.costPrice === 4.50 &&
      restockedProd2.currentStock === 25 && // 0 + 25
      restockedProd2.costPrice === 7.50 &&
      inboundMovements.length === 2 &&
      inboundMovements[0].quantity > 0
    ) {
      console.log(`[PASS] Inbound restock successful:`)
      console.log(`  - INV-SKU-1: Stock 10 -> ${restockedProd1.currentStock}, Cost updated to £${restockedProd1.costPrice}`)
      console.log(`  - INV-SKU-2: Stock 0 -> ${restockedProd2.currentStock}, Cost updated to £${restockedProd2.costPrice}`)
      console.log(`  - Movement Ledger: 2 INBOUND_PURCHASE records created with reference 'PO-2026-001'`)
    } else {
      throw new Error(`Restock failed: ${JSON.stringify(restockData)}`)
    }

    // ---------------------------------------------------------
    // TEST 4: POST /api/inventory/adjust (CYCLE COUNT RECONCILIATION)
    // ---------------------------------------------------------
    console.log('\n--- 4. Testing POST /api/inventory/adjust (Cycle Count Reconciliation) ---')
    const adjustRes = await fetch(`${baseUrl}/adjust`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenAdminA}`,
      },
      body: JSON.stringify({
        productSku: 'INV-SKU-1',
        newStock: 48, // Discrepancy: physical count is 48 instead of 50
        reason: 'Physical cycle count variance (-2 units)',
      }),
    })
    const adjustData = await adjustRes.json()
    const adjustedProd1 = await Product.findOne({ businessId: tenantAId, sku: 'INV-SKU-1' })

    if (
      adjustRes.status === 200 &&
      adjustedProd1.currentStock === 48 &&
      adjustData.data.adjustmentDelta === -2 &&
      adjustData.data.previousStock === 50
    ) {
      console.log(`[PASS] Stock adjusted: Previous = ${adjustData.data.previousStock}, New = ${adjustedProd1.currentStock}, Delta = ${adjustData.data.adjustmentDelta}`)
    } else {
      throw new Error(`Stock adjustment failed: ${JSON.stringify(adjustData)}`)
    }

    // ---------------------------------------------------------
    // TEST 5: POST /api/inventory/write-off (DAMAGED STOCK)
    // ---------------------------------------------------------
    console.log('\n--- 5. Testing POST /api/inventory/write-off (Damaged Stock) ---')
    const writeOffRes = await fetch(`${baseUrl}/write-off`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenAdminA}`,
      },
      body: JSON.stringify({
        productSku: 'INV-SKU-2',
        quantity: 3,
        reason: 'Warehouse water leak damage',
      }),
    })
    const writeOffData = await writeOffRes.json()
    const writtenOffProd2 = await Product.findOne({ businessId: tenantAId, sku: 'INV-SKU-2' })

    if (
      writeOffRes.status === 200 &&
      writtenOffProd2.currentStock === 22 && // 25 - 3
      writeOffData.data.writtenOffUnits === 3 &&
      writeOffData.data.totalWriteOffCost === 22.50 // 3 * 7.50
    ) {
      console.log(`[PASS] Write-off recorded: Units = ${writeOffData.data.writtenOffUnits}, New Stock = ${writtenOffProd2.currentStock}, Write-Off Cost = £${writeOffData.data.totalWriteOffCost}`)
    } else {
      throw new Error(`Write-off failed: ${JSON.stringify(writeOffData)}`)
    }

    // ---------------------------------------------------------
    // TEST 6: WRITE-OFF EXCEEDING STOCK REJECTION
    // ---------------------------------------------------------
    console.log('\n--- 6. Testing Excessive Write-Off Rejection ---')
    const excessiveWriteOffRes = await fetch(`${baseUrl}/write-off`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenAdminA}`,
      },
      body: JSON.stringify({
        productSku: 'INV-SKU-2',
        quantity: 100, // Exceeds on-hand (22)
        reason: 'Excessive loss claim',
      }),
    })
    const excessiveWriteOffData = await excessiveWriteOffRes.json()
    if (excessiveWriteOffRes.status === 400 && !excessiveWriteOffData.success) {
      console.log(`[PASS] Excessive write-off rejected with HTTP 400: "${excessiveWriteOffData.message}"`)
    } else {
      throw new Error(`Excessive write-off check failed: ${JSON.stringify(excessiveWriteOffData)}`)
    }

    // ---------------------------------------------------------
    // TEST 7: RBAC: STAFF BLOCKED FROM STOCK MUTATIONS
    // ---------------------------------------------------------
    console.log('\n--- 7. Testing RBAC: Staff Blocked from Stock Mutations ---')
    const staffAdjustRes = await fetch(`${baseUrl}/adjust`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenStaffA}`,
      },
      body: JSON.stringify({
        productSku: 'INV-SKU-1',
        adjustmentQuantity: 5,
        reason: 'Unauthorized staff adjustment',
      }),
    })
    const staffAdjustData = await staffAdjustRes.json()
    if (staffAdjustRes.status === 403) {
      console.log(`[PASS] Staff blocked from stock adjustment: HTTP 403 Forbidden`)
    } else {
      throw new Error(`Staff RBAC check failed: ${JSON.stringify(staffAdjustData)}`)
    }

    const staffReadRes = await fetch(`${baseUrl}`, {
      headers: { Authorization: `Bearer ${tokenStaffA}` },
    })
    const staffReadData = await staffReadRes.json()
    if (staffReadRes.status === 200 && staffReadData.success) {
      console.log(`[PASS] Staff permitted read-only access to inventory stock levels: HTTP 200 OK`)
    } else {
      throw new Error(`Staff read check failed: ${JSON.stringify(staffReadData)}`)
    }

    // ---------------------------------------------------------
    // TEST 8: CROSS-TENANT DATA ISOLATION
    // ---------------------------------------------------------
    console.log('\n--- 8. Testing Cross-Tenant Data Isolation ---')
    // Tenant B attempts to restock Tenant A's SKU 'INV-SKU-2' (which doesn't exist in Tenant B)
    const crossRestockRes = await fetch(`${baseUrl}/restock`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenAdminB}`,
      },
      body: JSON.stringify({
        items: [{ productSku: 'INV-SKU-2', quantity: 10 }],
      }),
    })
    const crossRestockData = await crossRestockRes.json()
    if (crossRestockRes.status === 400) {
      console.log(`[PASS] Cross-tenant restock rejected (foreign SKU not found in Tenant B catalog)`)
    } else {
      throw new Error(`Cross-tenant restock isolation failed: ${JSON.stringify(crossRestockData)}`)
    }

    // ---------------------------------------------------------
    // TEST 9: MOVEMENT AUDIT TRAIL ENDPOINTS
    // ---------------------------------------------------------
    console.log('\n--- 9. Testing Inventory Movement Audit Trail Endpoints ---')
    // 9a: Movements for specific SKU
    const skuMovementsRes = await fetch(`${baseUrl}/movements/INV-SKU-1`, {
      headers: { Authorization: `Bearer ${tokenAdminA}` },
    })
    const skuMovementsData = await skuMovementsRes.json()
    if (
      skuMovementsRes.status === 200 &&
      skuMovementsData.data.movements.length === 2 // Restock (+40) and Adjustment (-2)
    ) {
      console.log(`[PASS] /movements/INV-SKU-1 returned 2 audit records (Inbound Purchase + Adjustment)`)
    } else {
      throw new Error(`SKU movements failed: ${JSON.stringify(skuMovementsData)}`)
    }

    // 9b: All movements with filter
    const filteredMovementsRes = await fetch(`${baseUrl}/movements?movementType=INBOUND_PURCHASE`, {
      headers: { Authorization: `Bearer ${tokenAdminA}` },
    })
    const filteredMovementsData = await filteredMovementsRes.json()
    if (
      filteredMovementsRes.status === 200 &&
      filteredMovementsData.data.movements.length === 2 &&
      filteredMovementsData.data.movements.every((m) => m.movementType === 'INBOUND_PURCHASE')
    ) {
      console.log(`[PASS] /movements?movementType=INBOUND_PURCHASE returned 2 inbound purchase movements`)
    } else {
      throw new Error(`Filtered movements failed: ${JSON.stringify(filteredMovementsData)}`)
    }

    // ---------------------------------------------------------
    // TEST 10: GET /api/inventory/summary (VALUATION & HEALTH KPIS)
    // ---------------------------------------------------------
    console.log('\n--- 10. Testing Inventory Valuation & Health Summary ---')
    const summaryRes = await fetch(`${baseUrl}/summary`, {
      headers: { Authorization: `Bearer ${tokenAdminA}` },
    })
    const summaryData = await summaryRes.json()
    // Current stock in Tenant A:
    // INV-SKU-1: 48 units @ £4.50 cost = £216.00 | Retail £15.00 = £720.00
    // INV-SKU-2: 22 units @ £7.50 cost = £165.00 | Retail £24.00 = £528.00
    // Total Units: 70
    // Total Cost Valuation: 216.00 + 165.00 = £381.00
    // Total Retail Valuation: 720.00 + 528.00 = £1248.00
    // Potential Gross Profit: £867.00
    if (
      summaryRes.status === 200 &&
      summaryData.data.totalSkus === 2 &&
      summaryData.data.totalUnitsOnHand === 70 &&
      summaryData.data.totalValuationAtCost === 381.00 &&
      summaryData.data.totalValuationAtRetail === 1248.00 &&
      summaryData.data.potentialGrossProfit === 867.00
    ) {
      console.log(`[PASS] Inventory valuation & health summary verified:`)
      console.log(`  - Total SKUs: ${summaryData.data.totalSkus}`)
      console.log(`  - Total Units on Hand: ${summaryData.data.totalUnitsOnHand}`)
      console.log(`  - Total Valuation at Cost: £${summaryData.data.totalValuationAtCost}`)
      console.log(`  - Total Valuation at Retail: £${summaryData.data.totalValuationAtRetail}`)
      console.log(`  - Potential Gross Profit: £${summaryData.data.potentialGrossProfit}`)
      console.log(`  - Health Counts: Optimal: ${summaryData.data.healthCounts.optimal}`)
    } else {
      throw new Error(`Inventory summary failed: ${JSON.stringify(summaryData)}`)
    }

    // ---------------------------------------------------------
    // CLEANUP
    // ---------------------------------------------------------
    console.log('\n--- 11. Cleanup Test Artifacts ---')
    await InventoryMovement.deleteMany({ businessId: { $in: [tenantAId, tenantBId] } })
    await Product.deleteMany({ businessId: { $in: [tenantAId, tenantBId] } })
    await User.deleteMany({ businessId: { $in: [tenantAId, tenantBId] } })
    await Business.deleteMany({ businessId: { $in: [tenantAId, tenantBId] } })
    console.log('[PASS] Cleaned up test tenant records.')

    console.log('\n' + '='.repeat(80))
    console.log(' ALL INVENTORY CRUD & MOVEMENT LEDGER TESTS PASSED (10/10)')
    console.log('='.repeat(80))
  } catch (error) {
    console.error('Inventory API verification error:', error)
    process.exit(1)
  } finally {
    if (server) server.close()
    await mongoose.connection.close()
    process.exit(0)
  }
}

testInventoryApi()
