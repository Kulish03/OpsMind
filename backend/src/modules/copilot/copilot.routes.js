import { Router } from 'express'
import * as copilotController from './copilot.controller.js'
import { authenticate } from '../../middleware/authMiddleware.js'
import { enforceTenantScope } from '../../middleware/tenantMiddleware.js'

const router = Router()

// All Copilot routes strictly require valid authentication and tenant isolation
router.use(authenticate, enforceTenantScope)

router.get('/status', copilotController.getCopilotStatus)
router.post('/chat', copilotController.chatWithCopilot)
router.get('/history', copilotController.getConversationHistory)
router.post('/clear', copilotController.clearConversation)

export default router
