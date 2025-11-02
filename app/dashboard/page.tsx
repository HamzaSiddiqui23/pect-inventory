import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import LogoutButton from '@/app/components/LogoutButton'
import Image from 'next/image'

export default async function DashboardPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Get user profile to check role
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  const isAdmin = profile?.role === 'admin'

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
              <span className="text-sm text-gray-700">
                {user.email}
              </span>
              <LogoutButton />
            </div>
          </div>
        </div>
      </nav>

      <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
        <div className="rounded-lg bg-white shadow-md border p-8" style={{ borderColor: '#E77817' }}>
          <h2 className="text-2xl font-bold mb-4" style={{ color: '#0067ac' }}>
            Dashboard
          </h2>
          <p className="text-gray-600 mb-6">
            Welcome to the inventory management system. Manage your projects, users, and inventory from here.
          </p>

          {isAdmin && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-8">
              <a
                href="/users"
                className="block p-6 border-2 rounded-lg hover:shadow-lg transition-shadow"
                style={{ borderColor: '#0067ac' }}
              >
                <h3 className="text-xl font-semibold mb-2" style={{ color: '#0067ac' }}>
                  User Management
                </h3>
                <p className="text-gray-600 text-sm">
                  Create and manage users with different roles (Admin, Central Store Manager, Project Store Manager)
                </p>
              </a>

              <a
                href="/projects"
                className="block p-6 border-2 rounded-lg hover:shadow-lg transition-shadow"
                style={{ borderColor: '#0067ac' }}
              >
                <h3 className="text-xl font-semibold mb-2" style={{ color: '#0067ac' }}>
                  Project Management
                </h3>
                <p className="text-gray-600 text-sm">
                  Create and manage construction projects. Each project can have its own store.
                </p>
              </a>

              <a
                href="/categories"
                className="block p-6 border-2 rounded-lg hover:shadow-lg transition-shadow"
                style={{ borderColor: '#0067ac' }}
              >
                <h3 className="text-xl font-semibold mb-2" style={{ color: '#0067ac' }}>
                  Categories
                </h3>
                <p className="text-gray-600 text-sm">
                  Manage product categories for organizing inventory items.
                </p>
              </a>

              <a
                href="/products"
                className="block p-6 border-2 rounded-lg hover:shadow-lg transition-shadow"
                style={{ borderColor: '#0067ac' }}
              >
                <h3 className="text-xl font-semibold mb-2" style={{ color: '#0067ac' }}>
                  Products
                </h3>
                <p className="text-gray-600 text-sm">
                  Manage product master data with categories and units of measurement.
                </p>
              </a>

              <a
                href="/purchases"
                className="block p-6 border-2 rounded-lg hover:shadow-lg transition-shadow"
                style={{ borderColor: '#0067ac' }}
              >
                <h3 className="text-xl font-semibold mb-2" style={{ color: '#0067ac' }}>
                  Purchases
                </h3>
                <p className="text-gray-600 text-sm">
                  View and manage purchase history for central store inventory.
                </p>
              </a>

              <a
                href="/inventory"
                className="block p-6 border-2 rounded-lg hover:shadow-lg transition-shadow"
                style={{ borderColor: '#0067ac' }}
              >
                <h3 className="text-xl font-semibold mb-2" style={{ color: '#0067ac' }}>
                  Inventory
                </h3>
                <p className="text-gray-600 text-sm">
                  View current inventory levels across all stores with average costs.
                </p>
              </a>

              <a
                href="/issues"
                className="block p-6 border-2 rounded-lg hover:shadow-lg transition-shadow"
                style={{ borderColor: '#0067ac' }}
              >
                <h3 className="text-xl font-semibold mb-2" style={{ color: '#0067ac' }}>
                  Issue Items
                </h3>
                <p className="text-gray-600 text-sm">
                  Issue items from stores to projects or other stores. Track all issuances.
                </p>
              </a>

              <a
                href="/reports"
                className="block p-6 border-2 rounded-lg hover:shadow-lg transition-shadow"
                style={{ borderColor: '#0067ac' }}
              >
                <h3 className="text-xl font-semibold mb-2" style={{ color: '#0067ac' }}>
                  Reports
                </h3>
                <p className="text-gray-600 text-sm">
                  View detailed reports for purchases, issuances, and inventory costs across all time periods.
                </p>
              </a>
            </div>
          )}

          {(profile?.role === 'central_store_manager' || profile?.role === 'project_store_manager') && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-8">
              <a
                href="/issues"
                className="block p-6 border-2 rounded-lg hover:shadow-lg transition-shadow"
                style={{ borderColor: '#0067ac' }}
              >
                <h3 className="text-xl font-semibold mb-2" style={{ color: '#0067ac' }}>
                  Issue Items
                </h3>
                <p className="text-gray-600 text-sm">
                  Issue items from your store to projects or other stores.
                </p>
              </a>

              <a
                href="/inventory"
                className="block p-6 border-2 rounded-lg hover:shadow-lg transition-shadow"
                style={{ borderColor: '#0067ac' }}
              >
                <h3 className="text-xl font-semibold mb-2" style={{ color: '#0067ac' }}>
                  Inventory
                </h3>
                <p className="text-gray-600 text-sm">
                  View current inventory levels for your store.
                </p>
              </a>

              <a
                href="/reports"
                className="block p-6 border-2 rounded-lg hover:shadow-lg transition-shadow"
                style={{ borderColor: '#0067ac' }}
              >
                <h3 className="text-xl font-semibold mb-2" style={{ color: '#0067ac' }}>
                  Reports
                </h3>
                <p className="text-gray-600 text-sm">
                  View reports for purchases, issuances, and inventory costs.
                </p>
              </a>
            </div>
          )}

          {!isAdmin && (
            <div className="mt-8">
              <p className="text-sm text-gray-500">
                Inventory features will be available here based on your role.
              </p>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}

