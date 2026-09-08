import { useState, useEffect } from 'react'
import { Outlet, useLocation, NavLink } from 'react-router-dom'
import { Menu, Wallet, LayoutDashboard, Receipt, TrendingUp, ArrowRightLeft, MoreHorizontal } from 'lucide-react'
import Sidebar from './Sidebar'
import SetupBanner from './SetupBanner'
import ResetPasswordModal from './ResetPasswordModal'
import ThemeToggle from './ThemeToggle'
import { isSupabaseConfigured } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

export default function Layout() {
  const { session, member, loading, refreshMember, isPasswordRecovery, setIsPasswordRecovery } = useAuth()
  const [mobileOpen, setMobileOpen] = useState(false)
  const location = useLocation()

  // Close mobile drawer on navigation
  useEffect(() => {
    setMobileOpen(false)
  }, [location.pathname])

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && mobileOpen) {
        setMobileOpen(false)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [mobileOpen])

  return (
    <div className="min-h-screen md:h-screen bg-gray-50 dark:bg-gray-950 flex flex-col md:flex-row md:overflow-hidden">
      <Sidebar mobileOpen={mobileOpen} onCloseMobile={() => setMobileOpen(false)} />

      {/* Mobile Top Header */}
      <header className="md:hidden flex items-center justify-between px-4 py-3 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 sticky top-0 z-30 shadow-sm shrink-0">
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            className="p-2 -ml-2 rounded-lg text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500"
            aria-label="Open navigation menu"
          >
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-indigo-600 rounded-lg shrink-0">
              <Wallet className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-gray-900 dark:text-white text-sm">Expense Tracker</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          {member && (
            <div className="text-xs font-medium text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 px-2.5 py-1 rounded-full truncate max-w-[120px]">
              {member.name}
            </div>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto min-w-0 w-full">
        <div className="p-4 sm:p-6 lg:p-8 pb-24 md:pb-8 max-w-7xl mx-auto w-full">
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

      {/* Mobile Bottom Navigation Bar */}
      <nav
        aria-label="Mobile navigation"
        className="md:hidden fixed bottom-0 inset-x-0 bg-white/95 dark:bg-gray-900/95 backdrop-blur-md border-t border-gray-200 dark:border-gray-800 z-30 flex items-center justify-around h-16 px-1 safe-area-pb shadow-lg"
      >
        <NavLink
          to="/"
          className={({ isActive }) =>
            `flex flex-col items-center justify-center flex-1 py-1 px-1 transition-colors ${
              isActive
                ? 'text-indigo-600 dark:text-indigo-400 font-semibold'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
            }`
          }
        >
          <LayoutDashboard className="w-5 h-5" />
          <span className="text-[10px] mt-1">Dashboard</span>
        </NavLink>

        <NavLink
          to="/expenses"
          className={({ isActive }) =>
            `flex flex-col items-center justify-center flex-1 py-1 px-1 transition-colors ${
              isActive
                ? 'text-indigo-600 dark:text-indigo-400 font-semibold'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
            }`
          }
        >
          <Receipt className="w-5 h-5" />
          <span className="text-[10px] mt-1">Expenses</span>
        </NavLink>

        <NavLink
          to="/income"
          className={({ isActive }) =>
            `flex flex-col items-center justify-center flex-1 py-1 px-1 transition-colors ${
              isActive
                ? 'text-indigo-600 dark:text-indigo-400 font-semibold'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
            }`
          }
        >
          <TrendingUp className="w-5 h-5" />
          <span className="text-[10px] mt-1">Income</span>
        </NavLink>

        <NavLink
          to="/transfers"
          className={({ isActive }) =>
            `flex flex-col items-center justify-center flex-1 py-1 px-1 transition-colors ${
              isActive
                ? 'text-indigo-600 dark:text-indigo-400 font-semibold'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
            }`
          }
        >
          <ArrowRightLeft className="w-5 h-5" />
          <span className="text-[10px] mt-1">Transfers</span>
        </NavLink>

        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          className={`flex flex-col items-center justify-center flex-1 py-1 px-1 transition-colors ${
            ['/savings', '/members', '/categories'].includes(location.pathname)
              ? 'text-indigo-600 dark:text-indigo-400 font-semibold'
              : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
          }`}
          aria-label="More navigation options"
        >
          <MoreHorizontal className="w-5 h-5" />
          <span className="text-[10px] mt-1">More</span>
        </button>
      </nav>

      {isPasswordRecovery && (
        <ResetPasswordModal
          isOpen={isPasswordRecovery}
          onClose={() => setIsPasswordRecovery(false)}
        />
      )}
    </div>
  )
}

