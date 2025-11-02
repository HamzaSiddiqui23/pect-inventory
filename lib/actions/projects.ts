'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import type { CreateProjectInput, UpdateProjectInput } from '@/lib/types'
import { getErrorMessage } from '@/lib/utils/errors'

export async function createProject(input: CreateProjectInput) {
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
    .from('projects')
    .insert({
      name: input.name,
      description: input.description || null,
      location: input.location || null,
      status: input.status || 'active',
    })
    .select()
    .single()

  if (error) {
    return { error: getErrorMessage(error) }
  }

  revalidatePath('/projects')
  return { data, error: null }
}

export async function updateProject(input: UpdateProjectInput) {
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
  if (input.location !== undefined) updateData.location = input.location
  if (input.status !== undefined) updateData.status = input.status

  const { data, error } = await supabase
    .from('projects')
    .update(updateData)
    .eq('id', input.id)
    .select()
    .single()

  if (error) {
    return { error: getErrorMessage(error) }
  }

  revalidatePath('/projects')
  return { data, error: null }
}

export async function deleteProject(projectId: string) {
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
    .from('projects')
    .delete()
    .eq('id', projectId)

  if (error) {
    return { error: getErrorMessage(error) }
  }

  revalidatePath('/projects')
  return { error: null }
}

export async function getProjects() {
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

  let query = supabase.from('projects').select('*').order('created_at', { ascending: false })

  // Project store managers can only see their own project
  if (profile.role === 'project_store_manager' && profile.project_id) {
    query = query.eq('id', profile.project_id)
  }

  const { data, error } = await query

  return { data, error }
}

