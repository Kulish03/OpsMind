import * as mlService from './ml.service.js'
import { successResponse } from '../../utils/apiResponse.js'
import { catchAsync } from '../../utils/catchAsync.js'

export const getModelsOverview = catchAsync(async (req, res) => {
  const result = await mlService.getModelsOverview()
  return successResponse(res, result, 'ML models governance and evaluation overview retrieved')
})

export const getDemandForecast = catchAsync(async (req, res) => {
  const { horizon_days, sku } = req.body || {}
  const horizon = horizon_days || req.query.horizon_days || 14
  const targetSku = sku || req.query.sku || null

  const result = await mlService.getDemandForecast({
    horizon_days: Number(horizon),
    sku: targetSku,
  })
  return successResponse(res, result, 'Demand forecast generated successfully')
})

export const getAnomalies = catchAsync(async (req, res) => {
  const { domain, limit, records } = req.body || {}
  const targetDomain = domain || req.query.domain || 'expenses'
  const targetLimit = limit || req.query.limit || 50

  const result = await mlService.getAnomalies({
    domain: targetDomain,
    limit: Number(targetLimit),
    records,
  })
  return successResponse(res, result, 'Anomalies detected and explained successfully')
})

export const getInventoryRisk = catchAsync(async (req, res) => {
  const limit = req.body?.limit || req.query.limit || 100
  const result = await mlService.getInventoryRisk({
    businessId: req.businessId,
    limit: Number(limit),
  })
  return successResponse(res, result, 'Inventory risk and replenishment recommendations retrieved')
})

export const getCustomerChurn = catchAsync(async (req, res) => {
  const limit = req.body?.limit || req.query.limit || 50
  const result = await mlService.getCustomerChurn({
    limit: Number(limit),
  })
  return successResponse(res, result, 'Customer inactivity and churn predictions retrieved')
})

export const retrainModel = catchAsync(async (req, res) => {
  const { modelName } = req.params
  const result = await mlService.retrainModel(modelName)
  return successResponse(res, result, `Model ${modelName} retrained successfully`)
})
