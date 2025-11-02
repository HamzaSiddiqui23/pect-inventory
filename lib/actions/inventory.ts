'use server'

import { createClient } from '@/lib/supabase/server'
import type { InventoryItem } from '@/lib/types'
import { getErrorMessage } from '@/lib/utils/errors'

export async function getInventory(storeId?: string, productId?: string) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { data: null, error: 'Not authenticated' }
  }

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('role, project_id')
    .eq('id', user.id)
    .single()

  const isAdmin = profile?.role === 'admin'

  let query = supabase
    .from('inventory_items')
    .select(`
      *,
      store:stores(*),
      product:products(
        *,
        category:categories(*)
      )
    `)
    .order('store_id', { ascending: true })
    .order('product_id', { ascending: true })

  // Filter by store if provided
  if (storeId) {
    query = query.eq('store_id', storeId)
  } else if (!isAdmin && profile?.role === 'project_store_manager' && profile.project_id) {
    // Project store managers can only see their store
    query = query.eq('store.project_id', profile.project_id)
  }
  // If admin and no storeId, show all stores

  // Filter by product if provided
  if (productId) {
    query = query.eq('product_id', productId)
  }

  const { data, error } = await query

  if (error || !data) {
    return { data: null, error: error?.message || 'Failed to fetch inventory' }
  }

  // Calculate average cost for each item (only for admins or if showing all stores)
  const inventoryWithCosts = await Promise.all(
    data.map(async (item) => {
      let avgCost = 0
      if (isAdmin) {
        const { data: avgCostData } = await supabase.rpc('get_average_cost', {
          p_store_id: item.store_id,
          p_product_id: item.product_id,
        })
        avgCost = avgCostData || 0
      }

      return {
        ...item,
        average_cost: avgCost,
      } as InventoryItem
    })
  )

  return { data: inventoryWithCosts, error: null }
}

export async function getInventoryItem(storeId: string, productId: string) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { data: null, error: 'Not authenticated' }
  }

  const { data, error } = await supabase
    .from('inventory_items')
    .select(`
      *,
      store:stores(*),
      product:products(
        *,
        category:categories(*)
      )
    `)
    .eq('store_id', storeId)
    .eq('product_id', productId)
    .single()

  if (error) {
    return { data: null, error: getErrorMessage(error) }
  }

  // Get average cost
  const { data: avgCost } = await supabase.rpc('get_average_cost', {
    p_store_id: storeId,
    p_product_id: productId,
  })

  return {
    data: {
      ...data,
      average_cost: avgCost || 0,
    } as InventoryItem,
    error: null,
  }
}

