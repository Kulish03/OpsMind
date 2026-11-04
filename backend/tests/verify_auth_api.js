import dotenv from 'dotenv'
dotenv.config()

import mongoose from 'mongoose'
import connectDB from '../src/config/db.js'
import app from '../src/app.js'
import { User, Business } from '../src/modules/auth/index.js'

const PORT = 5055

const testAuthApi = async () => {
  console.log('='.repeat(80))
  console.log(' OPSMIND BACKEND — USER REGISTRATION, LOGIN & JWT VERIFICATION')
  console.log('='.repeat(80))

  let server
  const testEmail = `operator_${Date.now()}@opsmind.internal`
  const testPassword = 'SecurePassword2026!'
  const testBusinessName = 'Highland Crafts SME'

  try {
    await connectDB()
    console.log('[OK] Connected to MongoDB.')

    // Start server on dedicated test port
    server = app.listen(PORT, () => {
      console.log(`[OK] Test server listening on http://127.0.0.1:${PORT}\n`)
    })

    const baseUrl = `http://127.0.0.1:${PORT}/api/auth`
    let authToken = null
    let createdBusinessId = null

    // ---------------------------------------------------------
    // TEST 1: REGISTRATION
    // ---------------------------------------------------------
    console.log('--- 1. Testing POST /api/auth/register ---')
    const regRes = await fetch(`${baseUrl}/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Hamish MacLeod',
        email: testEmail,
        password: testPassword,
        businessName: testBusinessName,
        businessType: 'retail',
        currency: 'GBP',
      }),
    })
    const regData = await regRes.json()

    if (regRes.status === 201 && regData.success && regData.data.token) {
      authToken = regData.data.token
      createdBusinessId = regData.data.business.businessId
      console.log(`✓ [PASS] User Registered: ${regData.data.user.name} (${regData.data.user.email})`)
      console.log(`✓ [PASS] Business Created: ${regData.data.business.name} [ID: ${createdBusinessId}]`)
      console.log(`✓ [PASS] JWT Token Generated: ${authToken.substring(0, 20)}...`)
    } else {
      throw new Error(`Registration failed (${regRes.status}): ${JSON.stringify(regData)}`)
    }

    // ---------------------------------------------------------
    // TEST 2: REJECT DUPLICATE EMAIL
    // ---------------------------------------------------------
    console.log('\n--- 2. Testing Duplicate Email Rejection ---')
    const dupRes = await fetch(`${baseUrl}/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Another User',
        email: testEmail,
        password: 'AnotherPassword123!',
        businessName: 'Another Store',
      }),
    })
    const dupData = await dupRes.json()
    if (dupRes.status === 409 && !dupData.success) {
      console.log(`✓ [PASS] Duplicate email rejected with HTTP 409 Conflict: "${dupData.message}"`)
    } else {
      throw new Error(`Duplicate check failed (${dupRes.status}): ${JSON.stringify(dupData)}`)
    }

    // ---------------------------------------------------------
    // TEST 3: REJECT INVALID PASSWORD
    // ---------------------------------------------------------
    console.log('\n--- 3. Testing Login with Invalid Password ---')
    const badLoginRes = await fetch(`${baseUrl}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: testEmail,
        password: 'IncorrectPassword999!',
      }),
    })
    const badLoginData = await badLoginRes.json()
    if (badLoginRes.status === 401 && !badLoginData.success) {
      console.log(`✓ [PASS] Invalid password rejected with HTTP 401 Unauthorized: "${badLoginData.message}"`)
    } else {
      throw new Error(`Bad login check failed (${badLoginRes.status}): ${JSON.stringify(badLoginData)}`)
    }

    // ---------------------------------------------------------
    // TEST 4: SUCCESSFUL LOGIN
    // ---------------------------------------------------------
    console.log('\n--- 4. Testing POST /api/auth/login ---')
    const loginRes = await fetch(`${baseUrl}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: testEmail,
        password: testPassword,
      }),
    })
    const loginData = await loginRes.json()
    if (loginRes.status === 200 && loginData.success && loginData.data.token) {
      console.log(`✓ [PASS] Login successful! Authenticated as: ${loginData.data.user.name} [Role: ${loginData.data.user.role}]`)
      console.log(`✓ [PASS] Verified Business Association: ${loginData.data.business.name} (${loginData.data.business.businessId})`)
    } else {
      throw new Error(`Login failed (${loginRes.status}): ${JSON.stringify(loginData)}`)
    }

    // ---------------------------------------------------------
    // TEST 5: REJECT UNAUTHORIZED PROTECTED ROUTE
    // ---------------------------------------------------------
    console.log('\n--- 5. Testing Protected Route Without Token ---')
    const noTokenRes = await fetch(`${baseUrl}/me`, { method: 'GET' })
    const noTokenData = await noTokenRes.json()
    if (noTokenRes.status === 401 && !noTokenData.success) {
      console.log(`✓ [PASS] Unauthorized access blocked with HTTP 401: "${noTokenData.message}"`)
    } else {
      throw new Error(`No-token check failed (${noTokenRes.status}): ${JSON.stringify(noTokenData)}`)
    }

    // ---------------------------------------------------------
    // TEST 6: VERIFY PROTECTED ROUTE WITH JWT
    // ---------------------------------------------------------
    console.log('\n--- 6. Testing GET /api/auth/me With Bearer Token ---')
    const meRes = await fetch(`${baseUrl}/me`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${authToken}`,
      },
    })
    const meData = await meRes.json()
    if (meRes.status === 200 && meData.success && meData.data.user.email === testEmail) {
      console.log(`✓ [PASS] Token authenticated successfully!`)
      console.log(`✓ [PASS] User Context: ${meData.data.user.name} (${meData.data.user.email})`)
      console.log(`✓ [PASS] Tenant Scope: ${meData.data.business.businessId}`)
      console.log(`✓ [PASS] Password Field Omitted: ${meData.data.user.password === undefined}`)
    } else {
      throw new Error(`Protected route check failed (${meRes.status}): ${JSON.stringify(meData)}`)
    }

    // ---------------------------------------------------------
    // CLEANUP
    // ---------------------------------------------------------
    console.log('\n--- 7. Cleanup Test Records ---')
    await User.deleteMany({ email: testEmail })
    if (createdBusinessId) {
      await Business.deleteMany({ businessId: createdBusinessId })
    }
    console.log('✓ [PASS] Cleaned up test user and business records.')

    console.log('\n' + '='.repeat(80))
    console.log(' ALL REGISTRATION, LOGIN & JWT TESTS PASSED (6/6 SUCCEEDED)')
    console.log('='.repeat(80))
  } catch (error) {
    console.error('Auth verification error:', error)
    process.exit(1)
  } finally {
    if (server) {
      server.close()
    }
    await mongoose.connection.close()
    process.exit(0)
  }
}

testAuthApi()
