'use server'

import { createClient } from '@/lib/supabase/server'

export type ReportPeriod = 'weekly' | 'monthly' | 'quarterly' | 'annual' | 'lifetime'

interface DateRange {
  startDate: string
  endDate: string
}

function getDateRange(period: ReportPeriod): DateRange {
  const now = new Date()
  const endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  endDate.setHours(23, 59, 59, 999) // End of today
  
  let startDate: Date

  switch (period) {
    case 'weekly':
      startDate = new Date(endDate)
      startDate.setDate(startDate.getDate() - 6) // Last 7 days (including today)
      break
    case 'monthly':
      startDate = new Date(endDate.getFullYear(), endDate.getMonth(), 1)
      break
    case 'quarterly':
      const quarter = Math.floor(endDate.getMonth() / 3)
      startDate = new Date(endDate.getFullYear(), quarter * 3, 1)
      break
    case 'annual':
      startDate = new Date(endDate.getFullYear(), 0, 1)
      break
    case 'lifetime':
      startDate = new Date(2000, 0, 1) // Very early date
      break
  }
  startDate.setHours(0, 0, 0, 0)

  return {
    startDate: startDate.toISOString().split('T')[0],
    endDate: endDate.toISOString().split('T')[0],
  }
}

export async function getPurchaseReport(period: ReportPeriod, storeId?: string) {
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
  const dateRange = getDateRange(period)

  let query = supabase
    .from('purchases')
    .select(`
      *,
      store:stores(
        *,
        project:projects(*)
      ),
      product:products(
        *,
        category:categories(*)
      )
    `)
    .gte('purchase_date', dateRange.startDate)
    .lte('purchase_date', dateRange.endDate)
    .order('purchase_date', { ascending: false })

  // Filter by store if provided or if user is not admin
  if (storeId) {
    query = query.eq('store_id', storeId)
  } else if (!isAdmin) {
    if (profile.role === 'project_store_manager' && profile.project_id) {
      const { data: store } = await supabase
        .from('stores')
        .select('id')
        .eq('project_id', profile.project_id)
        .single()

      if (store) {
        query = query.eq('store_id', store.id)
      }
    }
    // Central store managers can see all purchases (no filter)
  }

  const { data, error } = await query

  if (error) {
    return { data: null, error: typeof error === 'string' ? error : error.message }
  }

  // Calculate summary statistics
  const summary = {
    totalPurchases: data?.length || 0,
    totalQuantity: data?.reduce((sum, p) => sum + Number(p.quantity), 0) || 0,
    totalCost: data?.reduce((sum, p) => sum + Number(p.total_cost), 0) || 0,
    averageUnitCost: data && data.length > 0
      ? data.reduce((sum, p) => sum + Number(p.total_cost), 0) / 
        data.reduce((sum, p) => sum + Number(p.quantity), 0)
      : 0,
  }

  return { data, summary, error: null }
}

export async function getIssueReport(period: ReportPeriod, storeId?: string) {
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
  const dateRange = getDateRange(period)

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
    .gte('issue_date', dateRange.startDate)
    .lte('issue_date', dateRange.endDate)
    .order('issue_date', { ascending: false })

  // Filter by store if provided
  if (storeId) {
    query = query.or(`from_store_id.eq.${storeId},to_store_id.eq.${storeId}`)
  } else if (!isAdmin && profile.role === 'project_store_manager' && profile.project_id) {
    // Project store managers can only see issues for their store
    const { data: store } = await supabase
      .from('stores')
      .select('id')
      .eq('project_id', profile.project_id)
      .single()

    if (store) {
      query = query.or(`from_store_id.eq.${store.id},to_store_id.eq.${store.id}`)
    }
  }
  // Central store managers can see all issues (no filter)

  const { data, error } = await query

  if (error) {
    return { data: null, error: typeof error === 'string' ? error : error.message }
  }

  // Calculate summary statistics
  const issuedToStores = data?.filter(i => i.to_store_id) || []
  const issuedToProjects = data?.filter(i => !i.to_store_id) || []

  const summary = {
    totalIssues: data?.length || 0,
    issuesToStores: issuedToStores.length,
    issuesToProjects: issuedToProjects.length,
    totalQuantity: data?.reduce((sum, i) => sum + Number(i.quantity), 0) || 0,
    totalCost: issuedToStores.reduce((sum, i) => sum + (Number(i.total_cost) || 0), 0),
  }

  return { data, summary, error: null }
}

export async function getInventoryCostReport(storeId?: string) {
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
    .from('inventory_items')
    .select(`
      *,
      store:stores(
        *,
        project:projects(*)
      ),
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
  } else if (!isAdmin && profile.role === 'project_store_manager' && profile.project_id) {
    const { data: store } = await supabase
      .from('stores')
      .select('id')
      .eq('project_id', profile.project_id)
      .single()

    if (store) {
      query = query.eq('store_id', store.id)
    }
  }

  const { data, error } = await query

  if (error) {
    return { data: null, error: typeof error === 'string' ? error : error.message }
  }

  // Calculate average costs and totals for each item
  const inventoryWithCosts = await Promise.all(
    (data || []).map(async (item) => {
      let avgCost = 0
      if (isAdmin || (profile.role === 'central_store_manager' && item.store?.type === 'central')) {
        const { data: avgCostData } = await supabase.rpc('get_average_cost', {
          p_store_id: item.store_id,
          p_product_id: item.product_id,
        })
        avgCost = avgCostData || 0
      }

      const totalValue = avgCost * Number(item.quantity)

      return {
        ...item,
        average_cost: avgCost,
        total_value: totalValue,
      }
    })
  )

  // Calculate summary statistics
  const summary = {
    totalItems: inventoryWithCosts.length,
    totalQuantity: inventoryWithCosts.reduce((sum, item) => sum + Number(item.quantity), 0),
    totalValue: inventoryWithCosts.reduce((sum, item) => sum + (item.total_value || 0), 0),
    byStore: {} as Record<string, { quantity: number; value: number }>,
  }

  // Group by store
  inventoryWithCosts.forEach((item) => {
    const storeName = item.store?.name || 'Unknown'
    if (!summary.byStore[storeName]) {
      summary.byStore[storeName] = { quantity: 0, value: 0 }
    }
    summary.byStore[storeName].quantity += Number(item.quantity)
    summary.byStore[storeName].value += item.total_value || 0
  })

  return { data: inventoryWithCosts, summary, error: null }
}

export async function getStoresForReports() {
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
    .from('stores')
    .select(`
      *,
      project:projects(*)
    `)
    .order('type', { ascending: true })
    .order('name', { ascending: true })

  if (!isAdmin && profile.role === 'project_store_manager' && profile.project_id) {
    query = query.eq('project_id', profile.project_id)
  }

  const { data, error } = await query

  return { data, error }
}

