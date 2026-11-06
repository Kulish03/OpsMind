import { z } from 'zod'

export const createExpenseSchema = z.object({
  expenseId: z
    .string()
    .min(1, 'Expense ID cannot be empty')
    .max(50, 'Expense ID cannot exceed 50 characters')
    .trim()
    .optional(),
  category: z
    .string({ required_error: 'Expense category is required' })
    .min(1, 'Category cannot be empty')
    .max(100, 'Category cannot exceed 100 characters')
    .trim(),
  amount: z
    .number({ required_error: 'Amount is required' })
    .positive('Expense amount must be greater than 0'),
  date: z.coerce.date().optional(),
  description: z
    .string({ required_error: 'Description is required' })
    .min(1, 'Description cannot be empty')
    .max(255, 'Description cannot exceed 255 characters')
    .trim(),
  paymentMethod: z
    .string()
    .max(50, 'Payment method cannot exceed 50 characters')
    .trim()
    .optional()
    .default('Direct Debit'),
  source: z
    .enum(['synthetic', 'uci_retail', 'user_created'])
    .optional()
    .default('user_created'),
})

export const updateExpenseSchema = z.object({
  category: z
    .string()
    .min(1, 'Category cannot be empty')
    .max(100, 'Category cannot exceed 100 characters')
    .trim()
    .optional(),
  amount: z
    .number()
    .positive('Expense amount must be greater than 0')
    .optional(),
  date: z.coerce.date().optional(),
  description: z
    .string()
    .min(1, 'Description cannot be empty')
    .max(255, 'Description cannot exceed 255 characters')
    .trim()
    .optional(),
  paymentMethod: z
    .string()
    .max(50, 'Payment method cannot exceed 50 characters')
    .trim()
    .optional(),
})

export const queryExpenseSchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
  search: z.string().trim().optional(),
  category: z.string().trim().optional(),
  paymentMethod: z.string().trim().optional(),
  startDate: z.string().trim().optional(),
  endDate: z.string().trim().optional(),
  sortBy: z
    .enum(['date', 'amount', 'category', 'createdAt'])
    .optional()
    .default('date'),
  sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
})
