import { z } from 'zod'

export const registerSchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters').max(60, 'Name cannot exceed 60 characters'),
  email: z.string().trim().email('Invalid email address format').toLowerCase(),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  businessName: z.string().trim().min(2, 'Business name must be at least 2 characters').max(100),
  businessType: z.enum(['retail', 'wholesale', 'e-commerce', 'restaurant', 'services', 'other']).optional().default('retail'),
  currency: z.string().trim().length(3, 'Currency must be a 3-letter ISO code (e.g. GBP, USD)').optional().default('GBP'),
})

export const loginSchema = z.object({
  email: z.string().trim().email('Invalid email address format').toLowerCase(),
  password: z.string().min(1, 'Password is required'),
})
