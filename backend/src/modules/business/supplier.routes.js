import { Router } from 'express'
import * as supplierController from './supplier.controller.js'
import { authenticate, requireRole } from '../../middleware/authMiddleware.js'
import { enforceTenantScope } from '../../middleware/tenantMiddleware.js'
import { validateRequest, validateQuery } from '../../middleware/validateRequest.js'
import {
  createSupplierSchema,
  updateSupplierSchema,
  querySupplierSchema,
} from './supplier.validation.js'

const router = Router()

// All Supplier routes require authentication and tenant isolation
router.use(authenticate, enforceTenantScope)

// Metrics and specialized endpoints (must be defined before /:id)
router.get('/summary', supplierController.getSupplierSummary)
router.get('/:id/products', supplierController.getSupplierProducts)

// List suppliers with pagination, category filter, and search
router.get('/', validateQuery(querySupplierSchema), supplierController.getSuppliers)

// Fetch single supplier by ID or supplierId
router.get('/:id', supplierController.getSupplierById)

// Create a new supplier (Admin & Manager only)
router.post(
  '/',
  requireRole(['admin', 'manager']),
  validateRequest(createSupplierSchema),
  supplierController.createSupplier
)

// Update supplier profile (Admin & Manager only)
router.put(
  '/:id',
  requireRole(['admin', 'manager']),
  validateRequest(updateSupplierSchema),
  supplierController.updateSupplier
)

// Delete supplier (Admin & Manager only; blocked if products are linked)
router.delete(
  '/:id',
  requireRole(['admin', 'manager']),
  supplierController.deleteSupplier
)

export default router
