import { catchAsync } from '../../utils/catchAsync.js'
import { successResponse } from '../../utils/apiResponse.js'
import * as inventoryService from './inventory.service.js'

/**
 * List inventory levels enriched with health status and valuations
 * GET /api/inventory
 */
export const getInventory = catchAsync(async (req, res) => {
  const result = await inventoryService.getInventoryOverview(req.businessId, req.query)
  return successResponse(res, result, 'Inventory overview retrieved successfully')
})

/**
 * Get inventory valuation and health summary
 * GET /api/inventory/summary
 */
export const getInventorySummary = catchAsync(async (req, res) => {
  const summary = await inventoryService.getInventorySummary(req.businessId)
  return successResponse(res, summary, 'Inventory health summary retrieved successfully')
})

/**
 * Inbound restock / purchase order receipt
 * POST /api/inventory/restock
 */
export const restock = catchAsync(async (req, res) => {
  const result = await inventoryService.restockInventory(req.businessId, req.body)
  return successResponse(res, result, 'Inbound inventory restock recorded successfully')
})

/**
 * Manual cycle count or stock adjustment
 * POST /api/inventory/adjust
 */
export const adjust = catchAsync(async (req, res) => {
  const result = await inventoryService.adjustStock(req.businessId, req.body)
  return successResponse(res, result, `Stock adjusted for SKU ${result.productSku}`)
})

/**
 * Write off damaged, expired, or lost stock
 * POST /api/inventory/write-off
 */
export const writeOff = catchAsync(async (req, res) => {
  const result = await inventoryService.writeOffStock(req.businessId, req.body)
  return successResponse(res, result, `Stock write-off recorded for SKU ${result.productSku}`)
})

/**
 * Query inventory movement audit log across the business
 * GET /api/inventory/movements
 */
export const getMovements = catchAsync(async (req, res) => {
  const result = await inventoryService.getMovements(req.businessId, req.query)
  return successResponse(res, result, 'Inventory movements retrieved successfully')
})

/**
 * Query movement history for a specific SKU
 * GET /api/inventory/movements/:sku
 */
export const getMovementsBySku = catchAsync(async (req, res) => {
  const result = await inventoryService.getMovementsBySku(req.businessId, req.params.sku, req.query)
  return successResponse(res, result, `Movements retrieved for SKU ${req.params.sku.toUpperCase()}`)
})
