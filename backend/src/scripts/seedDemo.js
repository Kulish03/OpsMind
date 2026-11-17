import mongoose from 'mongoose'
import dotenv from 'dotenv'
import bcrypt from 'bcryptjs'
import connectDB from '../config/db.js'
import { User, Business } from '../modules/auth/index.js'
import { generateRecommendations } from '../modules/recommendations/recommendation.service.js'

dotenv.config()

export const seedDemoAccount = async () => {
  console.log('=' .repeat(60))
  console.log(' OpsMind Demo Account & Dataset Seeder')
  console.log('=' .repeat(60))

  await connectDB()

  const businessId = 'default_sme_retail'

  // 1. Ensure Demo Business Profile
  const business = await Business.findOneAndUpdate(
    { businessId },
    {
      businessId,
      name: 'OpsMind SME Retail Ltd',
      businessType: 'retail',
      currency: 'GBP',
      address: '124 High Street, Manchester, UK',
      phone: '+44 161 949 0123',
    },
    { upsert: true, new: true }
  )
  console.log(`[OK] Demo Business verified: ${business.name} (${business.businessId})`)

  // 2. Demo Admin User Credentials
  const salt = await bcrypt.genSalt(10)
  const hashedPassword = await bcrypt.hash('Password123!', salt)

  const demoAdmin = await User.findOneAndUpdate(
    { email: 'demo@opsmind.io' },
    {
      name: 'Demo Operations Director',
      email: 'demo@opsmind.io',
      password: hashedPassword,
      role: 'admin',
      businessId,
    },
    { upsert: true, new: true }
  )
  console.log(`[OK] Demo Admin Account: ${demoAdmin.email} (Password: Password123!)`)

  // 3. Demo Staff User Credentials
  const demoStaff = await User.findOneAndUpdate(
    { email: 'staff@opsmind.io' },
    {
      name: 'Demo Warehouse Staff',
      email: 'staff@opsmind.io',
      password: hashedPassword,
      role: 'staff',
      businessId,
    },
    { upsert: true, new: true }
  )
  console.log(`[OK] Demo Staff Account: ${demoStaff.email} (Password: Password123!)`)

  // 4. Generate Initial Actionable Recommendations
  try {
    const recs = await generateRecommendations(businessId)
    console.log(`[OK] Actionable recommendations initialized: ${recs.length} items ready`)
  } catch (err) {
    console.warn('[Notice] Automated recommendation generation warning:', err.message)
  }

  console.log('=' .repeat(60))
  console.log(' DEMO CREDENTIALS:')
  console.log('   URL:      http://localhost:5173 (or deployed domain)')
  console.log('   Admin:    demo@opsmind.io / Password123!')
  console.log('   Staff:    staff@opsmind.io / Password123!')
  console.log('   Tenant:   default_sme_retail (OpsMind SME Retail Ltd)')
  console.log('=' .repeat(60))

  return { demoAdmin, demoStaff, business }
}

// If invoked directly from CLI
if (process.argv[1]?.endsWith('seedDemo.js')) {
  seedDemoAccount()
    .then(() => {
      console.log('Demo seed completed successfully.')
      process.exit(0)
    })
    .catch((err) => {
      console.error('Demo seed error:', err)
      process.exit(1)
    })
}
