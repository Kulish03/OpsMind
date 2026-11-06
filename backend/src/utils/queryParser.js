/**
 * Reusable Query Parser and Search/Filter/Pagination Utilities for OpsMind
 */

/**
 * Escapes regex special characters to prevent ReDoS attacks or syntax errors
 */
export const escapeRegex = (string) => {
  if (!string || typeof string !== 'string') return ''
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * Parses and bounds pagination parameters
 * @param {Object} query - Express req.query
 * @param {number} defaultLimit - default items per page (default: 20)
 * @param {number} maxLimit - ceiling on items per page (default: 100)
 */
export const parsePagination = (query = {}, defaultLimit = 20, maxLimit = 100) => {
  const page = Math.max(1, parseInt(query.page, 10) || 1)
  const limit = Math.min(maxLimit, Math.max(1, parseInt(query.limit, 10) || defaultLimit))
  const skip = (page - 1) * limit

  return { page, limit, skip }
}

/**
 * Formats standard pagination metadata envelope
 */
export const buildPaginationMeta = (total = 0, page = 1, limit = 20) => {
  const totalPages = Math.ceil(total / limit) || 1
  return {
    total,
    page,
    limit,
    totalPages,
    hasNextPage: page < totalPages,
    hasPrevPage: page > 1,
  }
}

/**
 * Constructs a case-insensitive MongoDB $or regex filter across specified fields
 */
export const buildSearchFilter = (searchTerm, fields = []) => {
  if (!searchTerm || !searchTerm.trim() || !Array.isArray(fields) || fields.length === 0) {
    return {}
  }

  const escaped = escapeRegex(searchTerm.trim())
  const regex = new RegExp(escaped, 'i')

  return {
    $or: fields.map((field) => ({ [field]: regex })),
  }
}

/**
 * Constructs a date range query on a target timestamp field
 */
export const buildDateRangeFilter = (fieldName = 'createdAt', startDate, endDate) => {
  if (!startDate && !endDate) return {}

  const range = {}
  if (startDate) {
    range.$gte = new Date(startDate)
  }
  if (endDate) {
    const end = new Date(endDate)
    // If date string only (YYYY-MM-DD), extend to end of day
    if (typeof endDate === 'string' && endDate.length <= 10) {
      end.setHours(23, 59, 59, 999)
    }
    range.$lte = end
  }

  return { [fieldName]: range }
}

/**
 * Constructs a sanitized Mongoose sort object
 */
export const parseSorting = (
  sortBy,
  sortOrder = 'desc',
  allowedFields = ['createdAt'],
  defaultSortField = 'createdAt'
) => {
  const field = allowedFields.includes(sortBy) ? sortBy : defaultSortField
  const order = sortOrder === 'asc' ? 1 : -1
  return { [field]: order }
}

export default {
  escapeRegex,
  parsePagination,
  buildPaginationMeta,
  buildSearchFilter,
  buildDateRangeFilter,
  parseSorting,
}
