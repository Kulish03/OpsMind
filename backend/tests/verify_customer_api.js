import dotenv from 'dotenv'
dotenv.config()

import mongoose from 'mongoose'
import connectDB from '../src/config/db.js'
import app from '../src/app.js'
import { User, Business } from '../src/modules/auth/index.js'
import { Customer, Sale } from '../src/modules/business/index.js'
import { generateToken } from '../src/modules/auth/auth.service.js'

const PORT = 5070

const testCustomerApi = async () => {
  console.log('='.repeat(80))
  console.log(' OPSMIND BACKEND — STEP 9: CUSTOMER CRUD APIS VERIFICATION')
  console.log('='.repeat(80))

  let server
  const tenantAId = `tenant_cust_a_${Date.now()}`
  const tenantBId = `tenant_cust_b_${Date.now()}`

  try {
    await connectDB()
    console.log('[OK] Connected to MongoDB.')

    server = app.listen(PORT, () => {
      console.log(`[OK] Test server listening on http://127.0.0.1:${PORT}\n`)
    })

    const baseUrl = `http://127.0.0.1:${PORT}/api/customers`

    // ---------------------------------------------------------
    // SEED TEST TENANTS & USERS
    // ---------------------------------------------------------
    await Business.create({
      businessId: tenantAId,
      name: 'Tenant A London Haberdashery',
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

    // Seed existing customers in Tenant A
    const custA1 = await Customer.create({
      businessId: tenantAId,
      customerId: 'CUST-A1',
      name: 'Sherlock Holmes',
      country: 'United Kingdom',
      totalSpend: 250.00,
      totalOrders: 3,
      rfm: { retentionStatus: 'ACTIVE', recencyDays: 5, frequency: 3, monetary: 250.00 },
    })

    // Seed customer in Tenant B with identical customerId to test multi-tenant independence
    await Customer.create({
      businessId: tenantBId,
      customerId: 'CUST-A1',
      name: 'Irene Adler',
      country: 'United States',
      totalSpend: 120.00,
      totalOrders: 1,
    })

    // ---------------------------------------------------------
    // TEST 1: CREATE CUSTOMER WITH CUSTOM ID & NAME
    // ---------------------------------------------------------
    console.log('--- 1. Testing POST /api/customers (Create Customer) ---')
    const createRes1 = await fetch(`${baseUrl}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenStaffA}`,
      },
      body: JSON.stringify({
        customerId: 'CUST-A2',
        name: 'Dr. John Watson',
        country: 'United Kingdom',
      }),
    })
    const createData1 = await createRes1.json()
    if (
      createRes1.status === 201 &&
      createData1.success &&
      createData1.data.customerId === 'CUST-A2' &&
      createData1.data.businessId === tenantAId
    ) {
      console.log(`[PASS] Customer created: ID: ${createData1.data.customerId}, Name: "${createData1.data.name}", Country: ${createData1.data.country}`)
    } else {
      throw new Error(`Create customer failed: ${JSON.stringify(createData1)}`)
    }

    // ---------------------------------------------------------
    // TEST 2: AUTO-GENERATE CUSTOMER ID WHEN OMITTED
    // ---------------------------------------------------------
    console.log('\n--- 2. Testing Customer Creation with Auto-Generated ID ---')
    const createRes2 = await fetch(`${baseUrl}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenStaffA}`,
      },
      body: JSON.stringify({
        name: 'Mrs. Martha Hudson',
      }),
    })
    const createData2 = await createRes2.json()
    if (
      createRes2.status === 201 &&
      createData2.data.customerId.startsWith('CUST-') &&
      createData2.data.name === 'Mrs. Martha Hudson'
    ) {
      console.log(`[PASS] Customer auto-assigned ID: '${createData2.data.customerId}' ("${createData2.data.name}")`)
    } else {
      throw new Error(`Auto customer ID creation failed: ${JSON.stringify(createData2)}`)
    }
    const autoCustId = createData2.data.customerId

    // ---------------------------------------------------------
    // TEST 3: DUPLICATE CUSTOMER ID REJECTION (409 Conflict)
    // ---------------------------------------------------------
    console.log('\n--- 3. Testing Duplicate Customer ID Collision within Tenant A ---')
    const dupRes = await fetch(`${baseUrl}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenStaffA}`,
      },
      body: JSON.stringify({
        customerId: 'CUST-A1', // Collides within Tenant A
        name: 'Imposter Sherlock',
      }),
    })
    const dupData = await dupRes.json()
    if (dupRes.status === 409 && !dupData.success) {
      console.log(`[PASS] Duplicate customer ID rejected with HTTP 409 Conflict: "${dupData.message}"`)
    } else {
      throw new Error(`Duplicate customer check failed: ${JSON.stringify(dupData)}`)
    }

    // ---------------------------------------------------------
    // TEST 4: MULTI-TENANT CUSTOMER INDEPENDENCE
    // ---------------------------------------------------------
    console.log('\n--- 4. Testing Multi-Tenant Customer ID Independence ---')
    const tenantBCust = await Customer.findOne({ businessId: tenantBId, customerId: 'CUST-A1' })
    const tenantACust = await Customer.findOne({ businessId: tenantAId, customerId: 'CUST-A1' })
    if (tenantBCust && tenantACust && tenantBCust.name === 'Irene Adler' && tenantACust.name === 'Sherlock Holmes') {
      console.log(`[PASS] Multi-tenant isolation verified: 'CUST-A1' exists independently in Tenant A (${tenantACust.name}) and Tenant B (${tenantBCust.name})`)
    } else {
      throw new Error(`Multi-tenant customer isolation failed!`)
    }

    // ---------------------------------------------------------
    // TEST 5: LIST CUSTOMERS (SEARCH, FILTER & PAGINATION)
    // ---------------------------------------------------------
    console.log('\n--- 5. Testing Customer Listing, Search & Sorting ---')
    const listRes = await fetch(`${baseUrl}?search=watson`, {
      headers: { Authorization: `Bearer ${tokenAdminA}` },
    })
    const listData = await listRes.json()
    if (
      listRes.status === 200 &&
      listData.data.customers.length === 1 &&
      listData.data.customers[0].customerId === 'CUST-A2'
    ) {
      console.log(`[PASS] Search by 'watson' returned 1 matching customer ('CUST-A2')`)
    } else {
      throw new Error(`Customer search failed: ${JSON.stringify(listData)}`)
    }

    // ---------------------------------------------------------
    // TEST 6: GET CUSTOMER BY ID & BY CUSTOMER_ID
    // ---------------------------------------------------------
    console.log('\n--- 6. Testing Get Customer by ID & by CustomerId ---')
    const getByIdRes = await fetch(`${baseUrl}/${custA1._id}`, {
      headers: { Authorization: `Bearer ${tokenAdminA}` },
    })
    const getByIdData = await getByIdRes.json()

    const getByCodeRes = await fetch(`${baseUrl}/CUST-A1`, {
      headers: { Authorization: `Bearer ${tokenAdminA}` },
    })
    const getByCodeData = await getByCodeRes.json()

    if (
      getByIdRes.status === 200 &&
      getByCodeRes.status === 200 &&
      getByIdData.data.customerId === 'CUST-A1' &&
      getByCodeData.data.customerId === 'CUST-A1'
    ) {
      console.log(`[PASS] Customer fetched successfully via both MongoDB _id and human-readable customerId ('CUST-A1')`)
    } else {
      throw new Error(`Customer fetch by identifier failed: ${JSON.stringify(getByIdData)}`)
    }

    // ---------------------------------------------------------
    // TEST 7: CUSTOMER ORDER HISTORY ENDPOINT
    // ---------------------------------------------------------
    console.log('\n--- 7. Testing Customer Order History Endpoint (/api/customers/:id/orders) ---')
    // Seed a sale for CUST-A1
    await Sale.create({
      businessId: tenantAId,
      invoiceId: `INV-CUST-TEST-${Date.now()}`,
      transactionDate: new Date(),
      customerReference: 'CUST-A1',
      totalAmount: 125.00,
      totalUnits: 2,
      items: [
        {
          productSku: 'SKU-SAMPLE',
          productName: 'Sample Tweed Hat',
          quantity: 2,
          unitPrice: 62.50,
          lineTotal: 125.00,
        },
      ],
    })

    const ordersRes = await fetch(`${baseUrl}/CUST-A1/orders`, {
      headers: { Authorization: `Bearer ${tokenAdminA}` },
    })
    const ordersData = await ordersRes.json()
    if (
      ordersRes.status === 200 &&
      ordersData.data.orders.length === 1 &&
      ordersData.data.customer.customerId === 'CUST-A1' &&
      ordersData.data.orders[0].totalAmount === 125.00
    ) {
      console.log(`[PASS] Order history retrieved: 1 sale invoice linked to customer 'CUST-A1' (Total: £125.00)`)
    } else {
      throw new Error(`Order history endpoint failed: ${JSON.stringify(ordersData)}`)
    }

    // ---------------------------------------------------------
    // TEST 8: CROSS-TENANT DATA ISOLATION
    // ---------------------------------------------------------
    console.log('\n--- 8. Testing Cross-Tenant Data Isolation ---')
    // Tenant B attempts to access Tenant A's customer 'CUST-A2'
    const crossReadRes = await fetch(`${baseUrl}/CUST-A2`, {
      headers: { Authorization: `Bearer ${tokenAdminB}` },
    })
    const crossReadData = await crossReadRes.json()
    if (crossReadRes.status === 404 && !crossReadData.success) {
      console.log(`[PASS] Cross-tenant read rejected with HTTP 404 Not Found (Data Isolation Enforced)`)
    } else {
      throw new Error(`Cross-tenant customer read failed: ${JSON.stringify(crossReadData)}`)
    }

    // ---------------------------------------------------------
    // TEST 9: UPDATE CUSTOMER PROFILE & RETENTION STATUS
    // ---------------------------------------------------------
    console.log('\n--- 9. Testing PUT /api/customers/:id (Update Profile & RFM) ---')
    const updateRes = await fetch(`${baseUrl}/CUST-A2`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenStaffA}`,
      },
      body: JSON.stringify({
        country: 'Scotland',
        retentionStatus: 'ACTIVE',
      }),
    })
    const updateData = await updateRes.json()
    const updatedWatson = await Customer.findOne({ businessId: tenantAId, customerId: 'CUST-A2' })
    if (
      updateRes.status === 200 &&
      updatedWatson.country === 'Scotland' &&
      updatedWatson.rfm.retentionStatus === 'ACTIVE'
    ) {
      console.log(`[PASS] Customer updated: Country -> "${updatedWatson.country}", Retention Status -> ${updatedWatson.rfm.retentionStatus}`)
    } else {
      throw new Error(`Update customer failed: ${JSON.stringify(updateData)}`)
    }

    // ---------------------------------------------------------
    // TEST 10: DELETE PROTECTION ON CUSTOMER WITH SALES HISTORY
    // ---------------------------------------------------------
    console.log('\n--- 10. Testing Delete Protection for Customers with Sales History ---')
    // CUST-A1 has 1 associated sale invoice -> deletion should be rejected
    const blockedDeleteRes = await fetch(`${baseUrl}/CUST-A1`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${tokenAdminA}` },
    })
    const blockedDeleteData = await blockedDeleteRes.json()
    if (blockedDeleteRes.status === 400 && !blockedDeleteData.success) {
      console.log(`[PASS] Deletion blocked due to sales history dependency: "${blockedDeleteData.message}"`)
    } else {
      throw new Error(`Customer deletion safety check failed: ${JSON.stringify(blockedDeleteData)}`)
    }

    // Delete customer without orders (Mrs. Hudson) -> should succeed
    const allowedDeleteRes = await fetch(`${baseUrl}/${autoCustId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${tokenAdminA}` },
    })
    const allowedDeleteData = await allowedDeleteRes.json()
    const checkDeleted = await Customer.findOne({ businessId: tenantAId, customerId: autoCustId })
    if (allowedDeleteRes.status === 200 && !checkDeleted) {
      console.log(`[PASS] Customer without orders ('${autoCustId}') deleted successfully`)
    } else {
      throw new Error(`Customer deletion failed: ${JSON.stringify(allowedDeleteData)}`)
    }

    // ---------------------------------------------------------
    // TEST 11: RBAC: STAFF BLOCKED FROM DELETING CUSTOMERS
    // ---------------------------------------------------------
    console.log('\n--- 11. Testing RBAC: Staff Blocked from Deleting Customers ---')
    const staffDeleteRes = await fetch(`${baseUrl}/CUST-A2`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${tokenStaffA}` },
    })
    const staffDeleteData = await staffDeleteRes.json()
    if (staffDeleteRes.status === 403) {
      console.log(`[PASS] Staff blocked from deleting customer: HTTP 403 Forbidden`)
    } else {
      throw new Error(`Staff delete check failed: ${JSON.stringify(staffDeleteData)}`)
    }

    // ---------------------------------------------------------
    // TEST 12: CUSTOMER SUMMARY & SEGMENTATION METRICS
    // ---------------------------------------------------------
    console.log('\n--- 12. Testing Customer Analytics & RFM Segmentation Summary ---')
    const summaryRes = await fetch(`${baseUrl}/summary`, {
      headers: { Authorization: `Bearer ${tokenAdminA}` },
    })
    const summaryData = await summaryRes.json()
    if (
      summaryRes.status === 200 &&
      summaryData.data.totalCustomers === 2 && // Sherlock & Watson remaining
      summaryData.data.retentionSegments.ACTIVE >= 1 &&
      summaryData.data.topCustomers.length >= 1
    ) {
      console.log(`[PASS] Customer analytics summary verified:`)
      console.log(`  - Total Customers: ${summaryData.data.totalCustomers}`)
      console.log(`  - Total Customer Spend: £${summaryData.data.totalCustomerSpend}`)
      console.log(`  - Retention Segments: Active = ${summaryData.data.retentionSegments.ACTIVE}`)
      console.log(`  - Top Customer: ${summaryData.data.topCustomers[0].name} (£${summaryData.data.topCustomers[0].totalSpend})`)
    } else {
      throw new Error(`Customer summary failed: ${JSON.stringify(summaryData)}`)
    }

    // ---------------------------------------------------------
    // CLEANUP
    // ---------------------------------------------------------
    console.log('\n--- 13. Cleanup Test Artifacts ---')
    await Customer.deleteMany({ businessId: { $in: [tenantAId, tenantBId] } })
    await Sale.deleteMany({ businessId: { $in: [tenantAId, tenantBId] } })
    await User.deleteMany({ businessId: { $in: [tenantAId, tenantBId] } })
    await Business.deleteMany({ businessId: { $in: [tenantAId, tenantBId] } })
    console.log('[PASS] Cleaned up test tenant records.')

    console.log('\n' + '='.repeat(80))
    console.log(' ALL CUSTOMER CRUD & RETENTION ANALYTICS TESTS PASSED (12/12)')
    console.log('='.repeat(80))
  } catch (error) {
    console.error('Customer API verification error:', error)
    process.exit(1)
  } finally {
    if (server) server.close()
    await mongoose.connection.close()
    process.exit(0)
  }
}

testCustomerApi()
