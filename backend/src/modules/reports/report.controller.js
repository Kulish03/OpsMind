import { catchAsync } from '../../utils/catchAsync.js'
import { successResponse } from '../../utils/apiResponse.js'
import * as reportService from './report.service.js'
import * as scheduleService from './schedule.service.js'

/**
 * Stream binary PDF Executive Report
 * GET /api/reports/executive-summary/pdf
 */
export const downloadExecutivePDF = catchAsync(async (req, res) => {
  const doc = await reportService.generateExecutiveReportPDF(req.businessId)

  const filename = `OpsMind-Executive-Report-${new Date().toISOString().split('T')[0]}.pdf`
  res.setHeader('Content-Type', 'application/pdf')
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)

  doc.pipe(res)
})

/**
 * Get JSON preview of the report
 * GET /api/reports/executive-summary/preview
 */
export const previewExecutiveReport = catchAsync(async (req, res) => {
  const result = await reportService.getExecutiveReportPreview(req.businessId)
  return successResponse(res, result, 'Report preview generated successfully')
})

export const createSchedule = catchAsync(async (req, res) => {
  const result = await scheduleService.createReportSchedule(req.businessId, req.body)
  return successResponse(res, result, 'Report schedule created successfully', 201)
})

export const listSchedules = catchAsync(async (req, res) => {
  const result = await scheduleService.listReportSchedules(req.businessId)
  return successResponse(res, result, 'Report schedules retrieved successfully')
})

export const triggerSchedule = catchAsync(async (req, res) => {
  const result = await scheduleService.triggerScheduledReport(req.businessId, req.params.id)
  return successResponse(res, result, 'Scheduled report triggered and dispatched successfully')
})
