import React, { useState, useEffect, useCallback } from 'react'
import {
  Lightbulb,
  CheckCircle2,
  AlertTriangle,
  AlertOctagon,
  RefreshCw,
  Filter,
  Check,
  X,
  Clock,
  ShieldCheck,
  TrendingUp,
  Package,
  Receipt,
  Users,
  ExternalLink,
  ChevronRight,
  ShieldAlert,
  ArrowRight,
  FileText,
  History,
} from 'lucide-react'
import {
  getRecommendations,
  getRecommendationSummary,
  generateRecommendations,
  reviewRecommendation,
  executeRecommendationAction,
  getRecommendationAuditLogs,
} from '../services/recommendationApi'
import { useAuth } from '../context/AuthContext'
import { formatCurrency, formatDate } from '../utils/formatters'
import Badge, { StatusBadge } from '../components/common/Badge'
import AlertBanner from '../components/common/AlertBanner'
import { Modal } from '../components/common/Modal'
import LoadingSpinner from '../components/common/LoadingSpinner'

export const RecommendationsPage = () => {
  const { user, currency } = useAuth()

  // State
  const [activeTab, setActiveTab] = useState('recommendations') // 'recommendations' | 'audit'
  const [recommendations, setRecommendations] = useState([])
  const [summary, setSummary] = useState(null)
  const [auditLogs, setAuditLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [statusFilter, setStatusFilter] = useState('PENDING_REVIEW')
  const [severityFilter, setSeverityFilter] = useState('ALL')
  const [typeFilter, setTypeFilter] = useState('ALL')

  // Notification banners
  const [successMsg, setSuccessMsg] = useState(null)
  const [errorMsg, setErrorMsg] = useState(null)

  // Execution Confirmation Modal State
  const [execModalOpen, setExecModalOpen] = useState(false)
  const [selectedRec, setSelectedRec] = useState(null)
  const [confirmedChecked, setConfirmedChecked] = useState(false)
  const [execNotes, setExecNotes] = useState('')
  const [isSubmittingExec, setIsSubmittingExec] = useState(false)

  // Review Modal / Prompt State
  const [reviewModalOpen, setReviewModalOpen] = useState(false)
  const [reviewTarget, setReviewTarget] = useState(null) // { rec, status }
  const [reviewNotes, setReviewNotes] = useState('')
  const [isSubmittingReview, setIsSubmittingReview] = useState(false)

  // Fetch data
  const fetchData = useCallback(async () => {
    setLoading(true)
    setErrorMsg(null)
    try {
      const [recData, sumData, auditData] = await Promise.all([
        getRecommendations({
          status: statusFilter,
          severity: severityFilter,
          type: typeFilter,
          limit: 50,
        }),
        getRecommendationSummary(),
        getRecommendationAuditLogs({ limit: 50 }),
      ])

      setRecommendations(recData?.items || [])
      setSummary(sumData || null)
      setAuditLogs(auditData || [])
    } catch (err) {
      console.error('Failed to load recommendation data:', err)
      setErrorMsg(err.response?.data?.message || err.message || 'Failed to retrieve recommendations')
    } finally {
      setLoading(false)
    }
  }, [statusFilter, severityFilter, typeFilter])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // Trigger engine to evaluate and generate new recommendations
  const handleGenerate = async () => {
    setGenerating(true)
    setErrorMsg(null)
    try {
      const res = await generateRecommendations()
      const count = Array.isArray(res) ? res.length : 0
      setSuccessMsg(`Engine scanned business models & rules. ${count} recommendations updated or ready.`)
      await fetchData()
    } catch (err) {
      setErrorMsg(err.response?.data?.message || err.message || 'Failed to generate recommendations')
    } finally {
      setGenerating(false)
    }
  }

  // Open review modal
  const promptReview = (rec, newStatus) => {
    setReviewTarget({ rec, newStatus })
    setReviewNotes('')
    setReviewModalOpen(true)
  }

  // Submit review status change
  const handleSubmitReview = async () => {
    if (!reviewTarget) return
    setIsSubmittingReview(true)
    setErrorMsg(null)
    try {
      await reviewRecommendation(reviewTarget.rec._id, {
        status: reviewTarget.newStatus,
        notes: reviewNotes || `Recommendation marked as ${reviewTarget.newStatus} by ${user?.name || 'admin'}.`,
      })
      setSuccessMsg(`Recommendation successfully marked as ${reviewTarget.newStatus}.`)
      setReviewModalOpen(false)
      setReviewTarget(null)
      await fetchData()
    } catch (err) {
      setErrorMsg(err.response?.data?.message || err.message || 'Failed to update recommendation status')
    } finally {
      setIsSubmittingReview(false)
    }
  }

  // Open consequential execution modal
  const openExecutionModal = (rec) => {
    setSelectedRec(rec)
    setConfirmedChecked(false)
    setExecNotes('')
    setExecModalOpen(true)
  }

  // Execute consequential action with explicit confirmation
  const handleExecuteConsequential = async () => {
    if (!confirmedChecked || !selectedRec) return
    setIsSubmittingExec(true)
    setErrorMsg(null)
    try {
      const payload = {
        ...(selectedRec.action?.suggestedPayload || {}),
        notes: execNotes,
      }
      const res = await executeRecommendationAction(selectedRec._id, {
        confirmed: true,
        executionPayload: payload,
      })
      setSuccessMsg(
        `Consequential action executed successfully! Result: ${res.executionResult?.action || 'APPLIED'}`
      )
      setExecModalOpen(false)
      setSelectedRec(null)
      await fetchData()
    } catch (err) {
      setErrorMsg(err.response?.data?.message || err.message || 'Failed to execute consequential operation')
    } finally {
      setIsSubmittingExec(false)
    }
  }

  // Severity styles
  const getSeverityBadge = (sev) => {
    switch (sev) {
      case 'CRITICAL':
        return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">Critical</span>
      case 'HIGH':
        return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">High</span>
      case 'MEDIUM':
        return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-sky-50 text-sky-700 border border-sky-200">Medium</span>
      default:
        return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200">Low</span>
    }
  }

  const getStatusBadge = (status) => {
    switch (status) {
      case 'PENDING_REVIEW':
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-800 border border-amber-200">Pending Review</span>
      case 'APPROVED':
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-800 border border-blue-200">Approved</span>
      case 'APPLIED':
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-800 border border-emerald-200">Action Applied</span>
      case 'DISMISSED':
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200">Dismissed</span>
      case 'REJECTED':
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-rose-50 text-rose-800 border border-rose-200">Rejected</span>
      default:
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-600">{status}</span>
    }
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl border border-indigo-100">
              <Lightbulb className="w-5 h-5" />
            </div>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">Recommendations & Human Approvals</h1>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Authoritative decision workflows backed by business rules, operational analytics, and evaluated machine learning models.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleGenerate}
            disabled={generating}
            className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm transition disabled:opacity-50 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${generating ? 'animate-spin' : ''}`} />
            <span>{generating ? 'Evaluating Rules & ML...' : 'Refresh Recommendations'}</span>
          </button>
        </div>
      </div>

      {/* Alerts / Feedback */}
      {successMsg && (
        <AlertBanner
          type="success"
          message={successMsg}
          onClose={() => setSuccessMsg(null)}
        />
      )}
      {errorMsg && (
        <AlertBanner
          type="error"
          message={errorMsg}
          onClose={() => setErrorMsg(null)}
        />
      )}

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Pending Review</span>
            <div className="w-7 h-7 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-bold text-slate-800 mt-2">
            {summary?.pendingReviewCount ?? '—'}
          </p>
          <p className="text-[11px] text-amber-700 mt-1 font-medium">Awaiting human sign-off</p>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Critical Actions</span>
            <div className="w-7 h-7 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center">
              <AlertOctagon className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-bold text-slate-800 mt-2">
            {summary?.criticalPendingCount ?? '—'}
          </p>
          <p className="text-[11px] text-rose-600 mt-1 font-medium">High operational urgency</p>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Estimated Impact</span>
            <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-bold text-slate-800 mt-2">
            {formatCurrency(summary?.totalEstimatedFinancialImpact, currency)}
          </p>
          <p className="text-[11px] text-emerald-700 mt-1 font-medium">Protected revenue & savings</p>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Applied Decisions</span>
            <div className="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <ShieldCheck className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-bold text-slate-800 mt-2">
            {summary?.appliedCount ?? '—'}
          </p>
          <p className="text-[11px] text-indigo-600 mt-1 font-medium">Consequential actions executed</p>
        </div>
      </div>

      {/* Tabs Header */}
      <div className="flex items-center justify-between border-b border-slate-200">
        <div className="flex space-x-6">
          <button
            onClick={() => setActiveTab('recommendations')}
            className={`pb-3 text-sm font-semibold transition border-b-2 flex items-center gap-2 cursor-pointer ${
              activeTab === 'recommendations'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Lightbulb className="w-4 h-4" />
            <span>Actionable Recommendations</span>
            {summary?.pendingReviewCount > 0 && (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">
                {summary.pendingReviewCount}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('audit')}
            className={`pb-3 text-sm font-semibold transition border-b-2 flex items-center gap-2 cursor-pointer ${
              activeTab === 'audit'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <History className="w-4 h-4" />
            <span>Audit Trail & Decision History</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] font-medium bg-slate-100 text-slate-600">
              {auditLogs.length}
            </span>
          </button>
        </div>
      </div>

      {/* TAB 1: RECOMMENDATIONS */}
      {activeTab === 'recommendations' && (
        <div className="space-y-4">
          {/* Filters Bar */}
          <div className="bg-white p-3.5 rounded-xl border border-slate-200/80 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-1.5 text-slate-500 font-medium">
                <Filter className="w-3.5 h-3.5" />
                <span>Filters:</span>
              </div>

              {/* Status Filter */}
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-700 font-medium focus:ring-1 focus:ring-indigo-500"
              >
                <option value="ALL">All Statuses</option>
                <option value="PENDING_REVIEW">Pending Review</option>
                <option value="APPROVED">Approved</option>
                <option value="APPLIED">Applied</option>
                <option value="DISMISSED">Dismissed</option>
                <option value="REJECTED">Rejected</option>
              </select>

              {/* Severity Filter */}
              <select
                value={severityFilter}
                onChange={(e) => setSeverityFilter(e.target.value)}
                className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-700 font-medium focus:ring-1 focus:ring-indigo-500"
              >
                <option value="ALL">All Severities</option>
                <option value="CRITICAL">Critical</option>
                <option value="HIGH">High</option>
                <option value="MEDIUM">Medium</option>
                <option value="LOW">Low</option>
              </select>

              {/* Type Filter */}
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-700 font-medium focus:ring-1 focus:ring-indigo-500"
              >
                <option value="ALL">All Categories</option>
                <option value="INVENTORY_REORDER">Inventory Reorder</option>
                <option value="EXPENSE_AUDIT">Expense Audit</option>
                <option value="CUSTOMER_RETENTION">Customer Retention</option>
              </select>
            </div>

            <span className="text-slate-400 font-medium">
              Showing {recommendations.length} items
            </span>
          </div>

          {/* Recommendations List */}
          {loading ? (
            <div className="py-12 flex justify-center">
              <LoadingSpinner size="lg" message="Loading recommendations..." />
            </div>
          ) : recommendations.length === 0 ? (
            <div className="bg-white rounded-xl border border-slate-200/80 p-12 text-center">
              <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-3">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-semibold text-slate-800">No Recommendations in this Filter</h3>
              <p className="text-xs text-slate-500 max-w-md mx-auto mt-1">
                Your operational metrics are within acceptable thresholds, or no items match the selected filter. Click "Refresh Recommendations" to run a fresh scan.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {recommendations.map((rec) => {
                const isConsequential = rec.action?.isConsequential
                const isPending = rec.status === 'PENDING_REVIEW'
                const isApproved = rec.status === 'APPROVED'
                const isApplied = rec.status === 'APPLIED'

                return (
                  <div
                    key={rec._id}
                    className="bg-white rounded-xl border border-slate-200/80 shadow-xs hover:border-slate-300 transition overflow-hidden"
                  >
                    {/* Card Header */}
                    <div className="p-4 border-b border-slate-100 flex flex-wrap items-center justify-between gap-2 bg-slate-50/40">
                      <div className="flex flex-wrap items-center gap-2">
                        {getSeverityBadge(rec.severity)}
                        <span className="text-[11px] font-semibold px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-100">
                          {rec.category}
                        </span>
                        <span className="text-[11px] text-slate-500 font-medium">
                          Urgency: <span className="text-slate-700 font-semibold">{rec.urgency}</span>
                        </span>
                        <span className="text-[11px] text-slate-400">
                          Engine: {rec.evidence?.generatedBy || 'BUSINESS_RULES'}
                        </span>
                      </div>

                      <div>{getStatusBadge(rec.status)}</div>
                    </div>

                    {/* Card Body */}
                    <div className="p-4 space-y-3">
                      <div>
                        <h3 className="text-sm font-bold text-slate-900">{rec.title}</h3>
                        <p className="text-xs text-slate-600 mt-1 leading-relaxed">{rec.reason}</p>
                      </div>

                      {/* Supporting Evidence Metrics */}
                      {rec.evidence?.metrics && Object.keys(rec.evidence.metrics).length > 0 && (
                        <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200/60">
                          <p className="text-[11px] font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">
                            Supporting Business Evidence:
                          </p>
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                            {Object.entries(rec.evidence.metrics).map(([key, val]) => (
                              <div key={key} className="bg-white p-2 rounded border border-slate-200/60">
                                <span className="text-[10px] text-slate-400 block capitalize">
                                  {key.replace(/([A-Z])/g, ' $1').toLowerCase()}
                                </span>
                                <span className="font-semibold text-slate-800 text-xs">
                                  {typeof val === 'number'
                                    ? val > 1000
                                      ? val.toLocaleString()
                                      : val
                                    : String(val)}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Financial Impact */}
                      {rec.estimatedImpact && (
                        <div className="flex items-center gap-2 p-2.5 rounded-lg bg-emerald-50/60 border border-emerald-100 text-xs">
                          <TrendingUp className="w-4 h-4 text-emerald-600 shrink-0" />
                          <div className="flex-1">
                            <span className="font-semibold text-emerald-900">
                              Estimated Impact ({rec.estimatedImpact.metric}):{' '}
                            </span>
                            <span className="font-bold text-emerald-700">
                              {formatCurrency(rec.estimatedImpact.amount, rec.estimatedImpact.currency)}
                            </span>
                            <span className="text-emerald-800 text-[11px] ml-1.5">
                              — {rec.estimatedImpact.explanation}
                            </span>
                          </div>
                        </div>
                      )}

                      {/* Recommended Consequential Action Box */}
                      {rec.action && (
                        <div className="p-3 rounded-lg bg-indigo-50/40 border border-indigo-100/80 text-xs space-y-1.5">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1.5 text-indigo-900 font-semibold">
                              <ArrowRight className="w-3.5 h-3.5 text-indigo-600" />
                              <span>Recommended Next Action:</span>
                              <span className="font-mono bg-white px-1.5 py-0.5 rounded border border-indigo-200 text-indigo-700 text-[11px]">
                                {rec.action.actionType}
                              </span>
                            </div>

                            {isConsequential && (
                              <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                                <ShieldAlert className="w-3 h-3 text-amber-600" />
                                Requires Human Confirmation
                              </span>
                            )}
                          </div>

                          {rec.action.suggestedPayload && (
                            <div className="text-[11px] text-slate-600 grid grid-cols-2 sm:grid-cols-3 gap-1 pt-1 font-mono">
                              {rec.action.suggestedPayload.orderQty && (
                                <div>
                                  Order Quantity: <strong className="text-slate-900">{rec.action.suggestedPayload.orderQty} units</strong>
                                </div>
                              )}
                              {rec.action.suggestedPayload.supplierName && (
                                <div>
                                  Vendor: <strong className="text-slate-900">{rec.action.suggestedPayload.supplierName}</strong>
                                </div>
                              )}
                              {rec.action.suggestedPayload.estimatedTotalCost && (
                                <div>
                                  Estimated Cost: <strong className="text-slate-900">{formatCurrency(rec.action.suggestedPayload.estimatedTotalCost, 'GBP')}</strong>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Decision Details if reviewed/applied */}
                      {rec.decision?.decidedAt && (
                        <div className="text-[11px] text-slate-500 bg-slate-50 p-2 rounded border border-slate-100 flex items-center justify-between">
                          <span>
                            Decision recorded by <strong>{rec.decision.decidedByName || 'Admin'}</strong> on{' '}
                            {formatDate(rec.decision.decidedAt, true)}
                          </span>
                          {rec.decision.decisionNotes && (
                            <span className="italic text-slate-600 truncate max-w-xs">
                              "{rec.decision.decisionNotes}"
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Card Actions Footer */}
                    <div className="px-4 py-3 bg-slate-50/70 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
                      <div className="text-[11px] text-slate-400">
                        Created {formatDate(rec.createdAt, true)}
                      </div>

                      <div className="flex items-center gap-2">
                        {/* If Pending Review */}
                        {isPending && (
                          <>
                            <button
                              onClick={() => promptReview(rec, 'REJECTED')}
                              className="px-2.5 py-1.5 text-xs font-semibold rounded-lg text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 transition cursor-pointer"
                            >
                              Reject
                            </button>
                            <button
                              onClick={() => promptReview(rec, 'DISMISSED')}
                              className="px-2.5 py-1.5 text-xs font-semibold rounded-lg text-slate-600 bg-white hover:bg-slate-100 border border-slate-200 transition cursor-pointer"
                            >
                              Dismiss
                            </button>
                            <button
                              onClick={() => promptReview(rec, 'APPROVED')}
                              className="px-3 py-1.5 text-xs font-semibold rounded-lg text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 transition cursor-pointer"
                            >
                              Approve
                            </button>
                            {isConsequential && (
                              <button
                                onClick={() => openExecutionModal(rec)}
                                className="px-3.5 py-1.5 text-xs font-bold rounded-lg text-white bg-indigo-600 hover:bg-indigo-700 shadow-xs transition flex items-center gap-1.5 cursor-pointer"
                              >
                                <Check className="w-3.5 h-3.5" />
                                <span>Confirm & Execute</span>
                              </button>
                            )}
                          </>
                        )}

                        {/* If Approved */}
                        {isApproved && (
                          <>
                            <button
                              onClick={() => promptReview(rec, 'DISMISSED')}
                              className="px-2.5 py-1.5 text-xs font-semibold rounded-lg text-slate-600 bg-white hover:bg-slate-100 border border-slate-200 transition cursor-pointer"
                            >
                              Dismiss
                            </button>
                            <button
                              onClick={() => openExecutionModal(rec)}
                              className="px-3.5 py-1.5 text-xs font-bold rounded-lg text-white bg-emerald-600 hover:bg-emerald-700 shadow-xs transition flex items-center gap-1.5 cursor-pointer"
                            >
                              <ShieldCheck className="w-3.5 h-3.5" />
                              <span>Execute Action</span>
                            </button>
                          </>
                        )}

                        {/* If Applied */}
                        {isApplied && (
                          <div className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-200">
                            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                            <span>Action Successfully Executed</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: AUDIT TRAIL */}
      {activeTab === 'audit' && (
        <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs overflow-hidden">
          <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-800">Immutable Recommendation Decision Trail</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Every human approval, rejection, dismissal, and consequential execution is permanently logged with tenant audit metadata.
              </p>
            </div>
            <button
              onClick={fetchData}
              className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition"
              title="Refresh Audit Logs"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>

          {auditLogs.length === 0 ? (
            <div className="p-12 text-center text-xs text-slate-400">
              No audit log entries recorded yet.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-700">
                <thead className="bg-slate-50 text-[11px] font-semibold text-slate-500 uppercase tracking-wider border-b border-slate-100">
                  <tr>
                    <th className="px-4 py-3">Timestamp</th>
                    <th className="px-4 py-3">User</th>
                    <th className="px-4 py-3">Action</th>
                    <th className="px-4 py-3">Recommendation</th>
                    <th className="px-4 py-3">State Change</th>
                    <th className="px-4 py-3">Notes & Execution</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {auditLogs.map((log) => (
                    <tr key={log._id} className="hover:bg-slate-50/80 transition">
                      <td className="px-4 py-3 whitespace-nowrap text-slate-500 font-mono text-[11px]">
                        {formatDate(log.timestamp, true)}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap font-medium text-slate-900">
                        {log.userName}
                        <span className="text-[10px] text-slate-400 block font-normal capitalize">
                          {log.userRole || 'admin'}
                        </span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span
                          className={`inline-flex px-2 py-0.5 rounded text-[11px] font-semibold ${
                            log.action === 'ACTION_EXECUTED'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : log.action === 'APPROVED'
                              ? 'bg-blue-50 text-blue-700 border border-blue-200'
                              : log.action === 'REJECTED'
                              ? 'bg-rose-50 text-rose-700 border border-rose-200'
                              : 'bg-slate-100 text-slate-700'
                          }`}
                        >
                          {log.action}
                        </span>
                      </td>
                      <td className="px-4 py-3 max-w-xs truncate font-medium text-slate-800">
                        {log.recommendationTitle}
                        <span className="text-[10px] text-slate-400 block font-normal">
                          {log.recommendationType}
                        </span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-[11px]">
                        {log.previousStatus ? (
                          <span className="text-slate-400">
                            {log.previousStatus} → <strong className="text-slate-800">{log.newStatus}</strong>
                          </span>
                        ) : (
                          <span className="text-slate-600 font-medium">{log.newStatus || '—'}</span>
                        )}
                      </td>
                      <td className="px-4 py-3 max-w-sm truncate text-slate-600 text-[11px]">
                        {log.notes || (log.executionResult ? JSON.stringify(log.executionResult) : '—')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Review Modal (Approve / Reject / Dismiss) */}
      <Modal
        isOpen={reviewModalOpen}
        onClose={() => setReviewModalOpen(false)}
        title={`Confirm Review: ${reviewTarget?.newStatus}`}
        subtitle={`Update decision state for "${reviewTarget?.rec?.title}"`}
      >
        <div className="space-y-4 text-xs">
          <p className="text-slate-600">
            You are changing the status of this recommendation to{' '}
            <strong className="text-slate-900">{reviewTarget?.newStatus}</strong>.
          </p>

          <div>
            <label className="block text-[11px] font-semibold text-slate-700 mb-1">
              Decision Justification / Notes (Optional)
            </label>
            <textarea
              value={reviewNotes}
              onChange={(e) => setReviewNotes(e.target.value)}
              placeholder="Provide context for this operational decision..."
              rows={3}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-xs text-slate-800 focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <button
              onClick={() => setReviewModalOpen(false)}
              className="px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 font-medium hover:bg-slate-50 cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmitReview}
              disabled={isSubmittingReview}
              className="px-4 py-1.5 rounded-lg bg-indigo-600 text-white font-semibold hover:bg-indigo-700 disabled:opacity-50 cursor-pointer"
            >
              {isSubmittingReview ? 'Submitting...' : 'Confirm Decision'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Consequential Human Confirmation Dialog */}
      <Modal
        isOpen={execModalOpen}
        onClose={() => setExecModalOpen(false)}
        title="⚠️ Consequential Business Operation Confirmation"
        subtitle="OpsMind Human Approval Guardrail"
        maxWidth="max-w-lg"
      >
        <div className="space-y-4 text-xs">
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 space-y-1">
            <p className="font-bold flex items-center gap-1.5 text-xs">
              <AlertTriangle className="w-4 h-4 text-amber-600" />
              Consequential Action Notice
            </p>
            <p className="text-[11px] leading-relaxed">
              This action triggers real inventory movements and operational record creation. OpsMind never executes purchasing or stock movements without explicit human consent.
            </p>
          </div>

          {selectedRec && (
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 space-y-2">
              <p className="font-semibold text-slate-900 text-xs">{selectedRec.title}</p>
              <div className="text-[11px] text-slate-600 space-y-1">
                <div>
                  <strong>Action:</strong> {selectedRec.action?.actionType}
                </div>
                {selectedRec.action?.suggestedPayload?.sku && (
                  <div>
                    <strong>Product SKU:</strong> {selectedRec.action.suggestedPayload.sku}
                  </div>
                )}
                {selectedRec.action?.suggestedPayload?.orderQty && (
                  <div>
                    <strong>Restock Order Quantity:</strong> {selectedRec.action.suggestedPayload.orderQty} units
                  </div>
                )}
                {selectedRec.action?.suggestedPayload?.estimatedTotalCost && (
                  <div>
                    <strong>Estimated Commitment:</strong>{' '}
                    {formatCurrency(selectedRec.action.suggestedPayload.estimatedTotalCost, 'GBP')}
                  </div>
                )}
              </div>
            </div>
          )}

          <div>
            <label className="block text-[11px] font-semibold text-slate-700 mb-1">
              Execution Notes / Reference (Optional)
            </label>
            <input
              type="text"
              value={execNotes}
              onChange={(e) => setExecNotes(e.target.value)}
              placeholder="e.g. Approved purchase order PO-9842 with vendor"
              className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs text-slate-800 focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          {/* Explicit Confirmation Checkbox */}
          <div className="p-3 bg-white border-2 border-indigo-200 rounded-xl flex items-start gap-3">
            <input
              type="checkbox"
              id="confirmCheckbox"
              checked={confirmedChecked}
              onChange={(e) => setConfirmedChecked(e.target.checked)}
              className="mt-0.5 w-4 h-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500 cursor-pointer"
            />
            <label htmlFor="confirmCheckbox" className="text-slate-800 text-[11px] font-semibold cursor-pointer">
              I understand this is a consequential business operation. I have reviewed the supporting metrics and authorize execution.
            </label>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <button
              onClick={() => setExecModalOpen(false)}
              className="px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 font-medium hover:bg-slate-50 cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={handleExecuteConsequential}
              disabled={!confirmedChecked || isSubmittingExec}
              className="px-4 py-1.5 rounded-lg bg-emerald-600 text-white font-bold hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed shadow-sm transition flex items-center gap-1.5 cursor-pointer"
            >
              {isSubmittingExec ? (
                <span>Executing...</span>
              ) : (
                <>
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>Confirm & Execute Operation</span>
                </>
              )}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

export default RecommendationsPage
