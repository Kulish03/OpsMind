import { Router } from 'express'
import * as productController from './product.controller.js'
import { authenticate, requireRole } from '../../middleware/authMiddleware.js'
import { enforceTenantScope } from '../../middleware/tenantMiddleware.js'
import { validateRequest, validateQuery } from '../../middleware/validateRequest.js'
import {
  createProductSchema,
  updateProductSchema,
  queryProductSchema,
} from './product.validation.js'

const router = Router()

// All Product routes require valid session and strict tenant scoping
router.use(authenticate, enforceTenantScope)

// Metadata & specialized queries (must be before /:id)
router.get('/meta/categories', productController.getCategories)
router.get('/alerts/low-stock', productController.getLowStockProducts)
router.get('/sku/:sku', productController.getProductBySku)

// List Products with pagination, search, category filter, sorting
router.get('/', validateQuery(queryProductSchema), productController.getProducts)

// Fetch single product by ID
router.get('/:id', productController.getProductById)

// Create a new product (Admin & Manager only)
router.post(
  '/',
  requireRole(['admin', 'manager']),
  validateRequest(createProductSchema),
  productController.createProduct
)

// Update product by ID (Admin & Manager only)
router.put(
  '/:id',
  requireRole(['admin', 'manager']),
  validateRequest(updateProductSchema),
  productController.updateProduct
)

// Delete / Deactivate product by ID (Admin & Manager only)
router.delete(
  '/:id',
  requireRole(['admin', 'manager']),
  (req, res, next) => {
    // If permanent deletion is requested, enforce admin role strictly
    if (req.query.permanent === 'true' && req.userRole !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: Only administrators can permanently delete catalog records.',
        timestamp: new Date().toISOString(),
      })
    }
    next()
  },
  productController.deleteProduct
)

export default router
