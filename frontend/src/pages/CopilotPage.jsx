import React, { useState } from 'react'
import {
  Bot,
  Sparkles,
  TrendingUp,
  Package,
  Users,
  AlertTriangle,
  Receipt,
  Scale,
  ShieldCheck,
  HelpCircle,
  Clock,
  Layers,
  Wrench,
  CheckCircle2,
} from 'lucide-react'
import CopilotChat from '../components/copilot/CopilotChat'

export default function CopilotPage() {
  const [selectedCategory, setSelectedCategory] = useState('all')

  const capabilities = [
    {
      category: 'Financials',
      icon: TrendingUp,
      title: 'Sales & Revenue Analytics',
      desc: 'Net revenue, gross margin, completed orders, and AOV calculations from your transactional database.',
      samplePrompt: 'How is our net revenue and average order value performing this month?',
    },
    {
      category: 'Inventory',
      icon: Package,
      title: 'Stockout Risk & Replenishment',
      desc: 'Days of supply (DoS), low stock warnings, and vendor purchase order suggestions.',
      samplePrompt: 'Which products are at risk of stocking out and need immediate replenishment?',
    },
    {
      category: 'Machine Learning',
      icon: Sparkles,
      title: 'ML Demand Forecasting',
      desc: 'Multi-day demand forecasts (Random Forest) with 90% confidence bounds and expected revenue.',
      samplePrompt: 'What is our forecasted demand for the next 14 days?',
    },
    {
      category: 'Risk & Anomalies',
      icon: AlertTriangle,
      title: 'Anomaly Detection & Explanations',
      desc: 'Flagged unusual expenses and sales outliers with category Z-score and IQR fence evidence.',
      samplePrompt: 'Are there any unusual or anomalous expenses flagged by the ML model?',
    },
    {
      category: 'Customers',
      icon: Users,
      title: 'Customer Churn & Inactivity',
      desc: 'Scored RFM profiles, churn probabilities, and tailored win-back retention actions.',
      samplePrompt: 'Which high-value customers are at risk of churning?',
    },
    {
      category: 'Financials',
      icon: Scale,
      title: 'Revenue vs Expenses',
      desc: 'Net profit margins and operating overhead breakdown across categories.',
      samplePrompt: 'Compare our revenue versus expenses and assess profitability.',
    },
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-2xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
                Phase 6 AI Business Copilot
              </span>
              <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                Grounded Tool Calling Active
              </span>
            </div>
            <h1 className="text-2xl font-bold text-slate-900 mt-2">
              AI Operations Copilot
            </h1>
            <p className="text-sm text-slate-500 mt-0.5">
              Ask operational questions in plain English. OpsMind interprets your intent, executes authoritative backend calculations, and cites verifiable facts and metrics.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1 text-xs text-slate-500 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>Multi-Tenant Isolated</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Grid: Copilot Chat & Capability Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Copilot Chat Interface (Takes 2/3 columns) */}
        <div className="lg:col-span-2">
          <CopilotChat />
        </div>

        {/* Right Column: Capabilities & Prompt Assistant */}
        <div className="space-y-6">
          {/* Tool Capabilities Card */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-2xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Wrench className="w-4 h-4 text-indigo-600" />
                Approved Tool Capabilities
              </h3>
              <span className="text-[11px] font-semibold text-slate-400">11 Tools</span>
            </div>

            <div className="space-y-3">
              {capabilities.map((cap, idx) => {
                const Icon = cap.icon
                return (
                  <div
                    key={idx}
                    className="p-3 rounded-xl border border-slate-100 bg-slate-50/50 hover:bg-slate-50 hover:border-slate-200 transition space-y-1"
                  >
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                        <Icon className="w-3.5 h-3.5" />
                      </div>
                      <span className="font-semibold text-xs text-slate-900">{cap.title}</span>
                    </div>
                    <p className="text-[11px] text-slate-500 pl-8 leading-relaxed">
                      {cap.desc}
                    </p>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Security & Verification Card */}
          <div className="bg-gradient-to-br from-slate-900 to-indigo-950 rounded-2xl p-5 text-white shadow-md space-y-3">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-emerald-400" />
              <h4 className="text-xs font-bold uppercase tracking-wider text-indigo-200">
                Grounding & Security
              </h4>
            </div>
            <ul className="text-xs text-slate-300 space-y-1.5">
              <li className="flex items-start gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 mt-0.5 shrink-0" />
                <span><strong>No Hallucinations:</strong> Calculations run deterministically in backend services.</span>
              </li>
              <li className="flex items-start gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 mt-0.5 shrink-0" />
                <span><strong>Tenant Isolation:</strong> Requests strictly scoped to your authenticated business.</span>
              </li>
              <li className="flex items-start gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 mt-0.5 shrink-0" />
                <span><strong>Prompt Injection Defense:</strong> Hostile instructions and override attempts are blocked.</span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}
