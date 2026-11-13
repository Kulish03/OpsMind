import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Lightbulb, ArrowRight, ShieldCheck, Clock, TrendingUp } from 'lucide-react'
import { getRecommendationSummary } from '../../services/recommendationApi'
import { formatCurrency } from '../../utils/formatters'
import { useAuth } from '../../context/AuthContext'

export const RecommendationsBanner = () => {
  const { currency } = useAuth()
  const [summary, setSummary] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let isMounted = true
    getRecommendationSummary()
      .then((data) => {
        if (isMounted) setSummary(data)
      })
      .catch((err) => {
        console.warn('Failed to load recommendation banner summary:', err)
      })
      .finally(() => {
        if (isMounted) setLoading(false)
      })

    return () => {
      isMounted = false
    }
  }, [])

  if (loading || !summary || summary.pendingReviewCount === 0) {
    return null
  }

  return (
    <div className="bg-gradient-to-r from-indigo-50/90 via-sky-50/50 to-white border border-indigo-100/90 rounded-2xl p-4 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-sm shadow-indigo-600/20 shrink-0">
          <Lightbulb className="w-5 h-5" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h4 className="text-sm font-bold text-slate-900">
              {summary.pendingReviewCount} Actionable Recommendation{summary.pendingReviewCount > 1 ? 's' : ''} Awaiting Approval
            </h4>
            {summary.criticalPendingCount > 0 && (
              <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-rose-100 text-rose-800 border border-rose-200">
                {summary.criticalPendingCount} Critical
              </span>
            )}
          </div>
          <p className="text-xs text-slate-600 mt-0.5">
            Evaluating stockout run-rates, unusual expense anomalies, and customer win-backs. Estimated impact:{' '}
            <strong className="text-emerald-700">
              {formatCurrency(summary.totalEstimatedFinancialImpact, currency)}
            </strong>
          </p>
        </div>
      </div>

      <Link
        to="/recommendations"
        className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm transition shrink-0 self-start sm:self-center"
      >
        <span>Review Recommendations</span>
        <ArrowRight className="w-3.5 h-3.5" />
      </Link>
    </div>
  )
}

export default RecommendationsBanner
