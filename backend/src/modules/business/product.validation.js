import { z } from 'zod'

export const createProductSchema = z.object({
  sku: z
    .string({ required_error: 'SKU is required' })
    .min(1, 'SKU cannot be empty')
    .max(50, 'SKU cannot exceed 50 characters')
    .trim()
    .transform((val) => val.toUpperCase()),
  name: z
    .string({ required_error: 'Product name is required' })
    .min(1, 'Product name cannot be empty')
    .max(200, 'Product name cannot exceed 200 characters')
    .trim(),
  category: z
    .string()
    .max(100, 'Category cannot exceed 100 characters')
    .trim()
    .optional()
    .default('General Merchandise'),
  sellingPrice: z
    .number({ required_error: 'Selling price is required' })
    .min(0, 'Selling price must be non-negative'),
  costPrice: z
    .number()
    .min(0, 'Cost price must be non-negative')
    .optional()
    .default(0),
  currentStock: z
    .number()
    .int('Current stock must be an integer')
    .optional()
    .default(0),
  reorderThreshold: z
    .number()
    .min(0, 'Reorder threshold must be non-negative')
    .optional()
    .default(20),
  targetStock: z
    .number()
    .min(0, 'Target stock must be non-negative')
    .optional()
    .default(100),
  supplierId: z.string().nullable().optional().default(null),
  isActive: z.boolean().optional().default(true),
  source: z
    .enum(['uci_retail', 'user_created', 'synthetic'])
    .optional()
    .default('user_created'),
})

export const updateProductSchema = z.object({
  sku: z
    .string()
    .min(1, 'SKU cannot be empty')
    .max(50, 'SKU cannot exceed 50 characters')
    .trim()
    .transform((val) => val.toUpperCase())
    .optional(),
  name: z
    .string()
    .min(1, 'Product name cannot be empty')
    .max(200, 'Product name cannot exceed 200 characters')
    .trim()
    .optional(),
  category: z
    .string()
    .max(100, 'Category cannot exceed 100 characters')
    .trim()
    .optional(),
  sellingPrice: z
    .number()
    .min(0, 'Selling price must be non-negative')
    .optional(),
  costPrice: z
    .number()
    .min(0, 'Cost price must be non-negative')
    .optional(),
  currentStock: z
    .number()
    .int('Current stock must be an integer')
    .optional(),
  reorderThreshold: z
    .number()
    .min(0, 'Reorder threshold must be non-negative')
    .optional(),
  targetStock: z
    .number()
    .min(0, 'Target stock must be non-negative')
    .optional(),
  supplierId: z.string().nullable().optional(),
  isActive: z.boolean().optional(),
})

export const queryProductSchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
  search: z.string().trim().optional(),
  category: z.string().trim().optional(),
  lowStock: z.enum(['true', 'false', '1', '0']).optional(),
  isActive: z.enum(['true', 'false', '1', '0']).optional(),
  sortBy: z
    .enum(['name', 'sku', 'sellingPrice', 'costPrice', 'currentStock', 'reorderThreshold', 'createdAt'])
    .optional()
    .default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
})
