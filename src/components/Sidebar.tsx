import { useState } from 'react'
import { NavLink } from 'react-router-dom'
import { LayoutDashboard, Receipt, Tags, Wallet, TrendingUp, ArrowRightLeft, HandCoins, LogOut, UserCircle, Users, QrCode } from 'lucide-react'
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

export default function Sidebar() {
  const { member, signOut } = useAuth()
  const [showQrModal, setShowQrModal] = useState(false)


  return (
    <aside className="w-64 bg-white border-r border-gray-200 flex flex-col">
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-600 rounded-lg">
            <Wallet className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="font-bold text-gray-900">Expense Tracker</h1>
            <p className="text-xs text-gray-500">Household Budget</p>
          </div>
        </div>
      </div>
      
      <nav className="flex-1 p-4">
        <ul className="space-y-1">
          {navItems.map(({ to, icon: Icon, label }) => (
            <li key={to}>
              <NavLink
                to={to}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                    isActive
                      ? 'bg-indigo-50 text-indigo-600'
                      : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                  }`
                }
              >
                <Icon className="w-5 h-5" />
                <span className="font-medium">{label}</span>
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
      
      <div className="p-4 border-t border-gray-200 space-y-3">
        <button
          type="button"
          onClick={() => setShowQrModal(true)}
          className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-lg border border-gray-200 bg-gray-50 hover:bg-gray-100 text-xs font-semibold text-gray-700 transition"
        >
          <QrCode className="w-4 h-4 text-indigo-600" />
          Connect Mobile App
        </button>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-gray-600 truncate">
            <UserCircle className="w-4 h-4 shrink-0" />
            <span className="truncate">{member?.name ?? 'Account'}</span>
          </div>
          <button
            type="button"
            onClick={signOut}
            className="p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-50"
            title="Sign out"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>

      {showQrModal && (
        <QrCodeDisplayModal
          isOpen={showQrModal}
          onClose={() => setShowQrModal(false)}
        />
      )}
    </aside>
  )
}
