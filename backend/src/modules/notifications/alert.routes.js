import { Router } from 'express'
import * as alertController from './alert.controller.js'
import { authenticate } from '../../middleware/authMiddleware.js'
import { enforceTenantScope } from '../../middleware/tenantMiddleware.js'

const router = Router()

// All Alert routes require authentication and tenant isolation
router.use(authenticate, enforceTenantScope)

// Alert Summary Counts
router.get('/summary', alertController.getAlertSummary)

// Trigger Rule-Based Evaluation on-demand
router.post('/evaluate', alertController.evaluateAlerts)

// List Alerts with pagination, status, and severity filters
router.get('/', alertController.getAlerts)

// Update Alert status
router.patch('/:id/status', alertController.updateAlertStatus)

export default router
