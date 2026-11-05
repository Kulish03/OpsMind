import { z } from 'zod'

export const restockItemSchema = z.object({
  productSku: z
    .string({ required_error: 'Product SKU is required' })
    .min(1, 'SKU cannot be empty')
    .trim()
    .transform((val) => val.toUpperCase()),
  quantity: z
    .number({ required_error: 'Restock quantity is required' })
    .int('Quantity must be an integer')
    .positive('Restock quantity must be greater than 0'),
  unitCost: z
    .number()
    .min(0, 'Unit cost must be non-negative')
    .optional(),
  supplierId: z.string().trim().optional(),
})

export const restockInventorySchema = z.object({
  referenceId: z.string().trim().optional(),
  reason: z.string().trim().optional().default('Supplier Restock / Inbound Purchase'),
  items: z.array(restockItemSchema).min(1, 'At least one item must be restocked'),
})

export const adjustStockSchema = z
  .object({
    productSku: z
      .string({ required_error: 'Product SKU is required' })
      .min(1, 'SKU cannot be empty')
      .trim()
      .transform((val) => val.toUpperCase()),
    newStock: z
      .number()
      .int('New stock must be an integer')
      .min(0, 'Stock cannot be negative')
      .optional(),
    adjustmentQuantity: z
      .number()
      .int('Adjustment quantity must be an integer')
      .optional(),
    reason: z
      .string({ required_error: 'Reason for stock adjustment is required' })
      .min(3, 'Reason must be at least 3 characters')
      .trim(),
    referenceId: z.string().trim().optional(),
  })
  .refine(
    (data) => data.newStock !== undefined || data.adjustmentQuantity !== undefined,
    {
      message: 'Either newStock or adjustmentQuantity must be provided',
      path: ['newStock'],
    }
  )

export const writeOffSchema = z.object({
  productSku: z
    .string({ required_error: 'Product SKU is required' })
    .min(1, 'SKU cannot be empty')
    .trim()
    .transform((val) => val.toUpperCase()),
  quantity: z
    .number({ required_error: 'Write-off quantity is required' })
    .int('Quantity must be an integer')
    .positive('Write-off quantity must be at least 1'),
  reason: z
    .string({ required_error: 'Reason for write-off is required' })
    .min(3, 'Reason must be at least 3 characters')
    .trim(),
  referenceId: z.string().trim().optional(),
})

export const queryInventorySchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
  search: z.string().trim().optional(),
  category: z.string().trim().optional(),
  stockStatus: z
    .enum(['all', 'out_of_stock', 'low_stock', 'optimal', 'overstocked'])
    .optional()
    .default('all'),
  sortBy: z
    .enum(['currentStock', 'name', 'sku', 'sellingPrice', 'costPrice', 'reorderThreshold', 'createdAt'])
    .optional()
    .default('currentStock'),
  sortOrder: z.enum(['asc', 'desc']).optional().default('asc'),
})

export const queryMovementsSchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
  productSku: z.string().trim().optional(),
  movementType: z
    .enum(['OPENING_BALANCE', 'INBOUND_PURCHASE', 'SALE_OUTFLOW', 'CUSTOMER_RETURN', 'ADJUSTMENT'])
    .optional(),
  startDate: z.string().trim().optional(),
  endDate: z.string().trim().optional(),
  search: z.string().trim().optional(),
  sortBy: z.enum(['timestamp', 'quantity', 'createdAt']).optional().default('timestamp'),
  sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
})
