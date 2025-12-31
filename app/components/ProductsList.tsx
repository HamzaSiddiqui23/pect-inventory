'use client'

import { useState, useRef, useMemo } from 'react'
import { createProduct, updateProduct, deleteProduct, importProductsFromCSV, type CSVProductRow, type ImportProductResult } from '@/lib/actions/products'
import { getErrorMessage } from '@/lib/utils/errors'
import type { Product, Category } from '@/lib/types'
import type { UnitType } from '@/lib/types'
import { UNIT_OPTIONS } from '@/lib/constants/unitOptions'
import Papa from 'papaparse'

export default function ProductsList({ initialProducts, categories }: { initialProducts: Product[], categories: Category[] }) {
  const [products, setProducts] = useState(initialProducts)
  const [showModal, setShowModal] = useState(false)
  const [showImportModal, setShowImportModal] = useState(false)
  const [editingProduct, setEditingProduct] = useState<Product | null>(null)
  const [loading, setLoading] = useState(false)
  const [importLoading, setImportLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [importError, setImportError] = useState<string | null>(null)
  const [csvData, setCsvData] = useState<CSVProductRow[]>([])
  const [importResult, setImportResult] = useState<ImportProductResult | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [filterCategory, setFilterCategory] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(50)
  const [formData, setFormData] = useState({
    category_id: '',
    name: '',
    unit: 'pcs' as UnitType,
    description: '',
    restock_level: '',
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    if (editingProduct) {
      if (!formData.category_id && !formData.name) {
        setError('Please provide at least category or name')
        setLoading(false)
        return
      }

      const result = await updateProduct({
        id: editingProduct.id,
        category_id: formData.category_id || undefined,
        name: formData.name || undefined,
        unit: formData.unit || undefined,
        description: formData.description || undefined,
        restock_level: formData.restock_level ? parseFloat(formData.restock_level) : undefined,
      })

      if (result.error) {
        setError(getErrorMessage(result.error))
        setLoading(false)
        return
      }
    } else {
      if (!formData.category_id) {
        setError('Please select a category')
        setLoading(false)
        return
      }

      const result = await createProduct({
        category_id: formData.category_id,
        name: formData.name,
        unit: formData.unit,
        description: formData.description || undefined,
        restock_level: formData.restock_level ? parseFloat(formData.restock_level) : 0,
      })

      if (result.error) {
        setError(getErrorMessage(result.error))
        setLoading(false)
        return
      }
    }

    window.location.reload()
  }

  const handleEdit = (product: Product) => {
    setEditingProduct(product)
    setFormData({
      category_id: product.category_id,
      name: product.name,
      unit: product.unit,
      description: product.description || '',
      restock_level: product.restock_level.toString(),
    })
    setShowModal(true)
  }

  const resetForm = () => {
    setEditingProduct(null)
    setFormData({ category_id: '', name: '', unit: 'pcs', description: '', restock_level: '' })
    setError(null)
  }

  const handleDelete = async (productId: string) => {
    if (!confirm('Are you sure you want to delete this product?')) {
      return
    }

    const result = await deleteProduct(productId)
    if (result.error) {
      alert(result.error)
      return
    }

    window.location.reload()
  }

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    setImportError(null)
    setImportResult(null)
    setCsvData([])

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        if (results.errors.length > 0) {
          setImportError(`CSV parsing error: ${results.errors[0].message}`)
          return
        }

        const rows = results.data as CSVProductRow[]
        if (rows.length === 0) {
          setImportError('CSV file is empty or has no valid data')
          return
        }

        setCsvData(rows)
      },
      error: (error) => {
        setImportError(`Failed to parse CSV: ${error.message}`)
      },
    })
  }

  const handleImport = async () => {
    if (csvData.length === 0) {
      setImportError('No data to import')
      return
    }

    setImportLoading(true)
    setImportError(null)
    setImportResult(null)

    const result = await importProductsFromCSV(csvData)

    if (result.error) {
      setImportError(getErrorMessage(result.error))
      setImportLoading(false)
      return
    }

    setImportResult(result.data || null)
    setImportLoading(false)

    // Reload page after successful import
    if (result.data && result.data.created > 0) {
      setTimeout(() => {
        window.location.reload()
      }, 2000)
    }
  }

  const downloadSampleCSV = () => {
    const sampleData = [
      ['name', 'category', 'unit', 'description', 'restock_level'],
      ['Steel Rod', 'Construction Materials', 'kg', 'High quality steel rods', '100'],
      ['Cement Bag', 'Construction Materials', 'bag', 'Portland cement', '50'],
      ['Paint Bucket', 'Paints & Coatings', 'l', 'White paint', '20'],
    ]

    const csv = Papa.unparse(sampleData)
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    const url = URL.createObjectURL(blob)
    link.setAttribute('href', url)
    link.setAttribute('download', 'sample-products.csv')
    link.style.visibility = 'hidden'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  // Filter products based on search query and category
  const filteredProducts = useMemo(() => {
    let filtered = products

    // Filter by category
    if (filterCategory) {
      filtered = filtered.filter((product) => product.category_id === filterCategory)
    }

    // Filter by search query (name or category name)
    if (searchQuery.trim()) {
      const query = searchQuery.trim().toLowerCase()
      filtered = filtered.filter((product) => {
        const nameMatch = product.name.toLowerCase().includes(query)
        const categoryMatch = product.category?.name?.toLowerCase().includes(query) || false
        return nameMatch || categoryMatch
      })
    }

    return filtered
  }, [products, searchQuery, filterCategory])

  // Pagination calculations
  const totalPages = Math.ceil(filteredProducts.length / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const endIndex = startIndex + itemsPerPage
  const paginatedProducts = filteredProducts.slice(startIndex, endIndex)

  // Reset to page 1 when filters change
  const handleSearchChange = (value: string) => {
    setSearchQuery(value)
    setCurrentPage(1)
  }

  const handleCategoryFilterChange = (value: string) => {
    setFilterCategory(value)
    setCurrentPage(1)
  }

  const handleItemsPerPageChange = (value: number) => {
    setItemsPerPage(value)
    setCurrentPage(1)
  }

  return (
    <div>
      {/* Search and Filter Section */}
      <div className="mb-4 bg-white p-4 rounded-lg border shadow-sm" style={{ borderColor: '#E77817' }}>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Search by Name or Category
            </label>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => handleSearchChange(e.target.value)}
              placeholder="Search products..."
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-500 focus:border-[#0067ac] focus:outline-none focus:ring-2 focus:ring-[#0067ac]"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Filter by Category
            </label>
            <select
              value={filterCategory}
              onChange={(e) => handleCategoryFilterChange(e.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 bg-white focus:border-[#0067ac] focus:outline-none focus:ring-2 focus:ring-[#0067ac]"
            >
              <option value="">All Categories</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Items per Page
            </label>
            <select
              value={itemsPerPage}
              onChange={(e) => handleItemsPerPageChange(Number(e.target.value))}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 bg-white focus:border-[#0067ac] focus:outline-none focus:ring-2 focus:ring-[#0067ac]"
            >
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
              <option value={200}>200</option>
            </select>
          </div>
        </div>
        {(searchQuery || filterCategory) && (
          <div className="mt-3 flex items-center gap-2">
            <span className="text-sm text-gray-600">
              Showing {filteredProducts.length} of {products.length} products
            </span>
            <button
              onClick={() => {
                setSearchQuery('')
                setFilterCategory('')
                setCurrentPage(1)
              }}
              className="text-sm text-[#0067ac] hover:text-[#005a94] underline"
            >
              Clear filters
            </button>
          </div>
        )}
      </div>

      <div className="mb-4 flex justify-end gap-3">
        <button
          onClick={() => {
            setShowImportModal(true)
            setCsvData([])
            setImportError(null)
            setImportResult(null)
            if (fileInputRef.current) {
              fileInputRef.current.value = ''
            }
          }}
          className="rounded-md px-4 py-2 text-sm font-semibold text-white transition-colors"
          style={{ backgroundColor: '#E77817' }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = '#d66a14'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = '#E77817'
          }}
        >
          Import from CSV
        </button>
        <button
          onClick={() => setShowModal(true)}
          className="rounded-md px-4 py-2 text-sm font-semibold text-white transition-colors"
          style={{ backgroundColor: '#0067ac' }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = '#005a94'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = '#0067ac'
          }}
        >
          Add Product
        </button>
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
            <h3 className="text-xl font-bold mb-4" style={{ color: '#0067ac' }}>
              {editingProduct ? 'Edit Product' : 'Add New Product'}
            </h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="rounded-md bg-red-50 p-3 border border-red-200">
                  <div className="text-sm text-red-800">{error}</div>
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Category *
                </label>
                <select
                  required={!editingProduct}
                  value={formData.category_id}
                  onChange={(e) => setFormData({ ...formData, category_id: e.target.value })}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 bg-white focus:border-[#0067ac] focus:outline-none focus:ring-2 focus:ring-[#0067ac]"
                >
                  <option value="">Select a category</option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Product Name *
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-500 focus:border-[#0067ac] focus:outline-none focus:ring-2 focus:ring-[#0067ac]"
                  placeholder="e.g., Steel Rods, Cement Bags"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Unit of Measurement *
                </label>
                <select
                  required
                  value={formData.unit}
                  onChange={(e) => setFormData({ ...formData, unit: e.target.value as UnitType })}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 bg-white focus:border-[#0067ac] focus:outline-none focus:ring-2 focus:ring-[#0067ac]"
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
                  Description
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={3}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-500 focus:border-[#0067ac] focus:outline-none focus:ring-2 focus:ring-[#0067ac]"
                  placeholder="Optional description"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Restock Level
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.restock_level}
                  onChange={(e) => setFormData({ ...formData, restock_level: e.target.value })}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-500 focus:border-[#0067ac] focus:outline-none focus:ring-2 focus:ring-[#0067ac]"
                  placeholder="Minimum quantity before restock alert"
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
                  {loading ? (editingProduct ? 'Updating...' : 'Creating...') : (editingProduct ? 'Update Product' : 'Create Product')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showImportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <h3 className="text-xl font-bold mb-4" style={{ color: '#0067ac' }}>
              Import Products from CSV
            </h3>

            {!importResult && (
              <>
                <div className="mb-4">
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-sm font-medium text-gray-700">
                      Select CSV File
                    </label>
                    <button
                      type="button"
                      onClick={downloadSampleCSV}
                      className="text-sm text-[#0067ac] hover:underline"
                    >
                      Download Sample CSV
                    </button>
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv"
                    onChange={handleFileUpload}
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-[#0067ac] focus:outline-none focus:ring-2 focus:ring-[#0067ac]"
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    CSV must have columns: name, category, unit (optional: description, restock_level)
                  </p>
                </div>

                {importError && (
                  <div className="mb-4 rounded-md bg-red-50 p-3 border border-red-200">
                    <div className="text-sm text-red-800">{importError}</div>
                  </div>
                )}

                {csvData.length > 0 && (
                  <div className="mb-4">
                    <h4 className="text-sm font-medium text-gray-700 mb-2">
                      Preview ({csvData.length} rows)
                    </h4>
                    <div className="border border-gray-300 rounded-md overflow-auto max-h-96">
                      <table className="min-w-full divide-y divide-gray-200 text-xs">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-3 py-2 text-left font-medium text-gray-700">Row</th>
                            <th className="px-3 py-2 text-left font-medium text-gray-700">Name</th>
                            <th className="px-3 py-2 text-left font-medium text-gray-700">Category</th>
                            <th className="px-3 py-2 text-left font-medium text-gray-700">Unit</th>
                            <th className="px-3 py-2 text-left font-medium text-gray-700">Description</th>
                            <th className="px-3 py-2 text-left font-medium text-gray-700">Restock Level</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {csvData.map((row, index) => (
                            <tr key={index} className={!row.name || !row.category || !row.unit ? 'bg-yellow-50' : ''}>
                              <td className="px-3 py-2 text-gray-900">{index + 2}</td>
                              <td className="px-3 py-2 text-gray-900">{row.name || <span className="text-red-600">Required</span>}</td>
                              <td className="px-3 py-2 text-gray-900">{row.category || <span className="text-red-600">Required</span>}</td>
                              <td className="px-3 py-2 text-gray-900">{row.unit || <span className="text-red-600">Required</span>}</td>
                              <td className="px-3 py-2 text-gray-500">{row.description || '-'}</td>
                              <td className="px-3 py-2 text-gray-500">{row.restock_level || '0'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setShowImportModal(false)
                      setCsvData([])
                      setImportError(null)
                      setImportResult(null)
                      if (fileInputRef.current) {
                        fileInputRef.current.value = ''
                      }
                    }}
                    className="flex-1 rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleImport}
                    disabled={importLoading || csvData.length === 0}
                    className="flex-1 rounded-md px-4 py-2 text-sm font-semibold text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    style={{ backgroundColor: '#0067ac' }}
                  >
                    {importLoading ? 'Importing...' : 'Import Products'}
                  </button>
                </div>
              </>
            )}

            {importResult && (
              <div>
                <div className="mb-4 rounded-md bg-green-50 p-4 border border-green-200">
                  <h4 className="text-sm font-semibold text-green-800 mb-2">Import Complete!</h4>
                  <div className="text-sm text-green-700 space-y-1">
                    <p>✓ {importResult.created} product(s) created successfully</p>
                    {importResult.skipped > 0 && (
                      <p>⚠ {importResult.skipped} product(s) skipped (duplicates)</p>
                    )}
                    {importResult.errors.length > 0 && (
                      <p>✗ {importResult.errors.length} row(s) had errors</p>
                    )}
                  </div>
                </div>

                {importResult.errors.length > 0 && (
                  <div className="mb-4">
                    <h4 className="text-sm font-medium text-gray-700 mb-2">Errors:</h4>
                    <div className="border border-red-200 rounded-md overflow-auto max-h-48">
                      <table className="min-w-full divide-y divide-gray-200 text-xs">
                        <thead className="bg-red-50">
                          <tr>
                            <th className="px-3 py-2 text-left font-medium text-red-700">Row</th>
                            <th className="px-3 py-2 text-left font-medium text-red-700">Error</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {importResult.errors.map((err, index) => (
                            <tr key={index}>
                              <td className="px-3 py-2 text-gray-900">{err.row}</td>
                              <td className="px-3 py-2 text-red-600">{err.error}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => {
                    setShowImportModal(false)
                    setCsvData([])
                    setImportError(null)
                    setImportResult(null)
                    if (fileInputRef.current) {
                      fileInputRef.current.value = ''
                    }
                    window.location.reload()
                  }}
                  className="w-full rounded-md px-4 py-2 text-sm font-semibold text-white transition-colors"
                  style={{ backgroundColor: '#0067ac' }}
                >
                  Close
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="rounded-lg bg-white shadow-md border overflow-hidden" style={{ borderColor: '#E77817' }}>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Product Name
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Category
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Unit
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Restock Level
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Description
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {filteredProducts.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-4 text-center text-sm text-gray-500">
                  {products.length === 0
                    ? 'No products found. Create your first product.'
                    : 'No products match your search criteria.'}
                </td>
              </tr>
            ) : (
              paginatedProducts.map((product) => (
                <tr key={product.id}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {product.name}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {product.category?.name || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {product.unit}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {product.restock_level || 0}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {product.description || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <button
                      onClick={() => handleEdit(product)}
                      className="text-[#0067ac] hover:text-[#005a94] mr-4"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(product.id)}
                      className="text-red-600 hover:text-red-900"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        </div>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between">
          <div className="text-sm text-gray-700">
            Showing {startIndex + 1} to {Math.min(endIndex, filteredProducts.length)} of {filteredProducts.length} products
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

