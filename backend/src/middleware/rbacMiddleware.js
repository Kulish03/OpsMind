import AppError from '../utils/AppError.js'

/**
 * Granular Role-Based Access Control (RBAC) Permission Matrix
 */
export const ROLE_PERMISSIONS = {
  admin: ['*'], // Full access to all business operations, financial reports, settings, and user management
  manager: [
    'INVENTORY:READ',
    'INVENTORY:WRITE',
    'SALES:READ',
    'SALES:WRITE',
    'CUSTOMERS:READ',
    'CUSTOMERS:WRITE',
    'SUPPLIERS:READ',
    'SUPPLIERS:WRITE',
    'RECOMMENDATIONS:READ',
    'RECOMMENDATIONS:REVIEW',
    'RECOMMENDATIONS:EXECUTE',
    'ANALYTICS:OPERATIONAL',
    'ALERTS:MANAGE',
    'DOCUMENTS:READ',
    'DOCUMENTS:WRITE',
    'REPORTS:READ',
  ],
  accountant: [
    'FINANCIALS:READ',
    'EXPENSES:READ',
    'EXPENSES:WRITE',
    'SALES:READ',
    'ANALYTICS:FINANCIAL',
    'REPORTS:READ',
    'REPORTS:EXPORT_PDF',
    'RECOMMENDATIONS:READ',
    'RECOMMENDATIONS:REVIEW',
    'DOCUMENTS:READ',
  ],
  staff: [
    'INVENTORY:READ',
    'SALES:READ',
    'SALES:WRITE',
    'CUSTOMERS:READ',
    'DOCUMENTS:READ',
  ],
}

/**
 * Restrict endpoint access to users possessing specific authorized roles.
 * Usage: router.post('/execute', authenticate, authorizeRoles('admin', 'manager'), ...)
 */
export const authorizeRoles = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user || !req.user.role) {
      return next(new AppError('Unauthorized: Authentication required', 401))
    }

    if (!allowedRoles.includes(req.user.role)) {
      return next(
        new AppError(
          `Forbidden: Role '${req.user.role}' lacks sufficient privileges to perform this operation. Allowed: ${allowedRoles.join(', ')}`,
          403
        )
      )
    }

    next()
  }
}

/**
 * Fine-grained permission checker
 */
export const requirePermission = (permission) => {
  return (req, res, next) => {
    const role = req.user?.role
    if (!role) {
      return next(new AppError('Unauthorized: Authentication required', 401))
    }

    const permissions = ROLE_PERMISSIONS[role] || []
    if (permissions.includes('*') || permissions.includes(permission)) {
      return next()
    }

    return next(
      new AppError(
        `Forbidden: Role '${role}' lacks permission '${permission}' for this resource.`,
        403
      )
    )
  }
}
