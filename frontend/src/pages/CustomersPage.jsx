import React, { useState, useEffect, useCallback } from 'react'
import {
  Users,
  Plus,
  Search,
  Filter,
  DollarSign,
  ShoppingBag,
  Eye,
  Mail,
  Phone,
  Globe,
  Clock,
  Sparkles,
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

export const CustomersPage = () => {
  const { currency, user } = useAuth()
  const [customers, setCustomers] = useState([])
  const [summary, setSummary] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [successMsg, setSuccessMsg] = useState(null)

  // Filters & Pagination
  const [searchTerm, setSearchTerm] = useState('')
  const [retentionFilter, setRetentionFilter] = useState('all')
  const [page, setPage] = useState(1)
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0, limit: 15 })

  const debouncedSearch = useDebounce(searchTerm, 350)

  // Modals state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [selectedCustomer, setSelectedCustomer] = useState(null)
  const [customerOrders, setCustomerOrders] = useState([])
  const [loadingOrders, setLoadingOrders] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  // Add Customer Form
  const [newCustomer, setNewCustomer] = useState({
    customerId: '',
    name: '',
    email: '',
    phone: '',
    company: '',
    country: 'United Kingdom',
  })

  // Fetch Customer Summary
  const fetchSummary = useCallback(async () => {
    try {
      const res = await api.get('/customers/summary')
      setSummary(res.data || null)
    } catch (err) {
      console.warn('Failed to load customer summary:', err)
    }
  }, [])

  // Fetch Customers List
  const fetchCustomers = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '15',
      })
      if (debouncedSearch) params.append('search', debouncedSearch)
      if (retentionFilter !== 'all') params.append('retentionStatus', retentionFilter)

      const res = await api.get(`/customers?${params.toString()}`)
      setCustomers(res.data?.customers || [])
      setPagination(res.data?.pagination || { page: 1, totalPages: 1, total: 0, limit: 15 })
    } catch (err) {
      console.error('Error fetching customers:', err)
      setError(err.response?.data?.message || err.message || 'Failed to retrieve customers')
    } finally {
      setLoading(false)
    }
  }, [page, debouncedSearch, retentionFilter])

  useEffect(() => {
    fetchSummary()
  }, [fetchSummary])

  useEffect(() => {
    fetchCustomers()
  }, [fetchCustomers])

  // View Customer Orders
  const handleViewOrders = async (cust) => {
    setSelectedCustomer(cust)
    setCustomerOrders([])
    setLoadingOrders(true)

    try {
      const res = await api.get(`/customers/${cust._id || cust.id}/orders`)
      setCustomerOrders(res.data?.orders || [])
    } catch (err) {
      console.warn('Failed to fetch customer orders:', err)
    } finally {
      setLoadingOrders(false)
    }
  }

  // Submit Add Customer
  const handleAddCustomer = async (e) => {
    e.preventDefault()
    setSubmitting(true)
    setError(null)

    try {
      await api.post('/customers', {
        customerId: newCustomer.customerId.trim() || undefined,
        name: newCustomer.name.trim(),
        email: newCustomer.email.trim() || undefined,
        phone: newCustomer.phone.trim() || undefined,
        company: newCustomer.company.trim() || undefined,
        country: newCustomer.country.trim() || 'United Kingdom',
      })
      setSuccessMsg(`Customer ${newCustomer.name} created successfully.`)
      setIsAddModalOpen(false)
      setNewCustomer({
        customerId: '',
        name: '',
        email: '',
        phone: '',
        company: '',
        country: 'United Kingdom',
      })
      fetchCustomers()
      fetchSummary()
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to add customer')
    } finally {
      setSubmitting(false)
    }
  }

  // Customer Directory Columns
  const columns = [
    {
      header: 'Customer ID',
      accessor: 'customerId',
      render: (val, row) => (
        <span
          onClick={() => handleViewOrders(row)}
          className="font-mono text-xs font-semibold text-indigo-600 hover:text-indigo-800 hover:underline cursor-pointer"
        >
          {val}
        </span>
      ),
    },
    {
      header: 'Name',
      accessor: 'name',
      render: (val, row) => (
        <div>
          <p className="text-xs font-semibold text-slate-800">{val}</p>
          {row.email && <p className="text-[11px] text-slate-400">{row.email}</p>}
        </div>
      ),
    },
    {
      header: 'Country',
      accessor: 'country',
      render: (val) => <span className="text-xs text-slate-600">{val || '—'}</span>,
    },
    {
      header: 'Orders',
      accessor: 'totalOrders',
      render: (val) => <span className="text-xs text-slate-700 font-semibold">{formatNumber(val)}</span>,
    },
    {
      header: 'Total Spend',
      accessor: 'totalSpend',
      render: (val) => (
        <span className="text-xs font-bold text-slate-900">{formatCurrency(val, currency)}</span>
      ),
    },
    {
      header: 'RFM Status',
      render: (_, row) => {
        const status = row.rfm?.retentionStatus || 'ACTIVE'
        return <StatusBadge status={status} />
      },
    },
    {
      header: 'Last Order',
      render: (_, row) => {
        const lastDate = row.lastOrderDate || row.rfm?.lastOrderDate
        return <span className="text-xs text-slate-500">{formatDate(lastDate)}</span>
      },
    },
    {
      header: 'Actions',
      render: (_, row) => (
        <button
          onClick={() => handleViewOrders(row)}
          className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-md transition"
        >
          <Eye className="w-3.5 h-3.5" />
          <span>Orders</span>
        </button>
      ),
    },
  ]

  const activeCount = summary?.statusDistribution?.ACTIVE?.count || 0
  const dormantCount = summary?.statusDistribution?.DORMANT?.count || 0
  const atRiskCount = summary?.statusDistribution?.AT_RISK?.count || 0
  const churnedCount = summary?.statusDistribution?.CHURNED?.count || 0

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Customer Intelligence</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Client directory, RFM retention segmentation, and lifetime order histories
          </p>
        </div>

        <button
          onClick={() => setIsAddModalOpen(true)}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-sm shadow-sm transition"
        >
          <Plus className="w-4 h-4" />
          <span>Add Customer Profile</span>
        </button>
      </div>

      {error && <AlertBanner type="error" message={error} onDismiss={() => setError(null)} />}
      {successMsg && (
        <AlertBanner type="success" message={successMsg} onDismiss={() => setSuccessMsg(null)} />
      )}

      {/* Customer KPI Strip */}
      <section className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard
          title="Total Clients"
          value={formatNumber(summary?.totalCustomers)}
          subtitle="Directory records"
          icon="customers"
        />
        <StatCard
          title="Active Clients"
          value={formatNumber(activeCount)}
          subtitle="Recent purchase activity"
          icon="sales"
        />
        <StatCard
          title="Dormant / At-Risk"
          value={formatNumber(dormantCount + atRiskCount)}
          subtitle="Re-engagement opportunity"
          icon="alert"
          changePositive={false}
        />
        <StatCard
          title="Churned Clients"
          value={formatNumber(churnedCount)}
          subtitle="No orders > 180 days"
          icon="alert"
          changePositive={false}
        />
      </section>

      {/* Search and Filters Bar */}
      <div className="bg-white border border-slate-200/80 rounded-xl p-4 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3 pointer-events-none" />
          <input
            type="text"
            placeholder="Search by name, email, or customer ID..."
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
            value={retentionFilter}
            onChange={(e) => {
              setRetentionFilter(e.target.value)
              setPage(1)
            }}
            className="w-full sm:w-auto px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
          >
            <option value="all">All Retention Segments</option>
            <option value="ACTIVE">Active (Ordered &le; 30d)</option>
            <option value="DORMANT">Dormant (31 - 90d)</option>
            <option value="AT_RISK">At Risk (91 - 180d)</option>
            <option value="CHURNED">Churned (&gt; 180d)</option>
          </select>
        </div>
      </div>

      {/* Customers DataTable */}
      <DataTable
        columns={columns}
        data={customers}
        loading={loading}
        pagination={pagination}
        onPageChange={(p) => setPage(p)}
        emptyMessage="No customers found matching criteria."
      />

      {/* Add Customer Modal */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title="Add New Customer Profile"
        subtitle="Registers client for multi-channel sales and RFM retention tracking"
        maxWidth="max-w-md"
        footer={
          <>
            <button
              type="button"
              onClick={() => setIsAddModalOpen(false)}
              className="px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition"
            >
              Cancel
            </button>
            <button
              onClick={handleAddCustomer}
              disabled={submitting}
              className="px-3 py-1.5 text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition disabled:opacity-50"
            >
              {submitting ? 'Creating...' : 'Create Customer'}
            </button>
          </>
        }
      >
        <form onSubmit={handleAddCustomer} className="space-y-3">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Customer ID (Optional)
            </label>
            <input
              type="text"
              placeholder="e.g. CUST-10492"
              value={newCustomer.customerId}
              onChange={(e) => setNewCustomer({ ...newCustomer, customerId: e.target.value })}
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg uppercase font-mono"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Full Name</label>
            <input
              type="text"
              required
              placeholder="e.g. Eleanor Vance"
              value={newCustomer.name}
              onChange={(e) => setNewCustomer({ ...newCustomer, name: e.target.value })}
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Email</label>
              <input
                type="email"
                placeholder="e.g. eleanor@example.com"
                value={newCustomer.email}
                onChange={(e) => setNewCustomer({ ...newCustomer, email: e.target.value })}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Phone</label>
              <input
                type="text"
                placeholder="+44 7911 123456"
                value={newCustomer.phone}
                onChange={(e) => setNewCustomer({ ...newCustomer, phone: e.target.value })}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Company</label>
              <input
                type="text"
                placeholder="Vance Logistics"
                value={newCustomer.company}
                onChange={(e) => setNewCustomer({ ...newCustomer, company: e.target.value })}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Country</label>
              <input
                type="text"
                required
                placeholder="United Kingdom"
                value={newCustomer.country}
                onChange={(e) => setNewCustomer({ ...newCustomer, country: e.target.value })}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg"
              />
            </div>
          </div>
        </form>
      </Modal>

      {/* Customer Order History Modal */}
      {selectedCustomer && (
        <Modal
          isOpen={Boolean(selectedCustomer)}
          onClose={() => setSelectedCustomer(null)}
          title={`Order History: ${selectedCustomer.name}`}
          subtitle={`Customer ID: ${selectedCustomer.customerId} | Lifetime Spend: ${formatCurrency(
            selectedCustomer.totalSpend,
            currency
          )}`}
          maxWidth="max-w-2xl"
          footer={
            <button
              onClick={() => setSelectedCustomer(null)}
              className="px-4 py-1.5 text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg"
            >
              Close
            </button>
          }
        >
          <div className="space-y-4">
            {loadingOrders ? (
              <div className="py-8 text-center text-slate-500 text-xs">
                Fetching invoice history...
              </div>
            ) : customerOrders.length > 0 ? (
              <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden">
                {customerOrders.map((ord) => (
                  <div key={ord.invoiceId} className="p-3 bg-white hover:bg-slate-50/70 text-xs">
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-indigo-600">{ord.invoiceId}</span>
                        <StatusBadge status={ord.status} />
                      </div>
                      <span className="font-bold text-slate-900 text-sm">
                        {formatCurrency(ord.totalAmount, currency)}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-slate-400 text-[11px]">
                      <span>{formatDate(ord.transactionDate, true)}</span>
                      <span>{ord.totalUnits} items</span>
                    </div>

                    {ord.items && ord.items.length > 0 && (
                      <div className="mt-2 pt-2 border-t border-slate-100 space-y-1">
                        {ord.items.map((item, idx) => (
                          <div key={idx} className="flex justify-between text-[11px] text-slate-600">
                            <span className="truncate max-w-sm">
                              {item.quantity} &times; {item.productName} ({item.productSku})
                            </span>
                            <span className="font-medium text-slate-800">
                              {formatCurrency(item.lineTotal, currency)}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-8 text-center text-slate-400 text-xs">
                No orders recorded for this customer yet.
              </div>
            )}
          </div>
        </Modal>
      )}
    </div>
  )
}

export default CustomersPage
