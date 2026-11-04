import dotenv from 'dotenv'
dotenv.config()

import mongoose from 'mongoose'
import connectDB from '../src/config/db.js'
import app from '../src/app.js'
import { User, Business } from '../src/modules/auth/index.js'
import { generateToken } from '../src/modules/auth/auth.service.js'

const PORT = 5066

const testBusinessApi = async () => {
  console.log('='.repeat(80))
  console.log(' OPSMIND BACKEND — BUSINESS PROFILE & TENANT ISOLATION VERIFICATION')
  console.log('='.repeat(80))

  let server
  const tenantAId = `tenant_a_${Date.now()}`
  const tenantBId = `tenant_b_${Date.now()}`

  try {
    await connectDB()
    console.log('[OK] Connected to MongoDB.')

    server = app.listen(PORT, () => {
      console.log(`[OK] Test server listening on http://127.0.0.1:${PORT}\n`)
    })

    const baseUrl = `http://127.0.0.1:${PORT}/api/businesses`

    // Seed Tenant A & Admin User
    const bizA = new Business({
      businessId: tenantAId,
      name: 'Tenant A Retail Boutique',
      businessType: 'retail',
      currency: 'GBP',
      settings: { defaultLowStockThreshold: 20 },
    })
    await bizA.save()

    const adminA = new User({
      businessId: tenantAId,
      name: 'Alice Admin',
      email: `alice_${Date.now()}@tenantA.com`,
      password: 'AdminPassword123!',
      role: 'admin',
    })
    await adminA.save()
    const tokenAdminA = generateToken(adminA)

    // Seed Staff User in Tenant A
    const staffA = new User({
      businessId: tenantAId,
      name: 'Sam Staff',
      email: `sam_${Date.now()}@tenantA.com`,
      password: 'StaffPassword123!',
      role: 'staff',
    })
    await staffA.save()
    const tokenStaffA = generateToken(staffA)

    // Seed Tenant B & Admin User (Attacker / Foreign Tenant)
    const bizB = new Business({
      businessId: tenantBId,
      name: 'Tenant B Competitor Store',
      businessType: 'wholesale',
      currency: 'USD',
      settings: { defaultLowStockThreshold: 50 },
    })
    await bizB.save()

    const adminB = new User({
      businessId: tenantBId,
      name: 'Bob Competitor',
      email: `bob_${Date.now()}@tenantB.com`,
      password: 'CompetitorPassword123!',
      role: 'admin',
    })
    await adminB.save()
    const tokenAdminB = generateToken(adminB)

    // ---------------------------------------------------------
    // TEST 1: FETCH BUSINESS PROFILE
    // ---------------------------------------------------------
    console.log('--- 1. Testing GET /api/businesses/profile (Tenant A Admin) ---')
    const resA = await fetch(`${baseUrl}/profile`, {
      headers: { Authorization: `Bearer ${tokenAdminA}` },
    })
    const dataA = await resA.json()
    if (resA.status === 200 && dataA.data.businessId === tenantAId) {
      console.log(`✓ [PASS] Profile fetched for: ${dataA.data.name} [Currency: ${dataA.data.currency}]`)
    } else {
      throw new Error(`Profile fetch failed: ${JSON.stringify(dataA)}`)
    }

    // ---------------------------------------------------------
    // TEST 2: UPDATE BUSINESS PROFILE & SETTINGS
    // ---------------------------------------------------------
    console.log('\n--- 2. Testing PUT /api/businesses/profile (Authorized Admin) ---')
    const updateRes = await fetch(`${baseUrl}/profile`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenAdminA}`,
      },
      body: JSON.stringify({
        name: 'Tenant A Luxury Boutique UK',
        settings: {
          defaultLowStockThreshold: 35,
          defaultTargetStock: 150,
        },
      }),
    })
    const updateData = await updateRes.json()
    if (updateRes.status === 200 && updateData.data.settings.defaultLowStockThreshold === 35) {
      console.log(`✓ [PASS] Settings updated successfully: Name -> "${updateData.data.name}", LowStockThreshold -> ${updateData.data.settings.defaultLowStockThreshold}`)
    } else {
      throw new Error(`Profile update failed: ${JSON.stringify(updateData)}`)
    }

    // ---------------------------------------------------------
    // TEST 3: ROLE-BASED ACCESS CONTROL (STAFF BLOCKED)
    // ---------------------------------------------------------
    console.log('\n--- 3. Testing RBAC: Staff Blocked from Modifying Settings ---')
    const staffUpdateRes = await fetch(`${baseUrl}/profile`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenStaffA}`,
      },
      body: JSON.stringify({
        name: 'Unauthorized Name Mutation',
      }),
    })
    const staffUpdateData = await staffUpdateRes.json()
    if (staffUpdateRes.status === 403 && !staffUpdateData.success) {
      console.log(`✓ [PASS] Staff correctly blocked with HTTP 403 Forbidden: "${staffUpdateData.message}"`)
    } else {
      throw new Error(`Staff RBAC check failed (${staffUpdateRes.status}): ${JSON.stringify(staffUpdateData)}`)
    }

    // ---------------------------------------------------------
    // TEST 4: MULTI-TENANT ISOLATION & SPOOFING PREVENTION
    // ---------------------------------------------------------
    console.log('\n--- 4. Testing Multi-Tenant Data Isolation & Spoofing Guard ---')
    // Tenant B attempts to spoof Tenant A by passing businessId: tenantAId in the body
    const spoofRes = await fetch(`${baseUrl}/profile`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenAdminB}`,
      },
      body: JSON.stringify({
        businessId: tenantAId, // ATTEMPTED TENANT SPOOF
        name: 'Hacked Tenant Name',
      }),
    })
    const spoofData = await spoofRes.json()

    // Verify Tenant A's document was NOT modified
    const tenantACheck = await Business.findOne({ businessId: tenantAId })
    const tenantBCheck = await Business.findOne({ businessId: tenantBId })

    if (tenantACheck.name === 'Tenant A Luxury Boutique UK' && tenantBCheck.name === 'Hacked Tenant Name') {
      console.log(`✓ [PASS] Tenant Isolation Enforced: Spoofed businessId was stripped and overridden by verified JWT!`)
      console.log(`✓ [PASS] Tenant A Name Unchanged: "${tenantACheck.name}"`)
      console.log(`✓ [PASS] Tenant B Modified Only Its Own Record: "${tenantBCheck.name}"`)
    } else {
      throw new Error(`Tenant spoofing guard failed! Tenant A was compromised!`)
    }

    // ---------------------------------------------------------
    // TEST 5: OPERATIONAL SUMMARY COUNTS
    // ---------------------------------------------------------
    console.log('\n--- 5. Testing GET /api/businesses/summary ---')
    const summaryRes = await fetch(`${baseUrl}/summary`, {
      headers: { Authorization: `Bearer ${tokenAdminA}` },
    })
    const summaryData = await summaryRes.json()
    if (summaryRes.status === 200 && summaryData.success && summaryData.data.counts) {
      console.log(`✓ [PASS] Tenant Summary Retrieved: Products: ${summaryData.data.counts.products}, Sales: ${summaryData.data.counts.salesInvoices}, LowStock: ${summaryData.data.counts.lowStockProducts}`)
    } else {
      throw new Error(`Summary fetch failed: ${JSON.stringify(summaryData)}`)
    }

    // ---------------------------------------------------------
    // CLEANUP
    // ---------------------------------------------------------
    console.log('\n--- 6. Cleanup Test Artifacts ---')
    await User.deleteMany({ businessId: { $in: [tenantAId, tenantBId] } })
    await Business.deleteMany({ businessId: { $in: [tenantAId, tenantBId] } })
    console.log('✓ [PASS] Cleaned up test tenant records.')

    console.log('\n' + '='.repeat(80))
    console.log(' ALL BUSINESS PROFILE & TENANT ISOLATION TESTS PASSED (5/5)')
    console.log('='.repeat(80))
  } catch (error) {
    console.error('Business API verification error:', error)
    process.exit(1)
  } finally {
    if (server) server.close()
    await mongoose.connection.close()
    process.exit(0)
  }
}

testBusinessApi()
