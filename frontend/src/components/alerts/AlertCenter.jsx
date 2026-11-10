import React, { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import {
  AlertTriangle,
  AlertOctagon,
  Info,
  CheckCircle2,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  XCircle,
  ArrowRight,
  ShieldAlert,
  SlidersHorizontal,
} from 'lucide-react'
import api from '../../services/api'
import { useAuth } from '../../context/AuthContext'
import { formatCurrency, formatNumber, formatDate } from '../../utils/formatters'
import Badge, { StatusBadge } from '../common/Badge'

export const AlertCenter = ({ onAlertCountChange }) => {
  const { currency } = useAuth()
  const [alerts, setAlerts] = useState([])
  const [summary, setSummary] = useState(null)
  const [loading, setLoading] = useState(true)
  const [evaluating, setEvaluating] = useState(false)
  const [expandedAlerts, setExpandedAlerts] = useState({})
  const [filterSeverity, setFilterSeverity] = useState('all')

  // Fetch active alerts & summary
  const fetchAlerts = useCallback(async () => {
    setLoading(true)
    try {
      const [listRes, summaryRes] = await Promise.all([
        api.get('/alerts?status=OPEN'),
        api.get('/alerts/summary'),
      ])

      const fetchedAlerts = listRes.data?.alerts || []
      const fetchedSummary = summaryRes.data || null

      setAlerts(fetchedAlerts)
      setSummary(fetchedSummary)

      if (onAlertCountChange) {
        onAlertCountChange(fetchedSummary?.totalActiveAlerts || 0)
      }
    } catch (err) {
      console.warn('Failed to load operational alerts:', err)
    } finally {
      setLoading(false)
    }
  }, [onAlertCountChange])

  useEffect(() => {
    fetchAlerts()
  }, [fetchAlerts])

  // Trigger real-time rule evaluation
  const handleEvaluateRules = async () => {
    setEvaluating(true)
    try {
      await api.post('/alerts/evaluate')
      await fetchAlerts()
    } catch (err) {
      console.error('Failed to trigger alert evaluation:', err)
    } finally {
      setEvaluating(false)
    }
  }

  // Toggle supporting data dropdown
  const toggleExpand = (id) => {
    setExpandedAlerts((prev) => ({ ...prev, [id]: !prev[id] }))
  }

  // Handle status update (ACTIONED or DISMISSED)
  const handleUpdateStatus = async (alertId, newStatus) => {
    try {
      await api.patch(`/alerts/${alertId}/status`, {
        status: newStatus,
        notes: `Marked as ${newStatus} from Dashboard Alert Center`,
      })
      // Refresh list
      fetchAlerts()
    } catch (err) {
      console.error(`Failed to update alert ${alertId}:`, err)
    }
  }

  const filteredAlerts = alerts.filter((a) => {
    if (filterSeverity === 'all') return true
    return a.severity === filterSeverity
  })

  // Severity config helper
  const getSeverityStyle = (severity) => {
    switch (severity) {
      case 'CRITICAL':
        return {
          border: 'border-l-4 border-l-rose-500 border-rose-200/80 bg-rose-50/30',
          badge: <Badge variant="danger" size="xs">Critical</Badge>,
          icon: <AlertOctagon className="w-5 h-5 text-rose-600 shrink-0" />,
        }
      case 'HIGH':
        return {
          border: 'border-l-4 border-l-amber-500 border-amber-200/80 bg-amber-50/20',
          badge: <Badge variant="warning" size="xs">High</Badge>,
          icon: <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />,
        }
      case 'MEDIUM':
        return {
          border: 'border-l-4 border-l-sky-500 border-slate-200 bg-white',
          badge: <Badge variant="info" size="xs">Medium</Badge>,
          icon: <Info className="w-5 h-5 text-sky-600 shrink-0" />,
        }
      default:
        return {
          border: 'border-l-4 border-l-indigo-400 border-slate-200 bg-white',
          badge: <Badge variant="indigo" size="xs">Info</Badge>,
          icon: <Info className="w-5 h-5 text-indigo-600 shrink-0" />,
        }
    }
  }

  return (
    <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm space-y-4">
      {/* Header with Title and Evaluate Button */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-3 border-b border-slate-100 gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-amber-50 border border-amber-200/60 flex items-center justify-center text-amber-600">
            <ShieldAlert className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-slate-900">
                Rule-Based Operational Alerts
              </h2>
              {summary && summary.totalActiveAlerts > 0 && (
                <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-rose-100 text-rose-700 animate-pulse">
                  {summary.totalActiveAlerts} Active
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500">
              Deterministic threshold monitoring: stockout risks, expense spikes, & sales declines
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Severity Quick Filter */}
          <select
            value={filterSeverity}
            onChange={(e) => setFilterSeverity(e.target.value)}
            className="px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
          >
            <option value="all">All Severities</option>
            <option value="CRITICAL">Critical</option>
            <option value="HIGH">High</option>
            <option value="MEDIUM">Medium</option>
            <option value="INFO">Info</option>
          </select>

          {/* Evaluate Rules Button */}
          <button
            onClick={handleEvaluateRules}
            disabled={evaluating}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100/80 text-indigo-700 border border-indigo-200/60 text-xs font-semibold transition disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${evaluating ? 'animate-spin' : ''}`} />
            <span>{evaluating ? 'Evaluating Rules...' : 'Scan Rules'}</span>
          </button>
        </div>
      </div>

      {/* Severity Counters Strip */}
      {summary && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          <div className="p-2.5 rounded-xl bg-rose-50/60 border border-rose-200/60 flex items-center justify-between">
            <span className="text-xs font-medium text-rose-800">Critical Stockouts</span>
            <span className="text-sm font-bold text-rose-700">{summary.bySeverity?.critical || 0}</span>
          </div>
          <div className="p-2.5 rounded-xl bg-amber-50/60 border border-amber-200/60 flex items-center justify-between">
            <span className="text-xs font-medium text-amber-800">High Urgency</span>
            <span className="text-sm font-bold text-amber-700">{summary.bySeverity?.high || 0}</span>
          </div>
          <div className="p-2.5 rounded-xl bg-sky-50/60 border border-sky-200/60 flex items-center justify-between">
            <span className="text-xs font-medium text-sky-800">Medium Priority</span>
            <span className="text-sm font-bold text-sky-700">{summary.bySeverity?.medium || 0}</span>
          </div>
          <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between">
            <span className="text-xs font-medium text-slate-700">Informational</span>
            <span className="text-sm font-bold text-slate-700">{summary.bySeverity?.info || 0}</span>
          </div>
        </div>
      )}

      {/* Alerts Feed */}
      <div className="space-y-3">
        {loading ? (
          <div className="py-8 text-center text-xs text-slate-400">Loading active alerts...</div>
        ) : filteredAlerts.length > 0 ? (
          filteredAlerts.map((alert) => {
            const isExpanded = Boolean(expandedAlerts[alert._id])
            const style = getSeverityStyle(alert.severity)

            return (
              <div
                key={alert._id}
                className={`rounded-xl border p-4 transition-all duration-150 ${style.border}`}
              >
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <span className="mt-0.5">{style.icon}</span>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-bold text-slate-900">{alert.title}</span>
                        {style.badge}
                        <span className="text-[10px] font-mono font-medium px-2 py-0.5 rounded bg-slate-100 text-slate-600">
                          {alert.type}
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                        {alert.description}
                      </p>

                      {/* Recommended Action */}
                      {alert.recommendedAction && (
                        <div className="mt-2 flex items-center gap-1.5 text-xs font-medium text-indigo-700">
                          <span className="font-semibold text-slate-700">Recommended Action:</span>
                          <span>{alert.recommendedAction}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex items-center gap-2 shrink-0 self-end sm:self-start">
                    <button
                      onClick={() => handleUpdateStatus(alert._id, 'ACTIONED')}
                      className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200/60 transition"
                      title="Mark as Actioned / Resolved"
                    >
                      Resolve
                    </button>
                    <button
                      onClick={() => handleUpdateStatus(alert._id, 'DISMISSED')}
                      className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200 transition"
                      title="Dismiss alert"
                    >
                      Dismiss
                    </button>
                    <button
                      onClick={() => toggleExpand(alert._id)}
                      className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
                      title="Show Supporting Data"
                    >
                      {isExpanded ? (
                        <ChevronUp className="w-4 h-4" />
                      ) : (
                        <ChevronDown className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Expandable Supporting Data & Rule Evidence Drawer */}
                {isExpanded && alert.supportingData && (
                  <div className="mt-3 pt-3 border-t border-slate-200/80 bg-white/80 rounded-lg p-3 text-xs space-y-2">
                    <p className="font-bold text-[11px] uppercase tracking-wider text-slate-500">
                      Rule Evidence & Calculation Breakdown
                    </p>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {Object.entries(alert.supportingData).map(([key, val]) => (
                        <div key={key} className="p-2 rounded bg-slate-50 border border-slate-100">
                          <span className="text-[10px] text-slate-400 uppercase font-semibold block">
                            {key.replace(/([A-Z])/g, ' $1')}
                          </span>
                          <span className="font-mono font-bold text-slate-800 text-xs">
                            {typeof val === 'number'
                              ? key.toLowerCase().includes('revenue') ||
                                key.toLowerCase().includes('cost') ||
                                key.toLowerCase().includes('amount') ||
                                key.toLowerCase().includes('price')
                                ? formatCurrency(val, currency)
                                : val
                              : String(val)}
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
          <div className="py-8 text-center bg-slate-50/50 rounded-xl border border-dashed border-slate-200 text-xs font-medium text-emerald-700 flex flex-col items-center justify-center space-y-1">
            <CheckCircle2 className="w-6 h-6 text-emerald-600" />
            <span>All rule-based operational parameters are within safe bounds.</span>
            <span className="text-[11px] text-slate-400">Zero active critical or high-priority warnings</span>
          </div>
        )}
      </div>
    </div>
  )
}

export default AlertCenter
