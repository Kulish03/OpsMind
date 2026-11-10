import { catchAsync } from '../../utils/catchAsync.js'
import { successResponse } from '../../utils/apiResponse.js'
import * as analyticsService from './analytics.service.js'

/**
 * Executive KPI Overview: Revenue, COGS, Gross Profit, Net Profit, AOV
 * GET /api/analytics/kpis
 */
export const getKPIs = catchAsync(async (req, res) => {
  const result = await analyticsService.getExecutiveKPIs(req.businessId, req.query)
  return successResponse(res, result, 'Executive KPIs retrieved successfully')
})

/**
 * Sales revenue and volume time-series trends
 * GET /api/analytics/revenue-trend
 */
export const getRevenueTrend = catchAsync(async (req, res) => {
  const result = await analyticsService.getRevenueTrend(req.businessId, req.query)
  return successResponse(res, result, 'Revenue trends retrieved successfully')
})

/**
 * Top selling catalog products by revenue and units
 * GET /api/analytics/top-products
 */
export const getTopProducts = catchAsync(async (req, res) => {
  const result = await analyticsService.getTopProducts(req.businessId, req.query)
  return successResponse(res, result, 'Top products retrieved successfully')
})

/**
 * Sales distribution across categories
 * GET /api/analytics/category-breakdown
 */
export const getCategoryBreakdown = catchAsync(async (req, res) => {
  const result = await analyticsService.getCategoryBreakdown(req.businessId, req.query)
  return successResponse(res, result, 'Category breakdown retrieved successfully')
})

/**
 * Customer RFM segmentation and loyalty insights
 * GET /api/analytics/customer-insights
 */
export const getCustomerInsights = catchAsync(async (req, res) => {
  const result = await analyticsService.getCustomerInsights(req.businessId)
  return successResponse(res, result, 'Customer insights retrieved successfully')
})

/**
 * Inventory health, valuation, and stockout risk alerts
 * GET /api/analytics/inventory-health
 */
export const getInventoryHealth = catchAsync(async (req, res) => {
  const result = await analyticsService.getInventoryHealth(req.businessId)
  return successResponse(res, result, 'Inventory health metrics retrieved successfully')
})

/**
 * Daily, weekly, and monthly sales summaries with refunds/cancellations
 * GET /api/analytics/sales-summaries
 */
export const getSalesSummaries = catchAsync(async (req, res) => {
  const result = await analyticsService.getSalesSummaries(req.businessId, req.query)
  return successResponse(res, result, 'Sales summaries retrieved successfully')
})

/**
 * Revenue vs Operating Expenses Profitability Comparison
 * GET /api/analytics/revenue-vs-expense
 */
export const getRevenueVsExpenseComparison = catchAsync(async (req, res) => {
  const result = await analyticsService.getRevenueVsExpenseComparison(req.businessId, req.query)
  return successResponse(res, result, 'Revenue vs expense comparison retrieved successfully')
})

/**
 * Date-over-Date Performance Comparisons (Period over Period)
 * GET /api/analytics/date-comparison
 */
export const getDateOverDateComparison = catchAsync(async (req, res) => {
  const result = await analyticsService.getDateOverDateComparison(req.businessId, req.query)
  return successResponse(res, result, 'Date-over-date performance comparison retrieved successfully')
})

/**
 * Deep-dive Product and Category Profitability Analysis
 * GET /api/analytics/product-deep-dive
 */
export const getProductAndCategoryDeepDive = catchAsync(async (req, res) => {
  const result = await analyticsService.getProductAndCategoryDeepDive(req.businessId, req.query)
  return successResponse(res, result, 'Product and category deep dive analysis retrieved successfully')
})
