import React, { useState, useEffect, useCallback } from 'react'
import { Sparkles, TrendingDown, Layers, ArrowRight, Package } from 'lucide-react'
import { Link } from 'react-router-dom'
import api from '../../services/api'
import { useAuth } from '../../context/AuthContext'
import { formatCurrency, formatNumber, formatPercent } from '../../utils/formatters'
import Badge from '../common/Badge'

export const ProductPerformanceDeepDive = () => {
  const { currency } = useAuth()
  const [data, setData] = useState(null)
  const [activeTab, setActiveTab] = useState('top') // 'top' | 'slow' | 'categories'
  const [loading, setLoading] = useState(true)

  const fetchDeepDive = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.get('/analytics/product-deep-dive')
      setData(res.data || null)
    } catch (err) {
      console.warn('Failed to load product deep dive:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchDeepDive()
  }, [fetchDeepDive])

  const topByRevenue = data?.topByRevenue || []
  const bottomMovers = data?.bottomMovers || []
  const categoryPerformance = data?.categoryPerformance || []

  return (
    <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm space-y-4">
      {/* Header and Tab Selection */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-3 border-b border-slate-100 gap-3">
        <div>
          <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Package className="w-4 h-4 text-indigo-600" />
            Product Velocity & Category Profitability
          </h3>
          <p className="text-xs text-slate-500">
            Identify revenue drivers, dead-stock capital risks, and category margins
          </p>
        </div>

        <div className="flex items-center p-1 bg-slate-100 rounded-xl">
          <button
            onClick={() => setActiveTab('top')}
            className={`px-3 py-1 text-xs font-semibold rounded-lg transition ${
              activeTab === 'top'
                ? 'bg-white text-indigo-700 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Top Earners
          </button>
          <button
            onClick={() => setActiveTab('slow')}
            className={`px-3 py-1 text-xs font-semibold rounded-lg transition ${
              activeTab === 'slow'
                ? 'bg-white text-indigo-700 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Slow Movers
          </button>
          <button
            onClick={() => setActiveTab('categories')}
            className={`px-3 py-1 text-xs font-semibold rounded-lg transition ${
              activeTab === 'categories'
                ? 'bg-white text-indigo-700 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Categories
          </button>
        </div>
      </div>

      {loading ? (
        <div className="py-8 text-center text-xs text-slate-400">Loading catalog deep dive...</div>
      ) : activeTab === 'top' ? (
        /* Top Products List */
        <div className="divide-y divide-slate-100">
          {topByRevenue.length > 0 ? (
            topByRevenue.slice(0, 6).map((p, idx) => (
              <div key={p.sku} className="py-3 flex items-center justify-between">
                <div className="flex items-center space-x-3 min-w-0">
                  <span className="w-6 h-6 rounded-md bg-emerald-50 text-emerald-700 flex items-center justify-center text-xs font-bold shrink-0">
                    #{idx + 1}
                  </span>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-slate-800 truncate">{p.name}</p>
                    <div className="flex items-center gap-2 text-[11px] text-slate-400">
                      <span className="font-mono">SKU: {p.sku}</span>
                      <span>&bull;</span>
                      <span>{p.category}</span>
                    </div>
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <p className="text-xs font-bold text-slate-900">
                    {formatCurrency(p.totalRevenue, currency)}
                  </p>
                  <p className="text-[11px] text-emerald-600 font-medium">
                    {formatCurrency(p.grossProfit, currency)} profit ({formatPercent(p.grossMarginPercentage)})
                  </p>
                </div>
              </div>
            ))
          ) : (
            <div className="py-8 text-center text-xs text-slate-400">No sales data recorded yet.</div>
          )}
        </div>
      ) : activeTab === 'slow' ? (
        /* Slow Moving / Stagnant Stock List */
        <div className="divide-y divide-slate-100">
          {bottomMovers.length > 0 ? (
            bottomMovers.slice(0, 6).map((p) => (
              <div key={p.sku} className="py-3 flex items-center justify-between">
                <div className="flex items-center space-x-3 min-w-0">
                  <span className="w-6 h-6 rounded-md bg-rose-50 text-rose-700 flex items-center justify-center text-xs font-bold shrink-0">
                    !
                  </span>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-slate-800 truncate">{p.name}</p>
                    <div className="flex items-center gap-2 text-[11px] text-slate-400">
                      <span className="font-mono">SKU: {p.sku}</span>
                      <span>&bull;</span>
                      <span>{p.category}</span>
                    </div>
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <span className="text-xs font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200/60">
                    {p.totalQuantitySold} sold ({p.currentStock} in stock)
                  </span>
                  <p className="text-[10px] text-slate-400 mt-0.5">Capital tied: {formatCurrency(p.currentStock * (p.costPrice || 0), currency)}</p>
                </div>
              </div>
            ))
          ) : (
            <div className="py-8 text-center text-xs text-slate-400">No stagnant products identified.</div>
          )}
        </div>
      ) : (
        /* Category Breakdown Table */
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-100 text-xs">
            <thead>
              <tr className="text-left font-semibold uppercase tracking-wider text-slate-400">
                <th className="pb-2">Category</th>
                <th className="pb-2">Units Sold</th>
                <th className="pb-2">Revenue</th>
                <th className="pb-2">Gross Profit</th>
                <th className="pb-2 text-right">Margin %</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {categoryPerformance.map((c) => (
                <tr key={c.category} className="hover:bg-slate-50/60">
                  <td className="py-2.5 font-bold text-slate-800">{c.category}</td>
                  <td className="py-2.5 text-slate-600">{formatNumber(c.unitsSold)}</td>
                  <td className="py-2.5 font-semibold text-slate-800">{formatCurrency(c.revenue, currency)}</td>
                  <td className="py-2.5 font-semibold text-emerald-600">{formatCurrency(c.grossProfit, currency)}</td>
                  <td className="py-2.5 text-right font-bold text-slate-800">{formatPercent(c.grossMarginPercentage)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

export default ProductPerformanceDeepDive
