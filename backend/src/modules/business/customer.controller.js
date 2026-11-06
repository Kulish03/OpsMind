import { catchAsync } from '../../utils/catchAsync.js'
import { successResponse } from '../../utils/apiResponse.js'
import * as customerService from './customer.service.js'

/**
 * List customers with pagination, RFM retention filter, search, and sorting
 * GET /api/customers
 */
export const getCustomers = catchAsync(async (req, res) => {
  const result = await customerService.listCustomers(req.businessId, req.query)
  return successResponse(res, result, 'Customers retrieved successfully')
})

/**
 * Get customer segmentation and cohort summary
 * GET /api/customers/summary
 */
export const getCustomerSummary = catchAsync(async (req, res) => {
  const summary = await customerService.getCustomerSummary(req.businessId)
  return successResponse(res, summary, 'Customer analytics summary retrieved successfully')
})

/**
 * Get customer order / invoice history
 * GET /api/customers/:id/orders
 */
export const getCustomerOrders = catchAsync(async (req, res) => {
  const result = await customerService.getCustomerOrders(req.businessId, req.params.id, req.query)
  return successResponse(res, result, 'Customer order history retrieved successfully')
})

/**
 * Get single customer by ID or CustomerId
 * GET /api/customers/:id
 */
export const getCustomerById = catchAsync(async (req, res) => {
  const customer = await customerService.getCustomerById(req.businessId, req.params.id)
  return successResponse(res, customer, `Customer ${customer.customerId} retrieved successfully`)
})

/**
 * Create a new customer profile
 * POST /api/customers
 */
export const createCustomer = catchAsync(async (req, res) => {
  const customer = await customerService.createCustomer(req.businessId, req.body)
  return successResponse(res, customer, `Customer ${customer.customerId} created successfully`, 201)
})

/**
 * Update an existing customer profile
 * PUT /api/customers/:id
 */
export const updateCustomer = catchAsync(async (req, res) => {
  const customer = await customerService.updateCustomer(req.businessId, req.params.id, req.body)
  return successResponse(res, customer, `Customer ${customer.customerId} updated successfully`)
})

/**
 * Delete a customer record
 * DELETE /api/customers/:id
 */
export const deleteCustomer = catchAsync(async (req, res) => {
  const result = await customerService.deleteCustomer(req.businessId, req.params.id)
  return successResponse(res, result, result.message)
})
