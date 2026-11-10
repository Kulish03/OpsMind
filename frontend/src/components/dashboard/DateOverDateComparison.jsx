import React, { useState, useEffect, useCallback } from 'react'
import {
  TrendingUp,
  TrendingDown,
  ArrowUpRight,
  ArrowDownRight,
  Calendar,
  Layers,
  Scale,
} from 'lucide-react'
import api from '../../services/api'
import { useAuth } from '../../context/AuthContext'
import { formatCurrency, formatNumber, formatPercent } from '../../utils/formatters'

export const DateOverDateComparison = () => {
  const { currency } = useAuth()
  const [windowPeriod, setWindowPeriod] = useState('7d') // '7d' | '30d'
  const [comparison, setComparison] = useState(null)
  const [loading, setLoading] = useState(true)

  const fetchComparison = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.get(`/analytics/date-comparison?period=${windowPeriod}`)
      setComparison(res.data || null)
    } catch (err) {
      console.warn('Failed to load date-over-date comparison:', err)
    } finally {
      setLoading(false)
    }
  }, [windowPeriod])

  useEffect(() => {
    fetchComparison()
  }, [fetchComparison])

  const metrics = comparison?.metrics || {}

  const renderMetricCard = (title, metricData, isExpense = false) => {
    if (!metricData) return null
    const { current, prior, percentageDelta, absoluteDelta, trend } = metricData
    const isPositiveChange = percentageDelta > 0

    // For expenses, an increase is typically adverse (red), whereas decrease is favorable (green)
    const isFavorable = isExpense ? !isPositiveChange : isPositiveChange

    return (
      <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            {title}
          </span>
          <span
            className={`inline-flex items-center text-xs font-bold px-2 py-0.5 rounded-full ${
              trend === 'FLAT'
                ? 'bg-slate-200 text-slate-700'
                : isFavorable
                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/60'
                : 'bg-rose-50 text-rose-700 border border-rose-200/60'
            }`}
          >
            {trend === 'UP' ? (
              <ArrowUpRight className="w-3.5 h-3.5 mr-0.5" />
            ) : trend === 'DOWN' ? (
              <ArrowDownRight className="w-3.5 h-3.5 mr-0.5" />
            ) : null}
            {percentageDelta > 0 ? `+${percentageDelta}%` : `${percentageDelta}%`}
          </span>
        </div>

        <div className="flex items-baseline justify-between">
          <span className="text-xl font-bold text-slate-900">
            {typeof current === 'number' && title.toLowerCase().includes('order') && !title.toLowerCase().includes('value')
              ? formatNumber(current)
              : formatCurrency(current, currency)}
          </span>
          <span className="text-xs text-slate-400">
            vs{' '}
            {typeof prior === 'number' && title.toLowerCase().includes('order') && !title.toLowerCase().includes('value')
              ? formatNumber(prior)
              : formatCurrency(prior, currency)}
          </span>
        </div>

        <p className="text-[11px] text-slate-500">
          Delta:{' '}
          <span className="font-semibold text-slate-700">
            {typeof absoluteDelta === 'number' && title.toLowerCase().includes('order') && !title.toLowerCase().includes('value')
              ? (absoluteDelta > 0 ? `+${absoluteDelta}` : absoluteDelta)
              : formatCurrency(absoluteDelta, currency)}
          </span>
        </p>
      </div>
    )
  }

  return (
    <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm space-y-4">
      {/* Header with Comparison Window Selector */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-3 border-b border-slate-100 gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Scale className="w-4 h-4 text-indigo-600" />
            <h3 className="text-base font-bold text-slate-900">
              Period-Over-Period Business Comparison
            </h3>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Current trajectory vs identical prior calendar window
          </p>
        </div>

        <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-xl">
          <button
            onClick={() => setWindowPeriod('7d')}
            className={`px-3 py-1 text-xs font-semibold rounded-lg transition ${
              windowPeriod === '7d'
                ? 'bg-white text-indigo-700 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Last 7 Days vs Prior 7d
          </button>
          <button
            onClick={() => setWindowPeriod('30d')}
            className={`px-3 py-1 text-xs font-semibold rounded-lg transition ${
              windowPeriod === '30d'
                ? 'bg-white text-indigo-700 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Last 30 Days vs Prior 30d
          </button>
        </div>
      </div>

      {/* Metric Cards Grid */}
      {loading ? (
        <div className="py-8 text-center text-xs text-slate-400">Loading period comparison...</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
          {renderMetricCard('Revenue', metrics.revenue)}
          {renderMetricCard('Completed Orders', metrics.orders)}
          {renderMetricCard('Avg Order Value', metrics.averageOrderValue)}
          {renderMetricCard('Gross Profit', metrics.grossProfit)}
          {renderMetricCard('Operating Expenses', metrics.operatingExpenses, true)}
          {renderMetricCard('Net Profit', metrics.netProfit)}
        </div>
      )}
    </div>
  )
}

export default DateOverDateComparison
