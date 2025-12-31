'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import { createPurchase, updatePurchase, deletePurchase, getPurchases } from '@/lib/actions/purchases'
import { getErrorMessage } from '@/lib/utils/errors'
import type { Purchase, Product, Store, Category } from '@/lib/types'

export default function PurchasesList({ 
  initialPurchases, 
  products, 
  categories,
  stores,
  isAdmin 
}: { 
  initialPurchases: Purchase[]
  products: Product[]
  categories: Category[]
  stores: Store[]
  isAdmin: boolean
}) {
  const sortProducts = (items: Product[]) =>
    [...items].sort((a, b) => a.name.localeCompare(b.name))

  const [purchases, setPurchases] = useState(initialPurchases)
  const [productOptions, setProductOptions] = useState<Product[]>(sortProducts(products))
  const [showModal, setShowModal] = useState(false)
  const [editingPurchase, setEditingPurchase] = useState<Purchase | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [filterProductId, setFilterProductId] = useState<string>('')
  const [filterStartDate, setFilterStartDate] = useState<string>('')
  const [filterEndDate, setFilterEndDate] = useState<string>('')
  const [productSearch, setProductSearch] = useState('')
  const [showProductDropdown, setShowProductDropdown] = useState(false)
  const productSearchRef = useRef<HTMLDivElement>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(50)
  const [formData, setFormData] = useState({
    store_id: '',
    product_id: '',
    quantity: '',
    unit_cost: '',
    purchase_date: new Date().toISOString().split('T')[0],
    notes: '',
  })

  useEffect(() => {
    setProductOptions(sortProducts(products))
  }, [products])

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (productSearchRef.current && !productSearchRef.current.contains(event.target as Node)) {
        setShowProductDropdown(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])

  const filteredProducts = useMemo(() => {
    const query = productSearch.trim().toLowerCase()

    if (!query) {
      return productOptions
    }

    return productOptions.filter((product) => {
      const nameMatch = product.name.toLowerCase().includes(query)
      const categoryMatch = product.category?.name
        ? product.category.name.toLowerCase().includes(query)
        : false
      return nameMatch || categoryMatch
    })
  }, [productOptions, productSearch])

  const productSelectOptions = useMemo(() => {
    const options = [...filteredProducts]

    if (formData.product_id && !options.some((product) => product.id === formData.product_id)) {
      const selectedProduct = productOptions.find((product) => product.id === formData.product_id)
      if (selectedProduct) {
        options.unshift(selectedProduct)
      }
    }

    const unique = new Map<string, Product>()
    options.forEach((product) => {
      if (!unique.has(product.id)) {
        unique.set(product.id, product)
      }
    })

    return Array.from(unique.values())
  }, [filteredProducts, formData.product_id, productOptions])

  const selectedProduct = useMemo(() => {
    return productOptions.find((p) => p.id === formData.product_id)
  }, [productOptions, formData.product_id])

  const handleProductSelect = (product: Product) => {
    setFormData({ ...formData, product_id: product.id })
    setProductSearch(product.name)
    setShowProductDropdown(false)
  }

  // Filter purchases based on selected filters
  useEffect(() => {
    const loadFilteredPurchases = async () => {
      // Only filter if any filter is set, otherwise use initial data
      if (!filterProductId && !filterStartDate && !filterEndDate) {
        setPurchases(initialPurchases)
        return
      }

      setLoading(true)
      const result = await getPurchases(
        filterProductId || undefined,
        undefined,
        filterStartDate || undefined,
        filterEndDate || undefined
      )
      if (result.error) {
        setError(getErrorMessage(result.error))
      } else {
        setPurchases(result.data || [])
      }
      setLoading(false)
    }
    
    loadFilteredPurchases()
    setCurrentPage(1) // Reset to page 1 when filters change
  }, [filterProductId, filterStartDate, filterEndDate, initialPurchases])

  // Pagination calculations
  const totalPages = Math.ceil(purchases.length / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const endIndex = startIndex + itemsPerPage
  const paginatedPurchases = purchases.slice(startIndex, endIndex)

  const handleItemsPerPageChange = (value: number) => {
    setItemsPerPage(value)
    setCurrentPage(1)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    if (!formData.store_id) {
      setError('Please select a store')
      setLoading(false)
      return
    }

    if (!formData.product_id) {
      setError('Please select a product')
      setLoading(false)
      return
    }

    const quantity = parseFloat(formData.quantity)
    const unit_cost = parseFloat(formData.unit_cost)

    if (isNaN(quantity) || quantity <= 0) {
      setError('Quantity must be greater than 0')
      setLoading(false)
      return
    }

    if (isNaN(unit_cost) || unit_cost < 0) {
      setError('Unit cost must be 0 or greater')
      setLoading(false)
      return
    }

    if (editingPurchase && isAdmin) {
      const result = await updatePurchase({
        id: editingPurchase.id,
        store_id: formData.store_id || undefined,
        product_id: formData.product_id || undefined,
        quantity,
        unit_cost,
        purchase_date: formData.purchase_date || undefined,
        notes: formData.notes || undefined,
      })

      if (result.error) {
        setError(getErrorMessage(result.error))
        setLoading(false)
        return
      }
    } else {
      const result = await createPurchase({
        store_id: formData.store_id,
        product_id: formData.product_id,
        quantity,
        unit_cost,
        purchase_date: formData.purchase_date || undefined,
        notes: formData.notes || undefined,
      })

      if (result.error) {
        setError(getErrorMessage(result.error))
        setLoading(false)
        return
      }
    }

    window.location.reload()
  }

  const handleEdit = (purchase: Purchase) => {
    setEditingPurchase(purchase)
    setFormData({
      store_id: purchase.store_id,
      product_id: purchase.product_id,
      quantity: purchase.quantity.toString(),
      unit_cost: purchase.unit_cost.toString(),
      purchase_date: purchase.purchase_date,
      notes: purchase.notes || '',
    })
    const selectedProduct = productOptions.find((product) => product.id === purchase.product_id)
    setProductSearch(selectedProduct?.name ?? '')
    setShowProductDropdown(false)
    setShowModal(true)
  }

  const handleDelete = async (purchaseId: string) => {
    if (!confirm('Are you sure you want to delete this purchase? This will reverse the inventory.')) {
      return
    }

    if (!isAdmin) {
      alert('Only admins can delete purchases')
      return
    }

    const result = await deletePurchase(purchaseId)
    if (result.error) {
      alert(result.error)
      return
    }

    window.location.reload()
  }

  const resetForm = () => {
    setEditingPurchase(null)
    setFormData({
      store_id: '',
      product_id: '',
      quantity: '',
      unit_cost: '',
      purchase_date: new Date().toISOString().split('T')[0],
      notes: '',
    })
    setError(null)
    setProductSearch('')
    setShowProductDropdown(false)
  }

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
              {productOptions.map((product) => (
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
        <div className="mt-2 flex items-center justify-between">
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
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-700">Items per page:</label>
            <select
              value={itemsPerPage}
              onChange={(e) => handleItemsPerPageChange(Number(e.target.value))}
              className="rounded-md border border-gray-300 px-2 py-1 text-sm text-gray-900 bg-white focus:border-[#0067ac] focus:outline-none focus:ring-2 focus:ring-[#0067ac]"
            >
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
              <option value={200}>200</option>
            </select>
          </div>
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
          Add Purchase
        </button>
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
            <h3 className="text-xl font-bold mb-4" style={{ color: '#0067ac' }}>
              {editingPurchase ? 'Edit Purchase' : 'Add New Purchase'}
            </h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="rounded-md bg-red-50 p-3 border border-red-200">
                  <div className="text-sm text-red-800">{error}</div>
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Store *
                </label>
                <select
                  required={!editingPurchase}
                  value={formData.store_id}
                  onChange={(e) => setFormData({ ...formData, store_id: e.target.value })}
                  disabled={!!editingPurchase && !isAdmin}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 bg-white focus:border-[#0067ac] focus:outline-none focus:ring-2 focus:ring-[#0067ac] disabled:bg-gray-100 disabled:cursor-not-allowed"
                >
                  <option value="">Select a store</option>
                  {stores.map((store) => (
                    <option key={store.id} value={store.id}>
                      {store.name}{store.type === 'project' && store.project ? ` (${store.project.name})` : ''}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Product *
                </label>
                <div ref={productSearchRef} className="relative">
                  <input
                    type="text"
                    value={productSearch}
                    onChange={(e) => {
                      setProductSearch(e.target.value)
                      setShowProductDropdown(true)
                      if (!e.target.value) {
                        setFormData({ ...formData, product_id: '' })
                      }
                    }}
                    onFocus={() => setShowProductDropdown(true)}
                    placeholder="Search by name or category..."
                    disabled={!!editingPurchase && !isAdmin}
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-500 focus:border-[#0067ac] focus:outline-none focus:ring-2 focus:ring-[#0067ac] disabled:bg-gray-100 disabled:cursor-not-allowed"
                  />
                  {showProductDropdown && productSelectOptions.length > 0 && (
                    <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-auto">
                      {productSelectOptions.map((product) => (
                        <button
                          key={product.id}
                          type="button"
                          onClick={() => handleProductSelect(product)}
                          className="w-full text-left px-4 py-2 text-sm hover:bg-gray-100 focus:bg-gray-100 focus:outline-none"
                        >
                          <div className="font-medium text-gray-900">{product.name}</div>
                          <div className="text-xs text-gray-500">
                            {product.category?.name} • {product.unit}
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                  {showProductDropdown && productSearch && productSelectOptions.length === 0 && (
                    <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg p-4">
                      <p className="text-sm text-gray-500 text-center">
                        No matching products found
                      </p>
                    </div>
                  )}
                </div>
                {!selectedProduct && formData.product_id && (
                  <p className="mt-1 text-xs text-red-500">
                    Please select a valid product
                  </p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Quantity *
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  required
                  value={formData.quantity}
                  onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-500 focus:border-[#0067ac] focus:outline-none focus:ring-2 focus:ring-[#0067ac]"
                  placeholder="0.00"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Unit Cost *
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  required
                  value={formData.unit_cost}
                  onChange={(e) => setFormData({ ...formData, unit_cost: e.target.value })}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-500 focus:border-[#0067ac] focus:outline-none focus:ring-2 focus:ring-[#0067ac]"
                  placeholder="0.00"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Total Cost
                </label>
                <input
                  type="text"
                  readOnly
                  value={
                    formData.quantity && formData.unit_cost
                      ? (parseFloat(formData.quantity) * parseFloat(formData.unit_cost)).toFixed(2)
                      : '0.00'
                  }
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-600 bg-gray-50"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Purchase Date *
                </label>
                <input
                  type="date"
                  required
                  value={formData.purchase_date}
                  onChange={(e) => setFormData({ ...formData, purchase_date: e.target.value })}
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
                  {loading ? (editingPurchase ? 'Updating...' : 'Creating...') : (editingPurchase ? 'Update Purchase' : 'Create Purchase')}
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
                Store
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Product
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Category
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Quantity
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Unit Cost
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Total Cost
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {purchases.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-6 py-4 text-center text-sm text-gray-500">
                  No purchases found. Create your first purchase.
                </td>
              </tr>
            ) : (
              paginatedPurchases.map((purchase) => (
                <tr key={purchase.id}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {new Date(purchase.purchase_date).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {purchase.store?.name || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {purchase.product?.name || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {purchase.product?.category?.name || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {purchase.quantity} {purchase.product?.unit || ''}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    PKR {purchase.unit_cost.toFixed(2)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    PKR {purchase.total_cost.toFixed(2)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    {isAdmin && (
                      <>
                        <button
                          onClick={() => handleEdit(purchase)}
                          className="text-[#0067ac] hover:text-[#005a94] mr-4"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(purchase.id)}
                          className="text-red-600 hover:text-red-900"
                        >
                          Delete
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between">
          <div className="text-sm text-gray-700">
            Showing {startIndex + 1} to {Math.min(endIndex, purchases.length)} of {purchases.length} purchases
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
              className="px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Previous
            </button>
            <div className="flex gap-1">
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => {
                // Show first page, last page, current page, and pages around current
                if (
                  page === 1 ||
                  page === totalPages ||
                  (page >= currentPage - 1 && page <= currentPage + 1)
                ) {
                  return (
                    <button
                      key={page}
                      onClick={() => setCurrentPage(page)}
                      className={`px-3 py-2 text-sm font-medium rounded-md ${
                        currentPage === page
                          ? 'text-white'
                          : 'text-gray-700 bg-white border border-gray-300 hover:bg-gray-50'
                      }`}
                      style={currentPage === page ? { backgroundColor: '#0067ac' } : {}}
                    >
                      {page}
                    </button>
                  )
                } else if (page === currentPage - 2 || page === currentPage + 2) {
                  return (
                    <span key={page} className="px-3 py-2 text-sm text-gray-500">
                      ...
                    </span>
                  )
                }
                return null
              })}
            </div>
            <button
              onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
              disabled={currentPage === totalPages}
              className="px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

