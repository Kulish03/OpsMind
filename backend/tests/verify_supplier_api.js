import dotenv from 'dotenv'
dotenv.config()

import mongoose from 'mongoose'
import connectDB from '../src/config/db.js'
import app from '../src/app.js'
import { User, Business } from '../src/modules/auth/index.js'
import { Supplier, Product } from '../src/modules/business/index.js'
import { generateToken } from '../src/modules/auth/auth.service.js'

const PORT = 5071

const testSupplierApi = async () => {
  console.log('='.repeat(80))
  console.log(' OPSMIND BACKEND — STEP 10: SUPPLIER CRUD APIS VERIFICATION')
  console.log('='.repeat(80))

  let server
  const tenantAId = `tenant_sup_a_${Date.now()}`
  const tenantBId = `tenant_sup_b_${Date.now()}`

  try {
    await connectDB()
    console.log('[OK] Connected to MongoDB.')

    server = app.listen(PORT, () => {
      console.log(`[OK] Test server listening on http://127.0.0.1:${PORT}\n`)
    })

    const baseUrl = `http://127.0.0.1:${PORT}/api/suppliers`

    // ---------------------------------------------------------
    // SEED TEST TENANTS & USERS
    // ---------------------------------------------------------
    await Business.create({
      businessId: tenantAId,
      name: 'Tenant A Highland Retailers',
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

    // Seed Supplier in Tenant A
    const supA1 = await Supplier.create({
      businessId: tenantAId,
      supplierId: 'SUP-A1',
      name: 'Highland Tartan Mills',
      category: 'Textiles',
      contactPerson: 'Hamish MacLeod',
      email: 'hamish@highlandmills.co.uk',
      city: 'Edinburgh',
      country: 'United Kingdom',
      leadTimeDays: 14,
      minimumOrderQty: 100,
    })

    // Seed Supplier in Tenant B with identical supplierId
    await Supplier.create({
      businessId: tenantBId,
      supplierId: 'SUP-A1',
      name: 'Competitor Mills',
      category: 'Textiles',
      city: 'Glasgow',
      country: 'United Kingdom',
      leadTimeDays: 7,
    })

    // Seed Product linked to SUP-A1 in Tenant A
    await Product.create({
      businessId: tenantAId,
      sku: 'PROD-TARTAN-1',
      name: 'Royal Stewart Tartan Scarf',
      sellingPrice: 28.00,
      costPrice: 12.00,
      currentStock: 50,
      supplierId: 'SUP-A1',
    })

    // ---------------------------------------------------------
    // TEST 1: CREATE SUPPLIER WITH CUSTOM ID (ADMIN)
    // ---------------------------------------------------------
    console.log('--- 1. Testing POST /api/suppliers (Create Supplier) ---')
    const createRes1 = await fetch(`${baseUrl}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenAdminA}`,
      },
      body: JSON.stringify({
        supplierId: 'SUP-A2',
        name: 'Caledonian Ceramics',
        category: 'Pottery & Glassware',
        contactPerson: 'Fiona MacLeod',
        email: 'fiona@caledonian.co.uk',
        phone: '+44 131 496 0123',
        city: 'Stirling',
        leadTimeDays: 5,
        minimumOrderQty: 25,
      }),
    })
    const createData1 = await createRes1.json()
    if (
      createRes1.status === 201 &&
      createData1.success &&
      createData1.data.supplierId === 'SUP-A2' &&
      createData1.data.businessId === tenantAId
    ) {
      console.log(`[PASS] Supplier created: ID: ${createData1.data.supplierId}, Name: "${createData1.data.name}", Lead Time: ${createData1.data.leadTimeDays} days`)
    } else {
      throw new Error(`Create supplier failed: ${JSON.stringify(createData1)}`)
    }

    // ---------------------------------------------------------
    // TEST 2: AUTO-GENERATE SUPPLIER ID WHEN OMITTED
    // ---------------------------------------------------------
    console.log('\n--- 2. Testing Supplier Creation with Auto-Generated ID ---')
    const createRes2 = await fetch(`${baseUrl}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenAdminA}`,
      },
      body: JSON.stringify({
        name: 'Grampian Packaging Supplies',
        category: 'Packaging',
      }),
    })
    const createData2 = await createRes2.json()
    if (
      createRes2.status === 201 &&
      createData2.data.supplierId.startsWith('SUP-') &&
      createData2.data.name === 'Grampian Packaging Supplies'
    ) {
      console.log(`[PASS] Supplier auto-assigned ID: '${createData2.data.supplierId}' ("${createData2.data.name}")`)
    } else {
      throw new Error(`Auto supplier ID creation failed: ${JSON.stringify(createData2)}`)
    }
    const autoSupId = createData2.data.supplierId

    // ---------------------------------------------------------
    // TEST 3: DUPLICATE SUPPLIER ID COLLISION WITHIN TENANT A
    // ---------------------------------------------------------
    console.log('\n--- 3. Testing Duplicate Supplier ID Collision within Tenant A ---')
    const dupRes = await fetch(`${baseUrl}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenAdminA}`,
      },
      body: JSON.stringify({
        supplierId: 'SUP-A1', // Collides in Tenant A
        name: 'Duplicate Mills',
      }),
    })
    const dupData = await dupRes.json()
    if (dupRes.status === 409 && !dupData.success) {
      console.log(`[PASS] Duplicate supplier ID rejected with HTTP 409 Conflict: "${dupData.message}"`)
    } else {
      throw new Error(`Duplicate supplier check failed: ${JSON.stringify(dupData)}`)
    }

    // ---------------------------------------------------------
    // TEST 4: MULTI-TENANT SUPPLIER ID INDEPENDENCE
    // ---------------------------------------------------------
    console.log('\n--- 4. Testing Multi-Tenant Supplier ID Independence ---')
    const supTenantA = await Supplier.findOne({ businessId: tenantAId, supplierId: 'SUP-A1' })
    const supTenantB = await Supplier.findOne({ businessId: tenantBId, supplierId: 'SUP-A1' })
    if (supTenantA && supTenantB && supTenantA.name === 'Highland Tartan Mills' && supTenantB.name === 'Competitor Mills') {
      console.log(`[PASS] Multi-tenant isolation verified: 'SUP-A1' exists independently in Tenant A (${supTenantA.name}) and Tenant B (${supTenantB.name})`)
    } else {
      throw new Error(`Multi-tenant supplier isolation failed!`)
    }

    // ---------------------------------------------------------
    // TEST 5: LIST SUPPLIERS (SEARCH & LINKED PRODUCTS COUNT)
    // ---------------------------------------------------------
    console.log('\n--- 5. Testing Supplier Listing, Search & Product Counts ---')
    const listRes = await fetch(`${baseUrl}?search=caledonian`, {
      headers: { Authorization: `Bearer ${tokenAdminA}` },
    })
    const listData = await listRes.json()
    if (
      listRes.status === 200 &&
      listData.data.suppliers.length === 1 &&
      listData.data.suppliers[0].supplierId === 'SUP-A2'
    ) {
      console.log(`[PASS] Search by 'caledonian' returned 1 matching supplier ('SUP-A2')`)
    } else {
      throw new Error(`Supplier search failed: ${JSON.stringify(listData)}`)
    }

    const allSuppliersRes = await fetch(`${baseUrl}`, {
      headers: { Authorization: `Bearer ${tokenAdminA}` },
    })
    const allSuppliersData = await allSuppliersRes.json()
    const foundSupA1 = allSuppliersData.data.suppliers.find((s) => s.supplierId === 'SUP-A1')
    if (foundSupA1 && foundSupA1.linkedProductsCount === 1) {
      console.log(`[PASS] Supplier 'SUP-A1' correctly enriched with linkedProductsCount = 1`)
    } else {
      throw new Error(`Linked products count failed: ${JSON.stringify(allSuppliersData)}`)
    }

    // ---------------------------------------------------------
    // TEST 6: GET SUPPLIER BY ID & BY SUPPLIER_ID
    // ---------------------------------------------------------
    console.log('\n--- 6. Testing Get Supplier by ID & by SupplierId ---')
    const getByIdRes = await fetch(`${baseUrl}/${supA1._id}`, {
      headers: { Authorization: `Bearer ${tokenAdminA}` },
    })
    const getByIdData = await getByIdRes.json()

    const getByCodeRes = await fetch(`${baseUrl}/SUP-A1`, {
      headers: { Authorization: `Bearer ${tokenAdminA}` },
    })
    const getByCodeData = await getByCodeRes.json()

    if (
      getByIdRes.status === 200 &&
      getByCodeRes.status === 200 &&
      getByIdData.data.supplierId === 'SUP-A1' &&
      getByCodeData.data.supplierId === 'SUP-A1' &&
      getByIdData.data.linkedProductsCount === 1
    ) {
      console.log(`[PASS] Supplier fetched via both MongoDB _id and supplierId ('SUP-A1') with linked product count`)
    } else {
      throw new Error(`Supplier fetch by identifier failed: ${JSON.stringify(getByIdData)}`)
    }

    // ---------------------------------------------------------
    // TEST 7: GET PRODUCTS SUPPLIED BY SUPPLIER (/api/suppliers/:id/products)
    // ---------------------------------------------------------
    console.log('\n--- 7. Testing Get Products Supplied by Supplier ---')
    const supProductsRes = await fetch(`${baseUrl}/SUP-A1/products`, {
      headers: { Authorization: `Bearer ${tokenAdminA}` },
    })
    const supProductsData = await supProductsRes.json()
    if (
      supProductsRes.status === 200 &&
      supProductsData.data.products.length === 1 &&
      supProductsData.data.products[0].sku === 'PROD-TARTAN-1'
    ) {
      console.log(`[PASS] Supplier products endpoint returned 1 catalog product ('PROD-TARTAN-1': ${supProductsData.data.products[0].name})`)
    } else {
      throw new Error(`Supplier products endpoint failed: ${JSON.stringify(supProductsData)}`)
    }

    // ---------------------------------------------------------
    // TEST 8: CROSS-TENANT DATA ISOLATION
    // ---------------------------------------------------------
    console.log('\n--- 8. Testing Cross-Tenant Data Isolation ---')
    // Tenant B attempts to fetch Tenant A's supplier 'SUP-A2'
    const crossReadRes = await fetch(`${baseUrl}/SUP-A2`, {
      headers: { Authorization: `Bearer ${tokenAdminB}` },
    })
    const crossReadData = await crossReadRes.json()
    if (crossReadRes.status === 404 && !crossReadData.success) {
      console.log(`[PASS] Cross-tenant read rejected with HTTP 404 Not Found (Data Isolation Enforced)`)
    } else {
      throw new Error(`Cross-tenant supplier read failed: ${JSON.stringify(crossReadData)}`)
    }

    // ---------------------------------------------------------
    // TEST 9: UPDATE SUPPLIER PROFILE
    // ---------------------------------------------------------
    console.log('\n--- 9. Testing PUT /api/suppliers/:id (Update Profile) ---')
    const updateRes = await fetch(`${baseUrl}/SUP-A2`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenAdminA}`,
      },
      body: JSON.stringify({
        leadTimeDays: 8,
        minimumOrderQty: 40,
        city: 'Bridge of Allan',
      }),
    })
    const updateData = await updateRes.json()
    const updatedSupA2 = await Supplier.findOne({ businessId: tenantAId, supplierId: 'SUP-A2' })
    if (
      updateRes.status === 200 &&
      updatedSupA2.leadTimeDays === 8 &&
      updatedSupA2.minimumOrderQty === 40 &&
      updatedSupA2.city === 'Bridge of Allan'
    ) {
      console.log(`[PASS] Supplier updated: Lead Time -> ${updatedSupA2.leadTimeDays} days, MOQ -> ${updatedSupA2.minimumOrderQty}, City -> "${updatedSupA2.city}"`)
    } else {
      throw new Error(`Update supplier failed: ${JSON.stringify(updateData)}`)
    }

    // ---------------------------------------------------------
    // TEST 10: DELETE PROTECTION FOR SUPPLIER WITH LINKED PRODUCTS
    // ---------------------------------------------------------
    console.log('\n--- 10. Testing Delete Protection for Supplier with Linked Products ---')
    // SUP-A1 has 1 linked product -> deletion should be rejected
    const blockedDeleteRes = await fetch(`${baseUrl}/SUP-A1`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${tokenAdminA}` },
    })
    const blockedDeleteData = await blockedDeleteRes.json()
    if (blockedDeleteRes.status === 400 && !blockedDeleteData.success) {
      console.log(`[PASS] Deletion blocked due to product dependency: "${blockedDeleteData.message}"`)
    } else {
      throw new Error(`Supplier deletion safety check failed: ${JSON.stringify(blockedDeleteData)}`)
    }

    // Delete supplier without linked products (Grampian Packaging) -> should succeed
    const allowedDeleteRes = await fetch(`${baseUrl}/${autoSupId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${tokenAdminA}` },
    })
    const allowedDeleteData = await allowedDeleteRes.json()
    const checkDeleted = await Supplier.findOne({ businessId: tenantAId, supplierId: autoSupId })
    if (allowedDeleteRes.status === 200 && !checkDeleted) {
      console.log(`[PASS] Supplier without linked products ('${autoSupId}') deleted successfully`)
    } else {
      throw new Error(`Supplier deletion failed: ${JSON.stringify(allowedDeleteData)}`)
    }

    // ---------------------------------------------------------
    // TEST 11: RBAC: STAFF BLOCKED FROM SUPPLIER MUTATIONS
    // ---------------------------------------------------------
    console.log('\n--- 11. Testing RBAC: Staff Blocked from Modifying Suppliers ---')
    const staffCreateRes = await fetch(`${baseUrl}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenStaffA}`,
      },
      body: JSON.stringify({
        name: 'Unauthorized Supplier',
      }),
    })
    const staffCreateData = await staffCreateRes.json()
    if (staffCreateRes.status === 403) {
      console.log(`[PASS] Staff blocked from creating supplier: HTTP 403 Forbidden`)
    } else {
      throw new Error(`Staff create check failed: ${JSON.stringify(staffCreateData)}`)
    }

    const staffReadRes = await fetch(`${baseUrl}`, {
      headers: { Authorization: `Bearer ${tokenStaffA}` },
    })
    const staffReadData = await staffReadRes.json()
    if (staffReadRes.status === 200 && staffReadData.success) {
      console.log(`[PASS] Staff permitted read-only access to supplier directory: HTTP 200 OK`)
    } else {
      throw new Error(`Staff read check failed: ${JSON.stringify(staffReadData)}`)
    }

    // ---------------------------------------------------------
    // TEST 12: SUPPLIER DIRECTORY SUMMARY & LEAD TIME METRICS
    // ---------------------------------------------------------
    console.log('\n--- 12. Testing Supplier Directory Summary Endpoint ---')
    const summaryRes = await fetch(`${baseUrl}/summary`, {
      headers: { Authorization: `Bearer ${tokenAdminA}` },
    })
    const summaryData = await summaryRes.json()
    if (
      summaryRes.status === 200 &&
      summaryData.data.totalSuppliers === 2 && // SUP-A1 and SUP-A2 remaining
      summaryData.data.productsCoveredBySuppliers === 1 &&
      summaryData.data.averageLeadTimeDays > 0
    ) {
      console.log(`[PASS] Supplier summary verified:`)
      console.log(`  - Total Suppliers: ${summaryData.data.totalSuppliers}`)
      console.log(`  - Average Lead Time: ${summaryData.data.averageLeadTimeDays} days`)
      console.log(`  - Products Covered: ${summaryData.data.productsCoveredBySuppliers}`)
      console.log(`  - Categories: ${Object.keys(summaryData.data.categoryBreakdown).join(', ')}`)
    } else {
      throw new Error(`Supplier summary failed: ${JSON.stringify(summaryData)}`)
    }

    // ---------------------------------------------------------
    // CLEANUP
    // ---------------------------------------------------------
    console.log('\n--- 13. Cleanup Test Artifacts ---')
    await Supplier.deleteMany({ businessId: { $in: [tenantAId, tenantBId] } })
    await Product.deleteMany({ businessId: { $in: [tenantAId, tenantBId] } })
    await User.deleteMany({ businessId: { $in: [tenantAId, tenantBId] } })
    await Business.deleteMany({ businessId: { $in: [tenantAId, tenantBId] } })
    console.log('[PASS] Cleaned up test tenant records.')

    console.log('\n' + '='.repeat(80))
    console.log(' ALL SUPPLIER CRUD & DIRECTORY INTEGRATION TESTS PASSED (12/12)')
    console.log('='.repeat(80))
  } catch (error) {
    console.error('Supplier API verification error:', error)
    process.exit(1)
  } finally {
    if (server) server.close()
    await mongoose.connection.close()
    process.exit(0)
  }
}

testSupplierApi()
