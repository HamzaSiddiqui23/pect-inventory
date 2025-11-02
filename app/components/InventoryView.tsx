'use client'

import { useState } from 'react'
import type { InventoryItem, Store } from '@/lib/types'

export default function InventoryView({ 
  initialInventory, 
  stores, 
  isAdmin,
  currentStoreId 
}: { 
  initialInventory: InventoryItem[]
  stores: Store[]
  isAdmin: boolean
  currentStoreId?: string
}) {
  const [selectedStoreId, setSelectedStoreId] = useState<string | undefined>(currentStoreId)

  // Filter inventory by selected store (client-side)
  const filteredInventory = selectedStoreId 
    ? initialInventory.filter(item => item.store_id === selectedStoreId)
    : initialInventory

  return (
    <div>
      {isAdmin && stores.length > 0 && (
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Select Store
          </label>
          <select
            value={selectedStoreId || ''}
            onChange={(e) => setSelectedStoreId(e.target.value || undefined)}
            className="w-full max-w-md rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 bg-white focus:border-[#0067ac] focus:outline-none focus:ring-2 focus:ring-[#0067ac]"
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
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredInventory.length === 0 ? (
                <tr>
                  <td colSpan={isAdmin ? 6 : 4} className="px-6 py-4 text-center text-sm text-gray-500">
                    No inventory found {selectedStoreId ? 'for this store' : ''}.
                  </td>
                </tr>
              ) : (
                filteredInventory.map((item) => (
                  <tr key={item.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {item.product?.name || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {item.product?.category?.name || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {item.store?.name || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {item.quantity} {item.product?.unit || ''}
                    </td>
                    {isAdmin && (
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        PKR {item.average_cost?.toFixed(2) || '0.00'}
                      </td>
                    )}
                    {isAdmin && (
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        PKR {((item.average_cost || 0) * item.quantity).toFixed(2)}
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
    </div>
  )
}

