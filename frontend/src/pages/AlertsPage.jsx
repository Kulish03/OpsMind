import React, { useState, useEffect, useCallback } from 'react'
import {
  ShieldAlert,
  AlertOctagon,
  AlertTriangle,
  Info,
  RefreshCw,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Filter,
  Search,
  Check,
} from 'lucide-react'
import api from '../services/api'
import { useAuth } from '../context/AuthContext'
import { formatCurrency, formatNumber, formatDate } from '../utils/formatters'
import Badge, { StatusBadge } from '../components/common/Badge'
import AlertBanner from '../components/common/AlertBanner'

export const AlertsPage = () => {
  const { currency, user } = useAuth()
  const [alerts, setAlerts] = useState([])
  const [summary, setSummary] = useState(null)
  const [loading, setLoading] = useState(true)
  const [evaluating, setEvaluating] = useState(false)
  const [statusFilter, setStatusFilter] = useState('OPEN')
  const [severityFilter, setSeverityFilter] = useState('all')
  const [typeFilter, setTypeFilter] = useState('all')
  const [expandedAlerts, setExpandedAlerts] = useState({})
  const [successMsg, setSuccessMsg] = useState(null)
  const [errorMsg, setErrorMsg] = useState(null)

  const fetchAlertsAndSummary = useCallback(async () => {
    setLoading(true)
    setErrorMsg(null)
    try {
      const params = new URLSearchParams()
      if (statusFilter !== 'all') params.append('status', statusFilter)
      if (severityFilter !== 'all') params.append('severity', severityFilter)
      if (typeFilter !== 'all') params.append('type', typeFilter)

      const [alertsRes, sumRes] = await Promise.all([
        api.get(`/alerts?${params.toString()}`),
        api.get('/alerts/summary'),
      ])

      setAlerts(alertsRes.data?.alerts || [])
      setSummary(sumRes.data || null)
    } catch (err) {
      console.error('Failed to load alerts:', err)
      setErrorMsg(err.response?.data?.message || err.message || 'Failed to retrieve alerts')
    } finally {
      setLoading(false)
    }
  }, [statusFilter, severityFilter, typeFilter])

  useEffect(() => {
    fetchAlertsAndSummary()
  }, [fetchAlertsAndSummary])

  // Scan and evaluate rules
  const handleEvaluate = async () => {
    setEvaluating(true)
    setErrorMsg(null)
    try {
      const res = await api.post('/alerts/evaluate')
      setSuccessMsg(
        `Scanned operational rules. Generated ${res.data?.activeAlerts?.length || 0} active alerts.`
      )
      await fetchAlertsAndSummary()
    } catch (err) {
      setErrorMsg(err.response?.data?.message || err.message || 'Evaluation failed')
    } finally {
      setEvaluating(false)
    }
  }

  // Update status (ACTIONED, DISMISSED, IN_REVIEW)
  const handleUpdateStatus = async (alertId, newStatus) => {
    try {
      await api.patch(`/alerts/${alertId}/status`, {
        status: newStatus,
        notes: `Updated status to ${newStatus} by ${user?.name || 'admin'}`,
      })
      setSuccessMsg(`Alert updated to ${newStatus}`)
      fetchAlertsAndSummary()
    } catch (err) {
      setErrorMsg(err.response?.data?.message || err.message || 'Status update failed')
    }
  }

  const toggleExpand = (id) => {
    setExpandedAlerts((prev) => ({ ...prev, [id]: !prev[id] }))
  }

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <ShieldAlert className="w-6 h-6 text-indigo-600" />
            Operational Alert Center
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Rule-based threshold alerts, low-stock warnings, expense anomalies, and audit records
          </p>
        </div>

        <button
          onClick={handleEvaluate}
          disabled={evaluating}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-sm shadow-sm transition disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${evaluating ? 'animate-spin' : ''}`} />
          <span>{evaluating ? 'Scanning Rules...' : 'Scan Operational Rules'}</span>
        </button>
      </div>

      {errorMsg && <AlertBanner type="error" message={errorMsg} onDismiss={() => setErrorMsg(null)} />}
      {successMsg && (
        <AlertBanner type="success" message={successMsg} onDismiss={() => setSuccessMsg(null)} />
      )}

      {/* Alert KPI Summary Strip */}
      <section className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl bg-white border border-slate-200/80 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Active Alerts
            </p>
            <p className="text-2xl font-bold text-slate-900 mt-1">
              {summary?.totalActiveAlerts || 0}
            </p>
          </div>
          <div className="p-2.5 rounded-xl bg-indigo-50 text-indigo-600 border border-indigo-100">
            <ShieldAlert className="w-5 h-5" />
          </div>
        </div>

        <div className="p-4 rounded-xl bg-white border border-slate-200/80 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-rose-600">
              Critical Stockouts
            </p>
            <p className="text-2xl font-bold text-rose-700 mt-1">
              {summary?.bySeverity?.critical || 0}
            </p>
          </div>
          <div className="p-2.5 rounded-xl bg-rose-50 text-rose-600 border border-rose-100">
            <AlertOctagon className="w-5 h-5" />
          </div>
        </div>

        <div className="p-4 rounded-xl bg-white border border-slate-200/80 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-amber-600">
              High Priority
            </p>
            <p className="text-2xl font-bold text-amber-700 mt-1">
              {summary?.bySeverity?.high || 0}
            </p>
          </div>
          <div className="p-2.5 rounded-xl bg-amber-50 text-amber-600 border border-amber-100">
            <AlertTriangle className="w-5 h-5" />
          </div>
        </div>

        <div className="p-4 rounded-xl bg-white border border-slate-200/80 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-sky-600">
              Medium / Info
            </p>
            <p className="text-2xl font-bold text-sky-700 mt-1">
              {(summary?.bySeverity?.medium || 0) + (summary?.bySeverity?.info || 0)}
            </p>
          </div>
          <div className="p-2.5 rounded-xl bg-sky-50 text-sky-600 border border-sky-100">
            <Info className="w-5 h-5" />
          </div>
        </div>
      </section>

      {/* Filter Bar */}
      <div className="bg-white border border-slate-200/80 rounded-xl p-4 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Filter className="w-4 h-4 text-slate-400 shrink-0" />
          <span className="text-xs font-bold text-slate-700">Filter By:</span>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-700 focus:ring-2 focus:ring-indigo-500"
          >
            <option value="OPEN">Open</option>
            <option value="IN_REVIEW">In Review</option>
            <option value="ACTIONED">Actioned</option>
            <option value="DISMISSED">Dismissed</option>
            <option value="all">All Statuses</option>
          </select>

          <select
            value={severityFilter}
            onChange={(e) => setSeverityFilter(e.target.value)}
            className="px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-700 focus:ring-2 focus:ring-indigo-500"
          >
            <option value="all">All Severities</option>
            <option value="CRITICAL">Critical</option>
            <option value="HIGH">High</option>
            <option value="MEDIUM">Medium</option>
            <option value="INFO">Info</option>
          </select>

          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-700 focus:ring-2 focus:ring-indigo-500"
          >
            <option value="all">All Alert Types</option>
            <option value="STOCKOUT_RISK">Stockout Risk</option>
            <option value="LOW_STOCK">Low Stock</option>
            <option value="UNUSUAL_EXPENSE">Unusual Expense</option>
            <option value="SALES_DROP">Sales Drop</option>
            <option value="BUSINESS_INSIGHT">Business Insight</option>
          </select>
        </div>
      </div>

      {/* Alerts Feed */}
      <div className="space-y-3">
        {loading ? (
          <div className="py-12 text-center text-xs text-slate-400">Loading alerts...</div>
        ) : alerts.length > 0 ? (
          alerts.map((alert) => {
            const isExpanded = Boolean(expandedAlerts[alert._id])

            return (
              <div
                key={alert._id}
                className="bg-white border border-slate-200/80 rounded-xl p-4 shadow-sm hover:shadow transition space-y-3"
              >
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <span className="mt-1">
                      {alert.severity === 'CRITICAL' ? (
                        <AlertOctagon className="w-5 h-5 text-rose-600" />
                      ) : alert.severity === 'HIGH' ? (
                        <AlertTriangle className="w-5 h-5 text-amber-600" />
                      ) : (
                        <Info className="w-5 h-5 text-sky-600" />
                      )}
                    </span>

                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-bold text-slate-900">{alert.title}</span>
                        <StatusBadge status={alert.severity} />
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-100 text-slate-600">
                          {alert.type}
                        </span>
                        <span className="text-xs text-slate-400">
                          &bull; {formatDate(alert.createdAt, true)}
                        </span>
                      </div>

                      <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                        {alert.description}
                      </p>

                      {alert.recommendedAction && (
                        <div className="mt-2 text-xs font-medium text-indigo-700 flex items-center gap-1.5">
                          <span className="font-semibold text-slate-700">Recommended:</span>
                          <span>{alert.recommendedAction}</span>
                        </div>
                      )}

                      {alert.status === 'ACTIONED' && (
                        <p className="text-[11px] text-emerald-600 mt-1.5 font-medium">
                          ✓ Resolved by {alert.resolvedBy || 'user'} on{' '}
                          {formatDate(alert.resolvedAt, true)}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 shrink-0 self-end sm:self-start">
                    {alert.status === 'OPEN' && (
                      <>
                        <button
                          onClick={() => handleUpdateStatus(alert._id, 'ACTIONED')}
                          className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200/60 transition"
                        >
                          Action & Resolve
                        </button>
                        <button
                          onClick={() => handleUpdateStatus(alert._id, 'DISMISSED')}
                          className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200 transition"
                        >
                          Dismiss
                        </button>
                      </>
                    )}

                    <button
                      onClick={() => toggleExpand(alert._id)}
                      className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
                      title="Show Supporting Evidence"
                    >
                      {isExpanded ? (
                        <ChevronUp className="w-4 h-4" />
                      ) : (
                        <ChevronDown className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Supporting Data Drawer */}
                {isExpanded && alert.supportingData && (
                  <div className="pt-3 border-t border-slate-100 bg-slate-50/60 rounded-lg p-3 text-xs space-y-2">
                    <p className="font-bold text-[11px] uppercase tracking-wider text-slate-500">
                      Authoritative Supporting Data & Deterministic Evidence
                    </p>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {Object.entries(alert.supportingData).map(([k, v]) => (
                        <div key={k} className="p-2 rounded bg-white border border-slate-200/70">
                          <span className="text-[10px] text-slate-400 uppercase font-semibold block">
                            {k.replace(/([A-Z])/g, ' $1')}
                          </span>
                          <span className="font-mono font-bold text-slate-800 text-xs">
                            {typeof v === 'number'
                              ? k.toLowerCase().includes('revenue') ||
                                k.toLowerCase().includes('cost') ||
                                k.toLowerCase().includes('price') ||
                                k.toLowerCase().includes('amount')
                                ? formatCurrency(v, currency)
                                : v
                              : String(v)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )
          })
        ) : (
          <div className="py-12 text-center bg-white rounded-xl border border-dashed border-slate-200 text-xs text-slate-400">
            No alerts found matching current filters.
          </div>
        )}
      </div>
    </div>
  )
}

export default AlertsPage
