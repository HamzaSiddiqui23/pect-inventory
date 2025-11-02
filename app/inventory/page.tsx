import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getInventory } from '@/lib/actions/inventory'
import { getStores } from '@/lib/actions/purchases'
import Image from 'next/image'
import LogoutButton from '@/app/components/LogoutButton'
import InventoryView from '@/app/components/InventoryView'
import { getErrorMessage } from '@/lib/utils/errors'

export default async function InventoryPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('role, project_id')
    .eq('id', user.id)
    .single()

  if (!profile) {
    redirect('/login')
  }

  const isAdmin = profile.role === 'admin'
  
  // Get stores - admins see all, others see their own
  const { data: stores } = await getStores()
  
  // Get inventory - admins get all, others get their store only
  let storeId: string | undefined = undefined
  
  if (!isAdmin) {
    // For non-admins, show their store only
    storeId = stores?.[0]?.id
  }
  // For admins, storeId is undefined to show all stores
  
  const { data: inventory, error } = await getInventory(storeId)

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
            Inventory
          </h2>
        </div>

        {error && (
          <div className="mb-4 rounded-md bg-red-50 p-4 border border-red-200">
            <div className="text-sm text-red-800">
              <strong>Error loading inventory:</strong> {getErrorMessage(error)}
            </div>
          </div>
        )}

        <InventoryView 
          initialInventory={inventory || []} 
          stores={stores || []} 
          isAdmin={isAdmin}
          currentStoreId={storeId}
        />
      </main>
    </div>
  )
}

