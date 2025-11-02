'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import type { CreateCategoryInput, UpdateCategoryInput } from '@/lib/types'
import { getErrorMessage } from '@/lib/utils/errors'

export async function createCategory(input: CreateCategoryInput) {
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
    .from('categories')
    .insert({
      name: input.name,
      description: input.description || null,
    })
    .select()
    .single()

  if (error) {
    return { error: getErrorMessage(error) }
  }

  revalidatePath('/categories')
  return { data, error: null }
}

export async function updateCategory(input: UpdateCategoryInput) {
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
  if (input.name !== undefined) updateData.name = input.name
  if (input.description !== undefined) updateData.description = input.description

  const { data, error } = await supabase
    .from('categories')
    .update(updateData)
    .eq('id', input.id)
    .select()
    .single()

  if (error) {
    return { error: getErrorMessage(error) }
  }

  revalidatePath('/categories')
  return { data, error: null }
}

export async function deleteCategory(categoryId: string) {
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
    .from('categories')
    .delete()
    .eq('id', categoryId)

  if (error) {
    return { error: getErrorMessage(error) }
  }

  revalidatePath('/categories')
  return { error: null }
}

export async function getCategories() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { data: null, error: 'Not authenticated' }
  }

  const { data, error } = await supabase
    .from('categories')
    .select('*')
    .order('name', { ascending: true })

  return { data, error }
}

