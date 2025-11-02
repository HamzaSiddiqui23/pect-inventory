'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import type { CreateProductInput, UpdateProductInput } from '@/lib/types'
import { getErrorMessage } from '@/lib/utils/errors'

export async function createProduct(input: CreateProductInput) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { error: 'Not authenticated' }
  }

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile || profile.role !== 'admin') {
    return { error: 'Unauthorized: Admin access required' }
  }

  const { data, error } = await supabase
    .from('products')
    .insert({
      category_id: input.category_id,
      name: input.name,
      unit: input.unit,
      description: input.description || null,
      restock_level: input.restock_level || 0,
    })
    .select(`
      *,
      category:categories(*)
    `)
    .single()

  if (error) {
    return { error: getErrorMessage(error) }
  }

  revalidatePath('/products')
  return { data, error: null }
}

export async function updateProduct(input: UpdateProductInput) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { error: 'Not authenticated' }
  }

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile || profile.role !== 'admin') {
    return { error: 'Unauthorized: Admin access required' }
  }

  const updateData: any = {}
  if (input.category_id !== undefined) updateData.category_id = input.category_id
  if (input.name !== undefined) updateData.name = input.name
  if (input.unit !== undefined) updateData.unit = input.unit
  if (input.description !== undefined) updateData.description = input.description
  if (input.restock_level !== undefined) updateData.restock_level = input.restock_level

  const { data, error } = await supabase
    .from('products')
    .update(updateData)
    .eq('id', input.id)
    .select(`
      *,
      category:categories(*)
    `)
    .single()

  if (error) {
    return { error: getErrorMessage(error) }
  }

  revalidatePath('/products')
  return { data, error: null }
}

export async function deleteProduct(productId: string) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { error: 'Not authenticated' }
  }

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile || profile.role !== 'admin') {
    return { error: 'Unauthorized: Admin access required' }
  }

  const { error } = await supabase
    .from('products')
    .update({
      deleted_at: new Date().toISOString(),
      deleted_by: user.id,
    })
    .eq('id', productId)

  if (error) {
    return { error: getErrorMessage(error) }
  }

  revalidatePath('/products')
  return { error: null }
}

export async function getProducts() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { data: null, error: 'Not authenticated' }
  }

  const { data, error } = await supabase
    .from('products')
    .select(`
      *,
      category:categories(*)
    `)
    .is('deleted_at', null)
    .order('name', { ascending: true })

  return { data, error }
}

