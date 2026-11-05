import { z } from 'zod'

export const saleItemSchema = z.object({
  productSku: z
    .string({ required_error: 'Product SKU is required' })
    .min(1, 'SKU cannot be empty')
    .trim()
    .transform((val) => val.toUpperCase()),
  productName: z.string().trim().optional(),
  quantity: z
    .number({ required_error: 'Quantity is required' })
    .int('Quantity must be an integer')
    .positive('Quantity must be at least 1'),
  unitPrice: z
    .number()
    .min(0, 'Unit price must be non-negative')
    .optional(),
})

export const createSaleSchema = z.object({
  invoiceId: z
    .string()
    .trim()
    .optional(),
  transactionDate: z.coerce.date().optional(),
  customerReference: z.string().trim().optional().default('GUEST'),
  billingCountry: z.string().trim().optional().default('United Kingdom'),
  status: z.enum(['completed', 'cancelled', 'refunded']).optional().default('completed'),
  items: z
    .array(saleItemSchema)
    .min(1, 'Sale must include at least one item'),
  source: z.enum(['uci_retail', 'pos', 'synthetic']).optional().default('pos'),
})

export const querySaleSchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
  search: z.string().trim().optional(),
  status: z.enum(['completed', 'cancelled', 'refunded']).optional(),
  startDate: z.string().trim().optional(),
  endDate: z.string().trim().optional(),
  productSku: z.string().trim().optional(),
  customerReference: z.string().trim().optional(),
  sortBy: z
    .enum(['transactionDate', 'totalAmount', 'totalUnits', 'createdAt'])
    .optional()
    .default('transactionDate'),
  sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
})

export const cancelSaleSchema = z.object({
  reason: z.string().trim().optional().default('Customer cancellation / return'),
  status: z.enum(['cancelled', 'refunded']).optional().default('cancelled'),
})
