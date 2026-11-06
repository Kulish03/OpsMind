import { z } from 'zod'

export const createCustomerSchema = z.object({
  customerId: z
    .string()
    .min(1, 'Customer ID cannot be empty')
    .max(50, 'Customer ID cannot exceed 50 characters')
    .trim()
    .optional(),
  name: z
    .string()
    .min(1, 'Customer name cannot be empty')
    .max(150, 'Customer name cannot exceed 150 characters')
    .trim()
    .optional(),
  country: z
    .string()
    .max(100, 'Country name cannot exceed 100 characters')
    .trim()
    .optional()
    .default('United Kingdom'),
  source: z
    .enum(['uci_retail', 'user_created', 'synthetic'])
    .optional()
    .default('user_created'),
})

export const updateCustomerSchema = z.object({
  name: z
    .string()
    .min(1, 'Customer name cannot be empty')
    .max(150, 'Customer name cannot exceed 150 characters')
    .trim()
    .optional(),
  country: z
    .string()
    .max(100, 'Country name cannot exceed 100 characters')
    .trim()
    .optional(),
  retentionStatus: z
    .enum(['ACTIVE', 'DORMANT', 'AT_RISK', 'CHURNED'])
    .optional(),
})

export const queryCustomerSchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
  search: z.string().trim().optional(),
  retentionStatus: z.enum(['ACTIVE', 'DORMANT', 'AT_RISK', 'CHURNED']).optional(),
  country: z.string().trim().optional(),
  sortBy: z
    .enum(['totalSpend', 'totalOrders', 'totalUnitsPurchased', 'lastPurchaseDate', 'name', 'createdAt'])
    .optional()
    .default('totalSpend'),
  sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
})
