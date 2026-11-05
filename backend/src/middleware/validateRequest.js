import { errorResponse } from '../utils/apiResponse.js'

/**
 * Express middleware for Zod schema validation on request body
 */
export const validateRequest = (schema) => (req, res, next) => {
  try {
    const parsed = schema.parse(req.body)
    req.body = parsed
    next()
  } catch (error) {
    if (error.errors) {
      const formattedErrors = error.errors.map((err) => ({
        field: err.path.join('.'),
        message: err.message,
      }))
      return errorResponse(res, 'Validation error', 400, formattedErrors)
    }
    return errorResponse(res, error.message, 400)
  }
}

/**
 * Express middleware for Zod schema validation on query parameters
 */
export const validateQuery = (schema) => (req, res, next) => {
  try {
    const parsed = schema.parse(req.query)
    req.query = parsed
    next()
  } catch (error) {
    if (error.errors) {
      const formattedErrors = error.errors.map((err) => ({
        field: err.path.join('.'),
        message: err.message,
      }))
      return errorResponse(res, 'Query validation error', 400, formattedErrors)
    }
    return errorResponse(res, error.message, 400)
  }
}

export default validateRequest
