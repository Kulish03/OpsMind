import React from 'react'
import { Link } from 'react-router-dom'
import { Bot, ArrowLeft } from 'lucide-react'

export const NotFoundPage = () => {
  return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center text-center p-6">
      <div className="w-14 h-14 rounded-2xl bg-indigo-50 border border-indigo-200/60 flex items-center justify-center text-indigo-600 mb-4">
        <Bot className="w-8 h-8" />
      </div>
      <h1 className="text-3xl font-bold text-slate-900 tracking-tight">404</h1>
      <h2 className="text-lg font-semibold text-slate-700 mt-1">Page Not Found</h2>
      <p className="text-sm text-slate-500 mt-2 max-w-sm">
        The dashboard view you requested does not exist or may have been relocated.
      </p>
      <Link
        to="/dashboard"
        className="inline-flex items-center gap-2 mt-6 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold shadow-sm transition"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Return to Dashboard</span>
      </Link>
    </div>
  )
}

export default NotFoundPage
