import { errorResponse } from '../utils/apiResponse.js'

/**
 * Tenant Isolation Middleware
 * Guarantees that every request is strictly bound to the authenticated user's businessId.
 * Strips and overrides any client-supplied businessId in request bodies or query params
 * to prevent tenant spoofing attacks.
 */
export const enforceTenantScope = (req, res, next) => {
  if (!req.businessId) {
    return errorResponse(res, 'Tenant context missing from authentication session.', 401)
  }

  // Security Invariant: Override any client-provided businessId with the verified JWT businessId
  if (req.body && typeof req.body === 'object') {
    req.body.businessId = req.businessId
  }

  if (req.query && typeof req.query === 'object') {
    req.query.businessId = req.businessId
  }

  next()
}

/**
 * Helper to build an authoritative multi-tenant Mongoose filter
 */
export const tenantFilter = (req, baseFilter = {}) => {
  return {
    ...baseFilter,
    businessId: req.businessId,
  }
}

/**
 * Asserts document ownership; returns 404/403 if document belongs to another tenant
 */
export const assertTenantOwnership = (doc, req) => {
  if (!doc) return false
  return doc.businessId === req.businessId
}

export default enforceTenantScope
