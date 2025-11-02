import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Image from 'next/image'
import LogoutButton from '@/app/components/LogoutButton'
import { getErrorMessage } from '@/lib/utils/errors'

export default async function DebugPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Get user profile
  const { data: profile, error: profileError } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  // Try to get users
  const { data: users, error: usersError } = await supabase
    .from('user_profiles')
    .select('*')
    .limit(5)

  // Try to get projects
  const { data: projects, error: projectsError } = await supabase
    .from('projects')
    .select('*')
    .limit(5)

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
                Debug Information
              </h1>
            </div>
            <div className="flex items-center gap-4">
              <a
                href="/dashboard"
                className="text-sm text-gray-700 hover:text-[#0067ac]"
              >
                Dashboard
              </a>
              <LogoutButton />
            </div>
          </div>
        </div>
      </nav>

      <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
        <div className="rounded-lg bg-white shadow-md border p-8 space-y-6" style={{ borderColor: '#E77817' }}>
          <div>
            <h2 className="text-xl font-bold mb-2" style={{ color: '#0067ac' }}>Auth User</h2>
            <pre className="bg-gray-100 p-4 rounded text-xs overflow-auto">
              {JSON.stringify(user, null, 2)}
            </pre>
          </div>

          <div>
            <h2 className="text-xl font-bold mb-2" style={{ color: '#0067ac' }}>User Profile</h2>
            {profileError ? (
              <div className="bg-red-50 p-4 rounded border border-red-200">
                <p className="text-sm text-red-800">
                  <strong>Error:</strong> {getErrorMessage(profileError)}
                </p>
                <p className="text-sm text-red-600 mt-2">
                  <strong>Error Code:</strong> {(profileError as any)?.code || 'N/A'}
                </p>
                <p className="text-sm text-red-600 mt-2">
                  <strong>Error Details:</strong> {JSON.stringify(profileError, null, 2)}
                </p>
                <p className="text-sm text-red-600 mt-2">
                  This usually means the user_profiles table doesn't exist or RLS is blocking access.
                  Make sure you've run the schema.sql file in Supabase SQL Editor.
                </p>
                <p className="text-sm text-blue-600 mt-3 font-semibold">
                  Try running fix-rls-policies.sql to fix RLS policies
                </p>
              </div>
            ) : profile ? (
              <div>
                <p className="text-sm text-green-600 mb-2">✓ Profile found successfully</p>
                <pre className="bg-gray-100 p-4 rounded text-xs overflow-auto">
                  {JSON.stringify(profile, null, 2)}
                </pre>
              </div>
            ) : (
              <div className="bg-yellow-50 p-4 rounded border border-yellow-200">
                <p className="text-sm text-yellow-800">
                  <strong>Warning:</strong> No profile returned, but no error either.
                </p>
                <p className="text-sm text-yellow-700 mt-2">
                  This might indicate an RLS policy issue. The query executed but returned no rows.
                  Check your RLS policies in Supabase.
                </p>
              </div>
            )}
          </div>

          <div>
            <h2 className="text-xl font-bold mb-2" style={{ color: '#0067ac' }}>Users Query Test</h2>
            {usersError ? (
              <div className="bg-red-50 p-4 rounded border border-red-200">
                <p className="text-sm text-red-800">
                  <strong>Error:</strong> {getErrorMessage(usersError)}
                </p>
                <p className="text-sm text-red-600 mt-2">
                  Details: {JSON.stringify(usersError, null, 2)}
                </p>
              </div>
            ) : (
              <div>
                <p className="text-sm text-gray-600 mb-2">Found {users?.length || 0} users</p>
                <pre className="bg-gray-100 p-4 rounded text-xs overflow-auto">
                  {JSON.stringify(users, null, 2)}
                </pre>
              </div>
            )}
          </div>

          <div>
            <h2 className="text-xl font-bold mb-2" style={{ color: '#0067ac' }}>Projects Query Test</h2>
            {projectsError ? (
              <div className="bg-red-50 p-4 rounded border border-red-200">
                <p className="text-sm text-red-800">
                  <strong>Error:</strong> {getErrorMessage(projectsError)}
                </p>
                <p className="text-sm text-red-600 mt-2">
                  Details: {JSON.stringify(projectsError, null, 2)}
                </p>
              </div>
            ) : (
              <div>
                <p className="text-sm text-gray-600 mb-2">Found {projects?.length || 0} projects</p>
                <pre className="bg-gray-100 p-4 rounded text-xs overflow-auto">
                  {JSON.stringify(projects, null, 2)}
                </pre>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}

