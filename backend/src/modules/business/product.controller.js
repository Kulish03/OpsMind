import { catchAsync } from '../../utils/catchAsync.js'
import { successResponse } from '../../utils/apiResponse.js'
import * as productService from './product.service.js'

/**
 * List products with pagination, search, category filter, and sorting
 * GET /api/products
 */
export const getProducts = catchAsync(async (req, res) => {
  const result = await productService.listProducts(req.businessId, req.query)
  return successResponse(res, result, 'Products retrieved successfully')
})

/**
 * Get distinct categories for active products
 * GET /api/products/meta/categories
 */
export const getCategories = catchAsync(async (req, res) => {
  const categories = await productService.getCategories(req.businessId)
  return successResponse(res, categories, 'Product categories retrieved successfully')
})

/**
 * Get low stock products
 * GET /api/products/alerts/low-stock
 */
export const getLowStockProducts = catchAsync(async (req, res) => {
  const result = await productService.getLowStockProducts(req.businessId, req.query)
  return successResponse(res, result, 'Low stock products retrieved successfully')
})

/**
 * Get product by SKU
 * GET /api/products/sku/:sku
 */
export const getProductBySku = catchAsync(async (req, res) => {
  const product = await productService.getProductBySku(req.businessId, req.params.sku)
  return successResponse(res, product, `Product ${product.sku} retrieved successfully`)
})

/**
 * Get product by ID
 * GET /api/products/:id
 */
export const getProductById = catchAsync(async (req, res) => {
  const product = await productService.getProductById(req.businessId, req.params.id)
  return successResponse(res, product, 'Product retrieved successfully')
})

/**
 * Create a new product
 * POST /api/products
 */
export const createProduct = catchAsync(async (req, res) => {
  const product = await productService.createProduct(req.businessId, req.body)
  return successResponse(res, product, `Product ${product.sku} created successfully`, 201)
})

/**
 * Update an existing product
 * PUT /api/products/:id
 */
export const updateProduct = catchAsync(async (req, res) => {
  const product = await productService.updateProduct(req.businessId, req.params.id, req.body)
  return successResponse(res, product, `Product ${product.sku} updated successfully`)
})

/**
 * Delete or deactivate product
 * DELETE /api/products/:id
 */
export const deleteProduct = catchAsync(async (req, res) => {
  const permanent = req.query.permanent === 'true'
  const result = await productService.deleteProduct(req.businessId, req.params.id, permanent)
  return successResponse(res, result, result.message)
})
