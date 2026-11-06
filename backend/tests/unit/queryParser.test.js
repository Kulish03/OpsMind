import { describe, it, expect } from '@jest/globals'
import {
  escapeRegex,
  parsePagination,
  buildPaginationMeta,
  buildSearchFilter,
  buildDateRangeFilter,
  parseSorting,
} from '../../src/utils/queryParser.js'

describe('Query Parser Utility Tests', () => {
  describe('escapeRegex', () => {
    it('escapes special regex characters correctly', () => {
      const input = 'Widget (Blue) [Large]* +?^${}|\\'
      const escaped = escapeRegex(input)
      expect(escaped).toBe('Widget \\(Blue\\) \\[Large\\]\\* \\+\\?\\^\\$\\{\\}\\|\\\\')
    })

    it('returns empty string when given non-string or null', () => {
      expect(escapeRegex(null)).toBe('')
      expect(escapeRegex(undefined)).toBe('')
      expect(escapeRegex(123)).toBe('')
    })
  })

  describe('parsePagination', () => {
    it('defaults to page 1 and defaultLimit when parameters are missing or invalid', () => {
      const result = parsePagination({}, 20, 100)
      expect(result).toEqual({ page: 1, limit: 20, skip: 0 })
    })

    it('bounds negative or zero page numbers to 1', () => {
      const result = parsePagination({ page: '-5', limit: '25' })
      expect(result.page).toBe(1)
      expect(result.limit).toBe(25)
      expect(result.skip).toBe(0)
    })

    it('clamps limit to maxLimit', () => {
      const result = parsePagination({ page: '3', limit: '500' }, 20, 100)
      expect(result.page).toBe(3)
      expect(result.limit).toBe(100)
      expect(result.skip).toBe(200)
    })
  })

  describe('buildPaginationMeta', () => {
    it('calculates total pages and navigation flags accurately', () => {
      const meta = buildPaginationMeta(105, 3, 20)
      expect(meta.total).toBe(105)
      expect(meta.page).toBe(3)
      expect(meta.limit).toBe(20)
      expect(meta.totalPages).toBe(6)
      expect(meta.hasNextPage).toBe(true)
      expect(meta.hasPrevPage).toBe(true)
    })

    it('handles zero total items gracefully', () => {
      const meta = buildPaginationMeta(0, 1, 20)
      expect(meta.total).toBe(0)
      expect(meta.totalPages).toBe(1)
      expect(meta.hasNextPage).toBe(false)
      expect(meta.hasPrevPage).toBe(false)
    })
  })

  describe('buildSearchFilter', () => {
    it('constructs an $or query array across specified fields', () => {
      const filter = buildSearchFilter('scarf', ['sku', 'name'])
      expect(filter.$or).toBeDefined()
      expect(filter.$or.length).toBe(2)
      expect(filter.$or[0].sku).toBeInstanceOf(RegExp)
      expect(filter.$or[1].name).toBeInstanceOf(RegExp)
    })

    it('returns empty object when search string is empty', () => {
      expect(buildSearchFilter('')).toEqual({})
      expect(buildSearchFilter('   ')).toEqual({})
    })
  })

  describe('buildDateRangeFilter', () => {
    it('creates $gte and $lte queries for date ranges', () => {
      const filter = buildDateRangeFilter('date', '2026-01-01', '2026-01-31')
      expect(filter.date).toBeDefined()
      expect(filter.date.$gte).toBeInstanceOf(Date)
      expect(filter.date.$lte).toBeInstanceOf(Date)
    })

    it('returns empty object when no dates are provided', () => {
      expect(buildDateRangeFilter('date', null, null)).toEqual({})
    })
  })

  describe('parseSorting', () => {
    it('parses sort fields and directions', () => {
      const sort = parseSorting('sellingPrice', 'asc', ['createdAt', 'sellingPrice'])
      expect(sort).toEqual({ sellingPrice: 1 })
    })

    it('falls back to default sort field if unauthorized field is supplied', () => {
      const sort = parseSorting('maliciousField', 'desc', ['createdAt', 'name'], 'createdAt')
      expect(sort).toEqual({ createdAt: -1 })
    })
  })
})
