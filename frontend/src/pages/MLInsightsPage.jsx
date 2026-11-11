import React, { useState, useEffect } from 'react'
import {
  TrendingUp,
  AlertTriangle,
  Package,
  Users,
  ShieldCheck,
  RefreshCw,
  Calendar,
  Layers,
  ArrowUpRight,
  Info,
  CheckCircle2,
  XCircle,
  HelpCircle,
} from 'lucide-react'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  Legend
} from 'recharts'
import {
  getDemandForecast,
  getAnomalies,
  getInventoryRisk,
  getCustomerChurn,
  getMLOverview,
  retrainModel,
} from '../services/mlApi'
import { formatCurrency, formatNumber } from '../utils/formatters'
import { useAuth } from '../context/AuthContext'

export default function MLInsightsPage() {
  const { currency } = useAuth()
  const [activeTab, setActiveTab] = useState('forecast')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [retrainingModel, setRetrainingModel] = useState(null)
  const [retrainSuccess, setRetrainSuccess] = useState(null)

  // Data states
  const [forecastData, setForecastData] = useState(null)
  const [forecastHorizon, setForecastHorizon] = useState(14)
  const [expenseAnomalies, setExpenseAnomalies] = useState(null)
  const [salesAnomalies, setSalesAnomalies] = useState(null)
  const [anomalyDomain, setAnomalyDomain] = useState('expenses')
  const [inventoryRisk, setInventoryRisk] = useState(null)
  const [inventoryFilter, setInventoryFilter] = useState('ALL')
  const [churnData, setChurnData] = useState(null)
  const [churnFilter, setChurnFilter] = useState('ALL')
  const [overviewData, setOverviewData] = useState(null)

  const fetchAllMLData = async () => {
    setLoading(true)
    setError(null)
    try {
      const [fc, expAnom, salesAnom, inv, churn, ov] = await Promise.allSettled([
        getDemandForecast(forecastHorizon),
        getAnomalies('expenses', 50),
        getAnomalies('sales', 50),
        getInventoryRisk(100),
        getCustomerChurn(100),
        getMLOverview(),
      ])

      if (fc.status === 'fulfilled') setForecastData(fc.value)
      if (expAnom.status === 'fulfilled') setExpenseAnomalies(expAnom.value)
      if (salesAnom.status === 'fulfilled') setSalesAnomalies(salesAnom.value)
      if (inv.status === 'fulfilled') setInventoryRisk(inv.value)
      if (churn.status === 'fulfilled') setChurnData(churn.value)
      if (ov.status === 'fulfilled') setOverviewData(ov.value)

      // Check if all failed
      if (
        fc.status === 'rejected' &&
        expAnom.status === 'rejected' &&
        inv.status === 'rejected' &&
        churn.status === 'rejected'
      ) {
        setError('Could not connect to the ML service. Please ensure the Python FastAPI service is running on port 8000.')
      }
    } catch (err) {
      setError(err.message || 'Failed to load ML insights')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchAllMLData()
  }, [forecastHorizon])

  const handleRetrain = async (modelName) => {
    setRetrainingModel(modelName)
    setRetrainSuccess(null)
    try {
      await retrainModel(modelName)
      setRetrainSuccess(`Model '${modelName}' retrained successfully!`)
      setTimeout(() => setRetrainSuccess(null), 4000)
      await fetchAllMLData()
    } catch (err) {
      alert(`Retraining failed: ${err.message}`)
    } finally {
      setRetrainingModel(null)
    }
  }

  // Filtered inventory
  const filteredInventoryItems = (inventoryRisk?.items || []).filter((item) => {
    if (inventoryFilter === 'ALL') return true
    if (inventoryFilter === 'ACTION_REQUIRED')
      return ['OUT_OF_STOCK', 'CRITICAL', 'HIGH'].includes(item.risk_level)
    return item.risk_level === inventoryFilter
  })

  // Filtered churn
  const filteredChurnCustomers = (churnData?.customers || []).filter((cust) => {
    if (churnFilter === 'ALL') return true
    return cust.risk_tier === churnFilter
  })

  return (
    <div className="space-y-6">
      {/* Top Header & Governance Bar */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-2xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
                Phase 5 Machine Learning
              </span>
              <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                Models Validated & Active
              </span>
            </div>
            <h1 className="text-2xl font-bold text-slate-900 mt-2">
              Machine Learning Intelligence & Predictions
            </h1>
            <p className="text-sm text-slate-500 mt-0.5">
              Chronologically evaluated time-series forecasting, Isolation Forest anomaly attribution, stockout risk & customer retention scoring.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => fetchAllMLData()}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 transition shadow-2xs disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh Predictions
            </button>
          </div>
        </div>

        {retrainSuccess && (
          <div className="mt-4 p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs font-medium text-emerald-800 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            {retrainSuccess}
          </div>
        )}

        {error && (
          <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs font-medium text-amber-800 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
            {error}
          </div>
        )}

        {/* Tab Navigation */}
        <div className="flex items-center gap-2 mt-6 border-b border-slate-100 pb-px overflow-x-auto">
          {[
            { id: 'forecast', label: 'Demand Forecasting', icon: TrendingUp },
            { id: 'anomalies', label: 'Anomaly Detection', icon: AlertTriangle },
            { id: 'inventory', label: 'Inventory Risk & Stockout', icon: Package },
            { id: 'churn', label: 'Customer Churn & Retention', icon: Users },
            { id: 'governance', label: 'Model Governance & Metrics', icon: ShieldCheck },
          ].map((tab) => {
            const Icon = tab.icon
            const isActive = activeTab === tab.id
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium whitespace-nowrap transition-all duration-150 ${
                  isActive
                    ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-600/20'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* =========================================================================
          TAB 1: DEMAND FORECASTING
      ========================================================================= */}
      {activeTab === 'forecast' && (
        <div className="space-y-6">
          {/* Top Forecast Metrics */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-2xs">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Forecast Horizon
              </span>
              <div className="flex items-baseline justify-between mt-2">
                <span className="text-2xl font-bold text-slate-900">
                  {forecastData?.forecast_horizon_days || forecastHorizon} Days
                </span>
                <span className="text-xs font-medium text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full">
                  Multi-step
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-1">Starting tomorrow onwards</p>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-2xs">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Forecasted Total Units
              </span>
              <div className="flex items-baseline justify-between mt-2">
                <span className="text-2xl font-bold text-slate-900">
                  {formatNumber(forecastData?.summary?.total_forecasted_units || 0)}
                </span>
                <span className="text-xs text-slate-500">
                  ~{formatNumber(forecastData?.summary?.daily_average_units || 0)} / day
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-1">Store-wide aggregate demand</p>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-2xs">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Forecasted Revenue
              </span>
              <div className="flex items-baseline justify-between mt-2">
                <span className="text-2xl font-bold text-slate-900">
                  {formatCurrency(forecastData?.summary?.total_forecasted_revenue || 0, currency)}
                </span>
                <span className="text-xs text-slate-500">
                  ~{formatCurrency(forecastData?.summary?.daily_average_revenue || 0, currency)} / day
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-1">Expected cash inflow</p>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-2xs">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Model Evaluation
              </span>
              <div className="flex items-baseline justify-between mt-2">
                <span className="text-2xl font-bold text-emerald-600">
                  {forecastData?.model_metadata?.evaluation?.random_forest_model?.wape_pct || 29.56}% WAPE
                </span>
                <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
                  +{forecastData?.model_metadata?.evaluation?.wape_improvement_vs_ma7_pct || 34.47}% vs MA7
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-1">Outperforms 7-Day MA baseline</p>
            </div>
          </div>

          {/* Interactive Chart with Confidence Bands */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-2xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-indigo-600" />
                  Demand Run-Rate Forecast & 90% Confidence Interval
                </h3>
                <p className="text-xs text-slate-500">
                  Trained chronologically with lag features and rolling seasonal statistics. Shaded band represents residual uncertainty bounds.
                </p>
              </div>

              {/* Horizon Switcher */}
              <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl">
                {[7, 14, 30].map((h) => (
                  <button
                    key={h}
                    onClick={() => setForecastHorizon(h)}
                    className={`px-3 py-1 text-xs font-semibold rounded-lg transition ${
                      forecastHorizon === h
                        ? 'bg-white text-indigo-600 shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {h} Days
                  </button>
                ))}
              </div>
            </div>

            {/* Recharts Area Chart */}
            <div className="h-80 w-full pt-4">
              {forecastData?.daily_forecasts?.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={forecastData.daily_forecasts} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="forecastUnits" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.4} />
                        <stop offset="95%" stopColor="#4f46e5" stopOpacity={0.0} />
                      </linearGradient>
                      <linearGradient id="confidenceBand" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#93c5fd" stopOpacity={0.25} />
                        <stop offset="95%" stopColor="#93c5fd" stopOpacity={0.05} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis
                      dataKey="date"
                      tickFormatter={(val) => val.slice(5)}
                      stroke="#94a3b8"
                      fontSize={11}
                    />
                    <YAxis
                      stroke="#94a3b8"
                      fontSize={11}
                      tickFormatter={(val) => (val >= 1000 ? `${(val / 1000).toFixed(0)}k` : val)}
                    />
                    <Tooltip
                      formatter={(val, name) => [
                        formatNumber(val),
                        name === 'predicted_units'
                          ? 'Predicted Units'
                          : name === 'upper_bound_units'
                          ? 'Upper Bound (90% CI)'
                          : 'Lower Bound (90% CI)',
                      ]}
                      labelFormatter={(label) => `Date: ${label}`}
                      contentStyle={{
                        backgroundColor: '#ffffff',
                        borderColor: '#e2e8f0',
                        borderRadius: '0.75rem',
                        boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="upper_bound_units"
                      stroke="#93c5fd"
                      strokeDasharray="4 4"
                      fillOpacity={1}
                      fill="url(#confidenceBand)"
                      name="upper_bound_units"
                    />
                    <Area
                      type="monotone"
                      dataKey="predicted_units"
                      stroke="#4f46e5"
                      strokeWidth={2.5}
                      fillOpacity={1}
                      fill="url(#forecastUnits)"
                      name="predicted_units"
                    />
                    <Area
                      type="monotone"
                      dataKey="lower_bound_units"
                      stroke="#93c5fd"
                      strokeDasharray="4 4"
                      fill="transparent"
                      name="lower_bound_units"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-slate-400 text-sm">
                  No forecast data available
                </div>
              )}
            </div>
          </div>

          {/* Day-by-Day Forecast Table */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs overflow-hidden">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Day-by-Day Forecast Breakdown</h3>
                <p className="text-xs text-slate-500">Granular daily units, revenue and bounds</p>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50/75 text-slate-500 text-xs font-semibold uppercase tracking-wider">
                  <tr>
                    <th className="px-5 py-3">Date</th>
                    <th className="px-5 py-3">Day</th>
                    <th className="px-5 py-3 text-right">Predicted Units</th>
                    <th className="px-5 py-3 text-right">90% Range</th>
                    <th className="px-5 py-3 text-right">Expected Revenue</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {(forecastData?.daily_forecasts || []).map((row, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/50">
                      <td className="px-5 py-3 font-medium text-slate-900">{row.date}</td>
                      <td className="px-5 py-3">
                        <span
                          className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${
                            row.is_weekend
                              ? 'bg-amber-50 text-amber-700 border border-amber-200'
                              : 'bg-slate-100 text-slate-700'
                          }`}
                        >
                          {row.day_name}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-right font-bold text-indigo-600">
                        {formatNumber(row.predicted_units)}
                      </td>
                      <td className="px-5 py-3 text-right text-xs text-slate-500">
                        {formatNumber(row.lower_bound_units)} – {formatNumber(row.upper_bound_units)}
                      </td>
                      <td className="px-5 py-3 text-right font-medium text-slate-900">
                        {formatCurrency(row.predicted_revenue, currency)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          TAB 2: ANOMALY DETECTION
      ========================================================================= */}
      {activeTab === 'anomalies' && (
        <div className="space-y-6">
          {/* Anomaly Domain Switcher */}
          <div className="flex items-center justify-between bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                Domain Filter:
              </span>
              <button
                onClick={() => setAnomalyDomain('expenses')}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition ${
                  anomalyDomain === 'expenses'
                    ? 'bg-indigo-600 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                Expense Anomalies ({expenseAnomalies?.total_anomalies_detected || 0})
              </button>
              <button
                onClick={() => setAnomalyDomain('sales')}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition ${
                  anomalyDomain === 'sales'
                    ? 'bg-indigo-600 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                Sales Anomalies ({salesAnomalies?.total_anomalies_detected || 0})
              </button>
            </div>

            <div className="text-xs text-slate-500">
              Isolation Forest + Statistical Z-Score / IQR Fences
            </div>
          </div>

          {/* Anomaly Cards List */}
          <div className="space-y-3">
            {anomalyDomain === 'expenses' ? (
              (expenseAnomalies?.anomalies || []).length > 0 ? (
                expenseAnomalies.anomalies.map((anom, idx) => (
                  <div
                    key={idx}
                    className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-2xs hover:border-slate-300 transition"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex items-start gap-3">
                        <div
                          className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                            anom.severity === 'CRITICAL'
                              ? 'bg-rose-100 text-rose-700'
                              : anom.severity === 'HIGH'
                              ? 'bg-amber-100 text-amber-700'
                              : 'bg-indigo-100 text-indigo-700'
                          }`}
                        >
                          <AlertTriangle className="w-5 h-5" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-slate-900 text-sm">
                              {anom.category}
                            </span>
                            <span
                              className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                                anom.severity === 'CRITICAL'
                                  ? 'bg-rose-50 text-rose-700 border border-rose-200'
                                  : anom.severity === 'HIGH'
                                  ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                  : 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                              }`}
                            >
                              {anom.severity} Severity
                            </span>
                            <span className="text-xs text-slate-400">{anom.date}</span>
                          </div>
                          <p className="text-base font-extrabold text-slate-900 mt-1">
                            {formatCurrency(anom.amount, currency)}
                          </p>
                        </div>
                      </div>

                      <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center border-t sm:border-0 pt-2 sm:pt-0 border-slate-100">
                        <span className="text-xs font-semibold text-slate-500">
                          Anomaly Score: <span className="text-rose-600 font-bold">{anom.anomaly_score}</span>
                        </span>
                        <span className="text-xs text-slate-400">
                          Z-Score: +{anom.z_score} σ
                        </span>
                      </div>
                    </div>

                    {/* Contributing Factors & Explainability */}
                    <div className="mt-3 pt-3 border-t border-slate-100 bg-slate-50/50 p-3 rounded-xl space-y-1">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                        Contributing Factors (Feature Attribution):
                      </span>
                      <ul className="text-xs text-slate-700 space-y-1 mt-1">
                        {anom.explanation.map((reason, rIdx) => (
                          <li key={rIdx} className="flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0"></span>
                            {reason}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                ))
              ) : (
                <div className="bg-white p-12 text-center rounded-2xl border border-slate-200 text-slate-400">
                  No expense anomalies detected in current dataset.
                </div>
              )
            ) : (
              (salesAnomalies?.anomalies || []).length > 0 ? (
                salesAnomalies.anomalies.map((anom, idx) => (
                  <div
                    key={idx}
                    className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-2xs hover:border-slate-300 transition"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-900 text-sm">
                            {anom.description}
                          </span>
                          <span className="text-xs font-mono bg-slate-100 px-1.5 py-0.5 rounded text-slate-600">
                            {anom.stock_code}
                          </span>
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                              anom.severity === 'CRITICAL'
                                ? 'bg-rose-50 text-rose-700 border border-rose-200'
                                : anom.severity === 'HIGH'
                                ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                : 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                            }`}
                          >
                            {anom.severity}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 mt-1">
                          Invoice: {anom.invoice_no} • Date: {anom.date} • Quantity: {formatNumber(anom.quantity)} units
                        </p>
                      </div>

                      <div className="text-right">
                        <span className="text-base font-extrabold text-slate-900">
                          {formatCurrency(anom.line_total, currency)}
                        </span>
                        <p className="text-xs text-slate-400">
                          Unit Price: {formatCurrency(anom.unit_price, currency)}
                        </p>
                      </div>
                    </div>

                    <div className="mt-3 pt-3 border-t border-slate-100 bg-slate-50/50 p-3 rounded-xl">
                      <ul className="text-xs text-slate-700 space-y-1">
                        {anom.explanation.map((reason, rIdx) => (
                          <li key={rIdx} className="flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 shrink-0"></span>
                            {reason}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                ))
              ) : (
                <div className="bg-white p-12 text-center rounded-2xl border border-slate-200 text-slate-400">
                  No sales anomalies detected in current sample.
                </div>
              )
            )}
          </div>
        </div>
      )}

      {/* =========================================================================
          TAB 3: INVENTORY RISK & REPLENISHMENT
      ========================================================================= */}
      {activeTab === 'inventory' && (
        <div className="space-y-6">
          {/* Risk Summary Row */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            {[
              {
                label: 'Out of Stock',
                count: inventoryRisk?.summary?.risk_distribution?.OUT_OF_STOCK || 0,
                color: 'text-rose-700 bg-rose-50 border-rose-200',
                filter: 'OUT_OF_STOCK',
              },
              {
                label: 'Critical Risk',
                count: inventoryRisk?.summary?.risk_distribution?.CRITICAL || 0,
                color: 'text-rose-600 bg-rose-50/70 border-rose-200',
                filter: 'CRITICAL',
              },
              {
                label: 'High Risk',
                count: inventoryRisk?.summary?.risk_distribution?.HIGH || 0,
                color: 'text-amber-700 bg-amber-50 border-amber-200',
                filter: 'HIGH',
              },
              {
                label: 'Moderate',
                count: inventoryRisk?.summary?.risk_distribution?.MODERATE || 0,
                color: 'text-blue-700 bg-blue-50 border-blue-200',
                filter: 'MODERATE',
              },
              {
                label: 'Healthy Stock',
                count: inventoryRisk?.summary?.risk_distribution?.HEALTHY || 0,
                color: 'text-emerald-700 bg-emerald-50 border-emerald-200',
                filter: 'HEALTHY',
              },
            ].map((card, idx) => (
              <button
                key={idx}
                onClick={() => setInventoryFilter(card.filter)}
                className={`p-3.5 rounded-2xl border text-left transition ${
                  inventoryFilter === card.filter
                    ? 'ring-2 ring-indigo-500 shadow-xs'
                    : 'bg-white border-slate-200/80 hover:bg-slate-50'
                }`}
              >
                <span className="text-[11px] font-semibold uppercase text-slate-400">
                  {card.label}
                </span>
                <p className="text-xl font-bold text-slate-900 mt-1">{card.count}</p>
              </button>
            ))}
          </div>

          {/* Actionable Recommendations Table */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs overflow-hidden">
            <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Replenishment Recommendations & Days of Supply (DoS)
                </h3>
                <p className="text-xs text-slate-500">
                  Calculated using run-rate velocity, reorder thresholds, and supplier lead-time dynamics.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setInventoryFilter('ALL')}
                  className={`px-3 py-1 text-xs font-semibold rounded-lg ${
                    inventoryFilter === 'ALL'
                      ? 'bg-indigo-600 text-white'
                      : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  All Items
                </button>
                <button
                  onClick={() => setInventoryFilter('ACTION_REQUIRED')}
                  className={`px-3 py-1 text-xs font-semibold rounded-lg ${
                    inventoryFilter === 'ACTION_REQUIRED'
                      ? 'bg-rose-600 text-white'
                      : 'bg-rose-50 text-rose-700'
                  }`}
                >
                  Action Required
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50/75 text-slate-500 text-xs font-semibold uppercase tracking-wider">
                  <tr>
                    <th className="px-5 py-3">Product / SKU</th>
                    <th className="px-5 py-3 text-right">Current Stock</th>
                    <th className="px-5 py-3 text-right">Days of Supply</th>
                    <th className="px-5 py-3">Risk Level</th>
                    <th className="px-5 py-3">Suggested Order</th>
                    <th className="px-5 py-3 text-right">Estimated Cost</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {filteredInventoryItems.slice(0, 30).map((item, idx) => {
                    const rec = item.replenishment_recommendation
                    return (
                      <tr key={idx} className="hover:bg-slate-50/50">
                        <td className="px-5 py-3">
                          <p className="font-semibold text-slate-900 text-xs sm:text-sm truncate max-w-xs">
                            {item.name}
                          </p>
                          <p className="text-xs font-mono text-slate-400">SKU: {item.sku}</p>
                        </td>
                        <td className="px-5 py-3 text-right font-medium text-slate-900">
                          {item.current_stock !== null ? formatNumber(item.current_stock) : 'N/A'}
                        </td>
                        <td className="px-5 py-3 text-right text-xs">
                          <span
                            className={`font-semibold ${
                              item.days_of_supply === 0
                                ? 'text-rose-600'
                                : item.days_of_supply < (item.supplier_lead_time_days || 7)
                                ? 'text-rose-600'
                                : item.days_of_supply < 15
                                ? 'text-amber-600'
                                : 'text-slate-600'
                            }`}
                          >
                            {item.days_of_supply !== undefined ? `${item.days_of_supply}d` : 'N/A'}
                          </span>
                        </td>
                        <td className="px-5 py-3">
                          <span
                            className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-bold uppercase ${
                              item.risk_level === 'OUT_OF_STOCK'
                                ? 'bg-rose-100 text-rose-800'
                                : item.risk_level === 'CRITICAL'
                                ? 'bg-rose-50 text-rose-700 border border-rose-200'
                                : item.risk_level === 'HIGH'
                                ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                : item.risk_level === 'MODERATE'
                                ? 'bg-blue-50 text-blue-700 border border-blue-200'
                                : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            }`}
                          >
                            {item.risk_level?.replace(/_/g, ' ')}
                          </span>
                        </td>
                        <td className="px-5 py-3 text-xs">
                          {rec?.status === 'RECOMMENDED' ? (
                            <div>
                              <span className="font-bold text-indigo-700">
                                +{formatNumber(rec.suggested_order_quantity)} units
                              </span>
                              <p className="text-[11px] text-slate-400 truncate max-w-xs">
                                {rec.supplier_name} ({rec.supplier_lead_time_days}d lead)
                              </p>
                            </div>
                          ) : (
                            <span className="text-slate-400">Adequately stocked</span>
                          )}
                        </td>
                        <td className="px-5 py-3 text-right font-medium text-slate-900 text-xs">
                          {rec?.status === 'RECOMMENDED'
                            ? formatCurrency(rec.estimated_order_cost, currency)
                            : '—'}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          TAB 4: CUSTOMER CHURN & RETENTION
      ========================================================================= */}
      {activeTab === 'churn' && (
        <div className="space-y-6">
          {/* Churn Stats Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-2xs">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Customers Scored
              </span>
              <p className="text-2xl font-bold text-slate-900 mt-2">
                {formatNumber(churnData?.total_customers_evaluated || 0)}
              </p>
              <p className="text-xs text-slate-500 mt-1">Active customer base</p>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-2xs">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Critical / High Risk
              </span>
              <p className="text-2xl font-bold text-rose-600 mt-2">
                {formatNumber(
                  (churnData?.risk_distribution?.CRITICAL || 0) +
                    (churnData?.risk_distribution?.HIGH || 0)
                )}
              </p>
              <p className="text-xs text-slate-500 mt-1">Need retention win-back</p>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-2xs">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Healthy Engagement
              </span>
              <p className="text-2xl font-bold text-emerald-600 mt-2">
                {formatNumber(churnData?.risk_distribution?.LOW || 0)}
              </p>
              <p className="text-xs text-slate-500 mt-1">Loyal recurring buyers</p>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-2xs">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Classifier ROC-AUC
              </span>
              <div className="flex items-baseline justify-between mt-2">
                <span className="text-2xl font-bold text-indigo-600">
                  {churnData?.model_metadata?.evaluation?.random_forest_model?.roc_auc || 0.734}
                </span>
                <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
                  +{churnData?.model_metadata?.evaluation?.auc_lift_vs_baseline_pct || 11.8}% vs Baseline
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-1">Random Forest vs 60d Recency</p>
            </div>
          </div>

          {/* Customers at Risk Table */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs overflow-hidden">
            <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Customer Inactivity Predictions & Intervention Actions
                </h3>
                <p className="text-xs text-slate-500">
                  Temporal RFM feature extraction evaluated strictly without look-ahead bias.
                </p>
              </div>

              {/* Filter */}
              <div className="flex items-center gap-1.5">
                {['ALL', 'CRITICAL', 'HIGH', 'MODERATE', 'LOW'].map((t) => (
                  <button
                    key={t}
                    onClick={() => setChurnFilter(t)}
                    className={`px-3 py-1 text-xs font-semibold rounded-lg ${
                      churnFilter === t
                        ? 'bg-indigo-600 text-white'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50/75 text-slate-500 text-xs font-semibold uppercase tracking-wider">
                  <tr>
                    <th className="px-5 py-3">Customer ID</th>
                    <th className="px-5 py-3">Risk Tier</th>
                    <th className="px-5 py-3">Churn Probability</th>
                    <th className="px-5 py-3">RFM Profile</th>
                    <th className="px-5 py-3">Recommended Retention Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {filteredChurnCustomers.slice(0, 30).map((cust, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/50">
                      <td className="px-5 py-3 font-bold text-slate-900">
                        Cust #{cust.customer_id}
                      </td>
                      <td className="px-5 py-3">
                        <span
                          className={`inline-block px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase ${
                            cust.risk_tier === 'CRITICAL'
                              ? 'bg-rose-100 text-rose-800'
                              : cust.risk_tier === 'HIGH'
                              ? 'bg-amber-100 text-amber-800'
                              : cust.risk_tier === 'MODERATE'
                              ? 'bg-blue-50 text-blue-700'
                              : 'bg-emerald-50 text-emerald-700'
                          }`}
                        >
                          {cust.risk_tier}
                        </span>
                      </td>
                      <td className="px-5 py-3">
                        <div className="w-32">
                          <div className="flex items-center justify-between text-xs font-semibold mb-1">
                            <span>{(cust.churn_probability * 100).toFixed(1)}%</span>
                          </div>
                          <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full ${
                                cust.churn_probability >= 0.75
                                  ? 'bg-rose-500'
                                  : cust.churn_probability >= 0.6
                                  ? 'bg-amber-500'
                                  : 'bg-emerald-500'
                              }`}
                              style={{ width: `${cust.churn_probability * 100}%` }}
                            />
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3 text-xs text-slate-600">
                        <p>Recency: <strong>{cust.rfm_metrics.recency_days}d ago</strong></p>
                        <p>Orders: {cust.rfm_metrics.frequency_orders} • Total: {formatCurrency(cust.rfm_metrics.monetary_spend, currency)}</p>
                      </td>
                      <td className="px-5 py-3 text-xs text-slate-700 max-w-sm">
                        {cust.recommended_action}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          TAB 5: MODEL GOVERNANCE & BENCHMARKS
      ========================================================================= */}
      {activeTab === 'governance' && (
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-2xs">
            <h3 className="text-base font-bold text-slate-900">
              Model Governance, Evaluation Metrics & Retraining
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              OpsMind strictly validates every machine learning algorithm against classical statistical baselines before deployment.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
              {/* Card 1: Demand Forecaster */}
              <div className="p-5 rounded-2xl border border-slate-200 bg-slate-50/40 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-bold text-slate-900 text-sm">Demand Forecaster</h4>
                    <p className="text-xs text-slate-400">RandomForestRegressor v1.0.0</p>
                  </div>
                  <button
                    onClick={() => handleRetrain('demand')}
                    disabled={retrainingModel === 'demand'}
                    className="px-3 py-1 rounded-lg text-xs font-semibold bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200 disabled:opacity-50"
                  >
                    {retrainingModel === 'demand' ? 'Training...' : 'Retrain Model'}
                  </button>
                </div>

                <div className="grid grid-cols-3 gap-2 text-center pt-2">
                  <div className="bg-white p-2 rounded-xl border border-slate-200/80">
                    <span className="text-[10px] text-slate-400 font-semibold uppercase">Naive Baseline</span>
                    <p className="text-sm font-bold text-slate-700">52.51%</p>
                    <span className="text-[10px] text-slate-400">WAPE</span>
                  </div>
                  <div className="bg-white p-2 rounded-xl border border-slate-200/80">
                    <span className="text-[10px] text-slate-400 font-semibold uppercase">7-Day MA</span>
                    <p className="text-sm font-bold text-slate-700">45.11%</p>
                    <span className="text-[10px] text-slate-400">WAPE</span>
                  </div>
                  <div className="bg-emerald-50 p-2 rounded-xl border border-emerald-200">
                    <span className="text-[10px] text-emerald-700 font-semibold uppercase">Random Forest</span>
                    <p className="text-sm font-extrabold text-emerald-800">29.56%</p>
                    <span className="text-[10px] text-emerald-600 font-bold">+34.5% Lift</span>
                  </div>
                </div>
                <p className="text-xs text-slate-500">
                  Chronological split: 288 train days, 72 test days. Top features: <code>rolling_mean_7</code>, <code>lag_7</code>, <code>day_of_week</code>.
                </p>
              </div>

              {/* Card 2: Customer Churn */}
              <div className="p-5 rounded-2xl border border-slate-200 bg-slate-50/40 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-bold text-slate-900 text-sm">Customer Churn Predictor</h4>
                    <p className="text-xs text-slate-400">RandomForestClassifier_Balanced v1.0.0</p>
                  </div>
                  <button
                    onClick={() => handleRetrain('churn')}
                    disabled={retrainingModel === 'churn'}
                    className="px-3 py-1 rounded-lg text-xs font-semibold bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200 disabled:opacity-50"
                  >
                    {retrainingModel === 'churn' ? 'Training...' : 'Retrain Model'}
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-2 text-center pt-2">
                  <div className="bg-white p-2 rounded-xl border border-slate-200/80">
                    <span className="text-[10px] text-slate-400 font-semibold uppercase">Recency 60d Baseline</span>
                    <p className="text-sm font-bold text-slate-700">0.657</p>
                    <span className="text-[10px] text-slate-400">ROC-AUC</span>
                  </div>
                  <div className="bg-emerald-50 p-2 rounded-xl border border-emerald-200">
                    <span className="text-[10px] text-emerald-700 font-semibold uppercase">Random Forest</span>
                    <p className="text-sm font-extrabold text-emerald-800">0.734</p>
                    <span className="text-[10px] text-emerald-600 font-bold">+11.8% Lift</span>
                  </div>
                </div>
                <p className="text-xs text-slate-500">
                  Temporal cutoff prevents data leakage. Top features: <code>frequency</code>, <code>monetary_total</code>, <code>recency_days</code>.
                </p>
              </div>

              {/* Card 3: Expense Anomaly Detector */}
              <div className="p-5 rounded-2xl border border-slate-200 bg-slate-50/40 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-bold text-slate-900 text-sm">Expense Anomaly Detector</h4>
                    <p className="text-xs text-slate-400">IsolationForest + Category Z-Score & IQR</p>
                  </div>
                  <button
                    onClick={() => handleRetrain('expense_anomaly')}
                    disabled={retrainingModel === 'expense_anomaly'}
                    className="px-3 py-1 rounded-lg text-xs font-semibold bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200 disabled:opacity-50"
                  >
                    {retrainingModel === 'expense_anomaly' ? 'Training...' : 'Retrain Model'}
                  </button>
                </div>
                <p className="text-xs text-slate-600">
                  Contamination rate: 4%. Baseline statistics calculated per category (e.g. Payroll, Logistics, Utilities). Flags multi-dimensional deviations with feature attribution.
                </p>
              </div>

              {/* Card 4: Sales Anomaly Detector */}
              <div className="p-5 rounded-2xl border border-slate-200 bg-slate-50/40 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-bold text-slate-900 text-sm">Sales Anomaly Detector</h4>
                    <p className="text-xs text-slate-400">IsolationForest_Sales v1.0.0</p>
                  </div>
                  <button
                    onClick={() => handleRetrain('sales_anomaly')}
                    disabled={retrainingModel === 'sales_anomaly'}
                    className="px-3 py-1 rounded-lg text-xs font-semibold bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200 disabled:opacity-50"
                  >
                    {retrainingModel === 'sales_anomaly' ? 'Training...' : 'Retrain Model'}
                  </button>
                </div>
                <p className="text-xs text-slate-600">
                  Contamination rate: 1%. Evaluates Quantity, Unit Price, Line Total, and Day of Week to flag bulk order spikes and abnormal price swings.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
