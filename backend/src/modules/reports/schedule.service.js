import ReportSchedule from './reportSchedule.model.js'
import * as analyticsService from '../analytics/analytics.service.js'
import AppError from '../../utils/AppError.js'

export const createReportSchedule = async (businessId, payload) => {
  if (!payload.reportType) {
    throw new AppError('reportType is required', 400)
  }

  const nextRun = new Date()
  if (payload.frequency === 'DAILY') nextRun.setDate(nextRun.getDate() + 1)
  else if (payload.frequency === 'MONTHLY') nextRun.setMonth(nextRun.getMonth() + 1)
  else nextRun.setDate(nextRun.getDate() + 7)

  const schedule = await ReportSchedule.create({
    businessId,
    reportType: payload.reportType,
    frequency: payload.frequency || 'WEEKLY',
    recipients: payload.recipients || ['demo@opsmind.io'],
    nextRunDate: nextRun,
    isActive: payload.isActive !== false,
  })

  return schedule
}

export const listReportSchedules = async (businessId) => {
  return await ReportSchedule.find({ businessId }).sort({ createdAt: -1 }).lean()
}

export const triggerScheduledReport = async (businessId, scheduleId) => {
  const schedule = await ReportSchedule.findOne({ _id: scheduleId, businessId })
  if (!schedule) {
    throw new AppError('Report schedule not found', 404)
  }

  // Generate automated report summary
  const kpis = await analyticsService.getExecutiveKPIs(businessId)

  const summary = `Automated ${schedule.reportType} digest dispatched to ${schedule.recipients.join(
    ', '
  )}. Net Revenue: £${(kpis.revenueAndOrders?.totalRevenue || 0).toLocaleString()}, Orders: ${
    kpis.revenueAndOrders?.totalOrders || 0
  }, Profit Margin: ${kpis.profitability?.netProfitMarginPercentage || 0}%.`

  schedule.lastRunDate = new Date()
  const next = new Date()
  if (schedule.frequency === 'DAILY') next.setDate(next.getDate() + 1)
  else if (schedule.frequency === 'MONTHLY') next.setMonth(next.getMonth() + 1)
  else next.setDate(next.getDate() + 7)
  schedule.nextRunDate = next

  schedule.executionHistory.unshift({
    executedAt: new Date(),
    status: 'SUCCESS',
    summaryDetails: summary,
  })

  // Retain last 20 execution history logs
  if (schedule.executionHistory.length > 20) {
    schedule.executionHistory = schedule.executionHistory.slice(0, 20)
  }

  await schedule.save()

  return {
    schedule,
    summary,
  }
}
