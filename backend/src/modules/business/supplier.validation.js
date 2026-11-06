import { z } from 'zod'

export const createSupplierSchema = z.object({
  supplierId: z
    .string()
    .min(1, 'Supplier ID cannot be empty')
    .max(50, 'Supplier ID cannot exceed 50 characters')
    .trim()
    .optional(),
  name: z
    .string({ required_error: 'Supplier name is required' })
    .min(1, 'Supplier name cannot be empty')
    .max(150, 'Supplier name cannot exceed 150 characters')
    .trim(),
  category: z
    .string()
    .max(100, 'Category cannot exceed 100 characters')
    .trim()
    .optional()
    .default('General Wholesale'),
  contactPerson: z
    .string()
    .max(100, 'Contact person cannot exceed 100 characters')
    .trim()
    .optional(),
  email: z
    .string()
    .email('Invalid email address')
    .trim()
    .optional()
    .or(z.literal('')),
  phone: z
    .string()
    .max(50, 'Phone cannot exceed 50 characters')
    .trim()
    .optional(),
  city: z
    .string()
    .max(100, 'City cannot exceed 100 characters')
    .trim()
    .optional(),
  country: z
    .string()
    .max(100, 'Country cannot exceed 100 characters')
    .trim()
    .optional()
    .default('United Kingdom'),
  leadTimeDays: z
    .number()
    .int('Lead time must be an integer')
    .min(1, 'Lead time must be at least 1 day')
    .optional()
    .default(7),
  minimumOrderQty: z
    .number()
    .int('Minimum order quantity must be an integer')
    .min(1, 'Minimum order quantity must be at least 1')
    .optional()
    .default(50),
  source: z
    .enum(['synthetic', 'user_created'])
    .optional()
    .default('user_created'),
})

export const updateSupplierSchema = z.object({
  name: z
    .string()
    .min(1, 'Supplier name cannot be empty')
    .max(150, 'Supplier name cannot exceed 150 characters')
    .trim()
    .optional(),
  category: z
    .string()
    .max(100, 'Category cannot exceed 100 characters')
    .trim()
    .optional(),
  contactPerson: z
    .string()
    .max(100, 'Contact person cannot exceed 100 characters')
    .trim()
    .optional(),
  email: z
    .string()
    .email('Invalid email address')
    .trim()
    .optional()
    .or(z.literal('')),
  phone: z
    .string()
    .max(50, 'Phone cannot exceed 50 characters')
    .trim()
    .optional(),
  city: z
    .string()
    .max(100, 'City cannot exceed 100 characters')
    .trim()
    .optional(),
  country: z
    .string()
    .max(100, 'Country cannot exceed 100 characters')
    .trim()
    .optional(),
  leadTimeDays: z
    .number()
    .int('Lead time must be an integer')
    .min(1, 'Lead time must be at least 1 day')
    .optional(),
  minimumOrderQty: z
    .number()
    .int('Minimum order quantity must be an integer')
    .min(1, 'Minimum order quantity must be at least 1')
    .optional(),
})

export const querySupplierSchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
  search: z.string().trim().optional(),
  category: z.string().trim().optional(),
  country: z.string().trim().optional(),
  sortBy: z
    .enum(['name', 'leadTimeDays', 'minimumOrderQty', 'createdAt'])
    .optional()
    .default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
})
