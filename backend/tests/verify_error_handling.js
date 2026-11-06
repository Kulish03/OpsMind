import dotenv from 'dotenv'
dotenv.config()

import mongoose from 'mongoose'
import connectDB from '../src/config/db.js'
import app from '../src/app.js'
import { User, Business } from '../src/modules/auth/index.js'
import { generateToken } from '../src/modules/auth/auth.service.js'

const PORT = 5074

const testErrorHandling = async () => {
  console.log('='.repeat(80))
  console.log(' STEP 14: CENTRALIZED ERROR HANDLING & VALIDATION VERIFICATION')
  console.log('='.repeat(80))

  let server
  const tenantId = `tenant_err_${Date.now()}`

  try {
    await connectDB()
    console.log('[OK] Connected to MongoDB.')

    server = app.listen(PORT, () => {
      console.log(`[OK] Test server listening on http://127.0.0.1:${PORT}\n`)
    })

    const baseUrl = `http://127.0.0.1:${PORT}/api`

    // Seed test admin
    await Business.create({
      businessId: tenantId,
      name: 'Error Handling SME',
    })
    const admin = await User.create({
      businessId: tenantId,
      name: 'Admin ErrorTester',
      email: `admin_${Date.now()}@error.com`,
      password: 'Password123!',
      role: 'admin',
    })
    const token = generateToken(admin)

    // 1. Test 404 Route Not Found
    console.log('--- 1. Testing Route Not Found (404) ---')
    const notFoundRes = await fetch(`${baseUrl}/non-existent-route-xyz`)
    const notFoundData = await notFoundRes.json()
    if (notFoundRes.status === 404 && !notFoundData.success && notFoundData.message.includes('Route not found')) {
      console.log(`[PASS] 404 caught cleanly: "${notFoundData.message}"`)
    } else {
      throw new Error(`404 route handling failed: ${JSON.stringify(notFoundData)}`)
    }

    // 2. Test Zod Validation Error formatting
    console.log('\n--- 2. Testing Zod Request Body Validation (400) ---')
    const badBodyRes = await fetch(`${baseUrl}/products`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        // Missing sku, name, sellingPrice
        category: 'Test',
      }),
    })
    const badBodyData = await badBodyRes.json()
    if (badBodyRes.status === 400 && Array.isArray(badBodyData.errors) && badBodyData.errors.length >= 3) {
      console.log(`[PASS] Zod validation caught missing fields: ${badBodyData.errors.map((e) => e.field).join(', ')}`)
    } else {
      throw new Error(`Zod validation handling failed: ${JSON.stringify(badBodyData)}`)
    }

    // 3. Test Invalid ObjectId format (400)
    console.log('\n--- 3. Testing Mongoose Bad ObjectId CastError (400) ---')
    const badIdRes = await fetch(`${baseUrl}/products/invalid-non-hex-id`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    const badIdData = await badIdRes.json()
    if (badIdRes.status === 400 && !badIdData.success && badIdData.message.includes('Invalid product ID')) {
      console.log(`[PASS] Bad ID format handled gracefully: "${badIdData.message}"`)
    } else {
      throw new Error(`Bad ID handling failed: ${JSON.stringify(badIdData)}`)
    }

    // 4. Test Malformed JWT (401)
    console.log('\n--- 4. Testing Invalid Authentication Token (401) ---')
    const badTokenRes = await fetch(`${baseUrl}/products`, {
      headers: { Authorization: `Bearer invalid.jwt.token.here` },
    })
    const badTokenData = await badTokenRes.json()
    if (badTokenRes.status === 401 && !badTokenData.success) {
      console.log(`[PASS] Invalid token caught cleanly with HTTP 401: "${badTokenData.message}"`)
    } else {
      throw new Error(`Bad token handling failed: ${JSON.stringify(badTokenData)}`)
    }

    // Cleanup
    await User.deleteMany({ businessId: tenantId })
    await Business.deleteMany({ businessId: tenantId })
    console.log('\n[PASS] Cleaned up test records.')

    console.log('\n' + '='.repeat(80))
    console.log(' ALL CENTRALIZED ERROR HANDLING TESTS PASSED (4/4)')
    console.log('='.repeat(80))
  } catch (error) {
    console.error('Error handling verification error:', error)
    process.exit(1)
  } finally {
    if (server) server.close()
    await mongoose.connection.close()
    process.exit(0)
  }
}

testErrorHandling()
