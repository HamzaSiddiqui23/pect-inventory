import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getUsers } from '@/lib/actions/users'
import { getProjects } from '@/lib/actions/projects'
import Image from 'next/image'
import LogoutButton from '@/app/components/LogoutButton'
import UsersList from '@/app/components/UsersList'
import { getErrorMessage } from '@/lib/utils/errors'

export default async function UsersPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Check if user is admin
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile || profile.role !== 'admin') {
    redirect('/dashboard')
  }

  const { data: users, error } = await getUsers()
  const { data: projects } = await getProjects()

  return (
    <div className="min-h-screen bg-white">
      <nav className="bg-white shadow-md border-b" style={{ borderColor: '#0067ac' }}>
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-20 justify-between items-center">
            <div className="flex items-center gap-4">
              <Image
                src="/pect-logo.png"
                alt="PECT Private Limited"
                width={150}
                height={60}
                priority
              />
              <h1 className="text-xl font-semibold" style={{ color: '#0067ac' }}>
                Inventory Management System
              </h1>
            </div>
            <div className="flex items-center gap-4">
              <a
                href="/dashboard"
                className="text-sm text-gray-700 hover:text-[#0067ac]"
              >
                Dashboard
              </a>
              <span className="text-sm text-gray-700">
                {user.email}
              </span>
              <LogoutButton />
            </div>
          </div>
        </div>
      </nav>

      <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6 flex justify-between items-center">
          <h2 className="text-2xl font-bold" style={{ color: '#0067ac' }}>
            User Management
          </h2>
        </div>

        {error && (
          <div className="mb-4 rounded-md bg-red-50 p-4 border border-red-200">
            <div className="text-sm text-red-800">
              <strong>Error loading users:</strong> {getErrorMessage(error)}
            </div>
          </div>
        )}

        {!error && users && users.length === 0 && (
          <div className="mb-4 rounded-md bg-yellow-50 p-4 border border-yellow-200">
            <div className="text-sm text-yellow-800">
              No users found. This might mean:
              <ul className="list-disc list-inside mt-2">
                <li>The user_profiles table doesn't exist (run the schema.sql)</li>
                <li>Your user profile hasn't been created yet</li>
              </ul>
            </div>
          </div>
        )}

        <UsersList initialUsers={users || []} projects={projects || []} />
      </main>
    </div>
  )
}

