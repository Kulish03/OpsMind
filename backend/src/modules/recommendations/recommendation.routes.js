import { Router } from 'express'
import * as recommendationController from './recommendation.controller.js'
import { authenticate } from '../../middleware/authMiddleware.js'
import { enforceTenantScope } from '../../middleware/tenantMiddleware.js'

const router = Router()

// All recommendation routes require authenticated user and tenant scope
router.use(authenticate, enforceTenantScope)

// Summary counts and impact
router.get('/summary', recommendationController.getRecommendationSummary)

// Audit logs
router.get('/audit', recommendationController.getAuditLogs)

// Generate recommendations from rules, analytics, and ML
router.post('/generate', recommendationController.generateRecommendations)

// List recommendations with filters
router.get('/', recommendationController.getRecommendations)

// Review workflow: Approve, Reject, Dismiss
router.patch('/:id/review', recommendationController.reviewRecommendation)

// Execute consequential action with explicit human confirmation
router.post('/:id/execute', recommendationController.executeAction)

export default router
