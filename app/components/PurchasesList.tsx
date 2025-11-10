'use client'

import { useState, useEffect, useMemo } from 'react'
import { createPurchase, updatePurchase, deletePurchase, getPurchases } from '@/lib/actions/purchases'
import { createProduct } from '@/lib/actions/products'
import { getErrorMessage } from '@/lib/utils/errors'
import type { Purchase, Product, Store, Category, UnitType } from '@/lib/types'
import { UNIT_OPTIONS } from '@/lib/constants/unitOptions'

export default function PurchasesList({ 
  initialPurchases, 
  products, 
  categories,
  centralStores,
  isAdmin 
}: { 
  initialPurchases: Purchase[]
  products: Product[]
  categories: Category[]
  centralStores: Store[]
  isAdmin: boolean
}) {
  const sortProducts = (items: Product[]) =>
    [...items].sort((a, b) => a.name.localeCompare(b.name))

  const createInitialProductForm = () => ({
    name: '',
    category_id: categories[0]?.id ?? '',
    unit: (UNIT_OPTIONS[0]?.value ?? 'units') as UnitType,
    description: '',
    restock_level: '',
  })

  const [purchases, setPurchases] = useState(initialPurchases)
  const [productOptions, setProductOptions] = useState<Product[]>(sortProducts(products))
  const [showModal, setShowModal] = useState(false)
  const [editingPurchase, setEditingPurchase] = useState<Purchase | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [productError, setProductError] = useState<string | null>(null)
  const [filterProductId, setFilterProductId] = useState<string>('')
  const [filterStartDate, setFilterStartDate] = useState<string>('')
  const [filterEndDate, setFilterEndDate] = useState<string>('')
  const [productSearch, setProductSearch] = useState('')
  const [showProductModal, setShowProductModal] = useState(false)
  const [savingProduct, setSavingProduct] = useState(false)
  const [formData, setFormData] = useState({
    store_id: '',
    product_id: '',
    quantity: '',
    unit_cost: '',
    purchase_date: new Date().toISOString().split('T')[0],
    notes: '',
  })
  const [newProductData, setNewProductData] = useState<{
    name: string
    category_id: string
    unit: UnitType
    description: string
    restock_level: string
  }>(createInitialProductForm)

  useEffect(() => {
    setProductOptions(sortProducts(products))
  }, [products])

  useEffect(() => {
    setNewProductData((prev) => ({
      ...prev,
      category_id: prev.category_id || categories[0]?.id || '',
    }))
  }, [categories])

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

  const handleProductModalOpen = () => {
    setProductError(null)
    setNewProductData(createInitialProductForm())
    setShowProductModal(true)
  }

  const handleProductModalClose = () => {
    setShowProductModal(false)
    setSavingProduct(false)
    setProductError(null)
    setNewProductData(createInitialProductForm())
  }

  const handleCreateProduct = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setProductError(null)

    if (!newProductData.name.trim()) {
      setProductError('Product name is required')
      return
    }

    if (!newProductData.category_id) {
      setProductError('Category is required')
      return
    }

    const restockLevel = newProductData.restock_level
      ? parseFloat(newProductData.restock_level)
      : undefined

    if (restockLevel !== undefined && (isNaN(restockLevel) || restockLevel < 0)) {
      setProductError('Restock level must be 0 or greater')
      return
    }

    setSavingProduct(true)

    const result = await createProduct({
      name: newProductData.name.trim(),
      category_id: newProductData.category_id,
      unit: newProductData.unit,
      description: newProductData.description.trim()
        ? newProductData.description.trim()
        : undefined,
      restock_level: restockLevel,
    })

    if (result.error) {
      setProductError(getErrorMessage(result.error))
      setSavingProduct(false)
      return
    }

    const createdProduct = result.data as Product
    setProductOptions((prev) => sortProducts([...prev, createdProduct]))
    setFormData((prev) => ({
      ...prev,
      product_id: createdProduct.id,
    }))
    setProductSearch(createdProduct.name)
    setSavingProduct(false)
    setShowProductModal(false)
    setProductError(null)
    setNewProductData(createInitialProductForm())
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
  }, [filterProductId, filterStartDate, filterEndDate, initialPurchases])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    if (!formData.store_id) {
      setError('Please select a central store')
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
                  Central Store *
                </label>
                <select
                  required={!editingPurchase}
                  value={formData.store_id}
                  onChange={(e) => setFormData({ ...formData, store_id: e.target.value })}
                  disabled={!!editingPurchase && !isAdmin}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 bg-white focus:border-[#0067ac] focus:outline-none focus:ring-2 focus:ring-[#0067ac] disabled:bg-gray-100 disabled:cursor-not-allowed"
                >
                  <option value="">Select a central store</option>
                  {centralStores.map((store) => (
                    <option key={store.id} value={store.id}>
                      {store.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <div className="mb-1 flex items-center justify-between">
                  <label className="text-sm font-medium text-gray-700">
                    Product *
                  </label>
                  {isAdmin && (
                    <button
                      type="button"
                      onClick={handleProductModalOpen}
                      className="text-sm font-medium text-[#0067ac] hover:underline"
                    >
                      Add new product
                    </button>
                  )}
                </div>
                <input
                  type="text"
                  value={productSearch}
                  onChange={(e) => setProductSearch(e.target.value)}
                  placeholder="Search by name or category"
                  className="mb-2 w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-500 focus:border-[#0067ac] focus:outline-none focus:ring-2 focus:ring-[#0067ac]"
                />
                <select
                  required={!editingPurchase}
                  value={formData.product_id}
                  onChange={(e) => setFormData({ ...formData, product_id: e.target.value })}
                  disabled={!!editingPurchase && !isAdmin}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 bg-white focus:border-[#0067ac] focus:outline-none focus:ring-2 focus:ring-[#0067ac] disabled:bg-gray-100 disabled:cursor-not-allowed"
                >
                  <option value="">Select a product</option>
                  {productSelectOptions.map((product) => (
                    <option key={product.id} value={product.id}>
                      {product.name} ({product.category?.name}) - {product.unit}
                    </option>
                  ))}
                </select>
                {productSearch && productSelectOptions.length === 0 && (
                  <p className="mt-1 text-xs text-gray-500">
                    {isAdmin
                      ? 'No matching products. Use "Add new product" to create one.'
                      : 'No matching products. Please contact an admin to add it.'}
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

      {showProductModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <h3 className="text-xl font-bold mb-4" style={{ color: '#0067ac' }}>
              Add New Product
            </h3>
            <form onSubmit={handleCreateProduct} className="space-y-4">
              {productError && (
                <div className="rounded-md bg-red-50 p-3 border border-red-200">
                  <div className="text-sm text-red-800">{productError}</div>
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Product Name *
                </label>
                <input
                  type="text"
                  value={newProductData.name}
                  onChange={(e) =>
                    setNewProductData({ ...newProductData, name: e.target.value })
                  }
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-500 focus:border-[#0067ac] focus:outline-none focus:ring-2 focus:ring-[#0067ac]"
                  placeholder="Enter product name"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Category *
                </label>
                <select
                  value={newProductData.category_id}
                  onChange={(e) =>
                    setNewProductData({ ...newProductData, category_id: e.target.value })
                  }
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 bg-white focus:border-[#0067ac] focus:outline-none focus:ring-2 focus:ring-[#0067ac] disabled:bg-gray-100"
                  required
                  disabled={categories.length === 0}
                >
                  <option value="">Select a category</option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
                {categories.length === 0 && (
                  <p className="mt-1 text-xs text-gray-500">
                    No categories available. Create a category first.
                  </p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Unit *
                </label>
                <select
                  value={newProductData.unit}
                  onChange={(e) =>
                    setNewProductData({ ...newProductData, unit: e.target.value as UnitType })
                  }
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 bg-white focus:border-[#0067ac] focus:outline-none focus:ring-2 focus:ring-[#0067ac]"
                  required
                >
                  {UNIT_OPTIONS.map((unit) => (
                    <option key={unit.value} value={unit.value}>
                      {unit.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Restock Level
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={newProductData.restock_level}
                  onChange={(e) =>
                    setNewProductData({ ...newProductData, restock_level: e.target.value })
                  }
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-500 focus:border-[#0067ac] focus:outline-none focus:ring-2 focus:ring-[#0067ac]"
                  placeholder="0"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description
                </label>
                <textarea
                  value={newProductData.description}
                  onChange={(e) =>
                    setNewProductData({ ...newProductData, description: e.target.value })
                  }
                  rows={3}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-500 focus:border-[#0067ac] focus:outline-none focus:ring-2 focus:ring-[#0067ac]"
                  placeholder="Optional description"
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={handleProductModalClose}
                  className="flex-1 rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingProduct || categories.length === 0}
                  className="flex-1 rounded-md px-4 py-2 text-sm font-semibold text-white transition-colors disabled:cursor-not-allowed disabled:opacity-70"
                  style={{ backgroundColor: '#0067ac' }}
                  onMouseEnter={(e) => {
                    if (!e.currentTarget.disabled) {
                      e.currentTarget.style.backgroundColor = '#005a94'
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!e.currentTarget.disabled) {
                      e.currentTarget.style.backgroundColor = '#0067ac'
                    }
                  }}
                >
                  {savingProduct ? 'Saving...' : 'Save Product'}
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
                Central Store
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
              purchases.map((purchase) => (
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
    </div>
  )
}

