import { Router } from 'express'
import * as customerController from './customer.controller.js'
import { authenticate, requireRole } from '../../middleware/authMiddleware.js'
import { enforceTenantScope } from '../../middleware/tenantMiddleware.js'
import { validateRequest, validateQuery } from '../../middleware/validateRequest.js'
import {
  createCustomerSchema,
  updateCustomerSchema,
  queryCustomerSchema,
} from './customer.validation.js'

const router = Router()

// All Customer routes require authentication and tenant isolation
router.use(authenticate, enforceTenantScope)

// Metrics and specialized endpoints (must be defined before /:id)
router.get('/summary', customerController.getCustomerSummary)
router.get('/:id/orders', customerController.getCustomerOrders)

// List customers with pagination, RFM retention status, and search
router.get('/', validateQuery(queryCustomerSchema), customerController.getCustomers)

// Fetch single customer by ID or customerId
router.get('/:id', customerController.getCustomerById)

// Create a new customer profile (accessible to Admin, Manager, and POS Staff)
router.post(
  '/',
  requireRole(['admin', 'manager', 'staff']),
  validateRequest(createCustomerSchema),
  customerController.createCustomer
)

// Update customer profile
router.put(
  '/:id',
  requireRole(['admin', 'manager', 'staff']),
  validateRequest(updateCustomerSchema),
  customerController.updateCustomer
)

// Delete customer profile (Admin & Manager only; blocked if orders exist)
router.delete(
  '/:id',
  requireRole(['admin', 'manager']),
  customerController.deleteCustomer
)

export default router
