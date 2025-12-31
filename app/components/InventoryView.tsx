'use client'

import { Fragment, useState } from 'react'
import type { InventoryItem, InventoryMovementEntry, Store } from '@/lib/types'
import InventoryHistoryView from '@/app/components/InventoryHistoryView'

export default function InventoryView({ 
  initialInventory, 
  stores, 
  isAdmin,
  currentStoreId,
  canViewAllStores = false,
  historyMap = {},
}: { 
  initialInventory: InventoryItem[]
  stores: Store[]
  isAdmin: boolean
  currentStoreId?: string
  canViewAllStores?: boolean
  historyMap?: Record<string, InventoryMovementEntry[]>
}) {
  const [selectedStoreId, setSelectedStoreId] = useState<string | undefined>(currentStoreId)
  const [searchName, setSearchName] = useState<string>('')
  const [searchCategory, setSearchCategory] = useState<string>('')
  const [expandedItemId, setExpandedItemId] = useState<string | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(50)

  // Get unique categories from inventory
  const categories = Array.from(
    new Set(
      initialInventory
        .map(item => item.product?.category?.name)
        .filter((name): name is string => !!name)
    )
  ).sort()

  // Filter inventory by selected store, product name, and category (client-side)
  const filteredInventory = initialInventory.filter(item => {
    // Store filter
    if (selectedStoreId && item.store_id !== selectedStoreId) {
      return false
    }
    
    // Product name filter
    if (searchName && !item.product?.name?.toLowerCase().includes(searchName.toLowerCase())) {
      return false
    }
    
    // Category filter
    if (searchCategory && item.product?.category?.name !== searchCategory) {
      return false
    }
    
    return true
  })

  // Pagination calculations
  const totalPages = Math.ceil(filteredInventory.length / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const endIndex = startIndex + itemsPerPage
  const paginatedInventory = filteredInventory.slice(startIndex, endIndex)

  // Reset to page 1 when filters change
  const handleFilterChange = () => {
    setCurrentPage(1)
  }

  const handleItemsPerPageChange = (value: number) => {
    setItemsPerPage(value)
    setCurrentPage(1)
  }

  return (
    <div>
      {/* Search and Filter Section */}
      <div className="mb-6 bg-white rounded-lg shadow-md border p-4" style={{ borderColor: '#E77817' }}>
        <div className={`grid grid-cols-1 gap-4 ${(isAdmin || canViewAllStores) && stores.length > 0 ? 'md:grid-cols-3' : 'md:grid-cols-2'}`}>
          {(isAdmin || canViewAllStores) && stores.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Filter by Store
              </label>
              <select
                value={selectedStoreId || ''}
                onChange={(e) => {
                  setSelectedStoreId(e.target.value || undefined)
                  handleFilterChange()
                }}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 bg-white focus:border-[#0067ac] focus:outline-none focus:ring-2 focus:ring-[#0067ac]"
              >
                <option value="">All Stores</option>
                {stores.map((store) => (
                  <option key={store.id} value={store.id}>
                    {store.name} ({store.type === 'central' ? 'Central' : 'Project'})
                  </option>
                ))}
              </select>
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Search by Product Name
            </label>
            <input
              type="text"
              value={searchName}
              onChange={(e) => {
                setSearchName(e.target.value)
                handleFilterChange()
              }}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-500 focus:border-[#0067ac] focus:outline-none focus:ring-2 focus:ring-[#0067ac]"
              placeholder="Enter product name..."
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Filter by Category
            </label>
            <select
              value={searchCategory}
              onChange={(e) => {
                setSearchCategory(e.target.value)
                handleFilterChange()
              }}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 bg-white focus:border-[#0067ac] focus:outline-none focus:ring-2 focus:ring-[#0067ac]"
            >
              <option value="">All Categories</option>
              {categories.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="mt-3 flex items-center justify-between">
          {(searchName || searchCategory || selectedStoreId) && (
            <button
              onClick={() => {
                setSearchName('')
                setSearchCategory('')
                setSelectedStoreId(undefined)
                handleFilterChange()
              }}
              className="text-sm text-gray-600 hover:text-gray-900 underline"
            >
              Clear Filters
            </button>
          )}
          <div className="flex items-center gap-2 ml-auto">
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

      <div className="rounded-lg bg-white shadow-md border overflow-hidden" style={{ borderColor: '#E77817' }}>
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Product
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Category
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Store
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Quantity
                </th>
                {isAdmin && (
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Average Cost
                  </th>
                )}
                {isAdmin && (
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Total Value
                  </th>
                )}
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  History
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredInventory.length === 0 ? (
                <tr>
                  <td colSpan={isAdmin ? 7 : 5} className="px-6 py-4 text-center text-sm text-gray-500">
                    No inventory found {selectedStoreId ? 'for this store' : ''}.
                  </td>
                </tr>
              ) : (
                paginatedInventory.map((item) => {
                  const needsRestock = item.product?.restock_level !== undefined && 
                                       item.product.restock_level > 0 && 
                                       item.quantity <= item.product.restock_level
                  return (
                  <Fragment key={item.id}>
                    <tr 
                      className={needsRestock ? 'bg-red-50 border-l-4' : ''}
                      style={needsRestock ? { borderLeftColor: '#dc2626' } : {}}
                    >
                      <td className={`px-6 py-4 whitespace-nowrap text-sm font-medium ${needsRestock ? 'text-red-800' : 'text-gray-900'}`}>
                        {item.product?.name || '-'}
                      </td>
                      <td className={`px-6 py-4 whitespace-nowrap text-sm ${needsRestock ? 'text-red-700' : 'text-gray-500'}`}>
                        {item.product?.category?.name || '-'}
                      </td>
                      <td className={`px-6 py-4 whitespace-nowrap text-sm ${needsRestock ? 'text-red-700' : 'text-gray-500'}`}>
                        {item.store?.name || '-'}
                      </td>
                      <td className={`px-6 py-4 whitespace-nowrap text-sm font-semibold ${needsRestock ? 'text-red-800' : 'text-gray-900'}`}>
                        {item.quantity} {item.product?.unit || ''}
                        {needsRestock && (
                          <span className="ml-2 text-xs font-bold text-red-600">(Low Stock)</span>
                        )}
                      </td>
                      {isAdmin && (
                        <td className={`px-6 py-4 whitespace-nowrap text-sm ${needsRestock ? 'text-red-700' : 'text-gray-900'}`}>
                          PKR {item.average_cost?.toFixed(2) || '0.00'}
                        </td>
                      )}
                      {isAdmin && (
                        <td className={`px-6 py-4 whitespace-nowrap text-sm font-medium ${needsRestock ? 'text-red-800' : 'text-gray-900'}`}>
                          PKR {((item.average_cost || 0) * item.quantity).toFixed(2)}
                        </td>
                      )}
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <button
                          type="button"
                          onClick={() =>
                            setExpandedItemId((prev) => (prev === item.id ? null : item.id))
                          }
                          className="inline-flex items-center rounded-md border border-[#0067ac] px-3 py-1 text-sm font-medium text-[#0067ac] hover:bg-[#0067ac] hover:text-white transition-colors"
                        >
                          {expandedItemId === item.id ? 'Hide History' : 'View History'}
                        </button>
                      </td>
                    </tr>
                    {expandedItemId === item.id && (
                      <tr>
                        <td colSpan={isAdmin ? 7 : 5} className="px-6 py-4 bg-gray-50">
                          {historyMap[item.id]?.length ? (
                            <InventoryHistoryView
                              item={item}
                              movements={historyMap[item.id]}
                              hideMeta
                            />
                          ) : (
                            <div className="text-sm text-gray-500">
                              No movement history available for this item.
                            </div>
                          )}
                        </td>
                      </tr>
                    )}
                  </Fragment>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between">
          <div className="text-sm text-gray-700">
            Showing {startIndex + 1} to {Math.min(endIndex, filteredInventory.length)} of {filteredInventory.length} items
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

