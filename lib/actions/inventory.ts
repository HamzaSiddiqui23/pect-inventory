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
  const isCentralStoreManager = profile?.role === 'central_store_manager'
  const isProjectStoreManager = profile?.role === 'project_store_manager'

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
  } else if (isProjectStoreManager && profile.project_id) {
    // Project store managers can see their own store + all central stores
    // Get their project store
    const { data: projectStore } = await supabase
      .from('stores')
      .select('id')
      .eq('project_id', profile.project_id)
      .eq('type', 'project')
      .is('deleted_at', null)
      .single()
    
    // Get all central stores
    const { data: centralStores } = await supabase
      .from('stores')
      .select('id')
      .eq('type', 'central')
      .is('deleted_at', null)
    
    // Filter to show only their store and all central stores
    const allowedStoreIds: string[] = []
    if (projectStore) allowedStoreIds.push(projectStore.id)
    if (centralStores) {
      centralStores.forEach(store => allowedStoreIds.push(store.id))
    }
    
    if (allowedStoreIds.length > 0) {
      query = query.in('store_id', allowedStoreIds)
    } else {
      // No stores found, return empty result
      query = query.eq('store_id', '00000000-0000-0000-0000-000000000000') // Non-existent ID
    }
  }
  // Admins and central store managers see all stores

  // Filter by product if provided
  if (productId) {
    query = query.eq('product_id', productId)
  }

  const { data, error } = await query

  if (error || !data) {
    return { data: null, error: error?.message || 'Failed to fetch inventory' }
  }

  // Calculate average cost for each item (only for admins - others don't see prices)
  const inventoryWithCosts = await Promise.all(
    data.map(async (item) => {
      let avgCost = 0
      // Only admins can see costs/prices
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

