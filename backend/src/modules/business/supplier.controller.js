import { catchAsync } from '../../utils/catchAsync.js'
import { successResponse } from '../../utils/apiResponse.js'
import * as supplierService from './supplier.service.js'

/**
 * List suppliers with pagination, category filter, and search
 * GET /api/suppliers
 */
export const getSuppliers = catchAsync(async (req, res) => {
  const result = await supplierService.listSuppliers(req.businessId, req.query)
  return successResponse(res, result, 'Suppliers retrieved successfully')
})

/**
 * Get supplier directory analytics and summary
 * GET /api/suppliers/summary
 */
export const getSupplierSummary = catchAsync(async (req, res) => {
  const summary = await supplierService.getSupplierSummary(req.businessId)
  return successResponse(res, summary, 'Supplier directory summary retrieved successfully')
})

/**
 * Get products supplied by a specific supplier
 * GET /api/suppliers/:id/products
 */
export const getSupplierProducts = catchAsync(async (req, res) => {
  const result = await supplierService.getSupplierProducts(req.businessId, req.params.id, req.query)
  return successResponse(res, result, 'Supplied products retrieved successfully')
})

/**
 * Get single supplier by ID or supplierId
 * GET /api/suppliers/:id
 */
export const getSupplierById = catchAsync(async (req, res) => {
  const supplier = await supplierService.getSupplierById(req.businessId, req.params.id)
  return successResponse(res, supplier, `Supplier ${supplier.name} retrieved successfully`)
})

/**
 * Create a new supplier
 * POST /api/suppliers
 */
export const createSupplier = catchAsync(async (req, res) => {
  const supplier = await supplierService.createSupplier(req.businessId, req.body)
  return successResponse(res, supplier, `Supplier ${supplier.name} created successfully`, 201)
})

/**
 * Update an existing supplier
 * PUT /api/suppliers/:id
 */
export const updateSupplier = catchAsync(async (req, res) => {
  const supplier = await supplierService.updateSupplier(req.businessId, req.params.id, req.body)
  return successResponse(res, supplier, `Supplier ${supplier.name} updated successfully`)
})

/**
 * Delete a supplier
 * DELETE /api/suppliers/:id
 */
export const deleteSupplier = catchAsync(async (req, res) => {
  const result = await supplierService.deleteSupplier(req.businessId, req.params.id)
  return successResponse(res, result, result.message)
})
