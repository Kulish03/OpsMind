import { catchAsync } from '../../utils/catchAsync.js'
import { successResponse } from '../../utils/apiResponse.js'
import * as businessService from './business.service.js'

export const getProfile = catchAsync(async (req, res) => {
  const business = await businessService.getBusinessProfile(req.businessId)
  return successResponse(res, business, 'Business profile retrieved successfully')
})

export const updateProfile = catchAsync(async (req, res) => {
  const updatedBusiness = await businessService.updateBusinessProfile(req.businessId, req.body)
  return successResponse(res, updatedBusiness, 'Business profile updated successfully')
})

export const getSummary = catchAsync(async (req, res) => {
  const summary = await businessService.getBusinessSummary(req.businessId)
  return successResponse(res, summary, 'Business summary retrieved successfully')
})

export const seedDemo = catchAsync(async (req, res) => {
  const result = await businessService.seedTenantDemoData(req.businessId)
  return successResponse(res, result, result.message, 201)
})
