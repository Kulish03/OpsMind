import { Router } from 'express'
import * as expenseController from './expense.controller.js'
import { authenticate, requireRole } from '../../middleware/authMiddleware.js'
import { enforceTenantScope } from '../../middleware/tenantMiddleware.js'
import { validateRequest, validateQuery } from '../../middleware/validateRequest.js'
import {
  createExpenseSchema,
  updateExpenseSchema,
  queryExpenseSchema,
} from './expense.validation.js'

const router = Router()

// All Expense routes require authentication and tenant isolation
router.use(authenticate, enforceTenantScope)

// Metrics and specialized endpoints (must be defined before /:id)
router.get('/summary', expenseController.getExpenseSummary)
router.get('/meta/categories', expenseController.getCategories)

// List expenses with pagination, category filter, date range, and search
router.get('/', validateQuery(queryExpenseSchema), expenseController.getExpenses)

// Fetch single expense by ID or expenseId
router.get('/:id', expenseController.getExpenseById)

// Create a new expense (Admin & Manager only)
router.post(
  '/',
  requireRole(['admin', 'manager']),
  validateRequest(createExpenseSchema),
  expenseController.createExpense
)

// Update expense record (Admin & Manager only)
router.put(
  '/:id',
  requireRole(['admin', 'manager']),
  validateRequest(updateExpenseSchema),
  expenseController.updateExpense
)

// Delete expense record (Admin & Manager only)
router.delete(
  '/:id',
  requireRole(['admin', 'manager']),
  expenseController.deleteExpense
)

export default router
