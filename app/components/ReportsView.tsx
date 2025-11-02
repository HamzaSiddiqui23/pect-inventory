'use client'

import { useState, useEffect } from 'react'
import { getPurchaseReport, getIssueReport, getInventoryCostReport, type ReportPeriod } from '@/lib/actions/reports'
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
  const [issuedToFilter, setIssuedToFilter] = useState<string>('')
  const [activeTab, setActiveTab] = useState<'purchases' | 'issues' | 'inventory'>('purchases')
  
  const [purchaseData, setPurchaseData] = useState<any>(null)
  const [issueData, setIssueData] = useState<any>(null)
  const [inventoryData, setInventoryData] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isAdmin = userProfile.role === 'admin'

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
        }
      } else if (activeTab === 'issues') {
        const result = await getIssueReport(selectedPeriod, selectedStoreId || undefined, issuedToFilter || undefined)
        if (result.error) {
          setError(getErrorMessage(result.error))
        } else {
          setIssueData(result)
        }
      } else if (activeTab === 'inventory') {
        const result = await getInventoryCostReport(selectedStoreId || undefined)
        if (result.error) {
          setError(getErrorMessage(result.error))
        } else {
          setInventoryData(result)
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
  }, [activeTab, selectedPeriod, selectedStoreId, issuedToFilter])

  // Load when tab, period, or store changes
  const handleTabChange = (tab: 'purchases' | 'issues' | 'inventory') => {
    setActiveTab(tab)
  }

  const handlePeriodChange = (period: ReportPeriod) => {
    setSelectedPeriod(period)
  }

  const handleStoreChange = (storeId: string) => {
    setSelectedStoreId(storeId)
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
    } else if (activeTab === 'issues' && issueData?.data) {
      filename = `issues-report-${selectedPeriod}-${new Date().toISOString().split('T')[0]}.csv`
      
      // CSV Headers
      csv = 'Date,From Store,To Store,Issued To,Product,Category,Quantity,Unit'
      if (isAdmin) {
        csv += ',Unit Cost,Total Cost'
      }
      csv += ',Notes\n'
      
      // CSV Rows
      issueData.data.forEach((issue: any) => {
        const row = [
          issue.issue_date,
          `"${issue.from_store?.name || ''}"`,
          `"${issue.to_store?.name || ''}"`,
          `"${issue.issued_to_name || ''}"`,
          `"${issue.product?.name || ''}"`,
          `"${issue.product?.category?.name || ''}"`,
          issue.quantity,
          issue.product?.unit || ''
        ]
        if (isAdmin) {
          row.push(issue.unit_cost || '')
          row.push(issue.total_cost || '')
        }
        row.push(`"${(issue.notes || '').replace(/"/g, '""')}"`)
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
        <div className={`grid grid-cols-1 gap-4 ${activeTab === 'issues' ? 'md:grid-cols-4' : 'md:grid-cols-3'}`}>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Report Type
            </label>
            <select
              value={activeTab}
              onChange={(e) => handleTabChange(e.target.value as 'purchases' | 'issues' | 'inventory')}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 bg-white focus:border-[#0067ac] focus:outline-none focus:ring-2 focus:ring-[#0067ac]"
            >
              <option value="purchases">Purchases</option>
              <option value="issues">Issuance</option>
              <option value="inventory">Inventory Costs</option>
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

          {activeTab === 'issues' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Issued To (Optional)
              </label>
              <input
                type="text"
                value={issuedToFilter}
                onChange={(e) => setIssuedToFilter(e.target.value)}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-500 focus:border-[#0067ac] focus:outline-none focus:ring-2 focus:ring-[#0067ac]"
                placeholder="Filter by recipient name"
              />
            </div>
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
              (activeTab === 'issues' && issueData?.data?.length) ||
              (activeTab === 'inventory' && inventoryData?.data?.length)
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

      {/* Issues Report */}
      {activeTab === 'issues' && issueData && (
        <div className="bg-white rounded-lg shadow-md border overflow-hidden" style={{ borderColor: '#E77817' }}>
          <div className="px-6 py-4 bg-gray-50 border-b">
            <h3 className="text-lg font-semibold" style={{ color: '#0067ac' }}>
              Issuance Report ({selectedPeriod})
            </h3>
            {issueData.summary && (
              <div className="mt-2 grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <span className="text-gray-600">Total Issues:</span>
                  <span className="ml-2 font-semibold text-gray-900">{issueData.summary.totalIssues}</span>
                </div>
                <div>
                  <span className="text-gray-600">To Stores:</span>
                  <span className="ml-2 font-semibold text-gray-900">{issueData.summary.issuesToStores}</span>
                </div>
                <div>
                  <span className="text-gray-600">To Projects:</span>
                  <span className="ml-2 font-semibold text-gray-900">{issueData.summary.issuesToProjects}</span>
                </div>
                <div>
                  <span className="text-gray-600">Total Quantity:</span>
                  <span className="ml-2 font-semibold text-gray-900">{issueData.summary.totalQuantity.toLocaleString()}</span>
                </div>
                {isAdmin && (
                  <div>
                    <span className="text-gray-600">Total Cost:</span>
                    <span className="ml-2 font-semibold text-gray-900">{formatCurrency(issueData.summary.totalCost)}</span>
                  </div>
                )}
              </div>
            )}
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">From Store</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">To Store</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Issued To</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Product</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Quantity</th>
                  {isAdmin && (
                    <>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Unit Cost</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total Cost</th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {(!issueData.data || issueData.data.length === 0) ? (
                  <tr>
                    <td colSpan={isAdmin ? 8 : 6} className="px-6 py-4 text-center text-sm text-gray-500">
                      No issues found for the selected period.
                    </td>
                  </tr>
                ) : (
                  issueData.data.map((issue: any) => (
                    <tr key={issue.id}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatDate(issue.issue_date)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {issue.from_store?.name || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {issue.to_store?.name || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {issue.issued_to_name || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {issue.product?.name || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {issue.quantity} {issue.product?.unit || ''}
                      </td>
                      {isAdmin && (
                        <>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {issue.unit_cost ? formatCurrency(issue.unit_cost) : '-'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {issue.total_cost ? formatCurrency(issue.total_cost) : '-'}
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

