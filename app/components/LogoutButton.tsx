'use client'

import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

export default function LogoutButton() {
  const router = useRouter()
  const supabase = createClient()

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <button
      onClick={handleLogout}
      className="rounded-md px-4 py-2 text-sm font-medium text-white focus:outline-none focus:ring-2 focus:ring-offset-2 transition-colors"
      style={{ 
        backgroundColor: '#E77817',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.backgroundColor = '#d66a15'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.backgroundColor = '#E77817'
      }}
      onFocus={(e) => {
        e.currentTarget.style.outline = '2px solid #E77817'
        e.currentTarget.style.outlineOffset = '2px'
      }}
      onBlur={(e) => {
        e.currentTarget.style.outline = 'none'
      }}
    >
      Logout
    </button>
  )
}

