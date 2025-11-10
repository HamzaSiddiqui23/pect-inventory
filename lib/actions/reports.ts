'use server'

import { createClient } from '@/lib/supabase/server'
import { getErrorMessage } from '@/lib/utils/errors'
import type { InventoryMovementEntry, InventoryMovementSummaryItem, Product, Store } from '@/lib/types'

export type ReportPeriod = 'today' | 'weekly' | 'monthly' | 'quarterly' | 'annual' | 'lifetime'

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
    case 'today':
      startDate = new Date(endDate)
      startDate.setHours(0, 0, 0, 0) // Start of today
      break
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
    .is('deleted_at', null)
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
        .is('deleted_at', null)
        .single()

      if (store) {
        query = query.eq('store_id', store.id)
      }
    }
    // Central store managers can see all purchases (no filter)
  }

  const { data, error } = await query

  if (error) {
    return { data: null, error: getErrorMessage(error) }
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

export async function getIssueReport(period: ReportPeriod, storeId?: string, issuedToName?: string) {
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
    .is('deleted_at', null)
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

  // Filter by issued_to_name if provided
  if (issuedToName) {
    query = query.ilike('issued_to_name', `%${issuedToName}%`)
  }

  const { data, error } = await query

  if (error) {
    return { data: null, error: getErrorMessage(error) }
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
      .is('deleted_at', null)
      .single()

    if (store) {
      query = query.eq('store_id', store.id)
    }
  }

  const { data, error } = await query

  if (error) {
    return { data: null, error: getErrorMessage(error) }
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

export async function getInventoryMovementReport(
  period: ReportPeriod,
  centralStoreId?: string,
  projectStoreId?: string
) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return { data: null, error: 'Not authenticated' }
  }

  const dateRange = getDateRange(period)

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('role, project_id')
    .eq('id', user.id)
    .single()

  if (!profile) {
    return { data: null, error: 'User profile not found' }
  }

  let centralStore: Store | null = null
  if (centralStoreId) {
    const { data, error } = await supabase
      .from('stores')
      .select('*')
      .eq('id', centralStoreId)
      .eq('type', 'central')
      .is('deleted_at', null)
      .single()

    if (error || !data) {
      return { data: null, error: error ? getErrorMessage(error) : 'Central store not found' }
    }
    centralStore = data as Store
  }

  let projectStore: Store | null = null
  if (projectStoreId) {
    const { data, error } = await supabase
      .from('stores')
      .select(`
        *,
        project:projects(*)
      `)
      .eq('id', projectStoreId)
      .eq('type', 'project')
      .is('deleted_at', null)
      .single()

    if (error || !data) {
      return { data: null, error: error ? getErrorMessage(error) : 'Project store not found' }
    }
    projectStore = data as Store
  }

  const purchasesQuery = supabase
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
        product:products(
          *,
          category:categories(*)
        ),
        store:stores(*)
      `
    )
    .is('deleted_at', null)
    .gte('purchase_date', dateRange.startDate)
    .lte('purchase_date', dateRange.endDate)

  if (projectStoreId) {
    purchasesQuery.eq('store_id', projectStoreId)
  }

  const { data: projectPurchases, error: purchasesError } = await purchasesQuery

  if (purchasesError) {
    return { data: null, error: getErrorMessage(purchasesError) }
  }

  const issuesInQuery = supabase
    .from('issues')
    .select(
      `
        id,
        quantity,
        issue_date,
        created_at,
        notes,
        issued_to_name,
        unit_cost,
        total_cost,
        from_store:stores!issues_from_store_id_fkey(*),
        to_store:stores!issues_to_store_id_fkey(*),
        product:products(
          *,
          category:categories(*)
        )
      `
    )
    .is('deleted_at', null)
    .gte('issue_date', dateRange.startDate)
    .lte('issue_date', dateRange.endDate)

  if (projectStoreId) {
    issuesInQuery.eq('to_store_id', projectStoreId)
  }
  if (centralStoreId) {
    issuesInQuery.eq('from_store_id', centralStoreId)
  }

  const { data: issuesIn, error: issuesInError } = await issuesInQuery

  if (issuesInError) {
    return { data: null, error: getErrorMessage(issuesInError) }
  }

  const issuesOutQuery = supabase
    .from('issues')
    .select(
      `
        id,
        quantity,
        issue_date,
        created_at,
        notes,
        issued_to_name,
        unit_cost,
        total_cost,
        from_store:stores!issues_from_store_id_fkey(*),
        to_store:stores!issues_to_store_id_fkey(*),
        product:products(
          *,
          category:categories(*)
        )
      `
    )
    .is('deleted_at', null)
    .gte('issue_date', dateRange.startDate)
    .lte('issue_date', dateRange.endDate)

  if (projectStoreId) {
    issuesOutQuery.eq('from_store_id', projectStoreId)
  }

  const { data: issuesOut, error: issuesOutError } = await issuesOutQuery

  if (issuesOutError) {
    return { data: null, error: getErrorMessage(issuesOutError) }
  }

  const inventoryMap = new Map<string, number>()
  if (projectStoreId) {
    const { data: inventoryItems, error: inventoryError } = await supabase
      .from('inventory_items')
      .select('product_id, quantity')
      .eq('store_id', projectStoreId)

    if (inventoryError) {
      return { data: null, error: getErrorMessage(inventoryError) }
    }

    inventoryItems?.forEach((item) => {
      inventoryMap.set(item.product_id, Number(item.quantity))
    })
  }

  const summaries = new Map<string, InventoryMovementSummaryItem>()

  const normalizeRecord = <T>(record: any): T | null => {
    if (!record) {
      return null
    }
    if (Array.isArray(record)) {
      return (record[0] ?? null) as T | null
    }
    return record as T
  }

  const ensureSummary = (product: Product | null | undefined) => {
    if (!product) {
      return null
    }
    if (!summaries.has(product.id)) {
      summaries.set(product.id, {
        product,
        received_quantity: 0,
        issued_quantity: 0,
        balance_quantity: inventoryMap.get(product.id) ?? 0,
        movements: [],
      })
    }
    return summaries.get(product.id)!
  }

  projectPurchases?.forEach((purchase) => {
    const product = normalizeRecord<Product>(purchase.product)
    const summary = ensureSummary(product)
    const purchaseStore = normalizeRecord<Store>(purchase.store)
    const storeId = projectStoreId ?? purchaseStore?.id
    if (!product || !summary || !storeId) {
      return
    }
    const quantity = Number(purchase.quantity)
    summary.received_quantity += quantity
    const entry: InventoryMovementEntry = {
      id: `purchase-${purchase.id}`,
      store_id: storeId,
      product_id: product.id,
      reference_type: 'purchase',
      reference_id: purchase.id,
      movement_type: 'purchase',
      date: purchase.purchase_date,
      created_at: purchase.created_at,
      quantity,
      unit_cost: purchase.unit_cost,
      total_cost: purchase.total_cost,
      notes: purchase.notes,
      issued_to_name: null,
      source_store: null,
      destination_store: projectStore,
    }
    summary.movements.push(entry)
  })

  issuesIn?.forEach((issue) => {
    const product = normalizeRecord<Product>(issue.product)
    const summary = ensureSummary(product)
    const fromStore = normalizeRecord<Store>(issue.from_store)
    const toStore = normalizeRecord<Store>(issue.to_store)
    const storeId = projectStoreId ?? toStore?.id ?? fromStore?.id
    if (!product || !summary || !storeId) {
      return
    }
    const quantity = Number(issue.quantity)
    summary.received_quantity += quantity
    const entry: InventoryMovementEntry = {
      id: `issue-in-${issue.id}`,
      store_id: storeId,
      product_id: product.id,
      reference_type: 'issue',
      reference_id: issue.id,
      movement_type: 'issue_in',
      date: issue.issue_date,
      created_at: issue.created_at,
      quantity,
      unit_cost: issue.unit_cost,
      total_cost: issue.total_cost,
      notes: issue.notes,
      issued_to_name: issue.issued_to_name,
      source_store: fromStore,
      destination_store: toStore,
    }
    summary.movements.push(entry)
  })

  issuesOut?.forEach((issue) => {
    const product = normalizeRecord<Product>(issue.product)
    const summary = ensureSummary(product)
    const fromStore = normalizeRecord<Store>(issue.from_store)
    const toStore = normalizeRecord<Store>(issue.to_store)
    const storeId = projectStoreId ?? fromStore?.id ?? toStore?.id
    if (!product || !summary || !storeId) {
      return
    }
    const quantity = Number(issue.quantity)
    summary.issued_quantity += quantity
    const entry: InventoryMovementEntry = {
      id: `issue-out-${issue.id}`,
      store_id: storeId,
      product_id: product.id,
      reference_type: 'issue',
      reference_id: issue.id,
      movement_type: 'issue_out',
      date: issue.issue_date,
      created_at: issue.created_at,
      quantity,
      unit_cost: issue.unit_cost,
      total_cost: issue.total_cost,
      notes: issue.notes,
      issued_to_name: issue.issued_to_name,
      source_store: fromStore,
      destination_store: toStore,
    }
    summary.movements.push(entry)
  })

  const result = Array.from(summaries.values()).map((summary) => {
    const received = summary.received_quantity
    const issued = summary.issued_quantity
    const currentBalance = inventoryMap.get(summary.product.id)
    return {
      ...summary,
      received_quantity: received,
      issued_quantity: issued,
      balance_quantity: currentBalance ?? received - issued,
      movements: summary.movements
    }
  })

  const sortedResult = result.sort((a, b) =>
    a.product.name.localeCompare(b.product.name)
  )

  return {
    data: sortedResult,
    centralStore: centralStore,
    projectStore: projectStore,
    period,
    error: null,
  }
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
    .is('deleted_at', null)
    .order('type', { ascending: true })
    .order('name', { ascending: true })

  if (!isAdmin && profile.role === 'project_store_manager' && profile.project_id) {
    query = query.eq('project_id', profile.project_id)
  }

  const { data, error } = await query

  return { data, error }
}

