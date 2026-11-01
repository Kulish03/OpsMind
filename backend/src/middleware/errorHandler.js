import { errorResponse } from '../utils/apiResponse.js'

/**
 * Global Error Handling Middleware
 */
export const errorHandler = (err, req, res, next) => {
  const statusCode = err.statusCode || 500
  const message = err.message || 'Internal Server Error'

  console.error(`[Error] ${req.method} ${req.originalUrl}:`, err)

  return errorResponse(res, message, statusCode, err.errors || null)
}
