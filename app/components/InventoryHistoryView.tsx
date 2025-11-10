'use client'

import { useMemo } from 'react'
import type { InventoryItem, InventoryMovementEntry } from '@/lib/types'

interface InventoryHistoryViewProps {
  item: InventoryItem
  movements: InventoryMovementEntry[]
  hideMeta?: boolean
}

function formatDate(date: string) {
  try {
    return new Date(date).toLocaleDateString('en-PK', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  } catch {
    return date
  }
}

function formatReference(entry: InventoryMovementEntry) {
  switch (entry.movement_type) {
    case 'purchase':
      return 'Purchase'
    case 'issue_in':
      return 'Received (Issue)'
    case 'issue_out':
      return 'Issued'
    default:
      return entry.movement_type
  }
}

export default function InventoryHistoryView({ item, movements, hideMeta = false }: InventoryHistoryViewProps) {
  const totals = useMemo(() => {
    return movements.reduce(
      (acc, movement) => {
        if (movement.movement_type === 'purchase' || movement.movement_type === 'issue_in') {
          acc.received += Number(movement.quantity)
        } else if (movement.movement_type === 'issue_out') {
          acc.issued += Number(movement.quantity)
        }
        return acc
      },
      { received: 0, issued: 0 }
    )
  }, [movements])

  const enhancedMovements = useMemo(() => {
    let runningBalance = 0
    return movements.map((movement) => {
      const isIncoming = movement.movement_type === 'purchase' || movement.movement_type === 'issue_in'
      const received = isIncoming ? Number(movement.quantity) : 0
      const issued = movement.movement_type === 'issue_out' ? Number(movement.quantity) : 0
      runningBalance += received - issued
      return {
        ...movement,
        received,
        issued,
        runningBalance,
      }
    })
  }, [movements])

  const currentBalance = Number(item.quantity ?? 0)
  const productName = item.product?.name || 'Unknown Product'
  const storeName = item.store?.name || 'Unknown Store'
  const categoryName = item.product?.category?.name

  return (
    <div className="space-y-8">
      {!hideMeta && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="rounded-lg border bg-white p-4 shadow-sm">
              <p className="text-sm text-gray-500">Total Received</p>
              <p className="mt-2 text-2xl font-semibold text-[#0067ac]">
                {totals.received.toLocaleString()} {item.product?.unit || ''}
              </p>
            </div>
            <div className="rounded-lg border bg-white p-4 shadow-sm">
              <p className="text-sm text-gray-500">Total Issued</p>
              <p className="mt-2 text-2xl font-semibold text-[#E77817]">
                {totals.issued.toLocaleString()} {item.product?.unit || ''}
              </p>
            </div>
            <div className="rounded-lg border bg-white p-4 shadow-sm">
              <p className="text-sm text-gray-500">Current Balance</p>
              <p className="mt-2 text-2xl font-semibold text-gray-900">
                {currentBalance.toLocaleString()} {item.product?.unit || ''}
              </p>
            </div>
          </div>

          <div className="rounded-lg border bg-white p-6 shadow-sm space-y-4">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">{productName}</h3>
              {categoryName && <p className="text-sm text-gray-500">Category: {categoryName}</p>}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-gray-600">
              <div>
                <span className="font-medium text-gray-900">Store:</span> {storeName}
              </div>
              <div>
                <span className="font-medium text-gray-900">Unit:</span> {item.product?.unit || '-'}
              </div>
              <div>
                <span className="font-medium text-gray-900">Restock Level:</span>{' '}
                {item.product?.restock_level != null ? item.product.restock_level : '-'}
              </div>
            </div>
          </div>
        </>
      )}
      <div className="rounded-lg border bg-white shadow-sm overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Date
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Reference
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Source
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Destination
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Received
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Issued
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Balance
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Notes
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {enhancedMovements.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-6 py-4 text-center text-sm text-gray-500">
                  No movement history found for this product.
                </td>
              </tr>
            ) : (
              enhancedMovements.map((movement) => (
                <tr key={movement.id}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                    {formatDate(movement.date)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {formatReference(movement)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                    {movement.source_store?.name || (movement.movement_type === 'purchase' ? 'Supplier' : '-')}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                    {movement.destination_store?.name ||
                      (movement.movement_type === 'issue_out' ? movement.issued_to_name || '-' : storeName)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-green-600 font-semibold">
                    {movement.received > 0 ? `${movement.received.toLocaleString()} ${item.product?.unit || ''}` : ''}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-red-600 font-semibold">
                    {movement.issued > 0 ? `${movement.issued.toLocaleString()} ${item.product?.unit || ''}` : ''}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900 font-semibold">
                    {movement.runningBalance.toLocaleString()} {item.product?.unit || ''}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {movement.notes || (movement.movement_type === 'issue_out' ? movement.issued_to_name || '-' : '')}
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


