import mongoose from 'mongoose'
import { Supplier } from './supplier.model.js'
import { Product } from './product.model.js'

/**
 * Escapes regex special characters to prevent ReDoS / syntax errors
 */
const escapeRegex = (string) => {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * List suppliers for a specific business tenant with filtering, search, sorting and pagination
 */
export const listSuppliers = async (businessId, query = {}) => {
  const page = Math.max(1, parseInt(query.page, 10) || 1)
  const limit = Math.min(100, Math.max(1, parseInt(query.limit, 10) || 20))
  const skip = (page - 1) * limit

  const filter = { businessId }

  // Search filter across supplierId, name, contactPerson, category, and city
  if (query.search && query.search.trim()) {
    const escaped = escapeRegex(query.search.trim())
    const searchRegex = new RegExp(escaped, 'i')
    filter.$or = [
      { supplierId: searchRegex },
      { name: searchRegex },
      { contactPerson: searchRegex },
      { category: searchRegex },
      { city: searchRegex },
    ]
  }

  // Category filter
  if (query.category && query.category.trim()) {
    filter.category = query.category.trim()
  }

  // Country filter
  if (query.country && query.country.trim()) {
    filter.country = query.country.trim()
  }

  // Sorting
  const sortBy = query.sortBy || 'createdAt'
  const sortOrder = query.sortOrder === 'asc' ? 1 : -1
  const sort = { [sortBy]: sortOrder }

  const [suppliers, total] = await Promise.all([
    Supplier.find(filter).sort(sort).skip(skip).limit(limit).lean(),
    Supplier.countDocuments(filter),
  ])

  // Count active products supplied by each supplier
  const supplierIds = suppliers.map((s) => s.supplierId)
  const productCounts = await Product.aggregate([
    { $match: { businessId, supplierId: { $in: supplierIds } } },
    { $group: { _id: '$supplierId', count: { $sum: 1 } } },
  ])

  const countMap = new Map(productCounts.map((pc) => [pc._id, pc.count]))
  const enrichedSuppliers = suppliers.map((s) => ({
    ...s,
    linkedProductsCount: countMap.get(s.supplierId) || 0,
  }))

  const totalPages = Math.ceil(total / limit) || 1

  return {
    suppliers: enrichedSuppliers,
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
 * Fetch a single supplier by MongoDB ID or Supplier ID
 */
export const getSupplierById = async (businessId, identifier) => {
  let supplier = null

  if (mongoose.Types.ObjectId.isValid(identifier)) {
    supplier = await Supplier.findOne({ _id: identifier, businessId })
  }
  if (!supplier) {
    supplier = await Supplier.findOne({ supplierId: identifier.trim(), businessId })
  }

  if (!supplier) {
    const error = new Error(`Supplier not found with identifier: ${identifier}`)
    error.statusCode = 404
    throw error
  }

  const linkedProductsCount = await Product.countDocuments({
    businessId,
    supplierId: supplier.supplierId,
  })

  return {
    ...supplier.toObject(),
    linkedProductsCount,
  }
}

/**
 * Fetch catalog products supplied by a specific vendor
 */
export const getSupplierProducts = async (businessId, identifier, query = {}) => {
  const supplier = await getSupplierById(businessId, identifier)

  const page = Math.max(1, parseInt(query.page, 10) || 1)
  const limit = Math.min(100, Math.max(1, parseInt(query.limit, 10) || 20))
  const skip = (page - 1) * limit

  const filter = {
    businessId,
    supplierId: supplier.supplierId,
  }

  const [products, total] = await Promise.all([
    Product.find(filter).sort({ currentStock: 1 }).skip(skip).limit(limit).lean(),
    Product.countDocuments(filter),
  ])

  const totalPages = Math.ceil(total / limit) || 1

  return {
    supplier: {
      supplierId: supplier.supplierId,
      name: supplier.name,
      leadTimeDays: supplier.leadTimeDays,
      minimumOrderQty: supplier.minimumOrderQty,
    },
    products,
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
 * Create a new supplier record
 */
export const createSupplier = async (businessId, supplierData) => {
  const supplierId =
    supplierData.supplierId?.trim() ||
    `SUP-${Date.now()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`

  // Check if supplier ID exists in this tenant
  const existing = await Supplier.findOne({ businessId, supplierId })
  if (existing) {
    const error = new Error(`Supplier with ID '${supplierId}' already exists in your business.`)
    error.statusCode = 409
    throw error
  }

  const supplier = new Supplier({
    ...supplierData,
    supplierId,
    businessId, // Invariant: strict tenant scoping
    source: supplierData.source || 'user_created',
  })

  await supplier.save()
  return supplier
}

/**
 * Update an existing supplier record
 */
export const updateSupplier = async (businessId, identifier, updateData) => {
  let supplier = null
  if (mongoose.Types.ObjectId.isValid(identifier)) {
    supplier = await Supplier.findOne({ _id: identifier, businessId })
  }
  if (!supplier) {
    supplier = await Supplier.findOne({ supplierId: identifier.trim(), businessId })
  }

  if (!supplier) {
    const error = new Error(`Supplier not found with identifier: ${identifier}`)
    error.statusCode = 404
    throw error
  }

  // Prevent mutation of immutable keys
  delete updateData.businessId
  delete updateData._id
  delete updateData.supplierId

  Object.assign(supplier, updateData)
  await supplier.save()

  return supplier
}

/**
 * Delete a supplier record
 * Blocked if any products in the catalog are currently linked to this supplier.
 */
export const deleteSupplier = async (businessId, identifier) => {
  let supplier = null
  if (mongoose.Types.ObjectId.isValid(identifier)) {
    supplier = await Supplier.findOne({ _id: identifier, businessId })
  }
  if (!supplier) {
    supplier = await Supplier.findOne({ supplierId: identifier.trim(), businessId })
  }

  if (!supplier) {
    const error = new Error(`Supplier not found with identifier: ${identifier}`)
    error.statusCode = 404
    throw error
  }

  // Check if products reference this supplier
  const linkedProductsCount = await Product.countDocuments({
    businessId,
    supplierId: supplier.supplierId,
  })

  if (linkedProductsCount > 0) {
    const error = new Error(
      `Cannot delete supplier '${supplier.name}' (${supplier.supplierId}) because ${linkedProductsCount} product(s) are currently linked to this vendor. Please reassign or unlink the products first.`
    )
    error.statusCode = 400
    throw error
  }

  await Supplier.deleteOne({ _id: supplier._id, businessId })

  return {
    supplierId: supplier.supplierId,
    name: supplier.name,
    deleted: true,
    message: `Supplier '${supplier.name}' deleted successfully.`,
  }
}

/**
 * Supplier directory operational summary
 */
export const getSupplierSummary = async (businessId) => {
  const [totalSuppliers, leadTimeAgg, categoryAgg, coveredProductsCount] = await Promise.all([
    Supplier.countDocuments({ businessId }),
    Supplier.aggregate([
      { $match: { businessId } },
      {
        $group: {
          _id: null,
          avgLeadTime: { $avg: '$leadTimeDays' },
          minLeadTime: { $min: '$leadTimeDays' },
          maxLeadTime: { $max: '$leadTimeDays' },
        },
      },
    ]),
    Supplier.aggregate([
      { $match: { businessId } },
      {
        $group: {
          _id: '$category',
          count: { $sum: 1 },
        },
      },
    ]),
    Product.countDocuments({ businessId, supplierId: { $ne: null } }),
  ])

  const leadTimes = leadTimeAgg[0] || { avgLeadTime: 0, minLeadTime: 0, maxLeadTime: 0 }

  const categoryBreakdown = {}
  for (const cat of categoryAgg) {
    if (cat._id) {
      categoryBreakdown[cat._id] = cat.count
    }
  }

  return {
    businessId,
    totalSuppliers,
    averageLeadTimeDays: Number(leadTimes.avgLeadTime ? leadTimes.avgLeadTime.toFixed(1) : 0),
    minLeadTimeDays: leadTimes.minLeadTime || 0,
    maxLeadTimeDays: leadTimes.maxLeadTime || 0,
    categoryBreakdown,
    productsCoveredBySuppliers: coveredProductsCount,
  }
}
