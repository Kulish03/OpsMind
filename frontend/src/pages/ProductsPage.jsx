import React, { useState, useEffect, useCallback } from 'react'
import {
  Package,
  Plus,
  Search,
  Filter,
  AlertTriangle,
  Edit2,
  Trash2,
  Layers,
  Boxes,
  TrendingUp,
  Tag,
} from 'lucide-react'
import api from '../services/api'
import { useAuth } from '../context/AuthContext'
import { useDebounce } from '../hooks/useDebounce'
import { formatCurrency, formatNumber, formatPercent } from '../utils/formatters'
import DataTable from '../components/common/DataTable'
import StatCard from '../components/common/StatCard'
import Modal from '../components/common/Modal'
import { StatusBadge, Badge } from '../components/common/Badge'
import { AlertBanner } from '../components/common/AlertBanner'

export const ProductsPage = () => {
  const { currency, user } = useAuth()
  const [products, setProducts] = useState([])
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [successMsg, setSuccessMsg] = useState(null)

  // Filters & Pagination
  const [searchTerm, setSearchTerm] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [lowStockFilter, setLowStockFilter] = useState(false)
  const [page, setPage] = useState(1)
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0, limit: 15 })

  const debouncedSearch = useDebounce(searchTerm, 350)

  // Modals state
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingProduct, setEditingProduct] = useState(null)
  const [deleteProductTarget, setDeleteProductTarget] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  // Form state
  const [formData, setFormData] = useState({
    sku: '',
    name: '',
    category: '',
    description: '',
    costPrice: 0,
    sellingPrice: 0,
    currentStock: 0,
    reorderThreshold: 10,
    targetStock: 50,
    unit: 'pcs',
  })

  // Load Categories metadata once
  useEffect(() => {
    const fetchMeta = async () => {
      try {
        const res = await api.get('/products/meta/categories')
        setCategories(res.data || [])
      } catch (err) {
        console.warn('Failed to fetch categories:', err)
      }
    }
    fetchMeta()
  }, [])

  // Fetch Products
  const fetchProducts = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '15',
      })
      if (debouncedSearch) params.append('search', debouncedSearch)
      if (categoryFilter !== 'all') params.append('category', categoryFilter)
      if (lowStockFilter) params.append('lowStock', 'true')

      const res = await api.get(`/products?${params.toString()}`)
      setProducts(res.data?.products || [])
      setPagination(res.data?.pagination || { page: 1, totalPages: 1, total: 0, limit: 15 })
    } catch (err) {
      console.error('Error fetching products:', err)
      setError(err.response?.data?.message || err.message || 'Failed to load catalog products')
    } finally {
      setLoading(false)
    }
  }, [page, debouncedSearch, categoryFilter, lowStockFilter])

  useEffect(() => {
    fetchProducts()
  }, [fetchProducts])

  // Open Add Modal
  const handleOpenAddModal = () => {
    setEditingProduct(null)
    setFormData({
      sku: '',
      name: '',
      category: categories[0] || 'General',
      description: '',
      costPrice: 0,
      sellingPrice: 0,
      currentStock: 0,
      reorderThreshold: 10,
      targetStock: 50,
      unit: 'pcs',
    })
    setIsModalOpen(true)
  }

  // Open Edit Modal
  const handleOpenEditModal = (prod) => {
    setEditingProduct(prod)
    setFormData({
      sku: prod.sku,
      name: prod.name,
      category: prod.category || '',
      description: prod.description || '',
      costPrice: prod.costPrice,
      sellingPrice: prod.sellingPrice,
      currentStock: prod.currentStock,
      reorderThreshold: prod.reorderThreshold,
      targetStock: prod.targetStock || 50,
      unit: prod.unit || 'pcs',
    })
    setIsModalOpen(true)
  }

  // Submit Add or Edit
  const handleSubmitProduct = async (e) => {
    e.preventDefault()
    setSubmitting(true)
    setError(null)

    try {
      if (editingProduct) {
        await api.put(`/products/${editingProduct._id || editingProduct.id}`, {
          name: formData.name.trim(),
          category: formData.category.trim(),
          description: formData.description?.trim() || undefined,
          costPrice: Number(formData.costPrice),
          sellingPrice: Number(formData.sellingPrice),
          reorderThreshold: Number(formData.reorderThreshold),
          targetStock: Number(formData.targetStock),
          unit: formData.unit.trim(),
        })
        setSuccessMsg(`Product ${formData.sku} updated successfully.`)
      } else {
        await api.post('/products', {
          sku: formData.sku.trim().toUpperCase(),
          name: formData.name.trim(),
          category: formData.category.trim() || 'General',
          description: formData.description?.trim() || undefined,
          costPrice: Number(formData.costPrice),
          sellingPrice: Number(formData.sellingPrice),
          currentStock: Number(formData.currentStock),
          reorderThreshold: Number(formData.reorderThreshold),
          targetStock: Number(formData.targetStock),
          unit: formData.unit.trim(),
        })
        setSuccessMsg(`New product ${formData.sku} added to catalog.`)
      }
      setIsModalOpen(false)
      fetchProducts()
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Operation failed')
    } finally {
      setSubmitting(false)
    }
  }

  // Delete / Deactivate Product
  const handleDeleteProduct = async () => {
    if (!deleteProductTarget) return
    setSubmitting(true)
    setError(null)

    try {
      await api.delete(`/products/${deleteProductTarget._id || deleteProductTarget.id}`)
      setSuccessMsg(`Product ${deleteProductTarget.sku} deactivated successfully.`)
      setDeleteProductTarget(null)
      fetchProducts()
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to deactivate product')
    } finally {
      setSubmitting(false)
    }
  }

  // Table Columns
  const columns = [
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
          {row.description && (
            <p className="text-[11px] text-slate-400 truncate max-w-xs">{row.description}</p>
          )}
        </div>
      ),
    },
    {
      header: 'Category',
      accessor: 'category',
      render: (val) => <Badge variant="neutral">{val || 'General'}</Badge>,
    },
    {
      header: 'Cost Price',
      accessor: 'costPrice',
      render: (val) => <span className="text-xs text-slate-600">{formatCurrency(val, currency)}</span>,
    },
    {
      header: 'Selling Price',
      accessor: 'sellingPrice',
      render: (val) => <span className="text-xs font-bold text-slate-900">{formatCurrency(val, currency)}</span>,
    },
    {
      header: 'Gross Margin',
      render: (_, row) => {
        const margin =
          row.sellingPrice > 0 ? ((row.sellingPrice - row.costPrice) / row.sellingPrice) * 100 : 0
        return (
          <span
            className={`text-xs font-medium ${
              margin >= 40 ? 'text-emerald-600' : margin >= 20 ? 'text-amber-600' : 'text-slate-600'
            }`}
          >
            {formatPercent(margin)}
          </span>
        )
      },
    },
    {
      header: 'Stock Level',
      accessor: 'currentStock',
      render: (val, row) => {
        const isLow = val <= row.reorderThreshold
        return (
          <div className="flex items-center gap-1.5">
            <span
              className={`text-xs font-bold ${
                val <= 0 ? 'text-rose-600' : isLow ? 'text-amber-600' : 'text-slate-800'
              }`}
            >
              {formatNumber(val)} {row.unit || 'pcs'}
            </span>
            {isLow && (
              <span className="w-2 h-2 rounded-full bg-amber-500" title="Below reorder threshold" />
            )}
          </div>
        )
      },
    },
    {
      header: 'Threshold',
      accessor: 'reorderThreshold',
      render: (val) => <span className="text-xs text-slate-400">{formatNumber(val)}</span>,
    },
    {
      header: 'Actions',
      render: (_, row) => (
        <div className="flex items-center space-x-1.5">
          <button
            onClick={() => handleOpenEditModal(row)}
            className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-slate-100 transition"
            title="Edit Product"
          >
            <Edit2 className="w-3.5 h-3.5" />
          </button>
          {(user?.role === 'admin' || user?.role === 'manager') && (
            <button
              onClick={() => setDeleteProductTarget(row)}
              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-slate-100 transition"
              title="Deactivate Product"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
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
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Product Catalog</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Manage SKUs, unit economics, reorder triggers, and active inventory items
          </p>
        </div>

        <button
          onClick={handleOpenAddModal}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-sm shadow-sm transition"
        >
          <Plus className="w-4 h-4" />
          <span>Add New Product</span>
        </button>
      </div>

      {error && <AlertBanner type="error" message={error} onDismiss={() => setError(null)} />}
      {successMsg && (
        <AlertBanner type="success" message={successMsg} onDismiss={() => setSuccessMsg(null)} />
      )}

      {/* Filter and Search Bar */}
      <div className="bg-white border border-slate-200/80 rounded-xl p-4 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3 pointer-events-none" />
          <input
            type="text"
            placeholder="Search by SKU or Product name..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value)
              setPage(1)
            }}
            className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 transition"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          {/* Category Dropdown */}
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

          {/* Low Stock Toggle Button */}
          <button
            type="button"
            onClick={() => {
              setLowStockFilter(!lowStockFilter)
              setPage(1)
            }}
            className={`flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg border transition ${
              lowStockFilter
                ? 'bg-amber-50 border-amber-300 text-amber-800'
                : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
            <span>Low Stock</span>
          </button>
        </div>
      </div>

      {/* Products Table */}
      <DataTable
        columns={columns}
        data={products}
        loading={loading}
        pagination={pagination}
        onPageChange={(p) => setPage(p)}
        emptyMessage="No products match your catalog query."
      />

      {/* Add / Edit Product Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingProduct ? `Edit Product ${editingProduct.sku}` : 'Add New Product to Catalog'}
        subtitle="Configure SKU identification, unit costs, and reorder levels"
        maxWidth="max-w-xl"
        footer={
          <>
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmitProduct}
              disabled={submitting}
              className="px-4 py-2 text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition disabled:opacity-50"
            >
              {submitting ? 'Saving...' : editingProduct ? 'Save Changes' : 'Create Product'}
            </button>
          </>
        }
      >
        <form onSubmit={handleSubmitProduct} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">SKU Code</label>
              <input
                type="text"
                required
                disabled={Boolean(editingProduct)}
                placeholder="e.g. 21484"
                value={formData.sku}
                onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg uppercase font-mono disabled:bg-slate-100"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Category</label>
              <input
                type="text"
                required
                placeholder="e.g. Home, Hardware, Gifts"
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Product Name</label>
            <input
              type="text"
              required
              placeholder="e.g. Ceramic Teapot with Infuser"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Cost Price ({currency})
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                required
                value={formData.costPrice}
                onChange={(e) => setFormData({ ...formData, costPrice: e.target.value })}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Selling Price ({currency})
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                required
                value={formData.sellingPrice}
                onChange={(e) => setFormData({ ...formData, sellingPrice: e.target.value })}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            {!editingProduct && (
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Initial Stock</label>
                <input
                  type="number"
                  min="0"
                  required
                  value={formData.currentStock}
                  onChange={(e) => setFormData({ ...formData, currentStock: e.target.value })}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg"
                />
              </div>
            )}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Reorder Point</label>
              <input
                type="number"
                min="0"
                required
                value={formData.reorderThreshold}
                onChange={(e) => setFormData({ ...formData, reorderThreshold: e.target.value })}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Target Stock</label>
              <input
                type="number"
                min="0"
                required
                value={formData.targetStock}
                onChange={(e) => setFormData({ ...formData, targetStock: e.target.value })}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Description (Optional)</label>
            <textarea
              rows={2}
              placeholder="Detailed specs or merchandising notes"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg"
            />
          </div>
        </form>
      </Modal>

      {/* Delete / Deactivate Confirmation Modal */}
      <Modal
        isOpen={Boolean(deleteProductTarget)}
        onClose={() => setDeleteProductTarget(null)}
        title="Deactivate Catalog Product"
        subtitle={`SKU: ${deleteProductTarget?.sku}`}
        maxWidth="max-w-md"
        footer={
          <>
            <button
              type="button"
              onClick={() => setDeleteProductTarget(null)}
              className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-lg"
            >
              Cancel
            </button>
            <button
              onClick={handleDeleteProduct}
              disabled={submitting}
              className="px-3 py-1.5 text-xs font-semibold bg-rose-600 hover:bg-rose-700 text-white rounded-lg transition disabled:opacity-50"
            >
              {submitting ? 'Deactivating...' : 'Deactivate Product'}
            </button>
          </>
        }
      >
        <p className="text-xs text-slate-600 leading-relaxed">
          Are you sure you want to deactivate{' '}
          <span className="font-semibold text-slate-800">{deleteProductTarget?.name}</span>? It
          will no longer appear in new sales lookups, but historical transaction logs will remain
          intact.
        </p>
      </Modal>
    </div>
  )
}

export default ProductsPage
