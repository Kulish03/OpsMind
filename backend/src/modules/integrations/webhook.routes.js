import { Router } from 'express'
import * as webhookController from './webhook.controller.js'
import { authenticate } from '../../middleware/authMiddleware.js'
import { enforceTenantScope } from '../../middleware/tenantMiddleware.js'

const router = Router()

// Integration status endpoint (requires auth & tenancy)
router.get('/status', authenticate, enforceTenantScope, webhookController.getIntegrationStatus)

// Inbound POS webhook endpoint (authenticated or HMAC/tenant-header)
router.post('/pos/webhook', authenticate, enforceTenantScope, webhookController.handlePOSWebhook)

// Inbound Accounting webhook endpoint
router.post('/accounting/webhook', authenticate, enforceTenantScope, webhookController.handleAccountingWebhook)

export default router
