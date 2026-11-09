import React from 'react'
import {
  DollarSign,
  ShoppingCart,
  TrendingUp,
  CreditCard,
  Box,
  Users,
  Truck,
  AlertTriangle,
  ArrowUpRight,
  ArrowDownRight,
  PackageCheck,
} from 'lucide-react'
import { formatNumber } from '../../utils/formatters'

export const StatCard = ({
  title,
  value,
  subtitle,
  icon = 'revenue',
  change,
  changePositive,
  variant = 'indigo',
  loading = false,
}) => {
  const iconConfig = {
    revenue: { component: DollarSign, bg: 'bg-emerald-50 text-emerald-600 border-emerald-100' },
    sales: { component: ShoppingCart, bg: 'bg-indigo-50 text-indigo-600 border-indigo-100' },
    transactions: { component: TrendingUp, bg: 'bg-sky-50 text-sky-600 border-sky-100' },
    profit: { component: CreditCard, bg: 'bg-teal-50 text-teal-600 border-teal-100' },
    products: { component: Box, bg: 'bg-blue-50 text-blue-600 border-blue-100' },
    inventory: { component: PackageCheck, bg: 'bg-cyan-50 text-cyan-600 border-cyan-100' },
    customers: { component: Users, bg: 'bg-violet-50 text-violet-600 border-violet-100' },
    suppliers: { component: Truck, bg: 'bg-amber-50 text-amber-600 border-amber-100' },
    alert: { component: AlertTriangle, bg: 'bg-rose-50 text-rose-600 border-rose-100' },
  }[icon] || { component: TrendingUp, bg: 'bg-indigo-50 text-indigo-600 border-indigo-100' }

  const IconComponent = iconConfig.component

  if (loading) {
    return (
      <div className="bg-white border border-slate-200/80 rounded-xl p-5 shadow-sm animate-pulse space-y-3">
        <div className="flex items-center justify-between">
          <div className="h-3 w-24 bg-slate-200 rounded"></div>
          <div className="w-8 h-8 rounded-lg bg-slate-100"></div>
        </div>
        <div className="h-7 w-32 bg-slate-200 rounded"></div>
        <div className="h-3 w-20 bg-slate-100 rounded"></div>
      </div>
    )
  }

  return (
    <div className="bg-white border border-slate-200/80 rounded-xl p-5 shadow-sm hover:shadow-md transition-all duration-200">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
          {title}
        </span>
        <div className={`p-2 rounded-lg border ${iconConfig.bg}`}>
          <IconComponent className="w-4 h-4" />
        </div>
      </div>

      <div className="mt-3 flex items-baseline justify-between">
        <div className="text-2xl font-bold tracking-tight text-slate-800">
          {value !== undefined && value !== null ? value : '—'}
        </div>

        {change !== undefined && change !== null && (
          <span
            className={`inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-full ${
              changePositive
                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/60'
                : 'bg-rose-50 text-rose-700 border border-rose-200/60'
            }`}
          >
            {changePositive ? (
              <ArrowUpRight className="w-3.5 h-3.5 mr-0.5 text-emerald-600" />
            ) : (
              <ArrowDownRight className="w-3.5 h-3.5 mr-0.5 text-rose-600" />
            )}
            {change}
          </span>
        )}
      </div>

      {subtitle && (
        <p className="mt-1.5 text-xs text-slate-400 font-normal truncate">{subtitle}</p>
      )}
    </div>
  )
}

export default StatCard
