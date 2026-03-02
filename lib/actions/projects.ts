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

  const requestedStoreName = input.store_name?.trim()
  if (requestedStoreName) {
    const { error: storeUpdateError } = await supabase
      .from('stores')
      .update({ name: requestedStoreName })
      .eq('project_id', data.id)
      .eq('type', 'project')

    if (storeUpdateError) {
      return { error: getErrorMessage(storeUpdateError) }
    }
  }

  revalidatePath('/projects')
  revalidatePath('/stores')
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

  if (input.store_name !== undefined) {
    const normalizedStoreName = input.store_name.trim()
    if (!normalizedStoreName) {
      return { error: 'Store name cannot be empty' }
    }

    const { error: storeUpdateError } = await supabase
      .from('stores')
      .update({ name: normalizedStoreName })
      .eq('project_id', input.id)
      .eq('type', 'project')

    if (storeUpdateError) {
      return { error: getErrorMessage(storeUpdateError) }
    }
  }

  revalidatePath('/projects')
  revalidatePath('/stores')
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
    .update({
      deleted_at: new Date().toISOString(),
      deleted_by: user.id,
    })
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

  let query = supabase
    .from('projects')
    .select('*')
    .is('deleted_at', null)
    .order('created_at', { ascending: false })

  // Project store managers can only see their own project
  if (profile.role === 'project_store_manager' && profile.project_id) {
    query = query.eq('id', profile.project_id)
  }

  const { data, error } = await query
  if (error || !data) {
    return { data: null, error }
  }

  const projectIds = data.map((project) => project.id)
  let projectStoreNameMap = new Map<string, string>()

  if (projectIds.length > 0) {
    const { data: projectStores } = await supabase
      .from('stores')
      .select('project_id, name')
      .eq('type', 'project')
      .is('deleted_at', null)
      .in('project_id', projectIds)

    projectStoreNameMap = new Map(
      (projectStores || [])
        .filter((store) => !!store.project_id)
        .map((store) => [store.project_id as string, store.name as string])
    )
  }

  const projectsWithStoreNames = data.map((project) => ({
    ...project,
    project_store_name: projectStoreNameMap.get(project.id) || null,
  }))

  return { data: projectsWithStoreNames, error: null }
}

