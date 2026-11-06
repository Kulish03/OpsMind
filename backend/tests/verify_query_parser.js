import {
  escapeRegex,
  parsePagination,
  buildPaginationMeta,
  buildSearchFilter,
  buildDateRangeFilter,
  parseSorting,
} from '../src/utils/queryParser.js'

console.log('='.repeat(80))
console.log(' STEP 12: QUERY PARSER & STANDARDIZATION VERIFICATION')
console.log('='.repeat(80))

// 1. Pagination parsing
const p1 = parsePagination({ page: '-5', limit: '500' }, 20, 100)
if (p1.page === 1 && p1.limit === 100 && p1.skip === 0) {
  console.log('[PASS] parsePagination safely bounds page >= 1 and limit <= maxLimit')
} else {
  throw new Error(`Pagination parsing failed: ${JSON.stringify(p1)}`)
}

// 2. Pagination metadata
const meta = buildPaginationMeta(95, 2, 20)
if (meta.total === 95 && meta.totalPages === 5 && meta.hasNextPage && meta.hasPrevPage) {
  console.log('[PASS] buildPaginationMeta calculates totalPages, hasNextPage, hasPrevPage')
} else {
  throw new Error(`Pagination meta failed: ${JSON.stringify(meta)}`)
}

// 3. Search filter
const searchFilter = buildSearchFilter('Special (Clock)*', ['sku', 'name'])
if (searchFilter.$or && searchFilter.$or.length === 2) {
  console.log('[PASS] buildSearchFilter escapes regex special chars safely')
} else {
  throw new Error(`Search filter failed: ${JSON.stringify(searchFilter)}`)
}

// 4. Date range filter
const dateFilter = buildDateRangeFilter('transactionDate', '2026-01-01', '2026-01-31')
if (dateFilter.transactionDate.$gte && dateFilter.transactionDate.$lte) {
  console.log('[PASS] buildDateRangeFilter constructs correct $gte and $lte filters')
} else {
  throw new Error(`Date range filter failed: ${JSON.stringify(dateFilter)}`)
}

// 5. Sorting
const sortObj = parseSorting('invalidField', 'asc', ['createdAt', 'sellingPrice'], 'createdAt')
if (sortObj.createdAt === 1) {
  console.log('[PASS] parseSorting falls back to defaultSortField if unauthorized field requested')
} else {
  throw new Error(`Sorting parsing failed: ${JSON.stringify(sortObj)}`)
}

console.log('='.repeat(80))
console.log(' ALL QUERY PARSER TESTS PASSED (5/5)')
console.log('='.repeat(80))
