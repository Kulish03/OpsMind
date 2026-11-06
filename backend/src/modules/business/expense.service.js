import mongoose from 'mongoose'
import { Expense } from './expense.model.js'

/**
 * Escapes regex special characters to prevent ReDoS / syntax errors
 */
const escapeRegex = (string) => {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * List operating expenses with filtering, date range, search and pagination
 */
export const listExpenses = async (businessId, query = {}) => {
  const page = Math.max(1, parseInt(query.page, 10) || 1)
  const limit = Math.min(100, Math.max(1, parseInt(query.limit, 10) || 20))
  const skip = (page - 1) * limit

  const filter = { businessId }

  // Category filter
  if (query.category && query.category.trim()) {
    filter.category = query.category.trim()
  }

  // Payment Method filter
  if (query.paymentMethod && query.paymentMethod.trim()) {
    filter.paymentMethod = query.paymentMethod.trim()
  }

  // Date range filter
  if (query.startDate || query.endDate) {
    filter.date = {}
    if (query.startDate) {
      filter.date.$gte = new Date(query.startDate)
    }
    if (query.endDate) {
      const end = new Date(query.endDate)
      if (query.endDate.length <= 10) {
        end.setHours(23, 59, 59, 999)
      }
      filter.date.$lte = end
    }
  }

  // Search across description, expenseId, and category
  if (query.search && query.search.trim()) {
    const escaped = escapeRegex(query.search.trim())
    const searchRegex = new RegExp(escaped, 'i')
    filter.$or = [
      { description: searchRegex },
      { expenseId: searchRegex },
      { category: searchRegex },
    ]
  }

  // Sorting
  const sortBy = query.sortBy || 'date'
  const sortOrder = query.sortOrder === 'asc' ? 1 : -1
  const sort = { [sortBy]: sortOrder }

  const [expenses, total, totalsAgg] = await Promise.all([
    Expense.find(filter).sort(sort).skip(skip).limit(limit).lean(),
    Expense.countDocuments(filter),
    Expense.aggregate([
      { $match: filter },
      {
        $group: {
          _id: null,
          totalAmount: { $sum: '$amount' },
        },
      },
    ]),
  ])

  const totalPages = Math.ceil(total / limit) || 1
  const totalAmount = totalsAgg[0]?.totalAmount || 0

  return {
    expenses,
    pagination: {
      total,
      page,
      limit,
      totalPages,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1,
    },
    filteredTotals: {
      totalAmount: Number(totalAmount.toFixed(2)),
      count: total,
    },
  }
}

/**
 * Fetch a single expense by MongoDB ID or Expense ID
 */
export const getExpenseById = async (businessId, identifier) => {
  let expense = null

  if (mongoose.Types.ObjectId.isValid(identifier)) {
    expense = await Expense.findOne({ _id: identifier, businessId })
  }
  if (!expense) {
    expense = await Expense.findOne({ expenseId: identifier.trim(), businessId })
  }

  if (!expense) {
    const error = new Error(`Expense record not found with identifier: ${identifier}`)
    error.statusCode = 404
    throw error
  }

  return expense
}

/**
 * Record a new operating expense
 */
export const createExpense = async (businessId, expenseData) => {
  const expenseId =
    expenseData.expenseId?.trim() ||
    `EXP-${Date.now()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`

  // Check collision within tenant
  const existing = await Expense.findOne({ businessId, expenseId })
  if (existing) {
    const error = new Error(`Expense with ID '${expenseId}' already exists in your business.`)
    error.statusCode = 409
    throw error
  }

  const date = expenseData.date ? new Date(expenseData.date) : new Date()

  const expense = new Expense({
    ...expenseData,
    expenseId,
    businessId, // Invariant: strict tenant scoping
    date,
    amount: Number(expenseData.amount),
    source: expenseData.source || 'user_created',
  })

  await expense.save()
  return expense
}

/**
 * Update an existing operating expense
 */
export const updateExpense = async (businessId, identifier, updateData) => {
  let expense = null
  if (mongoose.Types.ObjectId.isValid(identifier)) {
    expense = await Expense.findOne({ _id: identifier, businessId })
  }
  if (!expense) {
    expense = await Expense.findOne({ expenseId: identifier.trim(), businessId })
  }

  if (!expense) {
    const error = new Error(`Expense record not found with identifier: ${identifier}`)
    error.statusCode = 404
    throw error
  }

  // Prevent mutation of immutable keys
  delete updateData.businessId
  delete updateData._id
  delete updateData.expenseId

  if (updateData.date) {
    updateData.date = new Date(updateData.date)
  }
  if (updateData.amount !== undefined) {
    updateData.amount = Number(updateData.amount)
  }

  Object.assign(expense, updateData)
  await expense.save()

  return expense
}

/**
 * Delete an operating expense record
 */
export const deleteExpense = async (businessId, identifier) => {
  let expense = null
  if (mongoose.Types.ObjectId.isValid(identifier)) {
    expense = await Expense.findOne({ _id: identifier, businessId })
  }
  if (!expense) {
    expense = await Expense.findOne({ expenseId: identifier.trim(), businessId })
  }

  if (!expense) {
    const error = new Error(`Expense record not found with identifier: ${identifier}`)
    error.statusCode = 404
    throw error
  }

  await Expense.deleteOne({ _id: expense._id, businessId })

  return {
    expenseId: expense.expenseId,
    deleted: true,
    message: `Expense '${expense.expenseId}' deleted successfully.`,
  }
}

/**
 * Operational expense breakdown and analytics summary
 */
export const getExpenseSummary = async (businessId, query = {}) => {
  const filter = { businessId }

  if (query.startDate || query.endDate) {
    filter.date = {}
    if (query.startDate) {
      filter.date.$gte = new Date(query.startDate)
    }
    if (query.endDate) {
      const end = new Date(query.endDate)
      if (query.endDate.length <= 10) {
        end.setHours(23, 59, 59, 999)
      }
      filter.date.$lte = end
    }
  }

  const [totalAgg, categoryAgg, paymentMethodAgg, monthlyTrendAgg] = await Promise.all([
    Expense.aggregate([
      { $match: filter },
      {
        $group: {
          _id: null,
          totalAmount: { $sum: '$amount' },
          count: { $sum: 1 },
        },
      },
    ]),
    Expense.aggregate([
      { $match: filter },
      {
        $group: {
          _id: '$category',
          totalAmount: { $sum: '$amount' },
          count: { $sum: 1 },
        },
      },
      { $sort: { totalAmount: -1 } },
    ]),
    Expense.aggregate([
      { $match: filter },
      {
        $group: {
          _id: '$paymentMethod',
          totalAmount: { $sum: '$amount' },
          count: { $sum: 1 },
        },
      },
      { $sort: { totalAmount: -1 } },
    ]),
    Expense.aggregate([
      { $match: filter },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m', date: '$date' } },
          totalAmount: { $sum: '$amount' },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]),
  ])

  const totals = totalAgg[0] || { totalAmount: 0, count: 0 }

  return {
    businessId,
    totalExpensesAmount: Number(totals.totalAmount.toFixed(2)),
    totalExpensesCount: totals.count,
    averageExpenseAmount:
      totals.count > 0 ? Number((totals.totalAmount / totals.count).toFixed(2)) : 0,
    categoryBreakdown: categoryAgg.map((c) => ({
      category: c._id,
      totalAmount: Number(c.totalAmount.toFixed(2)),
      count: c.count,
    })),
    paymentMethodBreakdown: paymentMethodAgg.map((p) => ({
      paymentMethod: p._id,
      totalAmount: Number(p.totalAmount.toFixed(2)),
      count: p.count,
    })),
    monthlyTrend: monthlyTrendAgg.map((m) => ({
      month: m._id,
      totalAmount: Number(m.totalAmount.toFixed(2)),
      count: m.count,
    })),
  }
}

/**
 * Get distinct expense categories in this tenant's books
 */
export const getCategories = async (businessId) => {
  const categories = await Expense.distinct('category', { businessId })
  return categories.sort()
}
