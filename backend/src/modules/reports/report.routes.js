import { Router } from 'express'
import * as reportController from './report.controller.js'
import { authenticate } from '../../middleware/authMiddleware.js'
import { enforceTenantScope } from '../../middleware/tenantMiddleware.js'
import { authorizeRoles } from '../../middleware/rbacMiddleware.js'

const router = Router()

// Reports require authentication, tenant scope, and manager/admin/accountant role
router.use(authenticate, enforceTenantScope, authorizeRoles('admin', 'manager', 'accountant'))

// Download executive PDF report
router.get('/executive-summary/pdf', reportController.downloadExecutivePDF)

// Preview executive report JSON
router.get('/executive-summary/preview', reportController.previewExecutiveReport)

// Scheduled Reports & Automated Notifications
router.get('/schedules', reportController.listSchedules)
router.post('/schedules', reportController.createSchedule)
router.post('/schedules/:id/trigger', reportController.triggerSchedule)

export default router
