import { errorResponse } from '../utils/apiResponse.js'

/**
 * Global Centralized Error Handling Middleware
 * Intercepts Mongoose, MongoDB, Zod, and operational application errors,
 * formatting them into consistent, clean client responses.
 */
export const errorHandler = (err, req, res, next) => {
  let statusCode = err.statusCode || 500
  let message = err.message || 'Internal Server Error'
  let errors = err.errors || null

  // 1. Mongoose Bad ObjectId / CastError
  if (err.name === 'CastError') {
    statusCode = 400
    message = `Invalid format for field '${err.path}': ${err.value}`
  }

  // 2. Mongoose Validation Error
  if (err.name === 'ValidationError') {
    statusCode = 400
    message = 'Validation error'
    errors = Object.values(err.errors).map((el) => ({
      field: el.path,
      message: el.message,
    }))
  }

  // 3. MongoDB Duplicate Key Error (Code 11000)
  if (err.code === 11000) {
    statusCode = 409
    const duplicateField = Object.keys(err.keyValue || err.keyPattern || {})[0] || 'field'
    const duplicateValue = err.keyValue ? err.keyValue[duplicateField] : ''
    message = `Duplicate value '${duplicateValue}' for field '${duplicateField}'. Please provide a unique value.`
  }

  // 4. JWT Authentication Errors
  if (err.name === 'JsonWebTokenError') {
    statusCode = 401
    message = 'Invalid authentication token.'
  }

  if (err.name === 'TokenExpiredError') {
    statusCode = 401
    message = 'Session expired. Please log in again.'
  }

  // 5. Express JSON Syntax Error (Malformed JSON payload)
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    statusCode = 400
    message = 'Malformed JSON payload in request body.'
  }

  // 6. Zod Validation Error (if passed to next)
  if (err.name === 'ZodError' && err.errors) {
    statusCode = 400
    message = 'Validation error'
    errors = err.errors.map((e) => ({
      field: e.path.join('.'),
      message: e.message,
    }))
  }

  if (process.env.NODE_ENV !== 'test' && statusCode >= 500) {
    console.error(`[Unhandled Error] ${req.method} ${req.originalUrl}:`, err)
  }

  return errorResponse(res, message, statusCode, errors)
}

export default errorHandler
