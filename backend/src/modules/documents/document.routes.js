import { Router } from 'express'
import * as documentController from './document.controller.js'
import { authenticate } from '../../middleware/authMiddleware.js'
import { enforceTenantScope } from '../../middleware/tenantMiddleware.js'
import { authorizeRoles } from '../../middleware/rbacMiddleware.js'

const router = Router()

// All document routes require authentication and tenant isolation
router.use(authenticate, enforceTenantScope)

// Query documents via RAG (All roles)
router.post('/query', documentController.queryRAG)

// List documents (All roles)
router.get('/', documentController.listDocuments)

// Get single document (All roles)
router.get('/:id', documentController.getDocument)

// Create document (Admin / Manager)
router.post('/', authorizeRoles('admin', 'manager'), documentController.createDocument)

// Delete document (Admin only)
router.delete('/:id', authorizeRoles('admin'), documentController.deleteDocument)

export default router
