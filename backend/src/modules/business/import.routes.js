import { Router } from 'express'
import * as importController from './import.controller.js'
import { authenticate } from '../../middleware/authMiddleware.js'
import { enforceTenantScope } from '../../middleware/tenantMiddleware.js'
import { authorizeRoles } from '../../middleware/rbacMiddleware.js'

const router = Router()

// All bulk import operations require authentication, tenant scope, and manager/admin role
router.use(authenticate, enforceTenantScope, authorizeRoles('admin', 'manager'))

// Universal bulk import endpoint for products, sales, customers, expenses
router.post('/:entityType', importController.importData)

export default router
