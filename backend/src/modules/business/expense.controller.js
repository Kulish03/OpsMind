import { catchAsync } from '../../utils/catchAsync.js'
import { successResponse } from '../../utils/apiResponse.js'
import * as expenseService from './expense.service.js'

/**
 * List expenses with pagination, category filter, date range, and search
 * GET /api/expenses
 */
export const getExpenses = catchAsync(async (req, res) => {
  const result = await expenseService.listExpenses(req.businessId, req.query)
  return successResponse(res, result, 'Expenses retrieved successfully')
})

/**
 * Get expense breakdown, category analytics, and monthly trends
 * GET /api/expenses/summary
 */
export const getExpenseSummary = catchAsync(async (req, res) => {
  const summary = await expenseService.getExpenseSummary(req.businessId, req.query)
  return successResponse(res, summary, 'Expense analytics summary retrieved successfully')
})

/**
 * Get distinct expense categories
 * GET /api/expenses/meta/categories
 */
export const getCategories = catchAsync(async (req, res) => {
  const categories = await expenseService.getCategories(req.businessId)
  return successResponse(res, categories, 'Expense categories retrieved successfully')
})

/**
 * Get single expense record by ID or expenseId
 * GET /api/expenses/:id
 */
export const getExpenseById = catchAsync(async (req, res) => {
  const expense = await expenseService.getExpenseById(req.businessId, req.params.id)
  return successResponse(res, expense, `Expense ${expense.expenseId} retrieved successfully`)
})

/**
 * Record a new operating expense
 * POST /api/expenses
 */
export const createExpense = catchAsync(async (req, res) => {
  const expense = await expenseService.createExpense(req.businessId, req.body)
  return successResponse(res, expense, `Expense ${expense.expenseId} created successfully`, 201)
})

/**
 * Update an existing operating expense
 * PUT /api/expenses/:id
 */
export const updateExpense = catchAsync(async (req, res) => {
  const expense = await expenseService.updateExpense(req.businessId, req.params.id, req.body)
  return successResponse(res, expense, `Expense ${expense.expenseId} updated successfully`)
})

/**
 * Delete an operating expense
 * DELETE /api/expenses/:id
 */
export const deleteExpense = catchAsync(async (req, res) => {
  const result = await expenseService.deleteExpense(req.businessId, req.params.id)
  return successResponse(res, result, result.message)
})
