import { Business } from '../auth/business.model.js'
import { Product } from './product.model.js'
import { Customer } from './customer.model.js'
import { Sale } from './sale.model.js'
import { Alert } from '../notifications/alert.model.js'

/**
 * Fetch authenticated business profile
 */
export const getBusinessProfile = async (businessId) => {
  const business = await Business.findOne({ businessId })
  if (!business) {
    const error = new Error('Business profile not found.')
    error.statusCode = 404
    throw error
  }
  return business
}

/**
 * Update authenticated business profile and configuration settings
 */
export const updateBusinessProfile = async (businessId, updateData) => {
  // Prevent mutation of immutable identifiers
  delete updateData.businessId
  delete updateData._id
  delete updateData.ownerId

  const business = await Business.findOneAndUpdate(
    { businessId },
    { $set: updateData },
    { new: true, runValidators: true }
  )

  if (!business) {
    const error = new Error('Business profile not found.')
    error.statusCode = 404
    throw error
  }

  return business
}

/**
 * Fetch quick tenant-isolated operational stats
 */
export const getBusinessSummary = async (businessId) => {
  const business = await getBusinessProfile(businessId)
  const lowStockThreshold = business.settings?.defaultLowStockThreshold || 20

  const [productsCount, lowStockCount, customersCount, salesCount, openAlertsCount] = await Promise.all([
    Product.countDocuments({ businessId, isActive: true }),
    Product.countDocuments({ businessId, isActive: true, currentStock: { $lt: lowStockThreshold } }),
    Customer.countDocuments({ businessId }),
    Sale.countDocuments({ businessId }),
    Alert.countDocuments({ businessId, status: 'OPEN' }),
  ])

  return {
    businessId,
    businessName: business.name,
    businessType: business.businessType,
    currency: business.currency,
    demoDataLoaded: business.demoDataLoaded,
    counts: {
      products: productsCount,
      lowStockProducts: lowStockCount,
      customers: customersCount,
      salesInvoices: salesCount,
      openAlerts: openAlertsCount,
    },
  }
}

/**
 * Seed initial demo retail dataset into a new tenant
 */
export const seedTenantDemoData = async (targetBusinessId) => {
  const business = await getBusinessProfile(targetBusinessId)

  // Don't duplicate if already loaded
  if (business.demoDataLoaded) {
    return { message: 'Demo data is already loaded for this business.', alreadyLoaded: true }
  }

  const SOURCE_TENANT = 'default_sme_retail'

  // Clone 50 representative products
  const sampleProducts = await Product.find({ businessId: SOURCE_TENANT }).limit(50).lean()
  if (sampleProducts.length > 0) {
    const clonedProducts = sampleProducts.map((p) => {
      const clone = { ...p, businessId: targetBusinessId, source: 'synthetic' }
      delete clone._id
      delete clone.createdAt
      delete clone.updatedAt
      return clone
    })
    await Product.insertMany(clonedProducts)
  }

  // Clone 25 representative customers
  const sampleCustomers = await Customer.find({ businessId: SOURCE_TENANT }).limit(25).lean()
  if (sampleCustomers.length > 0) {
    const clonedCustomers = sampleCustomers.map((c) => {
      const clone = { ...c, businessId: targetBusinessId, source: 'synthetic' }
      delete clone._id
      delete clone.createdAt
      delete clone.updatedAt
      return clone
    })
    await Customer.insertMany(clonedCustomers)
  }

  // Clone 100 representative sales invoices
  const sampleSales = await Sale.find({ businessId: SOURCE_TENANT }).limit(100).lean()
  if (sampleSales.length > 0) {
    const clonedSales = sampleSales.map((s) => {
      const clone = { ...s, businessId: targetBusinessId, source: 'synthetic' }
      delete clone._id
      delete clone.createdAt
      delete clone.updatedAt
      return clone
    })
    await Sale.insertMany(clonedSales)
  }

  // Mark business as demo loaded
  business.demoDataLoaded = true
  await business.save()

  return {
    message: 'Demo retail dataset successfully initialized for business.',
    seeded: {
      products: sampleProducts.length,
      customers: sampleCustomers.length,
      sales: sampleSales.length,
    },
  }
}
