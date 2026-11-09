import React, { useState, useEffect, useCallback } from 'react'
import {
  ShoppingCart,
  Plus,
  Search,
  Filter,
  DollarSign,
  TrendingUp,
  Receipt,
  Trash2,
  Eye,
  Ban,
  CheckCircle2,
  Calendar,
} from 'lucide-react'
import api from '../services/api'
import { useAuth } from '../context/AuthContext'
import { useDebounce } from '../hooks/useDebounce'
import { formatCurrency, formatNumber, formatDate } from '../utils/formatters'
import DataTable from '../components/common/DataTable'
import StatCard from '../components/common/StatCard'
import Modal from '../components/common/Modal'
import { StatusBadge } from '../components/common/Badge'
import { AlertBanner } from '../components/common/AlertBanner'

export const SalesPage = () => {
  const { currency, user } = useAuth()
  const [sales, setSales] = useState([])
  const [summary, setSummary] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [successMsg, setSuccessMsg] = useState(null)

  // Filters & Pagination
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [page, setPage] = useState(1)
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0, limit: 15 })

  const debouncedSearch = useDebounce(searchTerm, 350)

  // Modals state
  const [isRecordModalOpen, setIsRecordModalOpen] = useState(false)
  const [selectedInvoice, setSelectedInvoice] = useState(null)
  const [cancelModalOpen, setCancelModalOpen] = useState(false)
  const [cancelReason, setCancelReason] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // Record Sale Form state
  const [newSale, setNewSale] = useState({
    customerReference: '',
    paymentMethod: 'card',
    notes: '',
    items: [{ productSku: '', productName: '', quantity: 1, unitPrice: 0 }],
  })

  // Fetch Sales List
  const fetchSales = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '15',
      })
      if (debouncedSearch) params.append('search', debouncedSearch)
      if (statusFilter !== 'all') params.append('status', statusFilter)

      const [salesRes, summaryRes] = await Promise.all([
        api.get(`/sales?${params.toString()}`),
        api.get('/sales/summary'),
      ])

      setSales(salesRes.data?.sales || [])
      setPagination(salesRes.data?.pagination || { page: 1, totalPages: 1, total: 0, limit: 15 })
      setSummary(summaryRes.data || null)
    } catch (err) {
      console.error('Error fetching sales:', err)
      setError(err.response?.data?.message || err.message || 'Failed to retrieve sales records')
    } finally {
      setLoading(false)
    }
  }, [page, debouncedSearch, statusFilter])

  useEffect(() => {
    fetchSales()
  }, [fetchSales])

  // Line Items Helper in Record Modal
  const handleItemChange = (index, field, value) => {
    const updated = [...newSale.items]
    updated[index][field] = value
    setNewSale({ ...newSale, items: updated })
  }

  const addItemRow = () => {
    setNewSale({
      ...newSale,
      items: [...newSale.items, { productSku: '', productName: '', quantity: 1, unitPrice: 0 }],
    })
  }

  const removeItemRow = (index) => {
    if (newSale.items.length <= 1) return
    const updated = newSale.items.filter((_, i) => i !== index)
    setNewSale({ ...newSale, items: updated })
  }

  const calculateSubtotal = () => {
    return newSale.items.reduce(
      (sum, item) => sum + (Number(item.quantity) || 0) * (Number(item.unitPrice) || 0),
      0
    )
  }

  // Submit New Sale
  const handleRecordSale = async (e) => {
    e.preventDefault()
    setSubmitting(true)
    setError(null)

    try {
      // Validate items
      for (const item of newSale.items) {
        if (!item.productSku.trim()) throw new Error('Product SKU is required for each item')
        if (!item.productName.trim()) throw new Error('Product Name is required for each item')
        if (Number(item.quantity) <= 0) throw new Error('Quantity must be greater than 0')
        if (Number(item.unitPrice) < 0) throw new Error('Unit price cannot be negative')
      }

      await api.post('/sales', {
        customerReference: newSale.customerReference.trim() || 'Walk-in Customer',
        paymentMethod: newSale.paymentMethod,
        notes: newSale.notes.trim() || undefined,
        items: newSale.items.map((i) => ({
          productSku: i.productSku.trim().toUpperCase(),
          productName: i.productName.trim(),
          quantity: Number(i.quantity),
          unitPrice: Number(i.unitPrice),
        })),
      })

      setSuccessMsg('Sale invoice created successfully. Inventory levels updated.')
      setIsRecordModalOpen(false)
      setNewSale({
        customerReference: '',
        paymentMethod: 'card',
        notes: '',
        items: [{ productSku: '', productName: '', quantity: 1, unitPrice: 0 }],
      })
      fetchSales()
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to create sale')
    } finally {
      setSubmitting(false)
    }
  }

  // Cancel/Refund Invoice
  const handleCancelSale = async () => {
    if (!selectedInvoice) return
    setSubmitting(true)
    setError(null)

    try {
      await api.post(`/sales/${selectedInvoice._id || selectedInvoice.id}/cancel`, {
        reason: cancelReason.trim() || 'Customer requested return / refund',
      })
      setSuccessMsg(`Invoice ${selectedInvoice.invoiceId} successfully cancelled. Stock restored.`)
      setCancelModalOpen(false)
      setSelectedInvoice(null)
      setCancelReason('')
      fetchSales()
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to cancel sale')
    } finally {
      setSubmitting(false)
    }
  }

  // Table Columns
  const columns = [
    {
      header: 'Invoice #',
      accessor: 'invoiceId',
      render: (val, row) => (
        <span
          onClick={() => setSelectedInvoice(row)}
          className="font-mono text-xs font-semibold text-indigo-600 hover:text-indigo-800 hover:underline cursor-pointer"
        >
          {val}
        </span>
      ),
    },
    {
      header: 'Date',
      accessor: 'transactionDate',
      render: (val) => <span className="text-xs text-slate-600">{formatDate(val, true)}</span>,
    },
    {
      header: 'Customer',
      accessor: 'customerReference',
      render: (val) => (
        <span className="text-xs font-medium text-slate-800">{val || 'Walk-in'}</span>
      ),
    },
    {
      header: 'Units',
      accessor: 'totalUnits',
      render: (val) => <span className="text-xs text-slate-600">{formatNumber(val)}</span>,
    },
    {
      header: 'Total Amount',
      accessor: 'totalAmount',
      render: (val) => (
        <span className="text-xs font-bold text-slate-900">{formatCurrency(val, currency)}</span>
      ),
    },
    {
      header: 'Payment',
      accessor: 'paymentMethod',
      render: (val) => (
        <span className="text-xs uppercase font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
          {val}
        </span>
      ),
    },
    {
      header: 'Status',
      accessor: 'status',
      render: (val) => <StatusBadge status={val} />,
    },
    {
      header: 'Actions',
      render: (_, row) => (
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setSelectedInvoice(row)}
            className="p-1 rounded-md text-slate-400 hover:text-indigo-600 hover:bg-slate-100"
            title="View Details"
          >
            <Eye className="w-4 h-4" />
          </button>
          {row.status === 'completed' && (user?.role === 'admin' || user?.role === 'manager') && (
            <button
              onClick={() => {
                setSelectedInvoice(row)
                setCancelModalOpen(true)
              }}
              className="p-1 rounded-md text-slate-400 hover:text-rose-600 hover:bg-slate-100"
              title="Cancel / Refund"
            >
              <Ban className="w-4 h-4" />
            </button>
          )}
        </div>
      ),
    },
  ]

  return (
    <div className="space-y-6">
      {/* Header and Action Button */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Sales Management</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Process orders, view transaction logs, and manage invoice refunds
          </p>
        </div>

        <button
          onClick={() => setIsRecordModalOpen(true)}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-sm shadow-sm transition"
        >
          <Plus className="w-4 h-4" />
          <span>Record New Sale</span>
        </button>
      </div>

      {error && <AlertBanner type="error" message={error} onDismiss={() => setError(null)} />}
      {successMsg && (
        <AlertBanner type="success" message={successMsg} onDismiss={() => setSuccessMsg(null)} />
      )}

      {/* Sales Summary KPI Cards */}
      <section className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          title="Total Sales Revenue"
          value={formatCurrency(summary?.totalRevenue, currency)}
          subtitle="Completed transactions"
          icon="revenue"
        />
        <StatCard
          title="Invoices Processed"
          value={formatNumber(summary?.totalOrders)}
          subtitle="Total transactions logged"
          icon="sales"
        />
        <StatCard
          title="Average Order Value"
          value={formatCurrency(summary?.averageOrderValue, currency)}
          subtitle="Per order spend"
          icon="transactions"
        />
      </section>

      {/* Search and Filters Bar */}
      <div className="bg-white border border-slate-200/80 rounded-xl p-4 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3 pointer-events-none" />
          <input
            type="text"
            placeholder="Search by invoice ID or customer..."
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
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value)
              setPage(1)
            }}
            className="w-full sm:w-auto px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
          >
            <option value="all">All Statuses</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
            <option value="refunded">Refunded</option>
          </select>
        </div>
      </div>

      {/* Invoices Data Table */}
      <DataTable
        columns={columns}
        data={sales}
        loading={loading}
        pagination={pagination}
        onPageChange={(newPage) => setPage(newPage)}
        emptyMessage="No sales invoices found matching criteria."
      />

      {/* Record Sale Modal */}
      <Modal
        isOpen={isRecordModalOpen}
        onClose={() => setIsRecordModalOpen(false)}
        title="Record New Sale Transaction"
        subtitle="Deducts stock automatically from current inventory"
        maxWidth="max-w-2xl"
        footer={
          <>
            <button
              type="button"
              onClick={() => setIsRecordModalOpen(false)}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition"
            >
              Cancel
            </button>
            <button
              onClick={handleRecordSale}
              disabled={submitting}
              className="px-4 py-2 text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition disabled:opacity-50"
            >
              {submitting ? 'Processing Sale...' : 'Complete & Record Sale'}
            </button>
          </>
        }
      >
        <form onSubmit={handleRecordSale} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Customer Reference / Name
              </label>
              <input
                type="text"
                placeholder="Walk-in or Customer ID"
                value={newSale.customerReference}
                onChange={(e) => setNewSale({ ...newSale, customerReference: e.target.value })}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Payment Method
              </label>
              <select
                value={newSale.paymentMethod}
                onChange={(e) => setNewSale({ ...newSale, paymentMethod: e.target.value })}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
              >
                <option value="card">Card</option>
                <option value="cash">Cash</option>
                <option value="bank_transfer">Bank Transfer</option>
                <option value="on_account">On Account</option>
              </select>
            </div>
          </div>

          {/* Line Items Table */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                Cart Items
              </label>
              <button
                type="button"
                onClick={addItemRow}
                className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" /> Add Item
              </button>
            </div>

            <div className="space-y-2 border border-slate-200 rounded-xl p-3 bg-slate-50/50">
              {newSale.items.map((item, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <input
                    type="text"
                    placeholder="SKU (e.g. 85123A)"
                    required
                    value={item.productSku}
                    onChange={(e) => handleItemChange(idx, 'productSku', e.target.value)}
                    className="w-28 px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-lg uppercase font-mono"
                  />
                  <input
                    type="text"
                    placeholder="Product Name"
                    required
                    value={item.productName}
                    onChange={(e) => handleItemChange(idx, 'productName', e.target.value)}
                    className="flex-1 px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-lg"
                  />
                  <input
                    type="number"
                    min="1"
                    placeholder="Qty"
                    required
                    value={item.quantity}
                    onChange={(e) => handleItemChange(idx, 'quantity', e.target.value)}
                    className="w-16 px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-lg text-center"
                  />
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="Price"
                    required
                    value={item.unitPrice}
                    onChange={(e) => handleItemChange(idx, 'unitPrice', e.target.value)}
                    className="w-20 px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-lg text-right"
                  />
                  <span className="w-20 text-xs font-bold text-slate-800 text-right">
                    {formatCurrency((item.quantity || 0) * (item.unitPrice || 0), currency)}
                  </span>
                  <button
                    type="button"
                    onClick={() => removeItemRow(idx)}
                    disabled={newSale.items.length <= 1}
                    className="p-1 text-slate-400 hover:text-rose-600 disabled:opacity-30"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>

            <div className="mt-3 flex justify-between items-center px-2">
              <span className="text-xs font-medium text-slate-500">Order Subtotal:</span>
              <span className="text-base font-bold text-slate-900">
                {formatCurrency(calculateSubtotal(), currency)}
              </span>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Internal Notes (Optional)
            </label>
            <textarea
              rows={2}
              placeholder="e.g. Counter pickup, phone order"
              value={newSale.notes}
              onChange={(e) => setNewSale({ ...newSale, notes: e.target.value })}
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </form>
      </Modal>

      {/* Invoice Details Modal */}
      {selectedInvoice && !cancelModalOpen && (
        <Modal
          isOpen={Boolean(selectedInvoice)}
          onClose={() => setSelectedInvoice(null)}
          title={`Invoice ${selectedInvoice.invoiceId}`}
          subtitle={`Recorded on ${formatDate(selectedInvoice.transactionDate, true)}`}
          maxWidth="max-w-lg"
          footer={
            <div className="flex items-center justify-between w-full">
              <StatusBadge status={selectedInvoice.status} />
              <button
                type="button"
                onClick={() => setSelectedInvoice(null)}
                className="px-4 py-1.5 text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg"
              >
                Close
              </button>
            </div>
          }
        >
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50 rounded-xl text-xs">
              <div>
                <span className="text-slate-400 block">Customer Reference:</span>
                <span className="font-semibold text-slate-800">
                  {selectedInvoice.customerReference || 'Walk-in'}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block">Payment Method:</span>
                <span className="font-semibold text-slate-800 uppercase">
                  {selectedInvoice.paymentMethod || 'Card'}
                </span>
              </div>
            </div>

            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                Purchased Items
              </h4>
              <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden">
                {selectedInvoice.items?.map((item, i) => (
                  <div key={i} className="p-2.5 flex items-center justify-between text-xs">
                    <div>
                      <p className="font-semibold text-slate-800">{item.productName}</p>
                      <p className="text-slate-400 font-mono">
                        {item.productSku} &bull; {item.quantity} &times;{' '}
                        {formatCurrency(item.unitPrice, currency)}
                      </p>
                    </div>
                    <span className="font-bold text-slate-900">
                      {formatCurrency(item.lineTotal, currency)}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="pt-2 flex justify-between items-center text-sm border-t border-slate-100">
              <span className="font-semibold text-slate-600">Total Invoice Amount:</span>
              <span className="text-lg font-bold text-slate-900">
                {formatCurrency(selectedInvoice.totalAmount, currency)}
              </span>
            </div>
          </div>
        </Modal>
      )}

      {/* Cancel Invoice Confirmation Modal */}
      <Modal
        isOpen={cancelModalOpen}
        onClose={() => setCancelModalOpen(false)}
        title="Cancel & Refund Invoice"
        subtitle={`Invoice: ${selectedInvoice?.invoiceId}`}
        maxWidth="max-w-md"
        footer={
          <>
            <button
              type="button"
              onClick={() => setCancelModalOpen(false)}
              className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-lg"
            >
              Back
            </button>
            <button
              onClick={handleCancelSale}
              disabled={submitting}
              className="px-3 py-1.5 text-xs font-semibold bg-rose-600 hover:bg-rose-700 text-white rounded-lg transition disabled:opacity-50"
            >
              {submitting ? 'Cancelling...' : 'Confirm Cancellation & Restock'}
            </button>
          </>
        }
      >
        <div className="space-y-3">
          <p className="text-xs text-slate-600 leading-relaxed">
            Cancelling this transaction will reverse invoice revenue and automatically restore
            deducted units back to current inventory with a{' '}
            <span className="font-semibold text-slate-800">RETURN_RESTOCK</span> audit log.
          </p>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Cancellation Reason
            </label>
            <input
              type="text"
              placeholder="e.g. Defective item returned, customer cancellation"
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-rose-500"
            />
          </div>
        </div>
      </Modal>
    </div>
  )
}

export default SalesPage
