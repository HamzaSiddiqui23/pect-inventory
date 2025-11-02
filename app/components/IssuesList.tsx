'use client'

import { useState, useEffect } from 'react'
import { createIssue, getIssues } from '@/lib/actions/issues'
import { getInventory } from '@/lib/actions/inventory'
import { getErrorMessage } from '@/lib/utils/errors'
import type { Issue, Product, Store, UserProfile } from '@/lib/types'

interface StoresData {
  fromStores: Store[]
  toStores: Store[]
}

export default function IssuesList({ 
  initialIssues, 
  storesData,
  products,
  userProfile
}: { 
  initialIssues: Issue[]
  storesData: StoresData | null
  products: Product[]
  userProfile: UserProfile
}) {
  const [issues, setIssues] = useState(initialIssues)
  const [showModal, setShowModal] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [availableInventory, setAvailableInventory] = useState<any[]>([])
  const [filterProductId, setFilterProductId] = useState<string>('')
  const [filterStartDate, setFilterStartDate] = useState<string>('')
  const [filterEndDate, setFilterEndDate] = useState<string>('')
  const [formData, setFormData] = useState({
    from_store_id: '',
    to_store_id: '',
    product_id: '',
    quantity: '',
    issued_to_name: '',
    issue_date: new Date().toISOString().split('T')[0],
    notes: '',
  })

  // Filter issues based on selected filters
  useEffect(() => {
    const loadFilteredIssues = async () => {
      // Only filter if any filter is set, otherwise use initial data
      if (!filterProductId && !filterStartDate && !filterEndDate) {
        setIssues(initialIssues)
        return
      }

      setLoading(true)
      const result = await getIssues(
        undefined,
        filterProductId || undefined,
        filterStartDate || undefined,
        filterEndDate || undefined
      )
      if (result.error) {
        setError(getErrorMessage(result.error))
      } else {
        setIssues(result.data || [])
      }
      setLoading(false)
    }
    
    loadFilteredIssues()
  }, [filterProductId, filterStartDate, filterEndDate, initialIssues])

  const isAdmin = userProfile.role === 'admin'
  const isCentralStoreManager = userProfile.role === 'central_store_manager'
  const selectedFromStore = storesData?.fromStores.find(s => s.id === formData.from_store_id)
  const isCentralStore = selectedFromStore?.type === 'central'
  const canIssueToStore = isCentralStore && (isAdmin || isCentralStoreManager) // Any central store can issue to project stores

  // Load inventory when from_store and product are selected
  useEffect(() => {
    if (formData.from_store_id && formData.product_id) {
      loadInventory()
    } else {
      setAvailableInventory([])
    }
  }, [formData.from_store_id, formData.product_id])

  const loadInventory = async () => {
    const { data } = await getInventory(formData.from_store_id)
    if (data) {
      setAvailableInventory(data)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const quantity = parseFloat(formData.quantity)

    if (!formData.from_store_id) {
      setError('Please select a store to issue from')
      setLoading(false)
      return
    }

    if (!formData.product_id) {
      setError('Please select a product')
      setLoading(false)
      return
    }

    if (isNaN(quantity) || quantity <= 0) {
      setError('Quantity must be greater than 0')
      setLoading(false)
      return
    }

    // For central stores issuing to project stores, require to_store_id
    if (canIssueToStore && !formData.to_store_id) {
      setError('Please select a project store to issue to')
      setLoading(false)
      return
    }

    // For project stores issuing to projects, require issued_to_name
    if (!isCentralStore && !formData.issued_to_name) {
      setError('Please enter the name of person receiving the items')
      setLoading(false)
      return
    }

    // Check available quantity
    const inventoryItem = availableInventory.find(
      item => item.product_id === formData.product_id
    )

    if (!inventoryItem || inventoryItem.quantity < quantity) {
      setError(`Insufficient inventory. Available: ${inventoryItem?.quantity || 0} ${inventoryItem?.product?.unit || ''}`)
      setLoading(false)
      return
    }

    const result = await createIssue({
      from_store_id: formData.from_store_id,
      to_store_id: isCentralStore ? (formData.to_store_id || null) : null,
      product_id: formData.product_id,
      quantity,
      issued_to_name: isCentralStore ? undefined : formData.issued_to_name,
      issue_date: formData.issue_date || undefined,
      notes: formData.notes || undefined,
    })

    if (result.error) {
      setError(getErrorMessage(result.error))
      setLoading(false)
      return
    }

    window.location.reload()
  }

  const resetForm = () => {
    setFormData({
      from_store_id: storesData?.fromStores[0]?.id || '',
      to_store_id: '',
      product_id: '',
      quantity: '',
      issued_to_name: '',
      issue_date: new Date().toISOString().split('T')[0],
      notes: '',
    })
    setError(null)
    setAvailableInventory([])
  }

  const availableQuantity = availableInventory.find(
    item => item.product_id === formData.product_id
  )?.quantity || 0

  return (
    <div>
      {/* Filters */}
      <div className="mb-4 bg-white rounded-lg shadow-md border p-4" style={{ borderColor: '#E77817' }}>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Filter by Product
            </label>
            <select
              value={filterProductId}
              onChange={(e) => setFilterProductId(e.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 bg-white focus:border-[#0067ac] focus:outline-none focus:ring-2 focus:ring-[#0067ac]"
            >
              <option value="">All Products</option>
              {products.map((product) => (
                <option key={product.id} value={product.id}>
                  {product.name} ({product.category?.name})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Start Date
            </label>
            <input
              type="date"
              value={filterStartDate}
              onChange={(e) => setFilterStartDate(e.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-[#0067ac] focus:outline-none focus:ring-2 focus:ring-[#0067ac]"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              End Date
            </label>
            <input
              type="date"
              value={filterEndDate}
              onChange={(e) => setFilterEndDate(e.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-[#0067ac] focus:outline-none focus:ring-2 focus:ring-[#0067ac]"
            />
          </div>
        </div>
        <div className="mt-2 flex gap-2">
          <button
            onClick={() => {
              setFilterProductId('')
              setFilterStartDate('')
              setFilterEndDate('')
            }}
            className="text-sm text-gray-600 hover:text-gray-900 underline"
          >
            Clear Filters
          </button>
        </div>
      </div>

      <div className="mb-4 flex justify-end">
        <button
          onClick={() => {
            resetForm()
            setShowModal(true)
          }}
          className="rounded-md px-4 py-2 text-sm font-semibold text-white transition-colors"
          style={{ backgroundColor: '#0067ac' }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = '#005a94'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = '#0067ac'
          }}
        >
          Issue Items
        </button>
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
            <h3 className="text-xl font-bold mb-4" style={{ color: '#0067ac' }}>
              Issue Items
            </h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="rounded-md bg-red-50 p-3 border border-red-200">
                  <div className="text-sm text-red-800">{error}</div>
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  From Store *
                </label>
                <select
                  required
                  value={formData.from_store_id}
                  onChange={(e) => {
                    setFormData({ 
                      ...formData, 
                      from_store_id: e.target.value,
                      to_store_id: '', // Reset when changing from store
                      product_id: '', // Reset product selection
                    })
                  }}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 bg-white focus:border-[#0067ac] focus:outline-none focus:ring-2 focus:ring-[#0067ac]"
                >
                  <option value="">Select a store</option>
                  {storesData?.fromStores.map((store) => (
                    <option key={store.id} value={store.id}>
                      {store.name} ({store.type === 'central' ? 'Central' : 'Project'})
                    </option>
                  ))}
                </select>
              </div>

              {canIssueToStore && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    To Project Store *
                  </label>
                  <select
                    required
                    value={formData.to_store_id}
                    onChange={(e) => setFormData({ ...formData, to_store_id: e.target.value })}
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 bg-white focus:border-[#0067ac] focus:outline-none focus:ring-2 focus:ring-[#0067ac]"
                  >
                    <option value="">Select a project store</option>
                    {storesData?.toStores.map((store) => (
                      <option key={store.id} value={store.id}>
                        {store.name} {store.project ? `- ${store.project.name}` : ''}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {!isCentralStore && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Issued To (Name) *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.issued_to_name}
                    onChange={(e) => setFormData({ ...formData, issued_to_name: e.target.value })}
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-500 focus:border-[#0067ac] focus:outline-none focus:ring-2 focus:ring-[#0067ac]"
                    placeholder="Name of person/team receiving items"
                  />
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Product *
                </label>
                <select
                  required
                  value={formData.product_id}
                  onChange={(e) => setFormData({ ...formData, product_id: e.target.value })}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 bg-white focus:border-[#0067ac] focus:outline-none focus:ring-2 focus:ring-[#0067ac]"
                >
                  <option value="">Select a product</option>
                  {products.map((product) => (
                    <option key={product.id} value={product.id}>
                      {product.name} ({product.category?.name}) - {product.unit}
                    </option>
                  ))}
                </select>
              </div>

              {formData.product_id && formData.from_store_id && (
                <div className="p-3 bg-blue-50 rounded-md border border-blue-200">
                  <p className="text-sm text-blue-800">
                    <strong>Available:</strong> {availableQuantity} {products.find(p => p.id === formData.product_id)?.unit || ''}
                  </p>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Quantity *
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  max={availableQuantity}
                  required
                  value={formData.quantity}
                  onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-500 focus:border-[#0067ac] focus:outline-none focus:ring-2 focus:ring-[#0067ac]"
                  placeholder="0.00"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Issue Date *
                </label>
                <input
                  type="date"
                  required
                  value={formData.issue_date}
                  onChange={(e) => setFormData({ ...formData, issue_date: e.target.value })}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-[#0067ac] focus:outline-none focus:ring-2 focus:ring-[#0067ac]"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Notes
                </label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  rows={3}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-500 focus:border-[#0067ac] focus:outline-none focus:ring-2 focus:ring-[#0067ac]"
                  placeholder="Optional notes"
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false)
                    resetForm()
                  }}
                  className="flex-1 rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 rounded-md px-4 py-2 text-sm font-semibold text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  style={{ backgroundColor: '#0067ac' }}
                >
                  {loading ? 'Issuing...' : 'Issue Items'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="rounded-lg bg-white shadow-md border overflow-hidden" style={{ borderColor: '#E77817' }}>
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Date
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                From Store
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                To Store
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Product
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Quantity
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Issued To
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {issues.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-4 text-center text-sm text-gray-500">
                  No issues found. Create your first issue.
                </td>
              </tr>
            ) : (
              issues.map((issue) => (
                <tr key={issue.id}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {new Date(issue.issue_date).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {issue.from_store?.name || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {issue.to_store?.name || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {issue.product?.name || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {issue.quantity} {issue.product?.unit || ''}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {issue.issued_to_name || '-'}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

