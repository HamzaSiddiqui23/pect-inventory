'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'
import type { CreateUserInput, UpdateUserInput } from '@/lib/types'
import { getErrorMessage } from '@/lib/utils/errors'

export async function createUser(input: CreateUserInput) {
  const supabase = await createClient()

  // Check if current user is admin
  const { data: { user: currentUser } } = await supabase.auth.getUser()
  if (!currentUser) {
    return { error: 'Not authenticated' }
  }

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('role')
    .eq('id', currentUser.id)
    .single()

  if (!profile || profile.role !== 'admin') {
    return { error: 'Unauthorized: Admin access required' }
  }

  try {
    // Use admin client to create user
    const adminClient = createAdminClient()
    
    // Create auth user
    const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
      email: input.email,
      password: input.password,
      email_confirm: true,
      user_metadata: {
        full_name: input.full_name || '',
      },
    })

    if (authError || !authData.user) {
      return { error: authError ? getErrorMessage(authError) : 'Failed to create user' }
    }

    // Update user profile with role and project
    const { error: profileError } = await adminClient
      .from('user_profiles')
      .update({
        role: input.role,
        project_id: input.project_id || null,
        full_name: input.full_name || null,
      })
      .eq('id', authData.user.id)

    if (profileError) {
      return { error: getErrorMessage(profileError) }
    }

    revalidatePath('/users')
    return { data: authData.user, error: null }
  } catch (error: any) {
    return { error: getErrorMessage(error) || 'Failed to create user' }
  }
}

export async function updateUser(input: UpdateUserInput) {
  const supabase = await createClient()

  const { data: { user: currentUser } } = await supabase.auth.getUser()
  if (!currentUser) {
    return { error: 'Not authenticated' }
  }

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('role')
    .eq('id', currentUser.id)
    .single()

  if (!profile || profile.role !== 'admin') {
    return { error: 'Unauthorized: Admin access required' }
  }

  const updateData: any = {}
  if (input.full_name !== undefined) updateData.full_name = input.full_name
  if (input.role !== undefined) updateData.role = input.role
  if (input.project_id !== undefined) updateData.project_id = input.project_id

  const { error } = await supabase
    .from('user_profiles')
    .update(updateData)
    .eq('id', input.id)

  if (error) {
    return { error: getErrorMessage(error) }
  }

  revalidatePath('/users')
  return { error: null }
}

export async function resetUserPassword(userId: string, newPassword: string) {
  const supabase = await createClient()

  const { data: { user: currentUser } } = await supabase.auth.getUser()
  if (!currentUser) {
    return { error: 'Not authenticated' }
  }

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('role')
    .eq('id', currentUser.id)
    .single()

  if (!profile || profile.role !== 'admin') {
    return { error: 'Unauthorized: Admin access required' }
  }

  if (!newPassword || newPassword.length < 6) {
    return { error: 'Password must be at least 6 characters long' }
  }

  try {
    const adminClient = createAdminClient()
    const { error } = await adminClient.auth.admin.updateUserById(userId, {
      password: newPassword,
    })

    if (error) {
      return { error: getErrorMessage(error) }
    }

    return { error: null }
  } catch (error: any) {
    return { error: error.message || 'Failed to reset password' }
  }
}

export async function deleteUser(userId: string) {
  const supabase = await createClient()

  const { data: { user: currentUser } } = await supabase.auth.getUser()
  if (!currentUser) {
    return { error: 'Not authenticated' }
  }

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('role')
    .eq('id', currentUser.id)
    .single()

  if (!profile || profile.role !== 'admin') {
    return { error: 'Unauthorized: Admin access required' }
  }

  try {
    const adminClient = createAdminClient()
    const { error } = await adminClient.auth.admin.deleteUser(userId)

    if (error) {
      return { error: getErrorMessage(error) }
    }

    revalidatePath('/users')
    return { error: null }
  } catch (error: any) {
    return { error: error.message || 'Failed to delete user' }
  }
}

export async function getUsers() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { data: null, error: 'Not authenticated' }
  }

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile || profile.role !== 'admin') {
    return { data: null, error: 'Unauthorized: Admin access required' }
  }

  const { data, error } = await supabase
    .from('user_profiles')
    .select(`
      *,
      projects:project_id (
        id,
        name
      )
    `)
    .order('created_at', { ascending: false })

  return { data, error }
}

