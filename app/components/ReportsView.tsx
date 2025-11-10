'use client'

import { useState, useEffect, useMemo } from 'react'
import {
  getPurchaseReport,
  getInventoryCostReport,
  getInventoryMovementReport,
  type ReportPeriod,
} from '@/lib/actions/reports'
import InventoryHistoryView from '@/app/components/InventoryHistoryView'
import type { InventoryItem } from '@/lib/types'
import { getErrorMessage } from '@/lib/utils/errors'
import type { Store, UserProfile } from '@/lib/types'

export default function ReportsView({ 
  initialStores,
  userProfile
}: { 
  initialStores: Store[]
  userProfile: UserProfile
}) {
  const [selectedPeriod, setSelectedPeriod] = useState<ReportPeriod>('monthly')
  const [selectedStoreId, setSelectedStoreId] = useState<string>('')
  const [activeTab, setActiveTab] = useState<'purchases' | 'inventory' | 'transfers'>('purchases')
  const [selectedCentralStoreId, setSelectedCentralStoreId] = useState<string>(() => {
    const firstCentral = initialStores.find((store) => store.type === 'central')
    return firstCentral?.id ?? ''
  })
  const [selectedProjectStoreId, setSelectedProjectStoreId] = useState<string>(() => {
    const firstProject = initialStores.find((store) => store.type === 'project')
    return firstProject?.id ?? ''
  })
  const [expandedProducts, setExpandedProducts] = useState<Record<string, boolean>>({})

  const [purchaseData, setPurchaseData] = useState<any>(null)
  const [inventoryData, setInventoryData] = useState<any>(null)
  const [movementData, setMovementData] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isAdmin = userProfile.role === 'admin'

  const centralStores = useMemo(
    () => initialStores.filter((store) => store.type === 'central'),
    [initialStores]
  )
  const projectStores = useMemo(
    () => initialStores.filter((store) => store.type === 'project'),
    [initialStores]
  )

  const loadReports = async () => {
    setLoading(true)
    setError(null)

    try {
      if (activeTab === 'purchases') {
        const result = await getPurchaseReport(selectedPeriod, selectedStoreId || undefined)
        if (result.error) {
          setError(getErrorMessage(result.error))
        } else {
          setPurchaseData(result)
          setInventoryData(null)
          setMovementData(null)
        }
      } else if (activeTab === 'inventory') {
        const result = await getInventoryCostReport(selectedStoreId || undefined)
        if (result.error) {
          setError(getErrorMessage(result.error))
        } else {
          setInventoryData(result)
          setPurchaseData(null)
          setMovementData(null)
        }
      } else if (activeTab === 'transfers') {
        const result = await getInventoryMovementReport(
          selectedPeriod,
          selectedCentralStoreId || undefined,
          selectedProjectStoreId || undefined
        )
        if (result.error) {
          setError(getErrorMessage(result.error))
        } else {
          setMovementData(result)
          setPurchaseData(null)
          setInventoryData(null)
        }
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load report')
    } finally {
      setLoading(false)
    }
  }

  // Load reports on mount and when filters change
  useEffect(() => {
    loadReports()
  }, [activeTab, selectedPeriod, selectedStoreId, selectedCentralStoreId, selectedProjectStoreId])

  // Load when tab, period, or store changes
  const handleTabChange = (tab: 'purchases' | 'inventory' | 'transfers') => {
    setExpandedProducts({})
    setActiveTab(tab)
  }

  const handlePeriodChange = (period: ReportPeriod) => {
    setSelectedPeriod(period)
  }

  const handleStoreChange = (storeId: string) => {
    setSelectedStoreId(storeId)
  }

  const movementTotals = useMemo(() => {
    if (!movementData?.data?.length) {
      return { products: 0, receivedEntries: 0, issuedEntries: 0, totalMovements: 0 }
    }

    return movementData.data.reduce(
      (
        acc: { products: number; receivedEntries: number; issuedEntries: number; totalMovements: number },
        item: any
      ) => {
        acc.products += 1
        const movements = item.movements || []
        movements.forEach((movement: any) => {
          if (movement.movement_type === 'purchase' || movement.movement_type === 'issue_in') {
            acc.receivedEntries += 1
          } else if (movement.movement_type === 'issue_out') {
            acc.issuedEntries += 1
          }
        })
        acc.totalMovements += movements.length
        return acc
      },
      { products: 0, receivedEntries: 0, issuedEntries: 0, totalMovements: 0 }
    )
  }, [movementData])

  const handleToggleProduct = (productId: string) => {
    setExpandedProducts((prev) => ({
      ...prev,
      [productId]: !prev[productId],
    }))
  }

  const formatCurrency = (amount: number) => {
    return `PKR ${amount.toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-PK')
  }

  const exportToCSV = () => {
    let csv = ''
    let filename = ''

    if (activeTab === 'purchases' && purchaseData?.data) {
      filename = `purchases-report-${selectedPeriod}-${new Date().toISOString().split('T')[0]}.csv`
      
      // CSV Headers
      csv = 'Date,Store,Product,Category,Quantity,Unit,Unit Cost,Total Cost,Notes\n'
      
      // CSV Rows
      purchaseData.data.forEach((purchase: any) => {
        const row = [
          purchase.purchase_date,
          `"${purchase.store?.name || ''}"`,
          `"${purchase.product?.name || ''}"`,
          `"${purchase.product?.category?.name || ''}"`,
          purchase.quantity,
          purchase.product?.unit || '',
          isAdmin ? purchase.unit_cost : '',
          isAdmin ? purchase.total_cost : '',
          `"${(purchase.notes || '').replace(/"/g, '""')}"`
        ]
        csv += row.join(',') + '\n'
      })
    } else if (activeTab === 'inventory' && inventoryData?.data) {
      filename = `inventory-cost-report-${new Date().toISOString().split('T')[0]}.csv`
      
      // CSV Headers
      csv = 'Store,Product,Category,Quantity,Unit'
      if (isAdmin) {
        csv += ',Average Cost,Total Value'
      }
      csv += '\n'
      
      // CSV Rows
      inventoryData.data.forEach((item: any) => {
        const row = [
          `"${item.store?.name || ''}"`,
          `"${item.product?.name || ''}"`,
          `"${item.product?.category?.name || ''}"`,
          item.quantity,
          item.product?.unit || ''
        ]
        if (isAdmin) {
          row.push(item.average_cost || 0)
          row.push(item.total_value || 0)
        }
        csv += row.join(',') + '\n'
      })
    } else if (activeTab === 'transfers' && movementData?.data) {
      filename = `inventory-history-report-${selectedPeriod}-${new Date().toISOString().split('T')[0]}.csv`
      csv = 'Product,Unit,Received Quantity,Issued Quantity,Balance Quantity\n'

      movementData.data.forEach((item: any) => {
        const row = [
          `"${item.product?.name || ''}"`,
          item.product?.unit || '',
          item.received_quantity,
          item.issued_quantity,
          item.balance_quantity,
        ]
        csv += row.join(',') + '\n'
      })
    } else {
      alert('No data available to export')
      return
    }

    // Create and download the file
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    const url = URL.createObjectURL(blob)
    link.setAttribute('href', url)
    link.setAttribute('download', filename)
    link.style.visibility = 'hidden'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="bg-white rounded-lg shadow-md border p-4" style={{ borderColor: '#E77817' }}>
        <div className={`grid grid-cols-1 gap-4 ${activeTab === 'transfers' ? 'md:grid-cols-4' : 'md:grid-cols-3'}`}>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Report Type
            </label>
            <select
              value={activeTab}
              onChange={(e) => handleTabChange(e.target.value as 'purchases' | 'inventory' | 'transfers')}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 bg-white focus:border-[#0067ac] focus:outline-none focus:ring-2 focus:ring-[#0067ac]"
            >
              <option value="purchases">Purchases</option>
              <option value="inventory">Inventory Costs</option>
              <option value="transfers">Inventory History</option>
            </select>
          </div>

          {activeTab !== 'inventory' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Time Period
              </label>
              <select
                value={selectedPeriod}
                onChange={(e) => handlePeriodChange(e.target.value as ReportPeriod)}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 bg-white focus:border-[#0067ac] focus:outline-none focus:ring-2 focus:ring-[#0067ac]"
              >
                <option value="today">Today</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
                <option value="quarterly">Quarterly</option>
                <option value="annual">Annual</option>
                <option value="lifetime">Lifetime</option>
              </select>
            </div>
          )}

          {activeTab !== 'transfers' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Store {isAdmin && '(Optional)'}
              </label>
              <select
                value={selectedStoreId}
                onChange={(e) => handleStoreChange(e.target.value)}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 bg-white focus:border-[#0067ac] focus:outline-none focus:ring-2 focus:ring-[#0067ac]"
              >
                <option value="">All Stores</option>
                {initialStores.map((store) => (
                  <option key={store.id} value={store.id}>
                    {store.name} ({store.type === 'central' ? 'Central' : 'Project'})
                  </option>
                ))}
              </select>
            </div>
          )}

          {activeTab === 'transfers' && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Central Store
                </label>
                <select
                  value={selectedCentralStoreId}
                  onChange={(e) => setSelectedCentralStoreId(e.target.value)}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 bg-white focus:border-[#0067ac] focus:outline-none focus:ring-2 focus:ring-[#0067ac]"
                >
                  <option value="">All Central Stores</option>
                  {centralStores.length === 0 && <option value="">No central stores available</option>}
                  {centralStores.map((store) => (
                    <option key={store.id} value={store.id}>
                      {store.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Project Store
                </label>
                <select
                  value={selectedProjectStoreId}
                  onChange={(e) => setSelectedProjectStoreId(e.target.value)}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 bg-white focus:border-[#0067ac] focus:outline-none focus:ring-2 focus:ring-[#0067ac]"
                >
                  <option value="">All Project Stores</option>
                  {projectStores.length === 0 && <option value="">No project stores available</option>}
                  {projectStores.map((store) => (
                    <option key={store.id} value={store.id}>
                      {store.name} {store.project ? `- ${store.project.name}` : ''}
                    </option>
                  ))}
                </select>
              </div>
            </>
          )}

        </div>

        <div className="mt-4 flex gap-3">
          <button
            onClick={loadReports}
            disabled={loading}
            className="rounded-md px-4 py-2 text-sm font-semibold text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            style={{ backgroundColor: '#0067ac' }}
          >
            {loading ? 'Loading...' : 'Refresh Report'}
          </button>
          <button
            onClick={exportToCSV}
            disabled={loading || !(
              (activeTab === 'purchases' && purchaseData?.data?.length) ||
              (activeTab === 'inventory' && inventoryData?.data?.length) ||
              (activeTab === 'transfers' && movementData?.data?.length)
            )}
            className="rounded-md px-4 py-2 text-sm font-semibold text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            style={{ backgroundColor: '#E77817' }}
            onMouseEnter={(e) => {
              if (!e.currentTarget.disabled) {
                e.currentTarget.style.backgroundColor = '#d66a14'
              }
            }}
            onMouseLeave={(e) => {
              if (!e.currentTarget.disabled) {
                e.currentTarget.style.backgroundColor = '#E77817'
              }
            }}
          >
            Export CSV
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-md bg-red-50 p-4 border border-red-200">
          <div className="text-sm text-red-800">
            <strong>Error:</strong> {error}
          </div>
        </div>
      )}

  {/* Movements Report */}
  {activeTab === 'transfers' && (
    <div className="bg-white rounded-lg shadow-md border overflow-hidden" style={{ borderColor: '#E77817' }}>
      <div className="px-6 py-4 bg-gray-50 border-b space-y-2">
        <h3 className="text-lg font-semibold" style={{ color: '#0067ac' }}>
          Inventory History Report ({selectedPeriod})
        </h3>
        <div className="text-sm text-gray-600">
          <p>
            <span className="font-medium text-gray-900">Central Store:</span>{' '}
            {movementData?.centralStore?.name || 'All Central Stores'}
          </p>
          <p>
            <span className="font-medium text-gray-900">Project Store:</span>{' '}
            {movementData?.projectStore?.name || 'All Project Stores'}
            {movementData?.projectStore?.project ? ` (${movementData.projectStore.project.name})` : ''}
          </p>
        </div>
      </div>

      <div className="px-6 py-4 space-y-6">
        {!movementData?.data?.length ? (
          <div className="rounded-md bg-yellow-50 border border-yellow-200 p-4 text-sm text-yellow-800">
            No transfer history found for the selected stores.
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="rounded-lg border bg-white p-4 shadow-sm">
                <p className="text-sm text-gray-500">Products Tracked</p>
                <p className="mt-2 text-2xl font-semibold text-[#0067ac]">
                  {movementTotals.products}
                </p>
              </div>
              <div className="rounded-lg border bg-white p-4 shadow-sm">
                <p className="text-sm text-gray-500">Received Entries</p>
                <p className="mt-2 text-2xl font-semibold text-[#0067ac]">
                  {movementTotals.receivedEntries}
                </p>
                <p className="mt-1 text-xs text-gray-500">Purchases + transfers from central store</p>
              </div>
              <div className="rounded-lg border bg-white p-4 shadow-sm">
                <p className="text-sm text-gray-500">Issued Entries</p>
                <p className="mt-2 text-2xl font-semibold text-[#E77817]">
                  {movementTotals.issuedEntries}
                </p>
                <p className="mt-1 text-xs text-gray-500">Transfers out or on-site usage</p>
              </div>
            </div>

            <p className="text-xs text-gray-500">
              Quantities are shown per-product below; totals above represent number of recorded movements (overall entries: {movementTotals.totalMovements}).
            </p>

            <div className="space-y-6">
              {movementData.data.map((item: any) => {
                const productId = item.product?.id || item.product_id
                const isExpanded = expandedProducts[productId]
                const unitLabel = item.product?.unit || ''
                const aggregateStore =
                  movementData?.projectStore ??
                  (selectedProjectStoreId
                    ? undefined
                    : {
                        id: 'all-project-stores',
                        name: 'All Project Stores',
                        type: 'project' as Store['type'],
                        project_id: null,
                        created_at: '1970-01-01T00:00:00Z',
                        updated_at: '1970-01-01T00:00:00Z',
                      })
                const historyItem: InventoryItem = {
                  id: `${movementData?.projectStore?.id || selectedProjectStoreId || 'all-project-stores'}-${productId}`,
                  store_id: movementData?.projectStore?.id || selectedProjectStoreId || 'all-project-stores',
                  product_id: productId,
                  quantity: Number(item.balance_quantity) || 0,
                  updated_at: item.updated_at || new Date().toISOString(),
                  store: aggregateStore,
                  product: item.product,
                }
                const movements = item.movements || []

                return (
                  <div key={productId} className="rounded-lg border bg-white shadow-sm">
                    <div className="flex items-center justify-between px-6 py-4 border-b bg-gray-50">
                      <div>
                        <h4 className="text-md font-semibold text-gray-900">
                          {item.product?.name || 'Unnamed Product'}
                        </h4>
                        {item.product?.category?.name && (
                          <p className="text-sm text-gray-500">
                            Category: {item.product.category.name}
                          </p>
                        )}
                      </div>
                      <button
                        onClick={() => handleToggleProduct(productId)}
                        className="inline-flex items-center rounded-md border border-[#0067ac] px-3 py-1 text-sm font-medium text-[#0067ac] hover:bg-[#0067ac] hover:text-white transition-colors"
                      >
                        {isExpanded ? 'Hide History' : 'View History'}
                      </button>
                    </div>

                    <div className="px-6 py-4 grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-gray-700">
                      <div>
                        <span className="text-gray-500">Received:</span>{' '}
                        <span className="font-semibold text-[#0067ac]">
                          {Number(item.received_quantity).toLocaleString()} {unitLabel}
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-500">Issued:</span>{' '}
                        <span className="font-semibold text-[#E77817]">
                          {Number(item.issued_quantity).toLocaleString()} {unitLabel}
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-500">Current Balance:</span>{' '}
                        <span className="font-semibold text-gray-900">
                          {Number(item.balance_quantity).toLocaleString()} {unitLabel}
                        </span>
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="px-6 pb-6">
                        <InventoryHistoryView item={historyItem} movements={movements} />
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </>
        )}
      </div>
    </div>
  )}
      {/* Purchases Report */}
      {activeTab === 'purchases' && purchaseData && (
        <div className="bg-white rounded-lg shadow-md border overflow-hidden" style={{ borderColor: '#E77817' }}>
          <div className="px-6 py-4 bg-gray-50 border-b">
            <h3 className="text-lg font-semibold" style={{ color: '#0067ac' }}>
              Purchases Report ({selectedPeriod})
            </h3>
            {purchaseData.summary && (
              <div className="mt-2 grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <span className="text-gray-600">Total Purchases:</span>
                  <span className="ml-2 font-semibold text-gray-900">{purchaseData.summary.totalPurchases}</span>
                </div>
                <div>
                  <span className="text-gray-600">Total Quantity:</span>
                  <span className="ml-2 font-semibold text-gray-900">{purchaseData.summary.totalQuantity.toLocaleString()}</span>
                </div>
                <div>
                  <span className="text-gray-600">Total Cost:</span>
                  <span className="ml-2 font-semibold text-gray-900">{formatCurrency(purchaseData.summary.totalCost)}</span>
                </div>
                <div>
                  <span className="text-gray-600">Avg Unit Cost:</span>
                  <span className="ml-2 font-semibold text-gray-900">{formatCurrency(purchaseData.summary.averageUnitCost)}</span>
                </div>
              </div>
            )}
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Store</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Product</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Quantity</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Unit Cost</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total Cost</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {(!purchaseData.data || purchaseData.data.length === 0) ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-4 text-center text-sm text-gray-500">
                      No purchases found for the selected period.
                    </td>
                  </tr>
                ) : (
                  purchaseData.data.map((purchase: any) => (
                    <tr key={purchase.id}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatDate(purchase.purchase_date)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {purchase.store?.name || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {purchase.product?.name || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {purchase.quantity} {purchase.product?.unit || ''}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {isAdmin ? formatCurrency(purchase.unit_cost) : '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {isAdmin ? formatCurrency(purchase.total_cost) : '-'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Inventory Cost Report */}
      {activeTab === 'inventory' && inventoryData && (
        <div className="space-y-4">
          <div className="bg-white rounded-lg shadow-md border overflow-hidden" style={{ borderColor: '#E77817' }}>
            <div className="px-6 py-4 bg-gray-50 border-b">
              <h3 className="text-lg font-semibold" style={{ color: '#0067ac' }}>
                Current Inventory Value
              </h3>
              {inventoryData.summary && (
                <div className="mt-2 grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                  <div>
                    <span className="text-gray-600">Total Items:</span>
                    <span className="ml-2 font-semibold text-gray-900">{inventoryData.summary.totalItems}</span>
                  </div>
                  <div>
                    <span className="text-gray-600">Total Quantity:</span>
                    <span className="ml-2 font-semibold text-gray-900">{inventoryData.summary.totalQuantity.toLocaleString()}</span>
                  </div>
                  {isAdmin && (
                    <div>
                      <span className="text-gray-600">Total Value:</span>
                      <span className="ml-2 font-semibold text-gray-900">{formatCurrency(inventoryData.summary.totalValue)}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Store</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Product</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Category</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Quantity</th>
                    {isAdmin && (
                      <>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Avg Cost</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total Value</th>
                      </>
                    )}
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {(!inventoryData.data || inventoryData.data.length === 0) ? (
                    <tr>
                      <td colSpan={isAdmin ? 6 : 4} className="px-6 py-4 text-center text-sm text-gray-500">
                        No inventory items found.
                      </td>
                    </tr>
                  ) : (
                    inventoryData.data.map((item: any) => (
                      <tr key={item.id}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {item.store?.name || '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {item.product?.name || '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {item.product?.category?.name || '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {item.quantity} {item.product?.unit || ''}
                        </td>
                        {isAdmin && (
                          <>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              {formatCurrency(item.average_cost || 0)}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              {formatCurrency(item.total_value || 0)}
                            </td>
                          </>
                        )}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Store Summary */}
          {isAdmin && inventoryData.summary && Object.keys(inventoryData.summary.byStore).length > 0 && (
            <div className="bg-white rounded-lg shadow-md border overflow-hidden" style={{ borderColor: '#E77817' }}>
              <div className="px-6 py-4 bg-gray-50 border-b">
                <h3 className="text-lg font-semibold" style={{ color: '#0067ac' }}>
                  Summary by Store
                </h3>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Store</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total Quantity</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total Value</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {Object.entries(inventoryData.summary.byStore).map(([storeName, data]: [string, any]) => (
                      <tr key={storeName}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {storeName}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {data.quantity.toLocaleString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {formatCurrency(data.value)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

