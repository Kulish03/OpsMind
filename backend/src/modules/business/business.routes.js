import { Router } from 'express'
import * as businessController from './business.controller.js'
import { authenticate, requireRole } from '../../middleware/authMiddleware.js'
import { enforceTenantScope } from '../../middleware/tenantMiddleware.js'
import { validateRequest } from '../../middleware/validateRequest.js'
import { updateBusinessProfileSchema } from './business.validation.js'

const router = Router()

// All routes require valid session and strict tenant scoping
router.use(authenticate, enforceTenantScope)

// Business Profile & Settings
router.get('/profile', businessController.getProfile)
router.put(
  '/profile',
  requireRole(['admin', 'manager']),
  validateRequest(updateBusinessProfileSchema),
  businessController.updateProfile
)

// Operational Counts & Dashboard Status
router.get('/summary', businessController.getSummary)

// Onboarding: Seed Demo Retail Data (Admin only)
router.post('/seed-demo-data', requireRole(['admin']), businessController.seedDemo)

export default router
