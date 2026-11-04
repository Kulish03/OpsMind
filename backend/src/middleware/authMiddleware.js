import jwt from 'jsonwebtoken'
import { errorResponse } from '../utils/apiResponse.js'
import { User } from '../modules/auth/user.model.js'

/**
 * Authentication Middleware: Validates JWT and hydrates user context
 */
export const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return errorResponse(res, 'Access denied. No token provided.', 401)
    }

    const token = authHeader.split(' ')[1]
    const secret = process.env.JWT_SECRET || 'supersecretjwtkey_replace_in_production'

    let decoded
    try {
      decoded = jwt.verify(token, secret)
    } catch (err) {
      if (err.name === 'TokenExpiredError') {
        return errorResponse(res, 'Session expired. Please log in again.', 401)
      }
      return errorResponse(res, 'Invalid authentication token.', 401)
    }

    // Hydrate user from database
    const user = await User.findById(decoded.id)
    if (!user || !user.isActive) {
      return errorResponse(res, 'User account is invalid or deactivated.', 401)
    }

    // Attach user and security tenant scope to request
    req.user = user
    req.businessId = user.businessId // Authoritative tenant context (never taken from client body!)
    req.userRole = user.role

    next()
  } catch (error) {
    return errorResponse(res, `Authentication error: ${error.message}`, 500)
  }
}

/**
 * Role-Based Access Control Middleware
 */
export const requireRole = (allowedRoles = []) => (req, res, next) => {
  if (!req.user || !allowedRoles.includes(req.user.role)) {
    return errorResponse(res, 'Forbidden: You do not have permission to perform this action.', 403)
  }
  next()
}

export default authenticate
