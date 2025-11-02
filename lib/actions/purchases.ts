'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import type { CreatePurchaseInput, UpdatePurchaseInput } from '@/lib/types'
import { getErrorMessage } from '@/lib/utils/errors'

export async function createPurchase(input: CreatePurchaseInput) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { error: 'Not authenticated' }
  }

  // Only admins and central store managers can create purchases
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile || !['admin', 'central_store_manager'].includes(profile.role)) {
    return { error: 'Unauthorized: Admin or Central Store Manager access required' }
  }

  // Verify it's for central store
  const { data: store } = await supabase
    .from('stores')
    .select('type')
    .eq('id', input.store_id)
    .single()

  if (!store || store.type !== 'central') {
    return { error: 'Purchases can only be made for central store' }
  }

  const total_cost = input.quantity * input.unit_cost

  const { data, error } = await supabase
    .from('purchases')
    .insert({
      store_id: input.store_id,
      product_id: input.product_id,
      quantity: input.quantity,
      unit_cost: input.unit_cost,
      total_cost: total_cost,
      purchase_date: input.purchase_date || new Date().toISOString().split('T')[0],
      notes: input.notes || null,
      created_by: user.id,
    })
    .select(`
      *,
      store:stores(*),
      product:products(
        *,
        category:categories(*)
      )
    `)
    .single()

  if (error) {
    return { error: getErrorMessage(error) }
  }

  revalidatePath('/purchases')
  revalidatePath('/inventory')
  return { data, error: null }
}

export async function updatePurchase(input: UpdatePurchaseInput) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { error: 'Not authenticated' }
  }

  // Only admins can update purchases
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile || profile.role !== 'admin') {
    return { error: 'Unauthorized: Admin access required' }
  }

  // Get current purchase to calculate new total cost
  const { data: currentPurchase } = await supabase
    .from('purchases')
    .select('quantity, unit_cost')
    .eq('id', input.id)
    .single()

  if (!currentPurchase) {
    return { error: 'Purchase not found' }
  }

  const quantity = input.quantity ?? currentPurchase.quantity
  const unit_cost = input.unit_cost ?? currentPurchase.unit_cost
  const total_cost = quantity * unit_cost

  const updateData: any = {
    total_cost,
  }
  if (input.store_id !== undefined) {
    // Verify new store is a central store if changing store
    const { data: newStore } = await supabase
      .from('stores')
      .select('type')
      .eq('id', input.store_id)
      .single()
    
    if (!newStore || newStore.type !== 'central') {
      return { error: 'Purchases can only be made for central stores' }
    }
    updateData.store_id = input.store_id
  }
  if (input.product_id !== undefined) updateData.product_id = input.product_id
  if (input.quantity !== undefined) updateData.quantity = input.quantity
  if (input.unit_cost !== undefined) updateData.unit_cost = input.unit_cost
  if (input.purchase_date !== undefined) updateData.purchase_date = input.purchase_date
  if (input.notes !== undefined) updateData.notes = input.notes

  const { data, error } = await supabase
    .from('purchases')
    .update(updateData)
    .eq('id', input.id)
    .select(`
      *,
      store:stores(*),
      product:products(
        *,
        category:categories(*)
      )
    `)
    .single()

  if (error) {
    return { error: getErrorMessage(error) }
  }

  revalidatePath('/purchases')
  revalidatePath('/inventory')
  return { data, error: null }
}

export async function deletePurchase(purchaseId: string) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { error: 'Not authenticated' }
  }

  // Only admins can delete purchases
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile || profile.role !== 'admin') {
    return { error: 'Unauthorized: Admin access required' }
  }

  // Note: The trigger will still reverse the inventory impact when we soft delete
  // We need to handle this in the trigger logic or keep hard delete for purchases
  // For now, we'll soft delete but the trigger logic will need updating
  const { error } = await supabase
    .from('purchases')
    .update({
      deleted_at: new Date().toISOString(),
      deleted_by: user.id,
    })
    .eq('id', purchaseId)

  if (error) {
    return { error: getErrorMessage(error) }
  }

  // Note: Inventory reversal should happen via a trigger on deleted_at update
  // Or we can keep hard delete for purchases to maintain trigger behavior
  // For now keeping soft delete for audit trail

  revalidatePath('/purchases')
  revalidatePath('/inventory')
  return { error: null }
}

export async function getPurchases(productId?: string, storeId?: string, startDate?: string, endDate?: string) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { data: null, error: 'Not authenticated' }
  }

  let query = supabase
    .from('purchases')
    .select(`
      *,
      store:stores(*),
      product:products(
        *,
        category:categories(*)
      )
    `)
    .is('deleted_at', null)
    .order('purchase_date', { ascending: false })
    .order('created_at', { ascending: false })

  if (productId) {
    query = query.eq('product_id', productId)
  }

  if (storeId) {
    query = query.eq('store_id', storeId)
  }

  if (startDate) {
    query = query.gte('purchase_date', startDate)
  }

  if (endDate) {
    query = query.lte('purchase_date', endDate)
  }

  const { data, error } = await query

  return { data, error }
}

export async function getStores() {
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

  let query = supabase
    .from('stores')
    .select(`
      *,
      project:projects(*)
    `)
    .is('deleted_at', null)
    .order('type', { ascending: true })
    .order('name', { ascending: true })

  // Project store managers can only see their store + all central stores
  if (profile?.role === 'project_store_manager' && profile.project_id) {
    // Get their project store and all central stores
    const { data: projectStore } = await supabase
      .from('stores')
      .select('id')
      .eq('project_id', profile.project_id)
      .eq('type', 'project')
      .is('deleted_at', null)
      .single()
    
    const { data: centralStores } = await supabase
      .from('stores')
      .select('id')
      .eq('type', 'central')
      .is('deleted_at', null)
    
    const allowedStoreIds: string[] = []
    if (projectStore) allowedStoreIds.push(projectStore.id)
    if (centralStores) {
      centralStores.forEach(store => allowedStoreIds.push(store.id))
    }
    
    if (allowedStoreIds.length > 0) {
      query = query.in('id', allowedStoreIds)
    } else {
      // No stores found, return empty result
      query = query.eq('id', '00000000-0000-0000-0000-000000000000') // Non-existent ID
    }
  }
  // Admins and central store managers can see all stores

  const { data, error } = await query

  return { data, error }
}

export async function getCentralStore() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { data: null, error: 'Not authenticated' }
  }

  const { data, error } = await supabase
    .from('stores')
    .select('*')
    .eq('type', 'central')
    .single()

  return { data, error }
}

