import React, { useState, useEffect, useCallback } from 'react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ResponsiveContainer,
  Legend,
} from 'recharts'
import { DollarSign, Layers, Info, AlertCircle } from 'lucide-react'
import api from '../../services/api'
import { useAuth } from '../../context/AuthContext'
import { formatCurrency, formatNumber } from '../../utils/formatters'

export const RevenueVsExpenseChart = () => {
  const { currency } = useAuth()
  const [granularity, setGranularity] = useState('monthly') // 'monthly' | 'weekly'
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)

  const fetchComparisonData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.get(`/analytics/revenue-vs-expense?period=${granularity}`)
      setData(res.data?.timeline || [])
    } catch (err) {
      console.warn('Failed to load revenue vs expense chart:', err)
    } finally {
      setLoading(false)
    }
  }, [granularity])

  useEffect(() => {
    fetchComparisonData()
  }, [fetchComparisonData])

  // Count items with missing cost in dataset
  const totalMissingCostItems = data.reduce(
    (sum, d) => sum + (d.missingCostItemsCount || 0),
    0
  )

  return (
    <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm space-y-4">
      {/* Header & Granularity Toggle */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-3 border-b border-slate-100 gap-3">
        <div>
          <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <DollarSign className="w-4 h-4 text-emerald-600" />
            Revenue vs. Operating Outflows & Net Profit
          </h3>
          <p className="text-xs text-slate-500">
            Authoritative cashflow & margin comparison: Sales Revenue vs. Expenses & Net Profit
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center p-1 bg-slate-100 rounded-xl">
            <button
              onClick={() => setGranularity('monthly')}
              className={`px-3 py-1 text-xs font-semibold rounded-lg transition ${
                granularity === 'monthly'
                  ? 'bg-white text-indigo-700 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Monthly
            </button>
            <button
              onClick={() => setGranularity('weekly')}
              className={`px-3 py-1 text-xs font-semibold rounded-lg transition ${
                granularity === 'weekly'
                  ? 'bg-white text-indigo-700 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Weekly
            </button>
          </div>
        </div>
      </div>

      {/* Missing Cost Notice if present */}
      {totalMissingCostItems > 0 && (
        <div className="p-2.5 rounded-lg bg-amber-50 border border-amber-200/60 flex items-center gap-2 text-xs text-amber-800">
          <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
          <span>
            {totalMissingCostItems} sales item(s) had zero or missing cost prices. COGS and profit
            reflect verified costs without speculative estimates.
          </span>
        </div>
      )}

      {/* Chart */}
      <div className="h-72 w-full pt-2">
        {loading ? (
          <div className="h-full flex items-center justify-center text-xs text-slate-400">
            Loading financial comparison data...
          </div>
        ) : data.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis dataKey="period" stroke="#94a3b8" fontSize={11} tickLine={false} />
              <YAxis
                stroke="#94a3b8"
                fontSize={11}
                tickLine={false}
                tickFormatter={(val) => `£${val >= 1000 ? `${(val / 1000).toFixed(0)}k` : val}`}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#ffffff',
                  border: '1px solid #e2e8f0',
                  borderRadius: '0.75rem',
                  fontSize: '12px',
                  boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                }}
                formatter={(val, name) => [
                  formatCurrency(val, currency),
                  name === 'revenue'
                    ? 'Sales Revenue'
                    : name === 'operatingExpenses'
                    ? 'Operating Expenses'
                    : 'Net Profit',
                ]}
              />
              <Legend
                wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }}
                formatter={(val) =>
                  val === 'revenue'
                    ? 'Revenue'
                    : val === 'operatingExpenses'
                    ? 'Operating Expenses'
                    : 'Net Profit'
                }
              />
              <Bar dataKey="revenue" fill="#10b981" radius={[4, 4, 0, 0]} barSize={20} />
              <Bar dataKey="operatingExpenses" fill="#f43f5e" radius={[4, 4, 0, 0]} barSize={20} />
              <Bar dataKey="netProfit" fill="#6366f1" radius={[4, 4, 0, 0]} barSize={20} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-full flex items-center justify-center text-slate-400 text-xs">
            No comparison data recorded for this timeframe.
          </div>
        )}
      </div>
    </div>
  )
}

export default RevenueVsExpenseChart
