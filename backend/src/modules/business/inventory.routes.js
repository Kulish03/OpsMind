import { Router } from 'express'
import * as inventoryController from './inventory.controller.js'
import { authenticate, requireRole } from '../../middleware/authMiddleware.js'
import { enforceTenantScope } from '../../middleware/tenantMiddleware.js'
import { validateRequest, validateQuery } from '../../middleware/validateRequest.js'
import {
  restockInventorySchema,
  adjustStockSchema,
  writeOffSchema,
  queryInventorySchema,
  queryMovementsSchema,
} from './inventory.validation.js'

const router = Router()

// All Inventory routes require authentication and tenant isolation
router.use(authenticate, enforceTenantScope)

// Inventory Summary & Valuation KPIs
router.get('/summary', inventoryController.getInventorySummary)

// Movement Ledger Endpoints (defined before general parameter routes)
router.get('/movements', validateQuery(queryMovementsSchema), inventoryController.getMovements)
router.get('/movements/:sku', validateQuery(queryMovementsSchema), inventoryController.getMovementsBySku)

// List Inventory Stock Levels with health status, valuation, and search
router.get('/', validateQuery(queryInventorySchema), inventoryController.getInventory)

// Inventory Stock Mutations (Admin & Manager only)
router.post(
  '/restock',
  requireRole(['admin', 'manager']),
  validateRequest(restockInventorySchema),
  inventoryController.restock
)

router.post(
  '/adjust',
  requireRole(['admin', 'manager']),
  validateRequest(adjustStockSchema),
  inventoryController.adjust
)

router.post(
  '/write-off',
  requireRole(['admin', 'manager']),
  validateRequest(writeOffSchema),
  inventoryController.writeOff
)

export default router
