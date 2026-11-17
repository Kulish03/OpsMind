import rateLimit from 'express-rate-limit'

/**
 * Standard API rate limiter for general authenticated and public routes.
 * 100 requests per 15-minute window per IP.
 */
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === 'test' ? 1000 : 100, // relaxed in test mode
  standardHeaders: true, // Return rate limit info in `RateLimit-*` headers
  legacyHeaders: false, // Disable `X-RateLimit-*` headers
  message: {
    success: false,
    message: 'Too many requests from this IP address. Please try again after 15 minutes.',
    statusCode: 429,
  },
})

/**
 * Stricter rate limiter for authentication endpoints (login, register)
 * to prevent brute-force credential stuffing.
 * 15 requests per 15-minute window per IP.
 */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === 'test' ? 500 : 15,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many authentication attempts. Please wait 15 minutes before retrying.',
    statusCode: 429,
  },
})

/**
 * Rate limiter for AI Copilot chat inference to prevent resource exhaustion.
 * 30 requests per minute per IP.
 */
export const copilotLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: process.env.NODE_ENV === 'test' ? 500 : 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'AI Copilot rate limit exceeded. Please wait a moment before sending another query.',
    statusCode: 429,
  },
})
