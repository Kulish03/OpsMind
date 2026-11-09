import React, { useState, useEffect, useCallback } from 'react'
import {
  Truck,
  Plus,
  Search,
  Filter,
  Clock,
  Box,
  Mail,
  Phone,
  Eye,
  Edit2,
  Trash2,
  Package,
} from 'lucide-react'
import api from '../services/api'
import { useAuth } from '../context/AuthContext'
import { useDebounce } from '../hooks/useDebounce'
import { formatCurrency, formatNumber } from '../utils/formatters'
import DataTable from '../components/common/DataTable'
import StatCard from '../components/common/StatCard'
import Modal from '../components/common/Modal'
import { StatusBadge, Badge } from '../components/common/Badge'
import { AlertBanner } from '../components/common/AlertBanner'

export const SuppliersPage = () => {
  const { currency, user } = useAuth()
  const [suppliers, setSuppliers] = useState([])
  const [summary, setSummary] = useState(null)
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
  const [editingSupplier, setEditingSupplier] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [viewProductsSupplier, setViewProductsSupplier] = useState(null)
  const [suppliedProducts, setSuppliedProducts] = useState([])
  const [loadingProducts, setLoadingProducts] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  // Form State
  const [formData, setFormData] = useState({
    supplierId: '',
    name: '',
    category: 'General Merchandise',
    contactPerson: '',
    email: '',
    phone: '',
    leadTimeDays: 7,
    minimumOrderQuantity: 10,
    paymentTerms: 'Net 30',
  })

  // Fetch Summary
  const fetchSummary = useCallback(async () => {
    try {
      const res = await api.get('/suppliers/summary')
      setSummary(res.data || null)
    } catch (err) {
      console.warn('Failed to load supplier summary:', err)
    }
  }, [])

  // Fetch Suppliers List
  const fetchSuppliers = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '15',
      })
      if (debouncedSearch) params.append('search', debouncedSearch)
      if (categoryFilter !== 'all') params.append('category', categoryFilter)

      const res = await api.get(`/suppliers?${params.toString()}`)
      setSuppliers(res.data?.suppliers || [])
      setPagination(res.data?.pagination || { page: 1, totalPages: 1, total: 0, limit: 15 })
    } catch (err) {
      console.error('Error fetching suppliers:', err)
      setError(err.response?.data?.message || err.message || 'Failed to retrieve suppliers')
    } finally {
      setLoading(false)
    }
  }, [page, debouncedSearch, categoryFilter])

  useEffect(() => {
    fetchSummary()
  }, [fetchSummary])

  useEffect(() => {
    fetchSuppliers()
  }, [fetchSuppliers])

  // View Linked Products
  const handleViewProducts = async (sup) => {
    setViewProductsSupplier(sup)
    setSuppliedProducts([])
    setLoadingProducts(true)

    try {
      const res = await api.get(`/suppliers/${sup._id || sup.id}/products`)
      setSuppliedProducts(res.data?.products || [])
    } catch (err) {
      console.warn('Failed to fetch supplied products:', err)
    } finally {
      setLoadingProducts(false)
    }
  }

  // Open Add Modal
  const handleOpenAddModal = () => {
    setEditingSupplier(null)
    setFormData({
      supplierId: `SUP-${Date.now().toString().slice(-4)}`,
      name: '',
      category: 'General Merchandise',
      contactPerson: '',
      email: '',
      phone: '',
      leadTimeDays: 7,
      minimumOrderQuantity: 10,
      paymentTerms: 'Net 30',
    })
    setIsModalOpen(true)
  }

  // Open Edit Modal
  const handleOpenEditModal = (sup) => {
    setEditingSupplier(sup)
    setFormData({
      supplierId: sup.supplierId,
      name: sup.name,
      category: sup.category || 'General Merchandise',
      contactPerson: sup.contactPerson || '',
      email: sup.email || '',
      phone: sup.phone || '',
      leadTimeDays: sup.leadTimeDays || 7,
      minimumOrderQuantity: sup.minimumOrderQuantity || 1,
      paymentTerms: sup.paymentTerms || 'Net 30',
    })
    setIsModalOpen(true)
  }

  // Submit Add or Edit
  const handleSubmitSupplier = async (e) => {
    e.preventDefault()
    setSubmitting(true)
    setError(null)

    try {
      if (editingSupplier) {
        await api.put(`/suppliers/${editingSupplier._id || editingSupplier.id}`, {
          name: formData.name.trim(),
          category: formData.category.trim(),
          contactPerson: formData.contactPerson.trim(),
          email: formData.email.trim(),
          phone: formData.phone.trim() || undefined,
          leadTimeDays: Number(formData.leadTimeDays),
          minimumOrderQuantity: Number(formData.minimumOrderQuantity),
          paymentTerms: formData.paymentTerms.trim() || undefined,
        })
        setSuccessMsg(`Supplier ${formData.name} updated.`)
      } else {
        await api.post('/suppliers', {
          supplierId: formData.supplierId.trim().toUpperCase(),
          name: formData.name.trim(),
          category: formData.category.trim(),
          contactPerson: formData.contactPerson.trim(),
          email: formData.email.trim(),
          phone: formData.phone.trim() || undefined,
          leadTimeDays: Number(formData.leadTimeDays),
          minimumOrderQuantity: Number(formData.minimumOrderQuantity),
          paymentTerms: formData.paymentTerms.trim() || undefined,
        })
        setSuccessMsg(`New vendor ${formData.name} added.`)
      }

      setIsModalOpen(false)
      fetchSuppliers()
      fetchSummary()
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Operation failed')
    } finally {
      setSubmitting(false)
    }
  }

  // Delete Supplier
  const handleDeleteSupplier = async () => {
    if (!deleteTarget) return
    setSubmitting(true)
    setError(null)

    try {
      await api.delete(`/suppliers/${deleteTarget._id || deleteTarget.id}`)
      setSuccessMsg(`Supplier ${deleteTarget.name} removed.`)
      setDeleteTarget(null)
      fetchSuppliers()
      fetchSummary()
    } catch (err) {
      setError(
        err.response?.data?.message ||
          err.message ||
          'Failed to delete supplier (active products may be linked)'
      )
    } finally {
      setSubmitting(false)
    }
  }

  // Columns
  const columns = [
    {
      header: 'Supplier ID',
      accessor: 'supplierId',
      render: (val, row) => (
        <span
          onClick={() => handleViewProducts(row)}
          className="font-mono text-xs font-semibold text-indigo-600 hover:text-indigo-800 hover:underline cursor-pointer"
        >
          {val}
        </span>
      ),
    },
    {
      header: 'Vendor Name',
      accessor: 'name',
      render: (val, row) => (
        <div>
          <p className="text-xs font-semibold text-slate-800">{val}</p>
          <p className="text-[11px] text-slate-400">
            {row.contactPerson} &bull; {row.email}
          </p>
        </div>
      ),
    },
    {
      header: 'Category',
      accessor: 'category',
      render: (val) => <Badge variant="neutral">{val}</Badge>,
    },
    {
      header: 'Lead Time',
      accessor: 'leadTimeDays',
      render: (val) => (
        <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-700">
          <Clock className="w-3.5 h-3.5 text-slate-400" />
          {val} days
        </span>
      ),
    },
    {
      header: 'Min Order Qty',
      accessor: 'minimumOrderQuantity',
      render: (val) => <span className="text-xs text-slate-700 font-semibold">{val} units</span>,
    },
    {
      header: 'Payment Terms',
      accessor: 'paymentTerms',
      render: (val) => <span className="text-xs text-slate-500">{val || 'Net 30'}</span>,
    },
    {
      header: 'Actions',
      render: (_, row) => (
        <div className="flex items-center space-x-1.5">
          <button
            onClick={() => handleViewProducts(row)}
            className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-slate-100 transition"
            title="Supplied Products"
          >
            <Box className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => handleOpenEditModal(row)}
            className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-slate-100 transition"
            title="Edit Supplier"
          >
            <Edit2 className="w-3.5 h-3.5" />
          </button>
          {(user?.role === 'admin' || user?.role === 'manager') && (
            <button
              onClick={() => setDeleteTarget(row)}
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

  const avgLeadTime = summary?.leadTimeStats?.avgLeadTime
    ? Math.round(summary.leadTimeStats.avgLeadTime)
    : 7

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Supplier Directory</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Manage vendor relationships, procurement lead times, and replenishment MOQs
          </p>
        </div>

        <button
          onClick={handleOpenAddModal}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-sm shadow-sm transition"
        >
          <Plus className="w-4 h-4" />
          <span>Add New Supplier</span>
        </button>
      </div>

      {error && <AlertBanner type="error" message={error} onDismiss={() => setError(null)} />}
      {successMsg && (
        <AlertBanner type="success" message={successMsg} onDismiss={() => setSuccessMsg(null)} />
      )}

      {/* Supplier KPI Strip */}
      <section className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          title="Active Suppliers"
          value={formatNumber(summary?.totalSuppliers)}
          subtitle="Contracted procurement partners"
          icon="suppliers"
        />
        <StatCard
          title="Average Lead Time"
          value={`${avgLeadTime} Days`}
          subtitle="Order placement to delivery"
          icon="transactions"
        />
        <StatCard
          title="Product Categories"
          value={formatNumber(summary?.categories?.length || 6)}
          subtitle="Supply chain diversity"
          icon="products"
        />
      </section>

      {/* Search and Filters Bar */}
      <div className="bg-white border border-slate-200/80 rounded-xl p-4 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3 pointer-events-none" />
          <input
            type="text"
            placeholder="Search by vendor name, contact, or email..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value)
              setPage(1)
            }}
            className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 transition"
          />
        </div>
      </div>

      {/* Suppliers DataTable */}
      <DataTable
        columns={columns}
        data={suppliers}
        loading={loading}
        pagination={pagination}
        onPageChange={(p) => setPage(p)}
        emptyMessage="No suppliers found matching criteria."
      />

      {/* Add / Edit Supplier Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingSupplier ? `Edit Supplier: ${editingSupplier.name}` : 'Register New Supplier'}
        subtitle="Configure vendor contact details, lead times, and terms"
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
              onClick={handleSubmitSupplier}
              disabled={submitting}
              className="px-3 py-1.5 text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition disabled:opacity-50"
            >
              {submitting ? 'Saving...' : editingSupplier ? 'Save Changes' : 'Register Supplier'}
            </button>
          </>
        }
      >
        <form onSubmit={handleSubmitSupplier} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Supplier ID</label>
              <input
                type="text"
                required
                disabled={Boolean(editingSupplier)}
                placeholder="SUP-001"
                value={formData.supplierId}
                onChange={(e) => setFormData({ ...formData, supplierId: e.target.value })}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg uppercase font-mono disabled:bg-slate-100"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Category</label>
              <input
                type="text"
                required
                placeholder="e.g. Home, Kitchen"
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Company / Vendor Name</label>
            <input
              type="text"
              required
              placeholder="Apex Wholesale Ltd"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Contact Person</label>
              <input
                type="text"
                required
                placeholder="Marcus Brody"
                value={formData.contactPerson}
                onChange={(e) => setFormData({ ...formData, contactPerson: e.target.value })}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Email</label>
              <input
                type="email"
                required
                placeholder="marcus@apex.com"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Phone</label>
              <input
                type="text"
                placeholder="+44 20 7946 0192"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Payment Terms</label>
              <input
                type="text"
                placeholder="Net 30, COD"
                value={formData.paymentTerms}
                onChange={(e) => setFormData({ ...formData, paymentTerms: e.target.value })}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Lead Time (Days)</label>
              <input
                type="number"
                min="1"
                required
                value={formData.leadTimeDays}
                onChange={(e) => setFormData({ ...formData, leadTimeDays: e.target.value })}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Minimum Order Qty</label>
              <input
                type="number"
                min="1"
                required
                value={formData.minimumOrderQuantity}
                onChange={(e) => setFormData({ ...formData, minimumOrderQuantity: e.target.value })}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg"
              />
            </div>
          </div>
        </form>
      </Modal>

      {/* View Supplied Products Modal */}
      {viewProductsSupplier && (
        <Modal
          isOpen={Boolean(viewProductsSupplier)}
          onClose={() => setViewProductsSupplier(null)}
          title={`Products Supplied by ${viewProductsSupplier.name}`}
          subtitle={`Lead Time: ${viewProductsSupplier.leadTimeDays} Days | MOQ: ${viewProductsSupplier.minimumOrderQuantity} Units`}
          maxWidth="max-w-xl"
          footer={
            <button
              onClick={() => setViewProductsSupplier(null)}
              className="px-4 py-1.5 text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg"
            >
              Close
            </button>
          }
        >
          <div className="space-y-3">
            {loadingProducts ? (
              <div className="py-8 text-center text-slate-500 text-xs">
                Loading linked catalog products...
              </div>
            ) : suppliedProducts.length > 0 ? (
              <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden">
                {suppliedProducts.map((p) => (
                  <div key={p.sku} className="p-3 flex items-center justify-between text-xs">
                    <div>
                      <p className="font-semibold text-slate-800">{p.name}</p>
                      <span className="font-mono text-slate-400">{p.sku}</span>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-slate-900">{formatCurrency(p.costPrice, currency)}</p>
                      <p className="text-[11px] text-slate-500">{p.currentStock} in stock</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-8 text-center text-slate-400 text-xs">
                No active products currently linked to this supplier.
              </div>
            )}
          </div>
        </Modal>
      )}

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        title="Delete Supplier"
        subtitle={`Supplier: ${deleteTarget?.name}`}
        maxWidth="max-w-md"
        footer={
          <>
            <button
              type="button"
              onClick={() => setDeleteTarget(null)}
              className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-lg"
            >
              Cancel
            </button>
            <button
              onClick={handleDeleteSupplier}
              disabled={submitting}
              className="px-3 py-1.5 text-xs font-semibold bg-rose-600 hover:bg-rose-700 text-white rounded-lg transition disabled:opacity-50"
            >
              {submitting ? 'Deleting...' : 'Delete Supplier'}
            </button>
          </>
        }
      >
        <p className="text-xs text-slate-600 leading-relaxed">
          Are you sure you want to delete{' '}
          <span className="font-semibold text-slate-800">{deleteTarget?.name}</span>? If products
          are actively assigned to this supplier, the system will prevent deletion.
        </p>
      </Modal>
    </div>
  )
}

export default SuppliersPage
