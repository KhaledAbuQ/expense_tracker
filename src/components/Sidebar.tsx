import { useState } from 'react'
import { NavLink } from 'react-router-dom'
import { LayoutDashboard, Receipt, Tags, Wallet, TrendingUp, ArrowRightLeft, HandCoins, LogOut, UserCircle, Users, QrCode, X } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import QrCodeDisplayModal from './QrCodeDisplayModal'

const navItems = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/income', icon: TrendingUp, label: 'Income' },
  { to: '/expenses', icon: Receipt, label: 'Expenses' },
  { to: '/transfers', icon: ArrowRightLeft, label: 'Transfers' },
  { to: '/savings', icon: HandCoins, label: 'Savings' },
  { to: '/members', icon: Users, label: 'Members' },
  { to: '/categories', icon: Tags, label: 'Categories' },
]

interface SidebarProps {
  mobileOpen?: boolean
  onCloseMobile?: () => void
}

function SidebarContent({
  onLinkClick,
  onOpenQr,
}: {
  onLinkClick?: () => void
  onOpenQr: () => void
}) {
  const { member, signOut } = useAuth()

  return (
    <div className="flex flex-col h-full bg-white">
      <div className="p-5 sm:p-6 border-b border-gray-200 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-600 rounded-lg shrink-0">
            <Wallet className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="font-bold text-gray-900 leading-tight">Expense Tracker</h1>
            <p className="text-xs text-gray-500">Household Budget</p>
          </div>
        </div>
        {onLinkClick && (
          <button
            type="button"
            onClick={onLinkClick}
            className="md:hidden p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            aria-label="Close menu"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      <nav className="flex-1 p-4 overflow-y-auto">
        <ul className="space-y-1">
          {navItems.map(({ to, icon: Icon, label }) => (
            <li key={to}>
              <NavLink
                to={to}
                onClick={onLinkClick}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                    isActive
                      ? 'bg-indigo-50 text-indigo-600 font-semibold'
                      : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                  }`
                }
              >
                <Icon className="w-5 h-5 shrink-0" />
                <span className="font-medium">{label}</span>
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      <div className="p-4 border-t border-gray-200 space-y-3 shrink-0">
        <button
          type="button"
          onClick={onOpenQr}
          className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-lg border border-gray-200 bg-gray-50 hover:bg-gray-100 text-xs font-semibold text-gray-700 transition"
        >
          <QrCode className="w-4 h-4 text-indigo-600" />
          Connect Mobile App
        </button>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-gray-600 truncate mr-2">
            <UserCircle className="w-4 h-4 shrink-0" />
            <span className="truncate">{member?.name ?? 'Account'}</span>
          </div>
          <button
            type="button"
            onClick={signOut}
            className="p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-50 shrink-0"
            title="Sign out"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  )
}

export default function Sidebar({ mobileOpen = false, onCloseMobile }: SidebarProps) {
  const [showQrModal, setShowQrModal] = useState(false)

  const handleOpenQr = () => {
    setShowQrModal(true)
    if (onCloseMobile) onCloseMobile()
  }

  return (
    <>
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex w-64 bg-white border-r border-gray-200 flex-col shrink-0 h-screen sticky top-0">
        <SidebarContent onOpenQr={() => setShowQrModal(true)} />
      </aside>

      {/* Mobile Drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden" role="dialog" aria-modal="true">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-sm transition-opacity"
            onClick={onCloseMobile}
            aria-hidden="true"
          />

          {/* Drawer panel */}
          <div
            className="fixed inset-y-0 left-0 w-72 max-w-[85vw] bg-white shadow-2xl z-10 flex flex-col transform transition-transform"
          >
            <SidebarContent
              onLinkClick={onCloseMobile}
              onOpenQr={handleOpenQr}
            />
          </div>
        </div>
      )}

      {showQrModal && (
        <QrCodeDisplayModal
          isOpen={showQrModal}
          onClose={() => setShowQrModal(false)}
        />
      )}
    </>
  )
}
