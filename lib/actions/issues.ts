'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import type { CreateIssueInput } from '@/lib/types'
import { getErrorMessage } from '@/lib/utils/errors'

export async function createIssue(input: CreateIssueInput) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { error: 'Not authenticated' }
  }

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('role, project_id')
    .eq('id', user.id)
    .single()

  if (!profile) {
    return { error: 'User profile not found' }
  }

  // Check permissions
  const isAdmin = profile.role === 'admin'
  const isCentralStoreManager = profile.role === 'central_store_manager'
  const isProjectStoreManager = profile.role === 'project_store_manager'

  // Get the source store to verify permissions
  const { data: sourceStore } = await supabase
    .from('stores')
    .select('type, project_id')
    .eq('id', input.from_store_id)
    .is('deleted_at', null)
    .single()

  if (!sourceStore) {
    return { error: 'Source store not found' }
  }

  // Verify user has permission to issue from this store
  if (!isAdmin) {
    if (sourceStore.type === 'central' && !isCentralStoreManager) {
      return { error: 'Unauthorized: Only Central Store Managers can issue from central store' }
    }
    if (sourceStore.type === 'project') {
      if (!isProjectStoreManager || profile.project_id !== sourceStore.project_id) {
        return { error: 'Unauthorized: You can only issue from your assigned project store' }
      }
    }
  }

  // Check if there's enough inventory
  const { data: inventory } = await supabase
    .from('inventory_items')
    .select('quantity')
    .eq('store_id', input.from_store_id)
    .eq('product_id', input.product_id)
    .single()

  if (!inventory || inventory.quantity < input.quantity) {
    return { error: 'Insufficient inventory' }
  }

  let destinationStore: { type: string; project_id: string | null } | null = null

  if (input.to_store_id) {
    if (input.to_store_id === input.from_store_id) {
      return { error: 'Destination store must be different from source store' }
    }

    const { data: toStore } = await supabase
      .from('stores')
      .select('type, project_id')
      .eq('id', input.to_store_id)
      .is('deleted_at', null)
      .single()

    if (!toStore) {
      return { error: 'Destination store not found' }
    }

    if (sourceStore.type === 'central' && toStore.type !== 'project') {
      return { error: 'Central stores can only issue to project stores' }
    }

    if (sourceStore.type === 'project' && toStore.type !== 'central') {
      return { error: 'Project stores can only return items to a central store or issue to individuals' }
    }

    destinationStore = toStore
  } else if (sourceStore.type === 'central') {
    return { error: 'Central stores must select a destination store' }
  }

  const issuedToName =
    !input.to_store_id && sourceStore.type !== 'central'
      ? input.issued_to_name?.toString().trim() || null
      : null

  // Create the issue record
  const { data, error } = await supabase
    .from('issues')
    .insert({
      from_store_id: input.from_store_id,
      to_store_id: destinationStore ? input.to_store_id : null,
      product_id: input.product_id,
      quantity: input.quantity,
      issued_to_name: issuedToName,
      issue_date: input.issue_date || new Date().toISOString().split('T')[0],
      notes: input.notes || null,
      created_by: user.id,
    })
    .select(`
      *,
      from_store:stores!issues_from_store_id_fkey(*),
      to_store:stores!issues_to_store_id_fkey(*),
      product:products(
        *,
        category:categories(*)
      )
    `)
    .single()

  // Note: Inventory is automatically updated by trigger

  if (error) {
    return { error: getErrorMessage(error) }
  }

  revalidatePath('/issues')
  revalidatePath('/inventory')
  return { data, error: null }
}

export async function getIssues(storeId?: string, productId?: string, startDate?: string, endDate?: string) {
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

  if (!profile) {
    return { data: null, error: 'User profile not found' }
  }

  const isAdmin = profile.role === 'admin'

  let query = supabase
    .from('issues')
    .select(`
      *,
      from_store:stores!issues_from_store_id_fkey(
        *,
        project:projects(*)
      ),
      to_store:stores!issues_to_store_id_fkey(
        *,
        project:projects(*)
      ),
      product:products(
        *,
        category:categories(*)
      )
    `)
    .is('deleted_at', null)
    .order('issue_date', { ascending: false })
    .order('created_at', { ascending: false })

  // Filter by store if provided
  if (storeId) {
    query = query.or(`from_store_id.eq.${storeId},to_store_id.eq.${storeId}`)
  } else if (!isAdmin && profile.role === 'project_store_manager' && profile.project_id) {
    // Project store managers can only see issues for their store
    const { data: store } = await supabase
      .from('stores')
      .select('id')
      .eq('project_id', profile.project_id)
      .is('deleted_at', null)
      .single()

    if (store) {
      query = query.or(`from_store_id.eq.${store.id},to_store_id.eq.${store.id}`)
    }
  } else if (!isAdmin && profile.role === 'central_store_manager') {
    // Central store managers can see all issues (no filter needed, but they won't see prices)
  }

  // Filter by product if provided
  if (productId) {
    query = query.eq('product_id', productId)
  }

  // Filter by date range if provided
  if (startDate) {
    query = query.gte('issue_date', startDate)
  }

  if (endDate) {
    query = query.lte('issue_date', endDate)
  }

  const { data, error } = await query

  return { data, error }
}

export async function getIssueableStores() {
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

  if (!profile) {
    return { data: null, error: 'User profile not found' }
  }

  const isAdmin = profile.role === 'admin'
  const isCentralStoreManager = profile.role === 'central_store_manager'
  const isProjectStoreManager = profile.role === 'project_store_manager'

  // Get stores the user can issue from
  let fromStoresQuery = supabase
    .from('stores')
    .select(`
      *,
      project:projects(*)
    `)
    .is('deleted_at', null)

  if (!isAdmin) {
    if (isCentralStoreManager) {
      fromStoresQuery = fromStoresQuery.eq('type', 'central')
    } else if (isProjectStoreManager) {
      if (profile.project_id) {
        fromStoresQuery = fromStoresQuery.eq('project_id', profile.project_id)
      } else {
        fromStoresQuery = fromStoresQuery.eq('id', '00000000-0000-0000-0000-000000000000') // No project assigned
      }
    }
  }

  const { data: fromStores, error: fromError } = await fromStoresQuery

  if (fromError) {
    return { data: null, error: getErrorMessage(fromError) }
  }

  const toStoresSet = new Map<string, any>()

  const addStores = (stores: any[] | null | undefined) => {
    if (!stores) return
    for (const store of stores) {
      toStoresSet.set(store.id, store)
    }
  }

  if (isAdmin || isCentralStoreManager) {
    const { data: projectStores, error: projectError } = await supabase
      .from('stores')
      .select(`
        *,
        project:projects(*)
      `)
      .eq('type', 'project')
      .is('deleted_at', null)

    if (projectError) {
      return { data: null, error: getErrorMessage(projectError) }
    }

    addStores(projectStores)
  }

  if (isAdmin || isProjectStoreManager) {
    const { data: centralStores, error: centralError } = await supabase
      .from('stores')
      .select(`
        *,
        project:projects(*)
      `)
      .eq('type', 'central')
      .is('deleted_at', null)

    if (centralError) {
      return { data: null, error: getErrorMessage(centralError) }
    }

    addStores(centralStores)
  }

  return {
    data: {
      fromStores: fromStores || [],
      toStores: Array.from(toStoresSet.values()),
    },
    error: null,
  }
}

