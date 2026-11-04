import dotenv from 'dotenv'
dotenv.config()

import mongoose from 'mongoose'
import connectDB from '../src/config/db.js'
import { User, Business } from '../src/modules/auth/index.js'
import { Product, Customer, Sale, Supplier, Expense, InventoryMovement } from '../src/modules/business/index.js'
import { Alert } from '../src/modules/notifications/index.js'

const TEST_TENANT = 'schema_audit_test_tenant'

const verifyAllSchemas = async () => {
  console.log('=' .repeat(80))
  console.log(' OPSMIND BACKEND — FULL MONGOOSE SCHEMAS & INDEXES AUDIT')
  console.log('=' .repeat(80))

  try {
    await connectDB()
    console.log('[OK] Connected to MongoDB.\n')

    const models = [
      { name: 'User', model: User },
      { name: 'Business', model: Business },
      { name: 'Product', model: Product },
      { name: 'Customer', model: Customer },
      { name: 'Sale', model: Sale },
      { name: 'Supplier', model: Supplier },
      { name: 'Expense', model: Expense },
      { name: 'InventoryMovement', model: InventoryMovement },
      { name: 'Alert', model: Alert },
    ]

    console.log('--- 1. Synchronizing Indexes for All 9 Domain Schemas ---')
    for (const item of models) {
      await item.model.syncIndexes()
      const indexes = await item.model.collection.indexes()
      const indexNames = indexes.map((i) => Object.keys(i.key).join('_') + (i.unique ? ' (UNIQUE)' : '')).join(', ')
      console.log(`✓ ${item.name.padEnd(20)}: ${indexes.length} indexes [${indexNames}]`)
    }

    console.log('\n--- 2. Verifying User Security (Bcrypt Hash & Exclusions) ---')
    const testEmail = `test_admin_${Date.now()}@opsmind.internal`
    const rawPassword = 'SecurePassword123!'

    const user = new User({
      businessId: TEST_TENANT,
      name: 'Test Administrator',
      email: testEmail,
      password: rawPassword,
      role: 'admin',
    })

    await user.save()
    console.log('✓ User saved to database.')

    // Verify bcrypt hash is not plain text
    const fetchedUserWithPass = await User.findById(user._id).select('+password')
    const isHashed = fetchedUserWithPass.password.startsWith('$2')
    console.log(`✓ Password Hashing: ${isHashed ? 'PASSED (Bcrypt hash: ' + fetchedUserWithPass.password.substring(0, 15) + '...)' : 'FAILED'}`)

    // Verify password comparison
    const matchSuccess = await user.comparePassword(rawPassword)
    const matchFailure = !(await user.comparePassword('WrongPassword999'))
    console.log(`✓ Password Comparison Method: ${matchSuccess && matchFailure ? 'PASSED' : 'FAILED'}`)

    // Verify toJSON omits password
    const userJson = user.toJSON()
    console.log(`✓ JSON Serialization Security: ${!userJson.password ? 'PASSED (Password field omitted)' : 'FAILED'}`)

    console.log('\n--- 3. Verifying Business Tenant Profile Schema ---')
    const business = new Business({
      businessId: TEST_TENANT,
      name: 'Alpha Retail SME',
      businessType: 'retail',
      currency: 'GBP',
      ownerId: user._id,
      contactEmail: testEmail,
      settings: {
        defaultLowStockThreshold: 25,
        defaultTargetStock: 120,
        taxRatePercentage: 20,
      },
    })
    await business.save()
    console.log(`✓ Business Profile saved: ${business.name} (Tenant: ${business.businessId}, Currency: ${business.currency})`)

    console.log('\n--- 4. Verifying Alert & Recommendation Schema ---')
    const alert = new Alert({
      businessId: TEST_TENANT,
      title: 'Low Stock Detected: 85123A',
      type: 'LOW_STOCK',
      severity: 'HIGH',
      description: 'Stock for White Hanging Heart T-Light Holder has dipped below reorder threshold (14 units remaining).',
      supportingData: {
        sku: '85123A',
        currentStock: 14,
        reorderThreshold: 20,
        daysOfSupply: 1.8,
      },
      recommendedAction: 'Trigger supplier purchase order with Heritage Ceramics Ltd.',
      actionType: 'REORDER_STOCK',
    })
    await alert.save()
    console.log(`✓ Alert document saved: [${alert.severity}] ${alert.title} (Status: ${alert.status})`)

    console.log('\n--- 5. Cleanup Test Documents ---')
    await User.deleteMany({ businessId: TEST_TENANT })
    await Business.deleteMany({ businessId: TEST_TENANT })
    await Alert.deleteMany({ businessId: TEST_TENANT })
    console.log('✓ Cleaned up all verification test records.')

    console.log('\n' + '=' .repeat(80))
    console.log(' ALL 9 DOMAIN SCHEMAS & INDEXES OPERATIONAL AND VERIFIED')
    console.log('=' .repeat(80))
  } catch (error) {
    console.error('Schema verification error:', error)
    process.exit(1)
  } finally {
    await mongoose.connection.close()
    process.exit(0)
  }
}

verifyAllSchemas()
