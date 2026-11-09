import React from 'react'
import { AlertCircle, CheckCircle2, Info, XCircle, X } from 'lucide-react'

export const AlertBanner = ({ type = 'info', message, onDismiss, className = '' }) => {
  if (!message) return null

  const typeConfig = {
    info: {
      bg: 'bg-sky-50 border-sky-200 text-sky-800',
      icon: <Info className="w-5 h-5 text-sky-600 shrink-0" />,
    },
    success: {
      bg: 'bg-emerald-50 border-emerald-200 text-emerald-800',
      icon: <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />,
    },
    warning: {
      bg: 'bg-amber-50 border-amber-200 text-amber-800',
      icon: <AlertCircle className="w-5 h-5 text-amber-600 shrink-0" />,
    },
    error: {
      bg: 'bg-rose-50 border-rose-200 text-rose-800',
      icon: <XCircle className="w-5 h-5 text-rose-600 shrink-0" />,
    },
  }[type] || {
    bg: 'bg-slate-50 border-slate-200 text-slate-800',
    icon: <Info className="w-5 h-5 text-slate-600 shrink-0" />,
  }

  return (
    <div
      className={`flex items-start justify-between p-3.5 rounded-lg border text-sm ${typeConfig.bg} ${className}`}
      role="alert"
    >
      <div className="flex items-start space-x-2.5">
        <span className="mt-0.5">{typeConfig.icon}</span>
        <div className="font-medium leading-relaxed">{message}</div>
      </div>
      {onDismiss && (
        <button
          onClick={onDismiss}
          type="button"
          className="ml-3 p-1 rounded-md hover:bg-black/5 transition text-current opacity-70 hover:opacity-100"
          aria-label="Dismiss alert"
        >
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  )
}

export default AlertBanner
