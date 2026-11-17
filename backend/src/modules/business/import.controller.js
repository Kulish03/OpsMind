import { catchAsync } from '../../utils/catchAsync.js'
import { successResponse } from '../../utils/apiResponse.js'
import * as importService from './import.service.js'

export const importData = catchAsync(async (req, res) => {
  const { entityType } = req.params
  const input = typeof req.body === 'string' ? req.body : req.body.data || req.body

  const result = await importService.importEntities(req.businessId, entityType, input)
  return successResponse(res, result, `Bulk ${entityType} import completed successfully`)
})
