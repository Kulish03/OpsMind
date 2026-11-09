import React, { useState, useEffect, useCallback } from 'react'
import {
  Boxes,
  PlusCircle,
  RotateCcw,
  AlertTriangle,
  Search,
  Filter,
  DollarSign,
  Package,
  History,
  TrendingDown,
  ArrowUpRight,
  ArrowDownRight,
  ClipboardCheck,
} from 'lucide-react'
import api from '../services/api'
import { useAuth } from '../context/AuthContext'
import { useDebounce } from '../hooks/useDebounce'
import { formatCurrency, formatNumber, formatDate } from '../utils/formatters'
import DataTable from '../components/common/DataTable'
import StatCard from '../components/common/StatCard'
import Modal from '../components/common/Modal'
import { StatusBadge, Badge } from '../components/common/Badge'
import { AlertBanner } from '../components/common/AlertBanner'

export const InventoryPage = () => {
  const { currency, user } = useAuth()
  const [activeTab, setActiveTab] = useState('stock') // 'stock' | 'movements'

  // Summary Metrics
  const [summary, setSummary] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [successMsg, setSuccessMsg] = useState(null)

  // Stock Tab State
  const [stockItems, setStockItems] = useState([])
  const [stockSearch, setStockSearch] = useState('')
  const [stockStatusFilter, setStockStatusFilter] = useState('all')
  const [stockPage, setStockPage] = useState(1)
  const [stockPagination, setStockPagination] = useState({ page: 1, totalPages: 1, total: 0, limit: 15 })

  // Movement Ledger Tab State
  const [movements, setMovements] = useState([])
  const [movementSearch, setMovementSearch] = useState('')
  const [movementTypeFilter, setMovementTypeFilter] = useState('all')
  const [movementPage, setMovementPage] = useState(1)
  const [movementPagination, setMovementPagination] = useState({ page: 1, totalPages: 1, total: 0, limit: 15 })

  const debouncedStockSearch = useDebounce(stockSearch, 350)
  const debouncedMovementSearch = useDebounce(movementSearch, 350)

  // Modals
  const [restockModalOpen, setRestockModalOpen] = useState(false)
  const [adjustModalOpen, setAdjustModalOpen] = useState(false)
  const [writeOffModalOpen, setWriteOffModalOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  // Active Item for Modals
  const [selectedProduct, setSelectedProduct] = useState(null)

  // Modal Form Inputs
  const [restockForm, setRestockForm] = useState({
    sku: '',
    quantity: 10,
    unitCost: 0,
    supplier: '',
    reference: '',
    notes: '',
  })

  const [adjustForm, setAdjustForm] = useState({
    sku: '',
    actualStock: 0,
    reason: 'Monthly physical inventory audit',
  })

  const [writeOffForm, setWriteOffForm] = useState({
    sku: '',
    quantity: 1,
    reason: 'Damaged Goods',
  })

  // Fetch Inventory Summary
  const fetchSummary = useCallback(async () => {
    try {
      const res = await api.get('/inventory/summary')
      setSummary(res.data || null)
    } catch (err) {
      console.warn('Failed to fetch inventory summary:', err)
    }
  }, [])

  // Fetch Stock Levels
  const fetchStock = useCallback(async () => {
    if (activeTab !== 'stock') return
    setLoading(true)
    setError(null)

    try {
      const params = new URLSearchParams({
        page: stockPage.toString(),
        limit: '15',
      })
      if (debouncedStockSearch) params.append('search', debouncedStockSearch)
      if (stockStatusFilter !== 'all') params.append('stockStatus', stockStatusFilter)

      const res = await api.get(`/inventory?${params.toString()}`)
      setStockItems(res.data?.inventory || [])
      setStockPagination(res.data?.pagination || { page: 1, totalPages: 1, total: 0, limit: 15 })
    } catch (err) {
      console.error('Failed to load stock levels:', err)
      setError(err.response?.data?.message || err.message || 'Failed to load stock levels')
    } finally {
      setLoading(false)
    }
  }, [activeTab, stockPage, debouncedStockSearch, stockStatusFilter])

  // Fetch Movement Ledger
  const fetchMovements = useCallback(async () => {
    if (activeTab !== 'movements') return
    setLoading(true)
    setError(null)

    try {
      const params = new URLSearchParams({
        page: movementPage.toString(),
        limit: '15',
      })
      if (debouncedMovementSearch) params.append('search', debouncedMovementSearch)
      if (movementTypeFilter !== 'all') params.append('movementType', movementTypeFilter)

      const res = await api.get(`/inventory/movements?${params.toString()}`)
      setMovements(res.data?.movements || [])
      setMovementPagination(res.data?.pagination || { page: 1, totalPages: 1, total: 0, limit: 15 })
    } catch (err) {
      console.error('Failed to load inventory movements:', err)
      setError(err.response?.data?.message || err.message || 'Failed to load inventory movements')
    } finally {
      setLoading(false)
    }
  }, [activeTab, movementPage, debouncedMovementSearch, movementTypeFilter])

  useEffect(() => {
    fetchSummary()
  }, [fetchSummary])

  useEffect(() => {
    if (activeTab === 'stock') {
      fetchStock()
    } else {
      fetchMovements()
    }
  }, [activeTab, fetchStock, fetchMovements])

  // Open Restock Modal
  const openRestock = (prod = null) => {
    setSelectedProduct(prod)
    setRestockForm({
      sku: prod ? prod.sku : '',
      quantity: prod && prod.targetStock > prod.currentStock ? prod.targetStock - prod.currentStock : 25,
      unitCost: prod ? prod.costPrice : 0,
      supplier: '',
      reference: `PO-${Date.now().toString().slice(-6)}`,
      notes: '',
    })
    setRestockModalOpen(true)
  }

  // Open Adjust Modal
  const openAdjust = (prod = null) => {
    setSelectedProduct(prod)
    setAdjustForm({
      sku: prod ? prod.sku : '',
      actualStock: prod ? prod.currentStock : 0,
      reason: 'Physical cycle count verification',
    })
    setAdjustModalOpen(true)
  }

  // Open Write-Off Modal
  const openWriteOff = (prod = null) => {
    setSelectedProduct(prod)
    setWriteOffForm({
      sku: prod ? prod.sku : '',
      quantity: 1,
      reason: 'Damaged in transit / handling',
    })
    setWriteOffModalOpen(true)
  }

  // Submit Restock
  const handleRestock = async (e) => {
    e.preventDefault()
    setSubmitting(true)
    setError(null)

    try {
      await api.post('/inventory/restock', {
        sku: restockForm.sku.trim().toUpperCase(),
        quantity: Number(restockForm.quantity),
        unitCost: Number(restockForm.unitCost),
        supplier: restockForm.supplier.trim() || undefined,
        referenceId: restockForm.reference.trim() || undefined,
        notes: restockForm.notes.trim() || undefined,
      })
      setSuccessMsg(`Restocked ${restockForm.quantity} units of SKU ${restockForm.sku}`)
      setRestockModalOpen(false)
      fetchSummary()
      fetchStock()
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Restock failed')
    } finally {
      setSubmitting(false)
    }
  }

  // Submit Adjust
  const handleAdjust = async (e) => {
    e.preventDefault()
    setSubmitting(true)
    setError(null)

    try {
      await api.post('/inventory/adjust', {
        sku: adjustForm.sku.trim().toUpperCase(),
        actualStock: Number(adjustForm.actualStock),
        reason: adjustForm.reason.trim(),
      })
      setSuccessMsg(`Stock for SKU ${adjustForm.sku} adjusted to ${adjustForm.actualStock} units`)
      setAdjustModalOpen(false)
      fetchSummary()
      fetchStock()
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Stock adjustment failed')
    } finally {
      setSubmitting(false)
    }
  }

  // Submit Write-Off
  const handleWriteOff = async (e) => {
    e.preventDefault()
    setSubmitting(true)
    setError(null)

    try {
      await api.post('/inventory/write-off', {
        sku: writeOffForm.sku.trim().toUpperCase(),
        quantity: Number(writeOffForm.quantity),
        reason: writeOffForm.reason.trim(),
      })
      setSuccessMsg(`Written off ${writeOffForm.quantity} units of SKU ${writeOffForm.sku}`)
      setWriteOffModalOpen(false)
      fetchSummary()
      fetchStock()
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Write-off failed')
    } finally {
      setSubmitting(false)
    }
  }

  // Stock Columns
  const stockColumns = [
    {
      header: 'SKU',
      accessor: 'sku',
      render: (val) => (
        <span className="font-mono text-xs font-bold text-slate-800 bg-slate-100 px-2 py-0.5 rounded">
          {val}
        </span>
      ),
    },
    {
      header: 'Product Name',
      accessor: 'name',
      render: (val, row) => (
        <div>
          <p className="text-xs font-semibold text-slate-800">{val}</p>
          <p className="text-[11px] text-slate-400">{row.category || 'General'}</p>
        </div>
      ),
    },
    {
      header: 'Status',
      accessor: 'stockStatus',
      render: (val) => <StatusBadge status={val} />,
    },
    {
      header: 'Current Stock',
      accessor: 'currentStock',
      render: (val, row) => (
        <span
          className={`text-xs font-bold ${
            val <= 0 ? 'text-rose-600' : val <= row.reorderThreshold ? 'text-amber-600' : 'text-slate-800'
          }`}
        >
          {formatNumber(val)} {row.unit || 'pcs'}
        </span>
      ),
    },
    {
      header: 'Thresholds',
      render: (_, row) => (
        <span className="text-[11px] text-slate-500">
          Reorder: <span className="font-medium text-slate-700">{row.reorderThreshold}</span> | Target:{' '}
          <span className="font-medium text-slate-700">{row.targetStock}</span>
        </span>
      ),
    },
    {
      header: 'Cost Valuation',
      accessor: 'inventoryValue',
      render: (val) => (
        <span className="text-xs font-semibold text-slate-800">{formatCurrency(val, currency)}</span>
      ),
    },
    {
      header: 'Actions',
      render: (_, row) => (
        <div className="flex items-center space-x-1.5">
          <button
            onClick={() => openRestock(row)}
            className="px-2 py-1 text-[11px] font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200/60 rounded-md transition"
            title="Restock"
          >
            Restock
          </button>
          <button
            onClick={() => openAdjust(row)}
            className="px-2 py-1 text-[11px] font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-md transition"
            title="Cycle Count Adjust"
          >
            Adjust
          </button>
          <button
            onClick={() => openWriteOff(row)}
            className="px-2 py-1 text-[11px] font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200/60 rounded-md transition"
            title="Write-Off"
          >
            Write-Off
          </button>
        </div>
      ),
    },
  ]

  // Movement Ledger Columns
  const movementColumns = [
    {
      header: 'Timestamp',
      accessor: 'timestamp',
      render: (val) => <span className="text-xs text-slate-600">{formatDate(val, true)}</span>,
    },
    {
      header: 'SKU',
      accessor: 'productSku',
      render: (val) => (
        <span className="font-mono text-xs font-bold text-slate-800 bg-slate-100 px-2 py-0.5 rounded">
          {val}
        </span>
      ),
    },
    {
      header: 'Movement Type',
      accessor: 'movementType',
      render: (val) => {
        const isPositive = ['PURCHASE_RECEIPT', 'RETURN_RESTOCK'].includes(val)
        return (
          <Badge variant={isPositive ? 'success' : 'neutral'} size="xs">
            {val}
          </Badge>
        )
      },
    },
    {
      header: 'Quantity Delta',
      accessor: 'quantityChange',
      render: (val) => {
        const isPos = val > 0
        return (
          <span
            className={`inline-flex items-center text-xs font-bold ${
              isPos ? 'text-emerald-600' : 'text-slate-800'
            }`}
          >
            {isPos ? `+${val}` : val}
          </span>
        )
      },
    },
    {
      header: 'Stock Transition',
      render: (_, row) => (
        <span className="text-xs text-slate-500 font-mono">
          {row.previousStock} &rarr; <span className="font-bold text-slate-800">{row.newStock}</span>
        </span>
      ),
    },
    {
      header: 'Unit Cost',
      accessor: 'unitCost',
      render: (val) => <span className="text-xs text-slate-600">{formatCurrency(val, currency)}</span>,
    },
    {
      header: 'Reason / Ref',
      accessor: 'reason',
      render: (val, row) => (
        <div className="max-w-xs truncate text-xs text-slate-600" title={val}>
          {val || '—'}
          {row.referenceId && (
            <span className="text-[10px] text-slate-400 block font-mono">Ref: {row.referenceId}</span>
          )}
        </div>
      ),
    },
  ]

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Inventory & Stock Control</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Monitor real-time stock levels, purchase receipts, and complete audit movement trails
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => openRestock()}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-xs shadow-sm transition"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Restock Shipment</span>
          </button>
        </div>
      </div>

      {error && <AlertBanner type="error" message={error} onDismiss={() => setError(null)} />}
      {successMsg && (
        <AlertBanner type="success" message={successMsg} onDismiss={() => setSuccessMsg(null)} />
      )}

      {/* Summary Valuation Strip */}
      <section className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <StatCard
          title="Stock at Cost"
          value={formatCurrency(summary?.totalCostValuation, currency)}
          subtitle="Inventory balance sheet"
          icon="inventory"
        />
        <StatCard
          title="Stock at Retail"
          value={formatCurrency(summary?.totalRetailValuation, currency)}
          subtitle="Potential revenue"
          icon="profit"
        />
        <StatCard
          title="Total SKUs"
          value={formatNumber(summary?.totalSkus)}
          subtitle="Active items"
          icon="products"
        />
        <StatCard
          title="Total Units"
          value={formatNumber(summary?.totalUnits)}
          subtitle="Physical inventory"
          icon="transactions"
        />
        <StatCard
          title="Low Stock"
          value={formatNumber(summary?.lowStockCount)}
          subtitle="Needs reorder"
          icon="alert"
          changePositive={false}
        />
        <StatCard
          title="Out of Stock"
          value={formatNumber(summary?.outOfStockCount)}
          subtitle="Zero on hand"
          icon="alert"
          changePositive={false}
        />
      </section>

      {/* Tab Switcher & Filters */}
      <div className="bg-white border border-slate-200/80 rounded-xl p-4 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-3">
        {/* Tab Buttons */}
        <div className="flex items-center p-1 bg-slate-100 rounded-xl w-full sm:w-auto">
          <button
            onClick={() => setActiveTab('stock')}
            className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-xs font-semibold transition ${
              activeTab === 'stock'
                ? 'bg-white text-slate-800 shadow-2xs'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <Boxes className="w-4 h-4" />
            <span>Current Stock Levels</span>
          </button>

          <button
            onClick={() => setActiveTab('movements')}
            className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-xs font-semibold transition ${
              activeTab === 'movements'
                ? 'bg-white text-slate-800 shadow-2xs'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <History className="w-4 h-4" />
            <span>Audit Movement Ledger</span>
          </button>
        </div>

        {/* Dynamic Filters depending on active tab */}
        {activeTab === 'stock' ? (
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <div className="relative flex-1 sm:w-64">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
              <input
                type="text"
                placeholder="Search SKU or Name..."
                value={stockSearch}
                onChange={(e) => {
                  setStockSearch(e.target.value)
                  setStockPage(1)
                }}
                className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <select
              value={stockStatusFilter}
              onChange={(e) => {
                setStockStatusFilter(e.target.value)
                setStockPage(1)
              }}
              className="px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="all">All Health</option>
              <option value="optimal">Optimal</option>
              <option value="low_stock">Low Stock</option>
              <option value="out_of_stock">Out of Stock</option>
              <option value="overstocked">Overstocked</option>
            </select>
          </div>
        ) : (
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <div className="relative flex-1 sm:w-64">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
              <input
                type="text"
                placeholder="Search movement or SKU..."
                value={movementSearch}
                onChange={(e) => {
                  setMovementSearch(e.target.value)
                  setMovementPage(1)
                }}
                className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <select
              value={movementTypeFilter}
              onChange={(e) => {
                setMovementTypeFilter(e.target.value)
                setMovementPage(1)
              }}
              className="px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="all">All Movements</option>
              <option value="PURCHASE_RECEIPT">Purchase Receipts</option>
              <option value="SALE_DEDUCTION">Sale Deductions</option>
              <option value="CYCLE_COUNT_ADJUSTMENT">Cycle Count Adjustments</option>
              <option value="WRITE_OFF">Write-Offs</option>
              <option value="RETURN_RESTOCK">Return Restocks</option>
            </select>
          </div>
        )}
      </div>

      {/* Main Tab Table */}
      {activeTab === 'stock' ? (
        <DataTable
          columns={stockColumns}
          data={stockItems}
          loading={loading}
          pagination={stockPagination}
          onPageChange={(p) => setStockPage(p)}
          emptyMessage="No stock items found for the applied filter."
        />
      ) : (
        <DataTable
          columns={movementColumns}
          data={movements}
          loading={loading}
          pagination={movementPagination}
          onPageChange={(p) => setMovementPage(p)}
          emptyMessage="No movement records recorded yet."
        />
      )}

      {/* Restock Inventory Modal */}
      <Modal
        isOpen={restockModalOpen}
        onClose={() => setRestockModalOpen(false)}
        title="Restock Shipment Received"
        subtitle="Increases current inventory and registers purchase in movement ledger"
        maxWidth="max-w-md"
        footer={
          <>
            <button
              type="button"
              onClick={() => setRestockModalOpen(false)}
              className="px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
            >
              Cancel
            </button>
            <button
              onClick={handleRestock}
              disabled={submitting}
              className="px-3 py-1.5 text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition disabled:opacity-50"
            >
              {submitting ? 'Processing...' : 'Confirm Restock'}
            </button>
          </>
        }
      >
        <form onSubmit={handleRestock} className="space-y-3">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Product SKU</label>
            <input
              type="text"
              required
              placeholder="e.g. 85123A"
              value={restockForm.sku}
              onChange={(e) => setRestockForm({ ...restockForm, sku: e.target.value })}
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg uppercase font-mono"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Units Received
              </label>
              <input
                type="number"
                min="1"
                required
                value={restockForm.quantity}
                onChange={(e) => setRestockForm({ ...restockForm, quantity: e.target.value })}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Unit Cost ({currency})
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                required
                value={restockForm.unitCost}
                onChange={(e) => setRestockForm({ ...restockForm, unitCost: e.target.value })}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Supplier (Optional)
              </label>
              <input
                type="text"
                placeholder="e.g. Apex Supplies Ltd"
                value={restockForm.supplier}
                onChange={(e) => setRestockForm({ ...restockForm, supplier: e.target.value })}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                PO / Reference #
              </label>
              <input
                type="text"
                placeholder="e.g. PO-9812"
                value={restockForm.reference}
                onChange={(e) => setRestockForm({ ...restockForm, reference: e.target.value })}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Notes</label>
            <input
              type="text"
              placeholder="e.g. Batch #44 inspection passed"
              value={restockForm.notes}
              onChange={(e) => setRestockForm({ ...restockForm, notes: e.target.value })}
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg"
            />
          </div>
        </form>
      </Modal>

      {/* Cycle Count Adjustment Modal */}
      <Modal
        isOpen={adjustModalOpen}
        onClose={() => setAdjustModalOpen(false)}
        title="Cycle Count Stock Adjustment"
        subtitle="Aligns system stock to physical count and logs audit discrepancy"
        maxWidth="max-w-md"
        footer={
          <>
            <button
              type="button"
              onClick={() => setAdjustModalOpen(false)}
              className="px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
            >
              Cancel
            </button>
            <button
              onClick={handleAdjust}
              disabled={submitting}
              className="px-3 py-1.5 text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition disabled:opacity-50"
            >
              {submitting ? 'Applying...' : 'Set Physical Count'}
            </button>
          </>
        }
      >
        <form onSubmit={handleAdjust} className="space-y-3">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Product SKU</label>
            <input
              type="text"
              required
              value={adjustForm.sku}
              onChange={(e) => setAdjustForm({ ...adjustForm, sku: e.target.value })}
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg uppercase font-mono"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Actual Physical Count on Shelf
            </label>
            <input
              type="number"
              min="0"
              required
              value={adjustForm.actualStock}
              onChange={(e) => setAdjustForm({ ...adjustForm, actualStock: e.target.value })}
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Audit Reason</label>
            <input
              type="text"
              required
              placeholder="e.g. End of month physical audit count"
              value={adjustForm.reason}
              onChange={(e) => setAdjustForm({ ...adjustForm, reason: e.target.value })}
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg"
            />
          </div>
        </form>
      </Modal>

      {/* Write-Off Stock Modal */}
      <Modal
        isOpen={writeOffModalOpen}
        onClose={() => setWriteOffModalOpen(false)}
        title="Inventory Write-Off"
        subtitle="Deducts unsellable stock due to damage, expiration, or shrinkage"
        maxWidth="max-w-md"
        footer={
          <>
            <button
              type="button"
              onClick={() => setWriteOffModalOpen(false)}
              className="px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
            >
              Cancel
            </button>
            <button
              onClick={handleWriteOff}
              disabled={submitting}
              className="px-3 py-1.5 text-xs font-semibold bg-rose-600 hover:bg-rose-700 text-white rounded-lg transition disabled:opacity-50"
            >
              {submitting ? 'Writing Off...' : 'Confirm Write-Off'}
            </button>
          </>
        }
      >
        <form onSubmit={handleWriteOff} className="space-y-3">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Product SKU</label>
            <input
              type="text"
              required
              value={writeOffForm.sku}
              onChange={(e) => setWriteOffForm({ ...writeOffForm, sku: e.target.value })}
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg uppercase font-mono"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Quantity to Write Off
            </label>
            <input
              type="number"
              min="1"
              required
              value={writeOffForm.quantity}
              onChange={(e) => setWriteOffForm({ ...writeOffForm, quantity: e.target.value })}
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Reason</label>
            <select
              value={writeOffForm.reason}
              onChange={(e) => setWriteOffForm({ ...writeOffForm, reason: e.target.value })}
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg"
            >
              <option value="Damaged Goods">Damaged Goods</option>
              <option value="Expired Stock">Expired Stock</option>
              <option value="Theft / Shrinkage">Theft / Shrinkage</option>
              <option value="Quality Inspection Failure">Quality Inspection Failure</option>
            </select>
          </div>
        </form>
      </Modal>
    </div>
  )
}

export default InventoryPage
