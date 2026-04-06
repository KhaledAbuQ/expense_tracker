import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import SetupBanner from './SetupBanner'
import { isSupabaseConfigured } from '../lib/supabase'

export default function Layout() {
  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar />
      <main className="flex-1 overflow-auto">
        <div className="p-8">
          {!isSupabaseConfigured && <SetupBanner />}
          <Outlet />
        </div>
      </main>
    </div>
  )
}
