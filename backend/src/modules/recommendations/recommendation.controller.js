import { catchAsync } from '../../utils/catchAsync.js'
import { successResponse } from '../../utils/apiResponse.js'
import * as recommendationService from './recommendation.service.js'

/**
 * Generate actionable recommendations from analytics and ML
 * POST /api/recommendations/generate
 */
export const generateRecommendations = catchAsync(async (req, res) => {
  const result = await recommendationService.generateRecommendations(req.businessId)
  return successResponse(
    res,
    result,
    `Successfully generated ${result.length} actionable recommendations`
  )
})

/**
 * List recommendations with pagination, filters, and summary
 * GET /api/recommendations
 */
export const getRecommendations = catchAsync(async (req, res) => {
  const result = await recommendationService.getRecommendations(req.businessId, req.query)
  return successResponse(res, result, 'Recommendations retrieved successfully')
})

/**
 * Get summary KPI metrics of recommendations
 * GET /api/recommendations/summary
 */
export const getRecommendationSummary = catchAsync(async (req, res) => {
  const result = await recommendationService.getRecommendationSummary(req.businessId)
  return successResponse(res, result, 'Recommendation summary retrieved successfully')
})

/**
 * Review, approve, reject, or dismiss a recommendation
 * PATCH /api/recommendations/:id/review
 */
export const reviewRecommendation = catchAsync(async (req, res) => {
  const { status, notes } = req.body
  const result = await recommendationService.reviewRecommendation(req.params.id, {
    status,
    notes,
    user: req.user,
    businessId: req.businessId,
  })
  return successResponse(res, result, `Recommendation marked as ${status}`)
})

/**
 * Explicitly confirm and execute consequential action
 * POST /api/recommendations/:id/execute
 */
export const executeAction = catchAsync(async (req, res) => {
  const { confirmed, executionPayload } = req.body
  const result = await recommendationService.executeConsequentialAction(req.params.id, {
    confirmed,
    executionPayload,
    user: req.user,
    businessId: req.businessId,
  })
  return successResponse(
    res,
    result,
    'Consequential recommendation action confirmed and executed successfully'
  )
})

/**
 * Retrieve immutable audit logs for recommendation decisions
 * GET /api/recommendations/audit
 */
export const getAuditLogs = catchAsync(async (req, res) => {
  const result = await recommendationService.getAuditLogs(req.businessId, req.query)
  return successResponse(res, result, 'Recommendation audit logs retrieved successfully')
})
