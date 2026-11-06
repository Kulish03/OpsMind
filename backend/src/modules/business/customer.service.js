import mongoose from 'mongoose'
import { Customer } from './customer.model.js'
import { Sale } from './sale.model.js'

/**
 * Escapes regex special characters to prevent ReDoS / syntax errors
 */
const escapeRegex = (string) => {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * List customers for a specific business tenant with filtering, search, sorting and pagination
 */
export const listCustomers = async (businessId, query = {}) => {
  const page = Math.max(1, parseInt(query.page, 10) || 1)
  const limit = Math.min(100, Math.max(1, parseInt(query.limit, 10) || 20))
  const skip = (page - 1) * limit

  const filter = { businessId }

  // Search filter across customerId, name, and country
  if (query.search && query.search.trim()) {
    const escaped = escapeRegex(query.search.trim())
    const searchRegex = new RegExp(escaped, 'i')
    filter.$or = [
      { customerId: searchRegex },
      { name: searchRegex },
      { country: searchRegex },
    ]
  }

  // Country filter
  if (query.country && query.country.trim()) {
    filter.country = query.country.trim()
  }

  // RFM Retention Status filter
  if (query.retentionStatus) {
    filter['rfm.retentionStatus'] = query.retentionStatus
  }

  // Sorting
  const sortBy = query.sortBy || 'totalSpend'
  const sortOrder = query.sortOrder === 'asc' ? 1 : -1
  const sort = { [sortBy]: sortOrder }

  const [customers, total] = await Promise.all([
    Customer.find(filter).sort(sort).skip(skip).limit(limit).lean(),
    Customer.countDocuments(filter),
  ])

  const totalPages = Math.ceil(total / limit) || 1

  return {
    customers,
    pagination: {
      total,
      page,
      limit,
      totalPages,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1,
    },
  }
}

/**
 * Fetch a single customer by MongoDB ID or Customer ID
 */
export const getCustomerById = async (businessId, identifier) => {
  let customer = null

  if (mongoose.Types.ObjectId.isValid(identifier)) {
    customer = await Customer.findOne({ _id: identifier, businessId })
  }
  if (!customer) {
    customer = await Customer.findOne({ customerId: identifier.trim(), businessId })
  }

  if (!customer) {
    const error = new Error(`Customer not found with identifier: ${identifier}`)
    error.statusCode = 404
    throw error
  }

  return customer
}

/**
 * Fetch a customer's order history from the sales ledger
 */
export const getCustomerOrders = async (businessId, identifier, query = {}) => {
  const customer = await getCustomerById(businessId, identifier)

  const page = Math.max(1, parseInt(query.page, 10) || 1)
  const limit = Math.min(100, Math.max(1, parseInt(query.limit, 10) || 20))
  const skip = (page - 1) * limit

  const filter = {
    businessId,
    customerReference: customer.customerId,
  }

  const [orders, total] = await Promise.all([
    Sale.find(filter).sort({ transactionDate: -1 }).skip(skip).limit(limit).lean(),
    Sale.countDocuments(filter),
  ])

  const totalPages = Math.ceil(total / limit) || 1

  return {
    customer: {
      customerId: customer.customerId,
      name: customer.name,
      country: customer.country,
      totalOrders: customer.totalOrders,
      totalSpend: customer.totalSpend,
      rfm: customer.rfm,
    },
    orders,
    pagination: {
      total,
      page,
      limit,
      totalPages,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1,
    },
  }
}

/**
 * Create a new customer profile
 */
export const createCustomer = async (businessId, customerData) => {
  const customerId =
    customerData.customerId?.trim() ||
    `CUST-${Date.now()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`

  // Check if customer ID already exists within this business tenant
  const existingCustomer = await Customer.findOne({ businessId, customerId })
  if (existingCustomer) {
    const error = new Error(`Customer with ID '${customerId}' already exists in your business.`)
    error.statusCode = 409
    throw error
  }

  const name = customerData.name?.trim() || `Customer ${customerId}`
  const country = customerData.country?.trim() || 'United Kingdom'

  const customer = new Customer({
    businessId, // Invariant: authoritative tenant context
    customerId,
    name,
    country,
    source: customerData.source || 'user_created',
  })

  await customer.save()
  return customer
}

/**
 * Update an existing customer's information
 */
export const updateCustomer = async (businessId, identifier, updateData) => {
  const customer = await getCustomerById(businessId, identifier)

  // Disallow mutation of immutable or financial audit fields
  delete updateData.businessId
  delete updateData._id
  delete updateData.customerId
  delete updateData.totalSpend
  delete updateData.totalOrders
  delete updateData.totalUnitsPurchased

  if (updateData.name) {
    customer.name = updateData.name.trim()
  }
  if (updateData.country) {
    customer.country = updateData.country.trim()
  }
  if (updateData.retentionStatus) {
    customer.rfm.retentionStatus = updateData.retentionStatus
  }

  await customer.save()
  return customer
}

/**
 * Delete a customer record (only allowed if no sales invoices reference this customer)
 */
export const deleteCustomer = async (businessId, identifier) => {
  const customer = await getCustomerById(businessId, identifier)

  // Verify historical transaction integrity
  const salesCount = await Sale.countDocuments({
    businessId,
    customerReference: customer.customerId,
  })

  if (salesCount > 0) {
    const error = new Error(
      `Cannot delete customer '${customer.customerId}' because they have ${salesCount} associated sales invoices. Consider updating retention status to DORMANT or CHURNED instead.`
    )
    error.statusCode = 400
    throw error
  }

  await Customer.deleteOne({ _id: customer._id, businessId })

  return {
    customerId: customer.customerId,
    deleted: true,
    message: `Customer record '${customer.customerId}' deleted successfully.`,
  }
}

/**
 * Comprehensive customer cohort & retention segmentation summary
 */
export const getCustomerSummary = async (businessId) => {
  const [totalCustomers, rfmAgg, topCustomers] = await Promise.all([
    Customer.countDocuments({ businessId }),
    Customer.aggregate([
      { $match: { businessId } },
      {
        $group: {
          _id: '$rfm.retentionStatus',
          count: { $sum: 1 },
          totalSpend: { $sum: '$totalSpend' },
        },
      },
    ]),
    Customer.find({ businessId })
      .sort({ totalSpend: -1 })
      .limit(5)
      .select('customerId name country totalSpend totalOrders rfm')
      .lean(),
  ])

  const statusDistribution = {
    ACTIVE: 0,
    DORMANT: 0,
    AT_RISK: 0,
    CHURNED: 0,
  }

  let totalCustomerSpend = 0
  for (const group of rfmAgg) {
    if (group._id && statusDistribution[group._id] !== undefined) {
      statusDistribution[group._id] = group.count
    }
    totalCustomerSpend += group.totalSpend || 0
  }

  const averageSpendPerCustomer =
    totalCustomers > 0 ? Number((totalCustomerSpend / totalCustomers).toFixed(2)) : 0

  return {
    businessId,
    totalCustomers,
    totalCustomerSpend: Number(totalCustomerSpend.toFixed(2)),
    averageSpendPerCustomer,
    retentionSegments: statusDistribution,
    topCustomers,
  }
}
