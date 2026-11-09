/**
 * OpsMind Data Formatting Utilities
 * Adheres strictly to requirements:
 * - Distinguishes missing/null metrics ('—') from real zero values ('£0.00' / 0)
 * - Tenant currency-aware formatting (defaults to business currency or GBP)
 */

export const formatCurrency = (amount, currency = 'GBP') => {
  if (amount === null || amount === undefined || isNaN(Number(amount))) {
    return '—'
  }

  try {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: currency || 'GBP',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount)
  } catch {
    const symbol = currency === 'USD' ? '$' : currency === 'EUR' ? '€' : '£'
    return `${symbol}${Number(amount).toFixed(2)}`
  }
}

export const formatNumber = (value) => {
  if (value === null || value === undefined || isNaN(Number(value))) {
    return '—'
  }

  return new Intl.NumberFormat('en-GB').format(value)
}

export const formatPercent = (value, includeSign = false) => {
  if (value === null || value === undefined || isNaN(Number(value))) {
    return '—'
  }

  const num = Number(value)
  const formatted = `${num.toFixed(1)}%`
  if (includeSign && num > 0) {
    return `+${formatted}`
  }
  return formatted
}

export const formatDate = (dateValue, includeTime = false) => {
  if (!dateValue) return '—'

  try {
    const d = new Date(dateValue)
    if (isNaN(d.getTime())) return '—'

    const options = {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    }

    if (includeTime) {
      options.hour = '2-digit'
      options.minute = '2-digit'
    }

    return new Intl.DateTimeFormat('en-GB', options).format(d)
  } catch {
    return '—'
  }
}

export const formatShortDate = (dateValue) => {
  if (!dateValue) return '—'
  try {
    const d = new Date(dateValue)
    if (isNaN(d.getTime())) return '—'
    return d.toISOString().split('T')[0]
  } catch {
    return '—'
  }
}
