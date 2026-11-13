import React from 'react'
import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard,
  ShoppingCart,
  Package,
  Boxes,
  Receipt,
  Users,
  Truck,
  Sparkles,
  Bot,
  Lightbulb,
  ShieldAlert,
  BrainCircuit,
} from 'lucide-react'

export const Sidebar = ({ onCloseMobile }) => {
  const navItems = [
    { name: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
    { name: 'AI Copilot', path: '/copilot', icon: Bot },
    { name: 'Recommendations', path: '/recommendations', icon: Lightbulb },
    { name: 'ML Insights', path: '/ml-insights', icon: BrainCircuit },
    { name: 'Alerts', path: '/alerts', icon: ShieldAlert },
    { name: 'Sales', path: '/sales', icon: ShoppingCart },
    { name: 'Products', path: '/products', icon: Package },
    { name: 'Inventory', path: '/inventory', icon: Boxes },
    { name: 'Expenses', path: '/expenses', icon: Receipt },
    { name: 'Customers', path: '/customers', icon: Users },
    { name: 'Suppliers', path: '/suppliers', icon: Truck },
  ]

  const linkClasses = ({ isActive }) =>
    `flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 ${
      isActive
        ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-600/20'
        : 'text-slate-600 hover:bg-slate-100/80 hover:text-slate-900'
    }`

  return (
    <div className="flex flex-col h-full bg-white border-r border-slate-200/80">
      {/* Brand Header */}
      <div className="p-5 border-b border-slate-100 flex items-center space-x-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-indigo-500 flex items-center justify-center shadow-md shadow-indigo-500/20">
          <Bot className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="text-base font-bold text-slate-900 tracking-tight flex items-center gap-1.5">
            OpsMind
            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200/60">
              Copilot
            </span>
          </h1>
          <p className="text-[11px] text-slate-400">SME Operations Platform</p>
        </div>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 p-3.5 space-y-1.5 overflow-y-auto">
        <p className="px-3 pt-2 pb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
          Core Operations
        </p>

        {navItems.map((item) => {
          const Icon = item.icon
          return (
            <NavLink
              key={item.path}
              to={item.path}
              onClick={onCloseMobile}
              className={linkClasses}
            >
              <Icon className="w-4 h-4 shrink-0" />
              <span>{item.name}</span>
            </NavLink>
          )
        })}
      </nav>

      {/* System Status Pill Footer */}
      <div className="p-4 border-t border-slate-100 bg-slate-50/50">
        <div className="flex items-center gap-2 p-2.5 rounded-lg bg-white border border-slate-200/70 shadow-2xs">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-slate-800 truncate">Ops Engine Active</p>
            <p className="text-[11px] text-slate-400 truncate">Multi-Tenant Scoped</p>
          </div>
          <Sparkles className="w-3.5 h-3.5 text-amber-500 shrink-0" />
        </div>
      </div>
    </div>
  )
}

export default Sidebar
