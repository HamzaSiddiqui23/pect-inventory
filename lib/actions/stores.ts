'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { getErrorMessage } from '@/lib/utils/errors'

export interface CreateCentralStoreInput {
  name: string
  location?: string
  description?: string
}

export interface UpdateCentralStoreInput {
  id: string
  name?: string
  location?: string
  description?: string
}

export async function createCentralStore(input: CreateCentralStoreInput) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { error: 'Not authenticated' }
  }

  // Only admins can create central stores
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile || profile.role !== 'admin') {
    return { error: 'Unauthorized: Admin access required' }
  }

  const { data, error } = await supabase
    .from('stores')
    .insert({
      name: input.name,
      type: 'central',
      project_id: null,
      // Note: We don't have location/description columns yet, but we can add them if needed
      // For now, we'll use the name field to include location info (e.g., "Central Store - Karachi")
    })
    .select('*')
    .single()

  if (error) {
    return { error: getErrorMessage(error) }
  }

  revalidatePath('/stores')
  revalidatePath('/purchases')
  revalidatePath('/inventory')
  return { data, error: null }
}

export async function updateCentralStore(input: UpdateCentralStoreInput) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { error: 'Not authenticated' }
  }

  // Only admins can update central stores
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile || profile.role !== 'admin') {
    return { error: 'Unauthorized: Admin access required' }
  }

  // Verify it's a central store
  const { data: store } = await supabase
    .from('stores')
    .select('type')
    .eq('id', input.id)
    .single()

  if (!store || store.type !== 'central') {
    return { error: 'Store not found or not a central store' }
  }

  const updateData: any = {}
  if (input.name !== undefined) updateData.name = input.name

  const { data, error } = await supabase
    .from('stores')
    .update(updateData)
    .eq('id', input.id)
    .select('*')
    .single()

  if (error) {
    return { error: getErrorMessage(error) }
  }

  revalidatePath('/stores')
  revalidatePath('/purchases')
  revalidatePath('/inventory')
  return { data, error: null }
}

export async function deleteCentralStore(storeId: string) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { error: 'Not authenticated' }
  }

  // Only admins can delete central stores
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile || profile.role !== 'admin') {
    return { error: 'Unauthorized: Admin access required' }
  }

  // Verify it's a central store
  const { data: store } = await supabase
    .from('stores')
    .select('type')
    .eq('id', storeId)
    .single()

  if (!store || store.type !== 'central') {
    return { error: 'Store not found or not a central store' }
  }

  // Check if store has inventory with quantity > 0
  const { data: inventoryItems, error: inventoryError } = await supabase
    .from('inventory_items')
    .select('id, quantity')
    .eq('store_id', storeId)

  if (inventoryError) {
    return { error: getErrorMessage(inventoryError) }
  }

  // Check if any inventory item has quantity > 0
  const hasNonZeroInventory = inventoryItems?.some(item => Number(item.quantity) > 0)

  if (hasNonZeroInventory) {
    return { error: 'Cannot delete central store with inventory items that have quantity > 0. Please transfer or remove inventory first.' }
  }

  // If there are inventory items but all have quantity 0, delete them
  if (inventoryItems && inventoryItems.length > 0) {
    const { error: deleteInventoryError } = await supabase
      .from('inventory_items')
      .delete()
      .eq('store_id', storeId)

    if (deleteInventoryError) {
      return { error: getErrorMessage(deleteInventoryError) }
    }
  }

  // Soft delete the store
  const { error } = await supabase
    .from('stores')
    .update({
      deleted_at: new Date().toISOString(),
      deleted_by: user.id,
    })
    .eq('id', storeId)

  if (error) {
    return { error: getErrorMessage(error) }
  }

  revalidatePath('/stores')
  revalidatePath('/purchases')
  revalidatePath('/inventory')
  return { error: null }
}

export async function getCentralStores() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { data: null, error: 'Not authenticated' }
  }

  const { data, error } = await supabase
    .from('stores')
    .select('*')
    .eq('type', 'central')
    .is('deleted_at', null)
    .order('name', { ascending: true })

  if (error) {
    return { data: null, error: getErrorMessage(error) }
  }

  return { data, error: null }
}

