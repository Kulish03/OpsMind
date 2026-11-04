import { z } from 'zod'

export const updateBusinessProfileSchema = z.object({
  name: z.string().trim().min(2).max(100).optional(),
  businessType: z.enum(['retail', 'wholesale', 'e-commerce', 'restaurant', 'services', 'other']).optional(),
  currency: z.string().trim().length(3).optional(),
  timeZone: z.string().trim().optional(),
  contactEmail: z.string().trim().email().optional(),
  contactPhone: z.string().trim().optional(),
  address: z
    .object({
      street: z.string().trim().optional(),
      city: z.string().trim().optional(),
      country: z.string().trim().optional(),
      postalCode: z.string().trim().optional(),
    })
    .optional(),
  settings: z
    .object({
      defaultLowStockThreshold: z.number().int().min(1).optional(),
      defaultTargetStock: z.number().int().min(1).optional(),
      taxRatePercentage: z.number().min(0).max(100).optional(),
    })
    .optional(),
})
