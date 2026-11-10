import { catchAsync } from '../../utils/catchAsync.js'
import { successResponse } from '../../utils/apiResponse.js'
import * as alertService from './alert.service.js'

/**
 * List active or historical operational alerts
 * GET /api/alerts
 */
export const getAlerts = catchAsync(async (req, res) => {
  const result = await alertService.listAlerts(req.businessId, req.query)
  return successResponse(res, result, 'Operational alerts retrieved successfully')
})

/**
 * Active alert KPI counts for dashboard notifications
 * GET /api/alerts/summary
 */
export const getAlertSummary = catchAsync(async (req, res) => {
  const result = await alertService.getAlertSummary(req.businessId)
  return successResponse(res, result, 'Alert summary retrieved successfully')
})

/**
 * Trigger rule evaluation on-demand
 * POST /api/alerts/evaluate
 */
export const evaluateAlerts = catchAsync(async (req, res) => {
  const result = await alertService.evaluateAllRules(req.businessId)
  return successResponse(res, result, 'Rule-based alert evaluation completed successfully')
})

/**
 * Update alert status (IN_REVIEW, ACTIONED, DISMISSED)
 * PATCH /api/alerts/:id/status
 */
export const updateAlertStatus = catchAsync(async (req, res) => {
  const result = await alertService.updateAlertStatus(req.businessId, req.params.id, {
    status: req.body.status,
    resolvedBy: req.user?.name || req.user?.email || 'admin',
    notes: req.body.notes,
  })
  return successResponse(res, result, `Alert status updated to ${result.status}`)
})
