import React from 'react'

export const Badge = ({ children, variant = 'neutral', size = 'sm', className = '' }) => {
  const variantStyles = {
    success: 'bg-emerald-50 text-emerald-700 border-emerald-200/60',
    warning: 'bg-amber-50 text-amber-700 border-amber-200/60',
    danger: 'bg-rose-50 text-rose-700 border-rose-200/60',
    info: 'bg-sky-50 text-sky-700 border-sky-200/60',
    purple: 'bg-purple-50 text-purple-700 border-purple-200/60',
    indigo: 'bg-indigo-50 text-indigo-700 border-indigo-200/60',
    neutral: 'bg-slate-100 text-slate-700 border-slate-200/60',
  }[variant] || 'bg-slate-100 text-slate-700 border-slate-200/60'

  const sizeStyles = {
    xs: 'px-2 py-0.5 text-[11px]',
    sm: 'px-2.5 py-0.5 text-xs',
    md: 'px-3 py-1 text-sm',
  }[size] || 'px-2.5 py-0.5 text-xs'

  return (
    <span
      className={`inline-flex items-center font-medium rounded-full border tracking-wide uppercase ${variantStyles} ${sizeStyles} ${className}`}
    >
      {children}
    </span>
  )
}

export const StatusBadge = ({ status }) => {
  if (!status) return <Badge variant="neutral">—</Badge>

  const normalized = String(status).toUpperCase()

  switch (normalized) {
    case 'COMPLETED':
    case 'ACTIVE':
    case 'OPTIMAL':
    case 'PAID':
    case 'HEALTHY':
      return <Badge variant="success">{status}</Badge>

    case 'LOW_STOCK':
    case 'LOW STOCK':
    case 'PENDING':
    case 'DORMANT':
    case 'AT_RISK':
    case 'AT RISK':
      return <Badge variant="warning">{status}</Badge>

    case 'OUT_OF_STOCK':
    case 'OUT OF STOCK':
    case 'CANCELLED':
    case 'CHURNED':
    case 'FAILED':
      return <Badge variant="danger">{status}</Badge>

    case 'OVERSTOCKED':
    case 'REFUNDED':
      return <Badge variant="purple">{status}</Badge>

    case 'ADMIN':
      return <Badge variant="indigo">Admin</Badge>
    case 'MANAGER':
      return <Badge variant="info">Manager</Badge>
    case 'STAFF':
      return <Badge variant="neutral">Staff</Badge>

    default:
      return <Badge variant="neutral">{status}</Badge>
  }
}

export default Badge
