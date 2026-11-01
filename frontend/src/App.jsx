import React, { useState, useEffect } from 'react'
import {
  Activity,
  AlertTriangle,
  ArrowUpRight,
  Bot,
  Box,
  CheckCircle2,
  Database,
  DollarSign,
  RefreshCw,
  Server,
  Sparkles,
  TrendingUp,
  Users,
  XCircle
} from 'lucide-react'
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid
} from 'recharts'
import api from './services/api'

const sampleSalesData = [
  { day: 'Mon', revenue: 2400, forecast: 2200 },
  { day: 'Tue', revenue: 1398, forecast: 2100 },
  { day: 'Wed', revenue: 9800, forecast: 3500 },
  { day: 'Thu', revenue: 3908, forecast: 3800 },
  { day: 'Fri', revenue: 4800, forecast: 4200 },
  { day: 'Sat', revenue: 6800, forecast: 5900 },
  { day: 'Sun', revenue: 4300, forecast: 4600 },
]

export default function App() {
  const [systemHealth, setSystemHealth] = useState(null)
  const [loading, setLoading] = useState(true)
  const [lastChecked, setLastChecked] = useState(null)

  const fetchHealth = async () => {
    setLoading(true)
    try {
      const response = await api.get('/health')
      setSystemHealth(response.data)
      setLastChecked(new Date().toLocaleTimeString())
    } catch (err) {
      console.warn('Backend not responding yet:', err)
      setSystemHealth(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchHealth()
  }, [])

  const isBackendHealthy = systemHealth?.status === 'healthy' || systemHealth?.status === 'partially_degraded'
  const isDbHealthy = systemHealth?.database?.status === 'connected'
  const isMlHealthy = systemHealth?.mlService?.status === 'connected'

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      {/* Top Navigation */}
      <header className="border-b border-slate-800 bg-slate-900/50 backdrop-blur sticky top-0 z-50 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-400 flex items-center justify-center shadow-lg shadow-emerald-500/20">
            <Bot className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
              OpsMind <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">Phase 0 Foundation</span>
            </h1>
            <p className="text-xs text-slate-400">AI-Powered Operations Copilot for SMEs</p>
          </div>
        </div>

        <button
          onClick={fetchHealth}
          disabled={loading}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-750 border border-slate-700 text-xs text-slate-300 transition-colors"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-emerald-400' : ''}`} />
          <span>Refresh Status</span>
          {lastChecked && <span className="text-slate-500 text-[10px]">({lastChecked})</span>}
        </button>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-6 space-y-6">
        {/* Architecture Service Health Cards */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-2">
              <Activity className="w-4 h-4 text-emerald-400" />
              Service Communication & Inter-Tier Health
            </h2>
            <span className="text-xs text-slate-500">Auto-detected via Node.js Express Gateway</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Frontend Card */}
            <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400">
                  <Activity className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-xs text-slate-400">Frontend Client</p>
                  <p className="text-sm font-semibold text-white">React + Vite</p>
                  <p className="text-[11px] text-slate-500">Port 5173</p>
                </div>
              </div>
              <CheckCircle2 className="w-5 h-5 text-emerald-400" />
            </div>

            {/* Backend Card */}
            <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${isBackendHealthy ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'}`}>
                  <Server className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-xs text-slate-400">Main Backend</p>
                  <p className="text-sm font-semibold text-white">Express.js</p>
                  <p className="text-[11px] text-slate-500">Port 5000 &bull; {isBackendHealthy ? 'Running' : 'Offline'}</p>
                </div>
              </div>
              {isBackendHealthy ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-400" />
              ) : (
                <XCircle className="w-5 h-5 text-rose-500" />
              )}
            </div>

            {/* Database Card */}
            <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${isDbHealthy ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'}`}>
                  <Database className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-xs text-slate-400">Data Store</p>
                  <p className="text-sm font-semibold text-white">MongoDB</p>
                  <p className="text-[11px] text-slate-500">Port 27017 &bull; {isDbHealthy ? 'Connected' : 'Disconnected'}</p>
                </div>
              </div>
              {isDbHealthy ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-400" />
              ) : (
                <XCircle className="w-5 h-5 text-rose-500" />
              )}
            </div>

            {/* ML & AI Service Card */}
            <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${isMlHealthy ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'}`}>
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-xs text-slate-400">ML & AI Service</p>
                  <p className="text-sm font-semibold text-white">Python FastAPI</p>
                  <p className="text-[11px] text-slate-500">Port 8000 &bull; {isMlHealthy ? 'Connected' : 'Offline'}</p>
                </div>
              </div>
              {isMlHealthy ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-400" />
              ) : (
                <XCircle className="w-5 h-5 text-rose-500" />
              )}
            </div>
          </div>
        </section>

        {/* Operational KPI Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-5 rounded-xl bg-slate-900 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between text-slate-400">
              <span className="text-xs font-medium uppercase tracking-wider">Weekly Revenue</span>
              <DollarSign className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="flex items-baseline justify-between">
              <span className="text-2xl font-bold text-white">$33,406</span>
              <span className="inline-flex items-center text-xs text-emerald-400 font-medium">
                +12.4% <ArrowUpRight className="w-3.5 h-3.5 ml-0.5" />
              </span>
            </div>
            <p className="text-xs text-slate-500">Aggregated via Express & MongoDB</p>
          </div>

          <div className="p-5 rounded-xl bg-slate-900 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between text-slate-400">
              <span className="text-xs font-medium uppercase tracking-wider">Active Products</span>
              <Box className="w-4 h-4 text-blue-400" />
            </div>
            <div className="flex items-baseline justify-between">
              <span className="text-2xl font-bold text-white">4,280</span>
              <span className="text-xs text-slate-400">SKUs tracked</span>
            </div>
            <p className="text-xs text-slate-500">Tenant-isolated catalog</p>
          </div>

          <div className="p-5 rounded-xl bg-slate-900 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between text-slate-400">
              <span className="text-xs font-medium uppercase tracking-wider">Stockout Risks</span>
              <AlertTriangle className="w-4 h-4 text-amber-400" />
            </div>
            <div className="flex items-baseline justify-between">
              <span className="text-2xl font-bold text-amber-400">14 Items</span>
              <span className="text-xs text-amber-500/80 font-medium">Needs Review</span>
            </div>
            <p className="text-xs text-slate-500">Evaluated by FastAPI ML Service</p>
          </div>

          <div className="p-5 rounded-xl bg-slate-900 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between text-slate-400">
              <span className="text-xs font-medium uppercase tracking-wider">Customer Retention</span>
              <Users className="w-4 h-4 text-indigo-400" />
            </div>
            <div className="flex items-baseline justify-between">
              <span className="text-2xl font-bold text-white">87.2%</span>
              <span className="text-xs text-indigo-400 font-medium">RFM Score A</span>
            </div>
            <p className="text-xs text-slate-500">Monitored for churn risk</p>
          </div>
        </div>

        {/* Operational Trend Chart */}
        <section className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-semibold text-white">Weekly Revenue vs. Projected Demand</h3>
              <p className="text-xs text-slate-400">Recharts rendering linked to design system</p>
            </div>
            <div className="flex items-center gap-4 text-xs">
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-full bg-emerald-500"></span>
                <span className="text-slate-300">Actual Revenue</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-full bg-blue-500"></span>
                <span className="text-slate-300">ML Forecast</span>
              </div>
            </div>
          </div>

          <div className="h-64 w-full pt-4">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={sampleSalesData}>
                <defs>
                  <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.4}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorForecast" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="day" stroke="#94a3b8" fontSize={12} tickLine={false} />
                <YAxis stroke="#94a3b8" fontSize={12} tickLine={false} tickFormatter={(val) => `$${val}`} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '0.75rem', color: '#f8fafc' }}
                />
                <Area type="monotone" dataKey="revenue" stroke="#10b981" strokeWidth={2} fillOpacity={1} fill="url(#colorRevenue)" />
                <Area type="monotone" dataKey="forecast" stroke="#3b82f6" strokeWidth={2} strokeDasharray="4 4" fillOpacity={1} fill="url(#colorForecast)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800/80 px-6 py-4 text-center text-xs text-slate-500">
        OpsMind SME Operations Platform &bull; Phase 0 Foundation Complete
      </footer>
    </div>
  )
}
