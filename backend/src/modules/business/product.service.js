import mongoose from 'mongoose'
import { Product } from './product.model.js'
import { Sale } from './sale.model.js'

/**
 * Escapes regex special characters to prevent ReDoS / syntax errors
 */
const escapeRegex = (string) => {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * List products for a specific business tenant with filtering, search, sorting and pagination
 */
export const listProducts = async (businessId, query = {}) => {
  const page = Math.max(1, parseInt(query.page, 10) || 1)
  const limit = Math.min(100, Math.max(1, parseInt(query.limit, 10) || 20))
  const skip = (page - 1) * limit

  const filter = { businessId }

  // Search filter across SKU, Name, and Category
  if (query.search && query.search.trim()) {
    const escaped = escapeRegex(query.search.trim())
    const searchRegex = new RegExp(escaped, 'i')
    filter.$or = [
      { sku: searchRegex },
      { name: searchRegex },
      { category: searchRegex },
    ]
  }

  // Exact Category filter
  if (query.category && query.category.trim()) {
    filter.category = query.category.trim()
  }

  // Active status filter
  if (query.isActive !== undefined) {
    filter.isActive = query.isActive === 'true' || query.isActive === '1' || query.isActive === true
  }

  // Low stock filter: currentStock <= reorderThreshold
  if (query.lowStock === 'true' || query.lowStock === '1' || query.lowStock === true) {
    filter.$expr = { $lte: ['$currentStock', '$reorderThreshold'] }
  }

  // Sorting
  const sortBy = query.sortBy || 'createdAt'
  const sortOrder = query.sortOrder === 'asc' ? 1 : -1
  const sort = { [sortBy]: sortOrder }

  const [products, total] = await Promise.all([
    Product.find(filter).sort(sort).skip(skip).limit(limit).lean(),
    Product.countDocuments(filter),
  ])

  const totalPages = Math.ceil(total / limit) || 1

  return {
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
 * Fetch a single product by ID scoped strictly to business tenant
 */
export const getProductById = async (businessId, productId) => {
  if (!mongoose.Types.ObjectId.isValid(productId)) {
    const error = new Error(`Invalid product ID: ${productId}`)
    error.statusCode = 400
    throw error
  }

  const product = await Product.findOne({ _id: productId, businessId })
  if (!product) {
    const error = new Error(`Product not found with ID: ${productId}`)
    error.statusCode = 404
    throw error
  }

  return product
}

/**
 * Fetch a single product by SKU scoped strictly to business tenant
 */
export const getProductBySku = async (businessId, sku) => {
  const formattedSku = sku.trim().toUpperCase()
  const product = await Product.findOne({ businessId, sku: formattedSku })

  if (!product) {
    const error = new Error(`Product not found with SKU: ${formattedSku}`)
    error.statusCode = 404
    throw error
  }

  return product
}

/**
 * Create a new product for the authenticated business tenant
 */
export const createProduct = async (businessId, productData) => {
  const formattedSku = productData.sku.trim().toUpperCase()

  // Prevent duplicate SKU within this tenant
  const existingProduct = await Product.findOne({ businessId, sku: formattedSku })
  if (existingProduct) {
    const error = new Error(`Product with SKU '${formattedSku}' already exists in your inventory.`)
    error.statusCode = 409
    throw error
  }

  const product = new Product({
    ...productData,
    sku: formattedSku,
    businessId, // Invariant: always assign authoritative businessId
    source: productData.source || 'user_created',
  })

  await product.save()
  return product
}

/**
 * Update an existing product scoped strictly to business tenant
 */
export const updateProduct = async (businessId, productId, updateData) => {
  if (!mongoose.Types.ObjectId.isValid(productId)) {
    const error = new Error(`Invalid product ID: ${productId}`)
    error.statusCode = 400
    throw error
  }

  const product = await Product.findOne({ _id: productId, businessId })
  if (!product) {
    const error = new Error(`Product not found with ID: ${productId}`)
    error.statusCode = 404
    throw error
  }

  // Handle SKU update safely
  if (updateData.sku) {
    const newSku = updateData.sku.trim().toUpperCase()
    if (newSku !== product.sku) {
      const duplicate = await Product.findOne({
        businessId,
        sku: newSku,
        _id: { $ne: productId },
      })
      if (duplicate) {
        const error = new Error(`Another product with SKU '${newSku}' already exists in your inventory.`)
        error.statusCode = 409
        throw error
      }
      product.sku = newSku
    }
  }

  // Strip immutable / security-sensitive keys
  delete updateData.businessId
  delete updateData._id
  delete updateData.sku

  Object.assign(product, updateData)
  await product.save()

  return product
}

/**
 * Delete or deactivate a product scoped strictly to business tenant
 */
export const deleteProduct = async (businessId, productId, permanent = false) => {
  if (!mongoose.Types.ObjectId.isValid(productId)) {
    const error = new Error(`Invalid product ID: ${productId}`)
    error.statusCode = 400
    throw error
  }

  const product = await Product.findOne({ _id: productId, businessId })
  if (!product) {
    const error = new Error(`Product not found with ID: ${productId}`)
    error.statusCode = 404
    throw error
  }

  if (permanent) {
    // Check if any sales records depend on this SKU
    const salesCount = await Sale.countDocuments({
      businessId,
      'items.productSku': product.sku,
    })

    if (salesCount > 0) {
      const error = new Error(
        `Cannot permanently delete product '${product.sku}' because it is referenced in ${salesCount} sales records. Deactivate the product instead.`
      )
      error.statusCode = 400
      throw error
    }

    await Product.deleteOne({ _id: productId, businessId })
    return {
      productId,
      sku: product.sku,
      permanent: true,
      message: `Product '${product.sku}' has been permanently deleted.`,
    }
  }

  // Soft delete (deactivate)
  product.isActive = false
  await product.save()

  return {
    productId,
    sku: product.sku,
    permanent: false,
    message: `Product '${product.sku}' has been deactivated.`,
    product,
  }
}

/**
 * Retrieve low stock products (currentStock <= reorderThreshold)
 */
export const getLowStockProducts = async (businessId, query = {}) => {
  const limit = Math.min(100, Math.max(1, parseInt(query.limit, 10) || 50))

  const filter = {
    businessId,
    isActive: true,
    $expr: { $lte: ['$currentStock', '$reorderThreshold'] },
  }

  const [products, total] = await Promise.all([
    Product.find(filter).sort({ currentStock: 1 }).limit(limit).lean(),
    Product.countDocuments(filter),
  ])

  return {
    products,
    total,
    count: products.length,
  }
}

/**
 * Get distinct categories available in this tenant's active catalog
 */
export const getCategories = async (businessId) => {
  const categories = await Product.distinct('category', { businessId, isActive: true })
  return categories.sort()
}
