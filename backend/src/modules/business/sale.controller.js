import { catchAsync } from '../../utils/catchAsync.js'
import { successResponse } from '../../utils/apiResponse.js'
import * as saleService from './sale.service.js'

/**
 * List sales with filtering, date range, search and pagination
 * GET /api/sales
 */
export const getSales = catchAsync(async (req, res) => {
  const result = await saleService.listSales(req.businessId, req.query)
  return successResponse(res, result, 'Sales invoices retrieved successfully')
})

/**
 * Get sales summary metrics
 * GET /api/sales/summary
 */
export const getSalesSummary = catchAsync(async (req, res) => {
  const summary = await saleService.getSalesSummary(req.businessId, req.query)
  return successResponse(res, summary, 'Sales performance summary retrieved successfully')
})

/**
 * Get sale invoice by invoice ID
 * GET /api/sales/invoice/:invoiceId
 */
export const getSaleByInvoiceId = catchAsync(async (req, res) => {
  const sale = await saleService.getSaleByInvoiceId(req.businessId, req.params.invoiceId)
  return successResponse(res, sale, `Invoice ${sale.invoiceId} retrieved successfully`)
})

/**
 * Get sale invoice by MongoDB ID
 * GET /api/sales/:id
 */
export const getSaleById = catchAsync(async (req, res) => {
  const sale = await saleService.getSaleById(req.businessId, req.params.id)
  return successResponse(res, sale, 'Sale record retrieved successfully')
})

/**
 * Record a new sale transaction
 * POST /api/sales
 */
export const createSale = catchAsync(async (req, res) => {
  const sale = await saleService.createSale(req.businessId, req.body)
  return successResponse(res, sale, `Sale invoice ${sale.invoiceId} created successfully`, 201)
})

/**
 * Cancel or refund a sale invoice
 * POST /api/sales/:id/cancel
 */
export const cancelSale = catchAsync(async (req, res) => {
  const result = await saleService.cancelOrRefundSale(req.businessId, req.params.id, req.body)
  return successResponse(res, result.sale, result.message)
})
