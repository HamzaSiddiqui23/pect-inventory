'use server'

import { createClient } from '@/lib/supabase/server'
import type { InventoryItem, InventoryMovementEntry } from '@/lib/types'
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

export async function getInventoryItemHistory(storeId: string, productId: string) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return { data: null, error: 'Not authenticated' }
  }

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('role, project_id')
    .eq('id', user.id)
    .single()

  if (!profile) {
    return { data: null, error: 'User profile not found' }
  }

  const { data: purchases, error: purchasesError } = await supabase
    .from('purchases')
    .select(
      `
        id,
        quantity,
        unit_cost,
        total_cost,
        purchase_date,
        created_at,
        notes,
        store:stores(*),
        product:products(
          *,
          category:categories(*)
        )
      `
    )
    .eq('store_id', storeId)
    .eq('product_id', productId)
    .is('deleted_at', null)

  if (purchasesError) {
    return { data: null, error: getErrorMessage(purchasesError) }
  }

  const { data: issuesFrom, error: issuesFromError } = await supabase
    .from('issues')
    .select(
      `
        id,
        quantity,
        issue_date,
        created_at,
        notes,
        from_store:stores!issues_from_store_id_fkey(*),
        to_store:stores!issues_to_store_id_fkey(*),
        issued_to_name,
        unit_cost,
        total_cost,
        product:products(
          *,
          category:categories(*)
        )
      `
    )
    .eq('from_store_id', storeId)
    .eq('product_id', productId)
    .is('deleted_at', null)

  if (issuesFromError) {
    return { data: null, error: getErrorMessage(issuesFromError) }
  }

  const { data: issuesTo, error: issuesToError } = await supabase
    .from('issues')
    .select(
      `
        id,
        quantity,
        issue_date,
        created_at,
        notes,
        from_store:stores!issues_from_store_id_fkey(*),
        to_store:stores!issues_to_store_id_fkey(*),
        issued_to_name,
        unit_cost,
        total_cost,
        product:products(
          *,
          category:categories(*)
        )
      `
    )
    .eq('to_store_id', storeId)
    .eq('product_id', productId)
    .is('deleted_at', null)

  if (issuesToError) {
    return { data: null, error: getErrorMessage(issuesToError) }
  }

  const movements: InventoryMovementEntry[] = []

  purchases?.forEach((purchase) => {
    movements.push({
      id: `purchase-${purchase.id}`,
      store_id: storeId,
      product_id: productId,
      reference_type: 'purchase',
      reference_id: purchase.id,
      movement_type: 'purchase',
      date: purchase.purchase_date,
      created_at: purchase.created_at,
      quantity: Number(purchase.quantity),
      unit_cost: purchase.unit_cost,
      total_cost: purchase.total_cost,
      notes: purchase.notes,
      issued_to_name: null,
      source_store: null,
      destination_store: purchase.store,
    })
  })

  issuesFrom?.forEach((issue) => {
    movements.push({
      id: `issue-out-${issue.id}`,
      store_id: storeId,
      product_id: productId,
      reference_type: 'issue',
      reference_id: issue.id,
      movement_type: 'issue_out',
      date: issue.issue_date,
      created_at: issue.created_at,
      quantity: Number(issue.quantity),
      unit_cost: issue.unit_cost,
      total_cost: issue.total_cost,
      notes: issue.notes,
      issued_to_name: issue.issued_to_name,
      source_store: issue.from_store,
      destination_store: issue.to_store,
    })
  })

  issuesTo?.forEach((issue) => {
    movements.push({
      id: `issue-in-${issue.id}`,
      store_id: storeId,
      product_id: productId,
      reference_type: 'issue',
      reference_id: issue.id,
      movement_type: 'issue_in',
      date: issue.issue_date,
      created_at: issue.created_at,
      quantity: Number(issue.quantity),
      unit_cost: issue.unit_cost,
      total_cost: issue.total_cost,
      notes: issue.notes,
      issued_to_name: issue.issued_to_name,
      source_store: issue.from_store,
      destination_store: issue.to_store,
    })
  })

  const sortedMovements = movements.sort((a, b) => {
    const dateDiff = new Date(a.date).getTime() - new Date(b.date).getTime()
    if (dateDiff !== 0) {
      return dateDiff
    }
    return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  })

  return {
    data: sortedMovements,
    error: null,
  }
}

