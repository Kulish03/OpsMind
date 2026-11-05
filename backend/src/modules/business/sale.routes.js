import { Router } from 'express'
import * as saleController from './sale.controller.js'
import { authenticate, requireRole } from '../../middleware/authMiddleware.js'
import { enforceTenantScope } from '../../middleware/tenantMiddleware.js'
import { validateRequest, validateQuery } from '../../middleware/validateRequest.js'
import {
  createSaleSchema,
  querySaleSchema,
  cancelSaleSchema,
} from './sale.validation.js'

const router = Router()

// All Sales routes require authentication and tenant isolation
router.use(authenticate, enforceTenantScope)

// Metrics and specialized endpoints (must be defined before /:id)
router.get('/summary', saleController.getSalesSummary)
router.get('/invoice/:invoiceId', saleController.getSaleByInvoiceId)

// List sales with pagination, date filtering, and search
router.get('/', validateQuery(querySaleSchema), saleController.getSales)

// Fetch single sale by MongoDB ID
router.get('/:id', saleController.getSaleById)

// Record a new sale transaction (accessible to Admin, Manager, and POS Staff)
router.post(
  '/',
  requireRole(['admin', 'manager', 'staff']),
  validateRequest(createSaleSchema),
  saleController.createSale
)

// Cancel or refund an invoice (Admin & Manager only)
router.post(
  '/:id/cancel',
  requireRole(['admin', 'manager']),
  validateRequest(cancelSaleSchema),
  saleController.cancelSale
)

export default router
