import React, { useEffect, useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import {
  DollarSign,
  ShoppingCart,
  TrendingUp,
  Package,
  AlertTriangle,
  ArrowRight,
  Boxes,
  Calendar,
  Layers,
  Sparkles,
} from 'lucide-react'
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ResponsiveContainer,
  Legend,
} from 'recharts'
import api from '../services/api'
import { useAuth } from '../context/AuthContext'
import { formatCurrency, formatNumber, formatPercent } from '../utils/formatters'
import StatCard from '../components/common/StatCard'
import LoadingSpinner from '../components/common/LoadingSpinner'
import { AlertBanner } from '../components/common/AlertBanner'
import { StatusBadge } from '../components/common/Badge'

export const DashboardPage = () => {
  const { currency } = useAuth()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [period, setPeriod] = useState('all')

  const [kpis, setKpis] = useState(null)
  const [revenueTrend, setRevenueTrend] = useState([])
  const [categoryBreakdown, setCategoryBreakdown] = useState([])
  const [topProducts, setTopProducts] = useState([])
  const [lowStockAlerts, setLowStockAlerts] = useState([])

  const fetchDashboardData = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      let queryParams = ''
      if (period === '30d') {
        const d = new Date()
        d.setDate(d.getDate() - 30)
        queryParams = `?startDate=${d.toISOString().split('T')[0]}`
      } else if (period === '90d') {
        const d = new Date()
        d.setDate(d.getDate() - 90)
        queryParams = `?startDate=${d.toISOString().split('T')[0]}`
      }

      const [kpiRes, trendRes, categoryRes, topProdRes, lowStockRes] = await Promise.all([
        api.get(`/analytics/kpis${queryParams}`),
        api.get(`/analytics/revenue-trend${queryParams}`),
        api.get(`/analytics/category-breakdown${queryParams}`),
        api.get(`/analytics/top-products?limit=5`),
        api.get(`/products/alerts/low-stock?limit=6`),
      ])

      setKpis(kpiRes.data || null)
      setRevenueTrend(trendRes.data?.trend || [])
      setCategoryBreakdown(categoryRes.data?.categories || [])
      setTopProducts(topProdRes.data?.topProducts || [])
      setLowStockAlerts(lowStockRes.data?.products || [])
    } catch (err) {
      console.error('Failed to load analytics dashboard:', err)
      setError(err.response?.data?.message || err.message || 'Unable to load dashboard data')
    } finally {
      setLoading(false)
    }
  }, [period])

  useEffect(() => {
    fetchDashboardData()
  }, [fetchDashboardData])

  const { revenueAndOrders, profitability, balanceMetrics } = kpis || {}
  const totalRevenue = revenueAndOrders?.totalRevenue
  const totalOrders = revenueAndOrders?.totalOrders
  const aov = revenueAndOrders?.averageOrderValue
  const grossProfit = profitability?.grossProfit
  const grossMargin = profitability?.grossMarginPercentage
  const netProfit = profitability?.netProfit
  const netMargin = profitability?.netProfitMarginPercentage
  const inventoryValuation = balanceMetrics?.inventoryValuationAtCost
  const activeSkus = balanceMetrics?.totalActiveSkus
  const totalCustomers = balanceMetrics?.totalCustomers

  return (
    <div className="space-y-6">
      {/* Top Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Operations & Financial Overview
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Real-time business performance, margins, and operational health
          </p>
        </div>

        {/* Period Filter Dropdown */}
        <div className="flex items-center gap-2">
          <div className="relative">
            <select
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
              className="pl-8 pr-4 py-2 text-xs font-semibold bg-white border border-slate-200/90 rounded-xl text-slate-700 hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-2xs cursor-pointer"
            >
              <option value="all">All-Time Performance</option>
              <option value="90d">Last 90 Days</option>
              <option value="30d">Last 30 Days</option>
            </select>
            <Calendar className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5 pointer-events-none" />
          </div>
        </div>
      </div>

      {error && <AlertBanner type="error" message={error} onDismiss={() => setError(null)} />}

      {/* Primary KPI Grid (6 metrics) */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <StatCard
          title="Total Revenue"
          value={formatCurrency(totalRevenue, currency)}
          subtitle={totalOrders ? `${formatNumber(totalOrders)} orders completed` : null}
          icon="revenue"
          loading={loading}
        />
        <StatCard
          title="Orders Count"
          value={formatNumber(totalOrders)}
          subtitle="Customer transactions"
          icon="sales"
          loading={loading}
        />
        <StatCard
          title="Avg Order Value"
          value={formatCurrency(aov, currency)}
          subtitle="Revenue per transaction"
          icon="transactions"
          loading={loading}
        />
        <StatCard
          title="Gross Profit"
          value={formatCurrency(grossProfit, currency)}
          subtitle={grossMargin !== undefined ? `${formatPercent(grossMargin)} margin` : null}
          icon="profit"
          loading={loading}
        />
        <StatCard
          title="Net Profit"
          value={formatCurrency(netProfit, currency)}
          subtitle={netMargin !== undefined ? `${formatPercent(netMargin)} net margin` : null}
          icon="profit"
          loading={loading}
        />
        <StatCard
          title="Stock Valuation"
          value={formatCurrency(inventoryValuation, currency)}
          subtitle={activeSkus ? `${formatNumber(activeSkus)} active SKUs` : null}
          icon="inventory"
          loading={loading}
        />
      </section>

      {/* Main Charts Row */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Revenue & Volume Trend Chart (2 columns) */}
        <div className="lg:col-span-2 bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-4 border-b border-slate-100 gap-2">
            <div>
              <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-indigo-600" />
                Revenue & Sales Trajectory
              </h2>
              <p className="text-xs text-slate-500">
                Chronological revenue stream & daily transaction counts
              </p>
            </div>
            <div className="flex items-center gap-4 text-xs font-medium">
              <span className="flex items-center gap-1.5 text-slate-600">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
                Revenue
              </span>
              <span className="flex items-center gap-1.5 text-slate-600">
                <span className="w-2.5 h-2.5 rounded-full bg-indigo-500"></span>
                Orders
              </span>
            </div>
          </div>

          <div className="h-72 w-full pt-4">
            {loading ? (
              <LoadingSpinner size="md" text="Loading chart data..." />
            ) : revenueTrend.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={revenueTrend} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="ordersGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6366f1" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                  <XAxis
                    dataKey="date"
                    stroke="#94a3b8"
                    fontSize={11}
                    tickLine={false}
                    tickFormatter={(val) => {
                      if (!val) return ''
                      const parts = val.split('-')
                      return parts.length >= 3 ? `${parts[1]}/${parts[2]}` : val
                    }}
                  />
                  <YAxis
                    yAxisId="left"
                    stroke="#94a3b8"
                    fontSize={11}
                    tickLine={false}
                    tickFormatter={(val) => `£${val >= 1000 ? `${(val / 1000).toFixed(0)}k` : val}`}
                  />
                  <YAxis
                    yAxisId="right"
                    orientation="right"
                    stroke="#94a3b8"
                    fontSize={11}
                    tickLine={false}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#ffffff',
                      border: '1px solid #e2e8f0',
                      borderRadius: '0.75rem',
                      boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                      fontSize: '12px',
                    }}
                    formatter={(value, name) => [
                      name === 'revenue' ? formatCurrency(value, currency) : value,
                      name === 'revenue' ? 'Revenue' : 'Orders',
                    ]}
                  />
                  <Area
                    yAxisId="left"
                    type="monotone"
                    dataKey="revenue"
                    stroke="#10b981"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#revenueGrad)"
                  />
                  <Area
                    yAxisId="right"
                    type="monotone"
                    dataKey="ordersCount"
                    stroke="#6366f1"
                    strokeWidth={1.5}
                    fillOpacity={1}
                    fill="url(#ordersGrad)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-slate-400 text-sm">
                No revenue trend records available for the selected period.
              </div>
            )}
          </div>
        </div>

        {/* Category Revenue Breakdown (1 column) */}
        <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm flex flex-col">
          <div className="pb-3 border-b border-slate-100">
            <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
              <Layers className="w-4 h-4 text-indigo-600" />
              Category Breakdown
            </h2>
            <p className="text-xs text-slate-500">Sales volume by catalog category</p>
          </div>

          <div className="h-72 w-full pt-4 flex-1">
            {loading ? (
              <LoadingSpinner size="md" text="Loading categories..." />
            ) : categoryBreakdown.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={categoryBreakdown.slice(0, 6)}
                  layout="vertical"
                  margin={{ top: 5, right: 15, left: 20, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                  <XAxis type="number" hide />
                  <YAxis
                    type="category"
                    dataKey="category"
                    stroke="#64748b"
                    fontSize={11}
                    tickLine={false}
                    width={90}
                    tickFormatter={(val) => (val && val.length > 12 ? `${val.substring(0, 12)}…` : val)}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#ffffff',
                      border: '1px solid #e2e8f0',
                      borderRadius: '0.75rem',
                      fontSize: '12px',
                    }}
                    formatter={(val) => [formatCurrency(val, currency), 'Revenue']}
                  />
                  <Bar dataKey="revenue" fill="#6366f1" radius={[0, 6, 6, 0]} barSize={16} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-slate-400 text-sm">
                No category breakdown data.
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Operational Feed: Top Products & Critical Stockout Risks */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Selling Products */}
        <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm">
          <div className="flex items-center justify-between pb-4 border-b border-slate-100">
            <div>
              <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-500" />
                Top Performing Products
              </h2>
              <p className="text-xs text-slate-500">Best-sellers ranked by gross revenue</p>
            </div>
            <Link
              to="/products"
              className="inline-flex items-center text-xs font-semibold text-indigo-600 hover:text-indigo-700"
            >
              Catalog <ArrowRight className="w-3.5 h-3.5 ml-1" />
            </Link>
          </div>

          <div className="mt-4 divide-y divide-slate-100">
            {topProducts.length > 0 ? (
              topProducts.map((p, idx) => (
                <div key={p.sku || idx} className="py-3 flex items-center justify-between">
                  <div className="flex items-center space-x-3 min-w-0">
                    <span className="w-6 h-6 rounded-md bg-slate-100 text-slate-600 flex items-center justify-center text-xs font-bold shrink-0">
                      {idx + 1}
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-800 truncate">
                        {p.productName || p.sku}
                      </p>
                      <p className="text-xs text-slate-400">SKU: {p.sku}</p>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-bold text-slate-900">
                      {formatCurrency(p.totalRevenueGenerated, currency)}
                    </p>
                    <p className="text-xs text-slate-500">
                      {formatNumber(p.totalQuantitySold)} units sold
                    </p>
                  </div>
                </div>
              ))
            ) : (
              <div className="py-8 text-center text-slate-400 text-xs">
                No top product sales recorded yet.
              </div>
            )}
          </div>
        </div>

        {/* Critical Stockout Alerts */}
        <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm">
          <div className="flex items-center justify-between pb-4 border-b border-slate-100">
            <div>
              <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-500" />
                Critical Low Stock Alerts
              </h2>
              <p className="text-xs text-slate-500">SKUs below safety reorder threshold</p>
            </div>
            <Link
              to="/inventory"
              className="inline-flex items-center text-xs font-semibold text-indigo-600 hover:text-indigo-700"
            >
              Manage Stock <ArrowRight className="w-3.5 h-3.5 ml-1" />
            </Link>
          </div>

          <div className="mt-4 divide-y divide-slate-100">
            {lowStockAlerts.length > 0 ? (
              lowStockAlerts.map((prod) => (
                <div key={prod.sku} className="py-3 flex items-center justify-between">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-800 truncate">{prod.name}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs text-slate-400 font-mono">SKU: {prod.sku}</span>
                      <span className="text-slate-300">•</span>
                      <span className="text-xs text-slate-500">{prod.category}</span>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-rose-600 bg-rose-50 border border-rose-200/60 px-2 py-0.5 rounded-full">
                        {prod.currentStock} in stock
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Threshold: {prod.reorderThreshold}
                    </p>
                  </div>
                </div>
              ))
            ) : (
              <div className="py-8 text-center text-emerald-600 text-xs font-medium">
                ✓ All catalog SKUs meet or exceed safety reorder thresholds!
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  )
}

export default DashboardPage
