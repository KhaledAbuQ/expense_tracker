import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import SetupBanner from './SetupBanner'
import { isSupabaseConfigured } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

export default function Layout() {
  const { session, member, loading, refreshMember } = useAuth()

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar />
      <main className="flex-1 overflow-auto">
        <div className="p-8">
          {!isSupabaseConfigured && <SetupBanner />}
          {isSupabaseConfigured && !!session && !loading && !member && (
            <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <span>
                Your account is signed in, but we could not find your household profile. Please contact your admin or sign out and sign up again.
              </span>
              <button
                type="button"
                onClick={refreshMember}
                className="rounded-lg border border-amber-300 bg-white px-3 py-1 text-xs font-medium text-amber-700 hover:bg-amber-100"
              >
                Retry
              </button>
            </div>
          )}
          <Outlet />
        </div>
      </main>
    </div>
  )
}
