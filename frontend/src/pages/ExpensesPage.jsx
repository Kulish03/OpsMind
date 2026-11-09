import React, { useState, useEffect, useCallback } from 'react'
import {
  Receipt,
  Plus,
  Search,
  Filter,
  DollarSign,
  TrendingDown,
  Calendar,
  Layers,
  Edit2,
  Trash2,
} from 'lucide-react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ResponsiveContainer,
} from 'recharts'
import api from '../services/api'
import { useAuth } from '../context/AuthContext'
import { useDebounce } from '../hooks/useDebounce'
import { formatCurrency, formatNumber, formatDate } from '../utils/formatters'
import DataTable from '../components/common/DataTable'
import StatCard from '../components/common/StatCard'
import Modal from '../components/common/Modal'
import { Badge } from '../components/common/Badge'
import { AlertBanner } from '../components/common/AlertBanner'

export const ExpensesPage = () => {
  const { currency, user } = useAuth()
  const [expenses, setExpenses] = useState([])
  const [summary, setSummary] = useState(null)
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [successMsg, setSuccessMsg] = useState(null)

  // Filters & Pagination
  const [searchTerm, setSearchTerm] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [page, setPage] = useState(1)
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0, limit: 15 })

  const debouncedSearch = useDebounce(searchTerm, 350)

  // Modals state
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingExpense, setEditingExpense] = useState(null)
  const [deleteExpenseTarget, setDeleteExpenseTarget] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  // Form State
  const [formData, setFormData] = useState({
    title: '',
    category: 'Rent',
    amount: '',
    date: new Date().toISOString().split('T')[0],
    paymentMethod: 'bank_transfer',
    vendor: '',
    notes: '',
  })

  // Load Categories & Summary metadata
  const fetchMetaAndSummary = useCallback(async () => {
    try {
      const [catRes, sumRes] = await Promise.all([
        api.get('/expenses/meta/categories'),
        api.get('/expenses/summary'),
      ])
      setCategories(catRes.data || [])
      setSummary(sumRes.data || null)
    } catch (err) {
      console.warn('Failed to load expense metadata:', err)
    }
  }, [])

  // Fetch Expenses List
  const fetchExpenses = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '15',
      })
      if (debouncedSearch) params.append('search', debouncedSearch)
      if (categoryFilter !== 'all') params.append('category', categoryFilter)

      const res = await api.get(`/expenses?${params.toString()}`)
      setExpenses(res.data?.expenses || [])
      setPagination(res.data?.pagination || { page: 1, totalPages: 1, total: 0, limit: 15 })
    } catch (err) {
      console.error('Error fetching expenses:', err)
      setError(err.response?.data?.message || err.message || 'Failed to retrieve expenses')
    } finally {
      setLoading(false)
    }
  }, [page, debouncedSearch, categoryFilter])

  useEffect(() => {
    fetchMetaAndSummary()
  }, [fetchMetaAndSummary])

  useEffect(() => {
    fetchExpenses()
  }, [fetchExpenses])

  // Open Add Modal
  const handleOpenAddModal = () => {
    setEditingExpense(null)
    setFormData({
      title: '',
      category: categories[0] || 'Rent',
      amount: '',
      date: new Date().toISOString().split('T')[0],
      paymentMethod: 'bank_transfer',
      vendor: '',
      notes: '',
    })
    setIsModalOpen(true)
  }

  // Open Edit Modal
  const handleOpenEditModal = (exp) => {
    setEditingExpense(exp)
    setFormData({
      title: exp.title,
      category: exp.category,
      amount: exp.amount,
      date: exp.date ? new Date(exp.date).toISOString().split('T')[0] : '',
      paymentMethod: exp.paymentMethod || 'bank_transfer',
      vendor: exp.vendor || '',
      notes: exp.notes || '',
    })
    setIsModalOpen(true)
  }

  // Submit Add or Edit
  const handleSubmitExpense = async (e) => {
    e.preventDefault()
    setSubmitting(true)
    setError(null)

    try {
      if (editingExpense) {
        await api.put(`/expenses/${editingExpense._id || editingExpense.id}`, {
          title: formData.title.trim(),
          category: formData.category,
          amount: Number(formData.amount),
          date: formData.date,
          paymentMethod: formData.paymentMethod,
          vendor: formData.vendor.trim() || undefined,
          notes: formData.notes.trim() || undefined,
        })
        setSuccessMsg('Expense record updated.')
      } else {
        await api.post('/expenses', {
          title: formData.title.trim(),
          category: formData.category,
          amount: Number(formData.amount),
          date: formData.date,
          paymentMethod: formData.paymentMethod,
          vendor: formData.vendor.trim() || undefined,
          notes: formData.notes.trim() || undefined,
        })
        setSuccessMsg('New expense recorded.')
      }

      setIsModalOpen(false)
      fetchExpenses()
      fetchMetaAndSummary()
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Expense submission failed')
    } finally {
      setSubmitting(false)
    }
  }

  // Delete Expense
  const handleDeleteExpense = async () => {
    if (!deleteExpenseTarget) return
    setSubmitting(true)
    setError(null)

    try {
      await api.delete(`/expenses/${deleteExpenseTarget._id || deleteExpenseTarget.id}`)
      setSuccessMsg('Expense record deleted.')
      setDeleteExpenseTarget(null)
      fetchExpenses()
      fetchMetaAndSummary()
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to delete expense')
    } finally {
      setSubmitting(false)
    }
  }

  // Table Columns
  const columns = [
    {
      header: 'Date',
      accessor: 'date',
      render: (val) => <span className="text-xs text-slate-600">{formatDate(val)}</span>,
    },
    {
      header: 'Title / Description',
      accessor: 'title',
      render: (val, row) => (
        <div>
          <p className="text-xs font-semibold text-slate-800">{val}</p>
          {row.vendor && (
            <p className="text-[11px] text-slate-400">Vendor: {row.vendor}</p>
          )}
        </div>
      ),
    },
    {
      header: 'Category',
      accessor: 'category',
      render: (val) => <Badge variant="neutral">{val}</Badge>,
    },
    {
      header: 'Amount',
      accessor: 'amount',
      render: (val) => (
        <span className="text-xs font-bold text-slate-900">{formatCurrency(val, currency)}</span>
      ),
    },
    {
      header: 'Payment Method',
      accessor: 'paymentMethod',
      render: (val) => (
        <span className="text-xs uppercase font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
          {val ? val.replace('_', ' ') : '—'}
        </span>
      ),
    },
    {
      header: 'Actions',
      render: (_, row) => (
        <div className="flex items-center space-x-1.5">
          <button
            onClick={() => handleOpenEditModal(row)}
            className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-slate-100 transition"
            title="Edit"
          >
            <Edit2 className="w-3.5 h-3.5" />
          </button>
          {(user?.role === 'admin' || user?.role === 'manager') && (
            <button
              onClick={() => setDeleteExpenseTarget(row)}
              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-slate-100 transition"
              title="Delete"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      ),
    },
  ]

  // Monthly breakdown for chart
  const monthlyTrendData = summary?.monthlyTrend || []

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Expense Management</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Log overhead operating expenses, cost categories, and vendor outflows
          </p>
        </div>

        <button
          onClick={handleOpenAddModal}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-sm shadow-sm transition"
        >
          <Plus className="w-4 h-4" />
          <span>Record New Expense</span>
        </button>
      </div>

      {error && <AlertBanner type="error" message={error} onDismiss={() => setError(null)} />}
      {successMsg && (
        <AlertBanner type="success" message={successMsg} onDismiss={() => setSuccessMsg(null)} />
      )}

      {/* Expense Summary KPI Strip */}
      <section className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          title="Total Operating Expenses"
          value={formatCurrency(summary?.totalExpenses, currency)}
          subtitle="Cumulative operational outflow"
          icon="profit"
        />
        <StatCard
          title="Expenses Count"
          value={formatNumber(summary?.expenseCount)}
          subtitle="Total receipts logged"
          icon="sales"
        />
        <StatCard
          title="Average Expense"
          value={formatCurrency(summary?.averageExpense, currency)}
          subtitle="Per expense entry"
          icon="transactions"
        />
      </section>

      {/* Monthly Expense Trend Chart (if data exists) */}
      {monthlyTrendData.length > 0 && (
        <section className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm">
          <div className="flex items-center justify-between pb-4 border-b border-slate-100">
            <div>
              <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
                <Receipt className="w-4 h-4 text-indigo-600" />
                Monthly Operating Expense Trajectory
              </h2>
              <p className="text-xs text-slate-500">Historical monthly outflows</p>
            </div>
          </div>

          <div className="h-60 w-full pt-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyTrendData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis dataKey="month" stroke="#94a3b8" fontSize={11} tickLine={false} />
                <YAxis
                  stroke="#94a3b8"
                  fontSize={11}
                  tickLine={false}
                  tickFormatter={(val) => `£${val >= 1000 ? `${(val / 1000).toFixed(0)}k` : val}`}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#ffffff',
                    border: '1px solid #e2e8f0',
                    borderRadius: '0.75rem',
                    fontSize: '12px',
                  }}
                  formatter={(val) => [formatCurrency(val, currency), 'Expenses']}
                />
                <Bar dataKey="total" fill="#f43f5e" radius={[4, 4, 0, 0]} barSize={24} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
      )}

      {/* Search and Filters Bar */}
      <div className="bg-white border border-slate-200/80 rounded-xl p-4 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3 pointer-events-none" />
          <input
            type="text"
            placeholder="Search by title, description, or vendor..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value)
              setPage(1)
            }}
            className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 transition"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Filter className="w-4 h-4 text-slate-400 shrink-0" />
          <select
            value={categoryFilter}
            onChange={(e) => {
              setCategoryFilter(e.target.value)
              setPage(1)
            }}
            className="w-full sm:w-auto px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
          >
            <option value="all">All Categories</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Expenses DataTable */}
      <DataTable
        columns={columns}
        data={expenses}
        loading={loading}
        pagination={pagination}
        onPageChange={(p) => setPage(p)}
        emptyMessage="No expenses found matching the criteria."
      />

      {/* Add / Edit Expense Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingExpense ? 'Edit Expense Record' : 'Record Operating Expense'}
        subtitle="Track overhead expenses against tenant cashflow"
        maxWidth="max-w-md"
        footer={
          <>
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmitExpense}
              disabled={submitting}
              className="px-3 py-1.5 text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition disabled:opacity-50"
            >
              {submitting ? 'Saving...' : editingExpense ? 'Save Changes' : 'Record Expense'}
            </button>
          </>
        }
      >
        <form onSubmit={handleSubmitExpense} className="space-y-3">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Expense Title</label>
            <input
              type="text"
              required
              placeholder="e.g. Warehouse electricity bill"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Category</label>
              <select
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg"
              >
                <option value="Rent">Rent</option>
                <option value="Utilities">Utilities</option>
                <option value="Salaries">Salaries</option>
                <option value="Inventory">Inventory</option>
                <option value="Shipping">Shipping</option>
                <option value="Marketing">Marketing</option>
                <option value="Software">Software</option>
                <option value="Maintenance">Maintenance</option>
                <option value="Insurance">Insurance</option>
                <option value="Other">Other</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Amount ({currency})
              </label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                required
                placeholder="0.00"
                value={formData.amount}
                onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Date</label>
              <input
                type="date"
                required
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Payment Method
              </label>
              <select
                value={formData.paymentMethod}
                onChange={(e) => setFormData({ ...formData, paymentMethod: e.target.value })}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg"
              >
                <option value="bank_transfer">Bank Transfer</option>
                <option value="card">Corporate Card</option>
                <option value="cash">Petty Cash</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Vendor / Payee (Optional)
            </label>
            <input
              type="text"
              placeholder="e.g. British Gas, Royal Mail"
              value={formData.vendor}
              onChange={(e) => setFormData({ ...formData, vendor: e.target.value })}
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Notes</label>
            <textarea
              rows={2}
              placeholder="Tax deduction notes or receipt number"
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg"
            />
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={Boolean(deleteExpenseTarget)}
        onClose={() => setDeleteExpenseTarget(null)}
        title="Delete Expense Record"
        subtitle={`Expense: ${deleteExpenseTarget?.title}`}
        maxWidth="max-w-md"
        footer={
          <>
            <button
              type="button"
              onClick={() => setDeleteExpenseTarget(null)}
              className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-lg"
            >
              Cancel
            </button>
            <button
              onClick={handleDeleteExpense}
              disabled={submitting}
              className="px-3 py-1.5 text-xs font-semibold bg-rose-600 hover:bg-rose-700 text-white rounded-lg transition disabled:opacity-50"
            >
              {submitting ? 'Deleting...' : 'Delete Expense'}
            </button>
          </>
        }
      >
        <p className="text-xs text-slate-600 leading-relaxed">
          Are you sure you want to delete this expense record for{' '}
          <span className="font-semibold text-slate-800">
            {formatCurrency(deleteExpenseTarget?.amount, currency)}
          </span>
          ? This will affect cashflow and net profit calculations.
        </p>
      </Modal>
    </div>
  )
}

export default ExpensesPage
