import dotenv from 'dotenv'
dotenv.config()

import mongoose from 'mongoose'
import connectDB from '../src/config/db.js'
import app from '../src/app.js'
import { User, Business } from '../src/modules/auth/index.js'
import { Product, Sale } from '../src/modules/business/index.js'
import { generateToken } from '../src/modules/auth/auth.service.js'

const PORT = 5067

const testProductApi = async () => {
  console.log('='.repeat(80))
  console.log(' OPSMIND BACKEND — STEP 6: PRODUCT CRUD APIS VERIFICATION')
  console.log('='.repeat(80))

  let server
  const tenantAId = `tenant_prod_a_${Date.now()}`
  const tenantBId = `tenant_prod_b_${Date.now()}`

  try {
    await connectDB()
    console.log('[OK] Connected to MongoDB.')

    server = app.listen(PORT, () => {
      console.log(`[OK] Test server listening on http://127.0.0.1:${PORT}\n`)
    })

    const baseUrl = `http://127.0.0.1:${PORT}/api/products`

    // ---------------------------------------------------------
    // SEED TEST TENANTS & USERS
    // ---------------------------------------------------------
    const bizA = await Business.create({
      businessId: tenantAId,
      name: 'Tenant A Home Furnishings',
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

    const bizB = await Business.create({
      businessId: tenantBId,
      name: 'Tenant B Competing Decor',
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

    // ---------------------------------------------------------
    // TEST 1: CREATE PRODUCT (POST /api/products)
    // ---------------------------------------------------------
    console.log('--- 1. Testing POST /api/products (Authorized Admin A) ---')
    const createRes1 = await fetch(`${baseUrl}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenAdminA}`,
      },
      body: JSON.stringify({
        sku: 'CLK-1001',
        name: 'Vintage Brass Wall Clock',
        category: 'Home Decor',
        sellingPrice: 45.99,
        costPrice: 22.50,
        currentStock: 50,
        reorderThreshold: 15,
        targetStock: 100,
      }),
    })
    const createData1 = await createRes1.json()
    if (createRes1.status === 201 && createData1.success && createData1.data.sku === 'CLK-1001') {
      console.log(`[PASS] Product created: SKU: ${createData1.data.sku}, Name: "${createData1.data.name}", Price: £${createData1.data.sellingPrice}`)
    } else {
      throw new Error(`Failed to create product: ${JSON.stringify(createData1)}`)
    }
    const productAId = createData1.data._id

    // ---------------------------------------------------------
    // TEST 2: TENANT ISOLATION ON CREATION (SPOOFING REJECTION)
    // ---------------------------------------------------------
    console.log('\n--- 2. Testing Tenant Spoofing Prevention on Product Creation ---')
    const createRes2 = await fetch(`${baseUrl}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenAdminA}`,
      },
      body: JSON.stringify({
        businessId: tenantBId, // Attempted tenant spoof
        sku: 'LMP-2002',
        name: 'Ceramic Table Lamp',
        category: 'Lighting',
        sellingPrice: 32.00,
        costPrice: 15.00,
        currentStock: 8, // Low stock product (<= 15)
        reorderThreshold: 15,
      }),
    })
    const createData2 = await createRes2.json()
    const productInDb = await Product.findById(createData2.data._id)
    if (createRes2.status === 201 && productInDb.businessId === tenantAId) {
      console.log(`[PASS] Spoofed businessId '${tenantBId}' was overridden; product bound strictly to '${tenantAId}'`)
    } else {
      throw new Error(`Tenant spoofing protection failed: ${JSON.stringify(createData2)}`)
    }
    const lowStockProductId = createData2.data._id

    // ---------------------------------------------------------
    // TEST 3: DUPLICATE SKU REJECTION WITHIN SAME TENANT (409)
    // ---------------------------------------------------------
    console.log('\n--- 3. Testing Duplicate SKU Collision within Tenant A ---')
    const dupRes = await fetch(`${baseUrl}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenAdminA}`,
      },
      body: JSON.stringify({
        sku: 'clk-1001', // Lowercase should be normalized and collide
        name: 'Duplicate Clock',
        sellingPrice: 50.00,
      }),
    })
    const dupData = await dupRes.json()
    if (dupRes.status === 409 && !dupData.success) {
      console.log(`[PASS] Duplicate SKU correctly rejected with HTTP 409 Conflict: "${dupData.message}"`)
    } else {
      throw new Error(`Duplicate SKU check failed (${dupRes.status}): ${JSON.stringify(dupData)}`)
    }

    // ---------------------------------------------------------
    // TEST 4: MULTI-TENANT SKU INDEPENDENCE (Same SKU in Tenant B)
    // ---------------------------------------------------------
    console.log('\n--- 4. Testing Multi-Tenant SKU Independence (Tenant B creates CLK-1001) ---')
    const resB = await fetch(`${baseUrl}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenAdminB}`,
      },
      body: JSON.stringify({
        sku: 'CLK-1001', // Identical SKU in separate tenant
        name: 'Competitor Wall Clock',
        category: 'Competitor Decor',
        sellingPrice: 39.99,
        costPrice: 20.00,
        currentStock: 10,
      }),
    })
    const dataB = await resB.json()
    if (resB.status === 201 && dataB.data.businessId === tenantBId && dataB.data.sku === 'CLK-1001') {
      console.log(`[PASS] Tenant B successfully created CLK-1001 independently of Tenant A without collision`)
    } else {
      throw new Error(`Multi-tenant SKU independence failed: ${JSON.stringify(dataB)}`)
    }

    // ---------------------------------------------------------
    // TEST 5: ROLE-BASED ACCESS CONTROL (STAFF BLOCKED FROM WRITE)
    // ---------------------------------------------------------
    console.log('\n--- 5. Testing RBAC: Staff Role Permissions ---')
    const staffPostRes = await fetch(`${baseUrl}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenStaffA}`,
      },
      body: JSON.stringify({
        sku: 'STF-3003',
        name: 'Staff Created Item',
        sellingPrice: 10.00,
      }),
    })
    const staffPostData = await staffPostRes.json()
    if (staffPostRes.status === 403 && !staffPostData.success) {
      console.log(`[PASS] Staff blocked from creating product: HTTP 403 Forbidden`)
    } else {
      throw new Error(`Staff RBAC create check failed: ${JSON.stringify(staffPostData)}`)
    }

    const staffReadRes = await fetch(`${baseUrl}/${productAId}`, {
      headers: { Authorization: `Bearer ${tokenStaffA}` },
    })
    const staffReadData = await staffReadRes.json()
    if (staffReadRes.status === 200 && staffReadData.success && staffReadData.data._id === productAId) {
      console.log(`[PASS] Staff permitted to read product catalog: HTTP 200 OK`)
    } else {
      throw new Error(`Staff read check failed: ${JSON.stringify(staffReadData)}`)
    }

    // ---------------------------------------------------------
    // TEST 6: LIST PRODUCTS (PAGINATION, SEARCH, CATEGORY, LOW STOCK)
    // ---------------------------------------------------------
    console.log('\n--- 6. Testing Product Queries (List, Search, Filter, Pagination) ---')
    // 6a: Paginated list
    const listRes = await fetch(`${baseUrl}?page=1&limit=10`, {
      headers: { Authorization: `Bearer ${tokenAdminA}` },
    })
    const listData = await listRes.json()
    if (listRes.status === 200 && listData.data.products.length === 2 && listData.data.pagination.total === 2) {
      console.log(`[PASS] Paginated list retrieved: 2 products in Tenant A (Page 1 of 1)`)
    } else {
      throw new Error(`Product list failed: ${JSON.stringify(listData)}`)
    }

    // 6b: Search by name/sku
    const searchRes = await fetch(`${baseUrl}?search=clock`, {
      headers: { Authorization: `Bearer ${tokenAdminA}` },
    })
    const searchData = await searchRes.json()
    if (searchRes.status === 200 && searchData.data.products.length === 1 && searchData.data.products[0].sku === 'CLK-1001') {
      console.log(`[PASS] Search by query 'clock' returned 1 matching product ('CLK-1001')`)
    } else {
      throw new Error(`Product search failed: ${JSON.stringify(searchData)}`)
    }

    // 6c: Filter by category
    const catRes = await fetch(`${baseUrl}?category=Lighting`, {
      headers: { Authorization: `Bearer ${tokenAdminA}` },
    })
    const catData = await catRes.json()
    if (catRes.status === 200 && catData.data.products.length === 1 && catData.data.products[0].category === 'Lighting') {
      console.log(`[PASS] Category filter 'Lighting' returned 1 product`)
    } else {
      throw new Error(`Category filter failed: ${JSON.stringify(catData)}`)
    }

    // 6d: Filter by low stock
    const lowStockQueryRes = await fetch(`${baseUrl}?lowStock=true`, {
      headers: { Authorization: `Bearer ${tokenAdminA}` },
    })
    const lowStockQueryData = await lowStockQueryRes.json()
    if (lowStockQueryRes.status === 200 && lowStockQueryData.data.products.length === 1 && lowStockQueryData.data.products[0].sku === 'LMP-2002') {
      console.log(`[PASS] Low stock filter (?lowStock=true) returned 1 product ('LMP-2002' stock 8 <= 15)`)
    } else {
      throw new Error(`Low stock query failed: ${JSON.stringify(lowStockQueryData)}`)
    }

    // ---------------------------------------------------------
    // TEST 7: FETCH PRODUCT BY SKU & BY ID
    // ---------------------------------------------------------
    console.log('\n--- 7. Testing Get Product By ID & SKU ---')
    const getSkuRes = await fetch(`${baseUrl}/sku/clk-1001`, {
      headers: { Authorization: `Bearer ${tokenAdminA}` },
    })
    const getSkuData = await getSkuRes.json()
    if (getSkuRes.status === 200 && getSkuData.data.sku === 'CLK-1001') {
      console.log(`[PASS] Product fetched by SKU: '${getSkuData.data.sku}' ("${getSkuData.data.name}")`)
    } else {
      throw new Error(`Fetch by SKU failed: ${JSON.stringify(getSkuData)}`)
    }

    // ---------------------------------------------------------
    // TEST 8: CROSS-TENANT DATA ISOLATION (TENANT B CANNOT ACCESS TENANT A)
    // ---------------------------------------------------------
    console.log('\n--- 8. Testing Cross-Tenant Boundary Protection (Tenant B tries to access Tenant A) ---')
    // Tenant B tries to read Tenant A's product by ID
    const crossReadRes = await fetch(`${baseUrl}/${productAId}`, {
      headers: { Authorization: `Bearer ${tokenAdminB}` },
    })
    const crossReadData = await crossReadRes.json()
    if (crossReadRes.status === 404 && !crossReadData.success) {
      console.log(`[PASS] Cross-tenant read rejected with HTTP 404 Not Found (Information Leakage Blocked)`)
    } else {
      throw new Error(`Cross-tenant read isolation failed! Result: ${JSON.stringify(crossReadData)}`)
    }

    // Tenant B tries to mutate Tenant A's product
    const crossUpdateRes = await fetch(`${baseUrl}/${productAId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenAdminB}`,
      },
      body: JSON.stringify({
        sellingPrice: 0.01,
      }),
    })
    const crossUpdateData = await crossUpdateRes.json()
    if (crossUpdateRes.status === 404) {
      console.log(`[PASS] Cross-tenant update rejected with HTTP 404 Not Found`)
    } else {
      throw new Error(`Cross-tenant update isolation failed: ${JSON.stringify(crossUpdateData)}`)
    }

    // ---------------------------------------------------------
    // TEST 9: UPDATE PRODUCT (PUT /api/products/:id)
    // ---------------------------------------------------------
    console.log('\n--- 9. Testing PUT /api/products/:id (Authorized Update) ---')
    const updateRes = await fetch(`${baseUrl}/${productAId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenAdminA}`,
      },
      body: JSON.stringify({
        name: 'Vintage Antique Brass Wall Clock (Restored)',
        sellingPrice: 59.95,
        reorderThreshold: 20,
      }),
    })
    const updateData = await updateRes.json()
    if (updateRes.status === 200 && updateData.data.sellingPrice === 59.95 && updateData.data.reorderThreshold === 20) {
      console.log(`[PASS] Product updated: Name -> "${updateData.data.name}", Price -> £${updateData.data.sellingPrice}`)
    } else {
      throw new Error(`Update product failed: ${JSON.stringify(updateData)}`)
    }

    // ---------------------------------------------------------
    // TEST 10: LOW STOCK ALERTS & DISTINCT CATEGORIES
    // ---------------------------------------------------------
    console.log('\n--- 10. Testing Low Stock Alerts & Category Metadata ---')
    const alertsRes = await fetch(`${baseUrl}/alerts/low-stock`, {
      headers: { Authorization: `Bearer ${tokenAdminA}` },
    })
    const alertsData = await alertsRes.json()
    if (alertsRes.status === 200 && alertsData.data.total === 1 && alertsData.data.products[0].sku === 'LMP-2002') {
      console.log(`[PASS] /alerts/low-stock returned 1 low-stock item ('LMP-2002')`)
    } else {
      throw new Error(`Low stock alerts endpoint failed: ${JSON.stringify(alertsData)}`)
    }

    const categoriesRes = await fetch(`${baseUrl}/meta/categories`, {
      headers: { Authorization: `Bearer ${tokenAdminA}` },
    })
    const categoriesData = await categoriesRes.json()
    if (categoriesRes.status === 200 && Array.isArray(categoriesData.data) && categoriesData.data.includes('Home Decor') && categoriesData.data.includes('Lighting')) {
      console.log(`[PASS] /meta/categories returned distinct categories: [${categoriesData.data.join(', ')}]`)
    } else {
      throw new Error(`Categories endpoint failed: ${JSON.stringify(categoriesData)}`)
    }

    // ---------------------------------------------------------
    // TEST 11: SOFT DELETE & PERMANENT DELETE CONSTRAINTS
    // ---------------------------------------------------------
    console.log('\n--- 11. Testing Product Deletion (Soft vs Permanent) ---')
    // 11a: Soft delete
    const deleteRes = await fetch(`${baseUrl}/${lowStockProductId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${tokenAdminA}` },
    })
    const deleteData = await deleteRes.json()
    const softDeletedProduct = await Product.findById(lowStockProductId)
    if (deleteRes.status === 200 && softDeletedProduct.isActive === false) {
      console.log(`[PASS] Soft delete successful: Product 'LMP-2002' marked isActive: false`)
    } else {
      throw new Error(`Soft delete failed: ${JSON.stringify(deleteData)}`)
    }

    // 11b: Attach dummy sale to productA (CLK-1001) and attempt permanent delete
    const dummySale = await Sale.create({
      businessId: tenantAId,
      invoiceId: `INV_TEST_${Date.now()}`,
      transactionDate: new Date(),
      customerReference: 'CUST-TEST',
      totalAmount: 59.95,
      totalUnits: 1,
      items: [
        {
          productSku: 'CLK-1001',
          productName: 'Vintage Antique Brass Wall Clock (Restored)',
          quantity: 1,
          unitPrice: 59.95,
          lineTotal: 59.95,
        },
      ],
    })

    const permBlockedRes = await fetch(`${baseUrl}/${productAId}?permanent=true`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${tokenAdminA}` },
    })
    const permBlockedData = await permBlockedRes.json()
    if (permBlockedRes.status === 400 && !permBlockedData.success) {
      console.log(`[PASS] Permanent deletion blocked due to sales history dependency: "${permBlockedData.message}"`)
    } else {
      throw new Error(`Permanent deletion safety check failed: ${JSON.stringify(permBlockedData)}`)
    }

    // Remove sale and verify permanent delete succeeds
    await Sale.deleteOne({ _id: dummySale._id })
    const permAllowedRes = await fetch(`${baseUrl}/${productAId}?permanent=true`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${tokenAdminA}` },
    })
    const permAllowedData = await permAllowedRes.json()
    const checkProductGone = await Product.findById(productAId)
    if (permAllowedRes.status === 200 && !checkProductGone) {
      console.log(`[PASS] Permanent deletion succeeded after removing sales reference. Record completely erased.`)
    } else {
      throw new Error(`Permanent deletion failed: ${JSON.stringify(permAllowedData)}`)
    }

    // ---------------------------------------------------------
    // CLEANUP
    // ---------------------------------------------------------
    console.log('\n--- 12. Cleanup Test Artifacts ---')
    await Product.deleteMany({ businessId: { $in: [tenantAId, tenantBId] } })
    await User.deleteMany({ businessId: { $in: [tenantAId, tenantBId] } })
    await Business.deleteMany({ businessId: { $in: [tenantAId, tenantBId] } })
    console.log('[PASS] Cleaned up test tenant products, users, and businesses.')

    console.log('\n' + '='.repeat(80))
    console.log(' ALL PRODUCT CRUD & MULTI-TENANT ISOLATION TESTS PASSED (11/11)')
    console.log('='.repeat(80))
  } catch (error) {
    console.error('Product API verification error:', error)
    process.exit(1)
  } finally {
    if (server) server.close()
    await mongoose.connection.close()
    process.exit(0)
  }
}

testProductApi()
