import { useEffect, useState } from 'react'
import { App as NativeApp } from '@capacitor/app'
import {
  Plus,
  Wallet,
  RefreshCw,
  LogOut,
  ArrowLeft,
  Fingerprint,
  Lock,
  Receipt,
  TrendingUp,
  ArrowRightLeft,
  Coins,
  MoreHorizontal,
  ChevronRight,
  Users,
  Tag,
  BarChart3,
  Database,
  Sun,
  Moon,
  Trash2,
  Pencil,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { useAuth } from '../context/AuthContext'
import { useExpenses } from '../hooks/useExpenses'
import { useCategories } from '../hooks/useCategories'
import ExpenseForm from '../components/ExpenseForm'
import IncomePage from './Income'
import TransfersPage from './Transfers'
import SavingsPage from './Savings'
import CategoriesPage from './Categories'
import MembersPage from './Members'
import DashboardPage from './Dashboard'
import ServerConfigForm from '../components/ServerConfigForm'
import {
  calculateTotalExpenses,
  formatCurrency,
  formatDateShort,
  getDateRange,
  groupExpensesByCategory,
} from '../lib/utils'
import { syncExpenseWidget, ExpenseWidget } from '../lib/widget'
import { checkBiometricStatus, BiometricAuth, type BiometricAvailability } from '../lib/biometrics'
import ThemeToggle from '../components/ThemeToggle'
import type { Expense, ExpenseFormData } from '../types'

type MobileTab = 'expenses' | 'income' | 'transfers' | 'savings' | 'more'
type MoreSubView = 'root' | 'categories' | 'members' | 'dashboard' | 'server'

export default function Mobile({
  standalone = false,
  onLock,
}: {
  standalone?: boolean
  onLock?: () => void
}) {
  const { member, loading: profileLoading, refreshMember, signOut } = useAuth()
  const [activeTab, setActiveTab] = useState<MobileTab>('expenses')
  const [moreSubView, setMoreSubView] = useState<MoreSubView>('root')
  const [adding, setAdding] = useState(false)
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null)
  const [period, setPeriod] = useState<'month' | 'last-month' | 'week'>('month')
  const [visibility, setVisibility] = useState<'all' | 'private' | 'household'>('all')
  const [online, setOnline] = useState(navigator.onLine)
  const [saveError, setSaveError] = useState('')
  const [biometrics, setBiometrics] = useState<BiometricAvailability>({
    isAvailable: false,
    isEnrolled: false,
    hasSavedCredentials: false,
  })

  const {
    expenses,
    loading,
    error,
    fetchExpenses,
    addExpense,
    updateExpense,
    deleteExpense,
  } = useExpenses({
    dateRange: getDateRange(period),
    visibility: visibility === 'all' ? undefined : visibility,
  })
  const { categories, loading: categoriesLoading, error: categoriesError, fetchCategories } =
    useCategories()

  useEffect(() => {
    const update = () => setOnline(navigator.onLine)
    window.addEventListener('online', update)
    window.addEventListener('offline', update)
    return () => {
      window.removeEventListener('online', update)
      window.removeEventListener('offline', update)
    }
  }, [])

  // Android hardware back button handler
  useEffect(() => {
    if (!standalone) return
    const backListener = NativeApp.addListener('backButton', () => {
      if (adding || editingExpense) {
        setAdding(false)
        setEditingExpense(null)
      } else if (moreSubView !== 'root') {
        setMoreSubView('root')
      } else if (activeTab !== 'expenses') {
        setActiveTab('expenses')
      } else {
        void NativeApp.exitApp()
      }
    })
    return () => {
      void backListener.then((handle) => handle.remove())
    }
  }, [standalone, adding, editingExpense, moreSubView, activeTab])

  // Resume listener to auto-refresh expenses on foregrounding
  useEffect(() => {
    if (!standalone) return
    const resumeListener = NativeApp.addListener('resume', () => {
      if (navigator.onLine) void fetchExpenses()
    })
    return () => {
      void resumeListener.then((handle) => handle.remove())
    }
  }, [standalone, fetchExpenses])

  // Check biometrics status
  useEffect(() => {
    let mounted = true
    void checkBiometricStatus().then((status) => {
      if (mounted) setBiometrics(status)
    })
    return () => {
      mounted = false
    }
  }, [])

  // Check if opened from Android Widget "+ Add" button
  useEffect(() => {
    void ExpenseWidget.checkLaunchIntent()
      .then((res) => {
        if (res?.action === 'add_expense') {
          setActiveTab('expenses')
          setEditingExpense(null)
          setAdding(true)
        }
      })
      .catch(() => {})

    const sub = ExpenseWidget.addListener('widgetAction', (info) => {
      if (info?.action === 'add_expense') {
        setActiveTab('expenses')
        setEditingExpense(null)
        setAdding(true)
      }
    })

    return () => {
      void sub.then((h) => h.remove()).catch(() => {})
    }
  }, [])

  // Sync widget with latest spending stats whenever expenses update
  useEffect(() => {
    if (!expenses) return
    const currentMonthTotal = calculateTotalExpenses(expenses)
    const todayIso = new Date().toISOString().slice(0, 10)
    const todayExpenses = expenses.filter((e) => e.date === todayIso)
    const todayTotal = calculateTotalExpenses(todayExpenses)

    void syncExpenseWidget({
      monthTotal: formatCurrency(currentMonthTotal),
      expenseCount: expenses.length,
      todayTotal: formatCurrency(todayTotal),
    })
  }, [expenses])

  const handleToggleBiometrics = async () => {
    if (biometrics.hasSavedCredentials) {
      await BiometricAuth.clearCredentials()
      setBiometrics((prev) => ({ ...prev, hasSavedCredentials: false }))
      toast.success('Biometric login disabled on this device')
    } else {
      toast('To enable biometrics, check "Remember with Fingerprint" next time you sign in.', {
        icon: '🔐',
      })
    }
  }

  const saveExpense = async (data: ExpenseFormData) => {
    setSaveError('')
    if (!member || !navigator.onLine) {
      setSaveError('Connect to the internet and load your profile before saving.')
      return
    }
    try {
      if (editingExpense) {
        const { member_id: _ignored, ...editable } = data
        await updateExpense(editingExpense.id, editable)
      } else {
        await addExpense({ ...data, member_id: member.id })
      }
      setAdding(false)
      setEditingExpense(null)
      await fetchExpenses()
    } catch {
      setSaveError('Could not save your expense. Your entries are still here; please try again.')
    }
  }

  const handleDeleteExpense = async (id: string) => {
    if (!window.confirm('Delete this expense?')) return
    try {
      await deleteExpense(id)
      await fetchExpenses()
      toast.success('Expense deleted')
    } catch {
      toast.error('Could not delete expense')
    }
  }

  const total = calculateTotalExpenses(expenses)
  const breakdown = groupExpensesByCategory(expenses, categories)

  return (
    <div className="mobile-client min-h-dvh bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors">
      <div className="mx-auto max-w-2xl px-4 sm:px-6 pb-28 pt-4">
        {/* Top Header */}
        <header className="mb-6 flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-indigo-600 dark:text-indigo-400">
              Pocket expenses
            </p>
            <p className="mt-0.5 text-sm text-slate-500 dark:text-gray-400">
              {activeTab === 'expenses'
                ? member
                  ? `Hello, ${member.name}`
                  : 'Your daily spending'
                : activeTab === 'income'
                  ? 'Income & deposits'
                  : activeTab === 'transfers'
                    ? 'Account transfers & gold'
                    : activeTab === 'savings'
                      ? 'Savings & assets'
                      : 'Settings & household'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle
              variant="icon"
              className="rounded-full bg-white dark:bg-gray-800 p-2.5 shadow-sm text-slate-700 dark:text-gray-300 hover:text-indigo-600 dark:hover:text-indigo-400 transition"
            />
            {biometrics.isAvailable && (
              <button
                type="button"
                onClick={() => void handleToggleBiometrics()}
                aria-label={
                  biometrics.hasSavedCredentials ? 'Biometrics active' : 'Enable biometrics'
                }
                title={
                  biometrics.hasSavedCredentials
                    ? 'Biometric sign-in active on this device. Tap to disable.'
                    : 'Biometrics supported. Sign in with password to enable.'
                }
                className={`rounded-full p-2.5 shadow-sm transition ${
                  biometrics.hasSavedCredentials
                    ? 'bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 ring-1 ring-indigo-200 dark:ring-indigo-800'
                    : 'bg-white dark:bg-gray-800 text-slate-400 dark:text-gray-400'
                }`}
              >
                <Fingerprint size={19} />
              </button>
            )}
            {onLock && (
              <button
                type="button"
                onClick={onLock}
                aria-label="Lock app"
                title="Lock app with biometrics now"
                className="rounded-full bg-white dark:bg-gray-800 p-2.5 shadow-sm text-slate-500 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition"
              >
                <Lock size={19} />
              </button>
            )}
            <button
              type="button"
              onClick={() => void signOut()}
              aria-label="Sign out"
              className="rounded-full bg-white dark:bg-gray-800 p-2.5 shadow-sm text-slate-700 dark:text-gray-300 hover:text-red-600 dark:hover:text-red-400 transition"
            >
              <LogOut size={19} />
            </button>
          </div>
        </header>

        {!online && (
          <p
            role="status"
            className="mb-4 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 p-3.5 text-sm text-amber-800 dark:text-amber-200"
          >
            You’re offline. Connect to refresh or sync data.
          </p>
        )}

        {profileLoading ? (
          <p role="status" className="text-gray-500 dark:text-gray-400 py-12 text-center">
            Loading your profile…
          </p>
        ) : !member ? (
          <div className="rounded-2xl bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 p-5 shadow-sm">
            <p>Your household profile could not be loaded.</p>
            <button
              onClick={() => void refreshMember()}
              className="mt-3 font-medium text-indigo-600 dark:text-indigo-400"
            >
              Retry profile
            </button>
          </div>
        ) : (
          <>
            {/* TAB: EXPENSES */}
            {activeTab === 'expenses' && (
              <>
                {adding || editingExpense ? (
                  <section className="rounded-3xl bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 p-5 shadow-sm">
                    <button
                      onClick={() => {
                        setAdding(false)
                        setEditingExpense(null)
                      }}
                      className="mb-5 flex items-center gap-2 text-sm text-slate-500 dark:text-gray-400 hover:text-slate-700 dark:hover:text-gray-200"
                    >
                      <ArrowLeft size={18} /> Overview
                    </button>
                    <h1 className="mb-5 text-2xl font-bold text-slate-900 dark:text-white">
                      {editingExpense ? 'Edit expense' : 'Add expense'}
                    </h1>
                    {saveError && (
                      <p
                        role="alert"
                        className="mb-4 rounded-xl bg-red-50 dark:bg-red-950/40 p-3 text-sm text-red-700 dark:text-red-400"
                      >
                        {saveError}
                      </p>
                    )}
                    {categoriesLoading ? (
                      <p role="status" className="text-gray-500 dark:text-gray-400">
                        Loading categories…
                      </p>
                    ) : categoriesError ? (
                      <div role="alert">
                        <p>Could not load categories.</p>
                        <button
                          onClick={() => void fetchCategories()}
                          className="py-3 text-indigo-600 dark:text-indigo-400"
                        >
                          Try again
                        </button>
                      </div>
                    ) : (
                      <ExpenseForm
                        categories={categories}
                        initialData={editingExpense || undefined}
                        onSubmit={saveExpense}
                        onCancel={() => {
                          setAdding(false)
                          setEditingExpense(null)
                        }}
                      />
                    )}
                  </section>
                ) : (
                  <div className="space-y-5">
                    <div className="flex items-center justify-between">
                      <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Overview</h1>
                      <button
                        disabled={loading || !online}
                        onClick={() => void fetchExpenses()}
                        aria-label="Refresh expenses"
                        className="rounded-full bg-white dark:bg-gray-800 p-2.5 shadow-sm text-slate-700 dark:text-gray-300 disabled:opacity-40 hover:text-indigo-600 dark:hover:text-indigo-400 transition"
                      >
                        <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
                      </button>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <select
                        aria-label="Period"
                        value={period}
                        onChange={(e) => setPeriod(e.target.value as typeof period)}
                        className="rounded-xl border border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-slate-900 dark:text-white px-3 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500"
                      >
                        <option value="month">This month</option>
                        <option value="last-month">Last month</option>
                        <option value="week">This week</option>
                      </select>
                      <select
                        aria-label="Visibility"
                        value={visibility}
                        onChange={(e) => setVisibility(e.target.value as typeof visibility)}
                        className="rounded-xl border border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-slate-900 dark:text-white px-3 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500"
                      >
                        <option value="all">All visible</option>
                        <option value="private">Personal</option>
                        <option value="household">Household</option>
                      </select>
                    </div>

                    {error ? (
                      <div
                        role="alert"
                        className="rounded-2xl bg-red-50 dark:bg-red-950/40 p-5 text-red-700 dark:text-red-400"
                      >
                        Could not load expenses.{' '}
                        <button onClick={() => void fetchExpenses()} className="underline">
                          Try again
                        </button>
                      </div>
                    ) : loading ? (
                      <p
                        role="status"
                        className="py-12 text-center text-slate-500 dark:text-gray-400"
                      >
                        Loading expenses…
                      </p>
                    ) : (
                      <>
                        <section className="rounded-3xl bg-indigo-600 dark:bg-indigo-700 p-6 text-white shadow-lg shadow-indigo-100 dark:shadow-none">
                          <Wallet className="mb-4 opacity-75" size={26} />
                          <p className="text-xs uppercase font-medium tracking-wider text-indigo-100">
                            Total spent
                          </p>
                          <p className="mt-2 break-words text-3xl font-bold tracking-tight">
                            {formatCurrency(total)}
                          </p>
                          <p className="mt-3 text-xs text-indigo-100">
                            {expenses.length} {expenses.length === 1 ? 'expense' : 'expenses'} ·{' '}
                            {visibility === 'all'
                              ? 'Personal + shared spending'
                              : visibility === 'private'
                                ? 'Personal spending'
                                : 'Shared household spending'}
                          </p>
                        </section>

                        <section className="rounded-3xl bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 p-5 shadow-sm">
                          <h2 className="mb-4 font-semibold text-slate-900 dark:text-white">
                            By category
                          </h2>
                          {breakdown.length === 0 ? (
                            <p className="text-sm text-slate-500 dark:text-gray-400">
                              Add your first expense to see where your money goes.
                            </p>
                          ) : (
                            <div className="space-y-4">
                              {breakdown.map((item) => (
                                <div key={item.name}>
                                  <div className="mb-2 flex justify-between gap-3 text-sm">
                                    <span className="text-slate-700 dark:text-gray-300">
                                      {item.name}
                                    </span>
                                    <span className="font-medium text-slate-900 dark:text-white">
                                      {formatCurrency(item.value)}
                                    </span>
                                  </div>
                                  <div className="h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-gray-700">
                                    <div
                                      className="h-full rounded-full bg-indigo-500"
                                      style={{
                                        width: `${total > 0 ? (item.value / total) * 100 : 0}%`,
                                      }}
                                    />
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </section>

                        <section className="rounded-3xl bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 p-5 shadow-sm">
                          <h2 className="mb-2 font-semibold text-slate-900 dark:text-white">
                            Recent expenses
                          </h2>
                          {expenses.length === 0 ? (
                            <p className="py-4 text-sm text-slate-500 dark:text-gray-400">
                              No expenses in this period.
                            </p>
                          ) : (
                            <ul className="divide-y divide-slate-100 dark:divide-gray-700">
                              {expenses.slice(0, 25).map((expense) => (
                                <li
                                  key={expense.id}
                                  className="flex items-start justify-between gap-3 py-3.5"
                                >
                                  <div className="min-w-0">
                                    <p className="break-words text-sm font-medium text-slate-900 dark:text-white">
                                      {expense.description ||
                                        expense.category?.name ||
                                        'Expense'}
                                    </p>
                                    <p className="mt-0.5 text-xs text-slate-500 dark:text-gray-400">
                                      {formatDateShort(expense.date)} ·{' '}
                                      {expense.category?.name || 'Uncategorized'}
                                    </p>
                                    <p className="mt-0.5 text-xs text-slate-400 dark:text-gray-500">
                                      {expense.visibility === 'private'
                                        ? 'Personal'
                                        : `Shared · ${expense.member?.name || 'Household'}`}{' '}
                                      · {expense.account_type === 'bank' ? 'Bank' : 'Cash'}
                                    </p>
                                  </div>
                                  <div className="flex items-center gap-1.5 shrink-0">
                                    <span className="font-semibold text-sm text-slate-900 dark:text-white">
                                      {formatCurrency(Number(expense.amount))}
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setEditingExpense(expense)
                                        setAdding(false)
                                      }}
                                      className="p-1.5 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 rounded-lg transition"
                                      title="Edit expense"
                                    >
                                      <Pencil size={15} />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => void handleDeleteExpense(expense.id)}
                                      className="p-1.5 text-slate-400 hover:text-red-600 dark:hover:text-red-400 rounded-lg transition"
                                      title="Delete expense"
                                    >
                                      <Trash2 size={15} />
                                    </button>
                                  </div>
                                </li>
                              ))}
                            </ul>
                          )}
                          {expenses.length > 25 && (
                            <p className="mt-3 text-xs text-slate-500 dark:text-gray-400">
                              Showing the 25 most recent expenses.
                            </p>
                          )}
                        </section>
                      </>
                    )}
                  </div>
                )}

                {/* Quick Add Expense Action Button */}
                {!adding && !editingExpense && (
                  <div className="fixed inset-x-0 bottom-16 z-20 pointer-events-none px-4 pb-2">
                    <button
                      disabled={!member || profileLoading || !online}
                      onClick={() => {
                        setSaveError('')
                        setEditingExpense(null)
                        setAdding(true)
                      }}
                      className="pointer-events-auto mx-auto flex min-h-12 w-full max-w-lg items-center justify-center gap-2 rounded-2xl bg-indigo-600 py-3 font-semibold text-white shadow-lg shadow-indigo-600/30 hover:bg-indigo-700 active:bg-indigo-800 transition disabled:opacity-40"
                    >
                      <Plus size={20} /> Add expense
                    </button>
                  </div>
                )}
              </>
            )}

            {/* TAB: INCOME */}
            {activeTab === 'income' && <IncomePage />}

            {/* TAB: TRANSFERS */}
            {activeTab === 'transfers' && <TransfersPage />}

            {/* TAB: SAVINGS */}
            {activeTab === 'savings' && <SavingsPage />}

            {/* TAB: MORE & SETTINGS */}
            {activeTab === 'more' && (
              <>
                {moreSubView === 'root' && (
                  <div className="space-y-4">
                    <div>
                      <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
                        More & Settings
                      </h1>
                      <p className="text-sm text-slate-500 dark:text-gray-400 mt-1">
                        Manage categories, household members, charts, and device preferences.
                      </p>
                    </div>

                    <div className="rounded-2xl bg-white dark:bg-gray-800 border border-slate-100 dark:border-gray-700 divide-y divide-slate-100 dark:divide-gray-700 overflow-hidden shadow-sm">
                      <button
                        type="button"
                        onClick={() => setMoreSubView('categories')}
                        className="w-full flex items-center justify-between p-4 hover:bg-slate-50 dark:hover:bg-gray-700/50 transition text-left"
                      >
                        <div className="flex items-center gap-3.5">
                          <div className="p-2.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400">
                            <Tag size={20} />
                          </div>
                          <div>
                            <p className="font-semibold text-sm text-slate-900 dark:text-white">
                              Categories
                            </p>
                            <p className="text-xs text-slate-500 dark:text-gray-400 mt-0.5">
                              Customize spending and income categories, icons & colors
                            </p>
                          </div>
                        </div>
                        <ChevronRight size={18} className="text-slate-400 dark:text-gray-500" />
                      </button>

                      <button
                        type="button"
                        onClick={() => setMoreSubView('members')}
                        className="w-full flex items-center justify-between p-4 hover:bg-slate-50 dark:hover:bg-gray-700/50 transition text-left"
                      >
                        <div className="flex items-center gap-3.5">
                          <div className="p-2.5 rounded-xl bg-purple-50 dark:bg-purple-950/50 text-purple-600 dark:text-purple-400">
                            <Users size={20} />
                          </div>
                          <div>
                            <p className="font-semibold text-sm text-slate-900 dark:text-white">
                              Household & Members
                            </p>
                            <p className="text-xs text-slate-500 dark:text-gray-400 mt-0.5">
                              Invite codes, member roles, and household sharing
                            </p>
                          </div>
                        </div>
                        <ChevronRight size={18} className="text-slate-400 dark:text-gray-500" />
                      </button>

                      <button
                        type="button"
                        onClick={() => setMoreSubView('dashboard')}
                        className="w-full flex items-center justify-between p-4 hover:bg-slate-50 dark:hover:bg-gray-700/50 transition text-left"
                      >
                        <div className="flex items-center gap-3.5">
                          <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400">
                            <BarChart3 size={20} />
                          </div>
                          <div>
                            <p className="font-semibold text-sm text-slate-900 dark:text-white">
                              Analytics & Charts
                            </p>
                            <p className="text-xs text-slate-500 dark:text-gray-400 mt-0.5">
                              Cumulative spending, pie charts, and monthly comparisons
                            </p>
                          </div>
                        </div>
                        <ChevronRight size={18} className="text-slate-400 dark:text-gray-500" />
                      </button>

                      <button
                        type="button"
                        onClick={() => setMoreSubView('server')}
                        className="w-full flex items-center justify-between p-4 hover:bg-slate-50 dark:hover:bg-gray-700/50 transition text-left"
                      >
                        <div className="flex items-center gap-3.5">
                          <div className="p-2.5 rounded-xl bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400">
                            <Database size={20} />
                          </div>
                          <div>
                            <p className="font-semibold text-sm text-slate-900 dark:text-white">
                              Database Server
                            </p>
                            <p className="text-xs text-slate-500 dark:text-gray-400 mt-0.5">
                              Supabase connection & scan QR code from desktop
                            </p>
                          </div>
                        </div>
                        <ChevronRight size={18} className="text-slate-400 dark:text-gray-500" />
                      </button>
                    </div>

                    {/* Device & Account settings */}
                    <div className="rounded-2xl bg-white dark:bg-gray-800 border border-slate-100 dark:border-gray-700 divide-y divide-slate-100 dark:divide-gray-700 overflow-hidden shadow-sm">
                      <div className="flex items-center justify-between p-4">
                        <div className="flex items-center gap-3.5">
                          <div className="p-2.5 rounded-xl bg-slate-100 dark:bg-gray-700 text-slate-700 dark:text-gray-200">
                            <Sun size={20} className="dark:hidden" />
                            <Moon size={20} className="hidden dark:block" />
                          </div>
                          <div>
                            <p className="font-semibold text-sm text-slate-900 dark:text-white">
                              Appearance
                            </p>
                            <p className="text-xs text-slate-500 dark:text-gray-400 mt-0.5">
                              Toggle light / dark theme
                            </p>
                          </div>
                        </div>
                        <ThemeToggle />
                      </div>

                      {biometrics.isAvailable && (
                        <div className="flex items-center justify-between p-4">
                          <div className="flex items-center gap-3.5">
                            <div className="p-2.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400">
                              <Fingerprint size={20} />
                            </div>
                            <div>
                              <p className="font-semibold text-sm text-slate-900 dark:text-white">
                                Biometric Unlock
                              </p>
                              <p className="text-xs text-slate-500 dark:text-gray-400 mt-0.5">
                                {biometrics.hasSavedCredentials
                                  ? 'Fingerprint / Face active'
                                  : 'Disabled on this device'}
                              </p>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => void handleToggleBiometrics()}
                            className={`px-3 py-1.5 rounded-full text-xs font-semibold transition ${
                              biometrics.hasSavedCredentials
                                ? 'bg-indigo-600 text-white hover:bg-indigo-700'
                                : 'bg-slate-100 dark:bg-gray-700 text-slate-700 dark:text-gray-300 hover:bg-slate-200 dark:hover:bg-gray-600'
                            }`}
                          >
                            {biometrics.hasSavedCredentials ? 'Active' : 'Enable'}
                          </button>
                        </div>
                      )}

                      {onLock && (
                        <button
                          type="button"
                          onClick={onLock}
                          className="w-full flex items-center justify-between p-4 hover:bg-slate-50 dark:hover:bg-gray-700/50 transition text-left"
                        >
                          <div className="flex items-center gap-3.5">
                            <div className="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400">
                              <Lock size={20} />
                            </div>
                            <div>
                              <p className="font-semibold text-sm text-slate-900 dark:text-white">
                                Lock App
                              </p>
                              <p className="text-xs text-slate-500 dark:text-gray-400 mt-0.5">
                                Require biometrics to re-enter
                              </p>
                            </div>
                          </div>
                          <ChevronRight size={18} className="text-slate-400 dark:text-gray-500" />
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => void signOut()}
                        className="w-full flex items-center justify-between p-4 hover:bg-red-50/50 dark:hover:bg-red-950/30 transition text-left"
                      >
                        <div className="flex items-center gap-3.5">
                          <div className="p-2.5 rounded-xl bg-red-50 dark:bg-red-950/50 text-red-600 dark:text-red-400">
                            <LogOut size={20} />
                          </div>
                          <div>
                            <p className="font-semibold text-sm text-red-600 dark:text-red-400">
                              Sign Out
                            </p>
                            <p className="text-xs text-slate-500 dark:text-gray-400 mt-0.5">
                              {member ? `Signed in as ${member.name}` : 'Sign out of current account'}
                            </p>
                          </div>
                        </div>
                      </button>
                    </div>

                    {!standalone && (
                      <div className="pt-2 text-center">
                        <a
                          href="/"
                          className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline font-medium"
                        >
                          Switch to Desktop View
                        </a>
                      </div>
                    )}

                    <div className="pt-4 text-center text-xs text-slate-400 dark:text-gray-500">
                      <p className="font-semibold">Pocket Expenses · v1.3.0</p>
                      <p className="mt-0.5 text-[11px]">Clean & Minimalist Household Edition</p>
                    </div>
                  </div>
                )}

                {moreSubView === 'categories' && (
                  <div>
                    <button
                      type="button"
                      onClick={() => setMoreSubView('root')}
                      className="mb-4 inline-flex items-center gap-2 rounded-xl bg-white dark:bg-gray-800 border border-slate-200 dark:border-gray-700 px-3.5 py-2 text-xs font-semibold text-slate-700 dark:text-gray-200 shadow-sm hover:bg-slate-50 dark:hover:bg-gray-700 transition"
                    >
                      <ArrowLeft size={16} /> Back to More
                    </button>
                    <CategoriesPage />
                  </div>
                )}

                {moreSubView === 'members' && (
                  <div>
                    <button
                      type="button"
                      onClick={() => setMoreSubView('root')}
                      className="mb-4 inline-flex items-center gap-2 rounded-xl bg-white dark:bg-gray-800 border border-slate-200 dark:border-gray-700 px-3.5 py-2 text-xs font-semibold text-slate-700 dark:text-gray-200 shadow-sm hover:bg-slate-50 dark:hover:bg-gray-700 transition"
                    >
                      <ArrowLeft size={16} /> Back to More
                    </button>
                    <MembersPage />
                  </div>
                )}

                {moreSubView === 'dashboard' && (
                  <div>
                    <button
                      type="button"
                      onClick={() => setMoreSubView('root')}
                      className="mb-4 inline-flex items-center gap-2 rounded-xl bg-white dark:bg-gray-800 border border-slate-200 dark:border-gray-700 px-3.5 py-2 text-xs font-semibold text-slate-700 dark:text-gray-200 shadow-sm hover:bg-slate-50 dark:hover:bg-gray-700 transition"
                    >
                      <ArrowLeft size={16} /> Back to More
                    </button>
                    <DashboardPage />
                  </div>
                )}

                {moreSubView === 'server' && (
                  <div>
                    <button
                      type="button"
                      onClick={() => setMoreSubView('root')}
                      className="mb-4 inline-flex items-center gap-2 rounded-xl bg-white dark:bg-gray-800 border border-slate-200 dark:border-gray-700 px-3.5 py-2 text-xs font-semibold text-slate-700 dark:text-gray-200 shadow-sm hover:bg-slate-50 dark:hover:bg-gray-700 transition"
                    >
                      <ArrowLeft size={16} /> Back to More
                    </button>
                    <ServerConfigForm
                      onCancel={() => setMoreSubView('root')}
                      onSaved={() => setMoreSubView('root')}
                    />
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>

      {/* Sleek Minimalist Mobile Bottom Navigation Bar */}
      <nav
        aria-label="Mobile navigation"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200/80 dark:border-gray-800 bg-white/95 dark:bg-gray-900/95 backdrop-blur-md px-2 py-1.5 safe-area-pb shadow-lg"
      >
        <div className="mx-auto flex max-w-lg items-center justify-around">
          <button
            type="button"
            onClick={() => {
              setActiveTab('expenses')
              setMoreSubView('root')
            }}
            className={`flex flex-col items-center justify-center flex-1 py-1 px-1 transition-colors ${
              activeTab === 'expenses'
                ? 'text-indigo-600 dark:text-indigo-400 font-semibold'
                : 'text-slate-500 dark:text-gray-400 hover:text-slate-900 dark:hover:text-gray-200'
            }`}
          >
            <Receipt className="w-5 h-5" />
            <span className="text-[10px] mt-1">Expenses</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab('income')
              setMoreSubView('root')
            }}
            className={`flex flex-col items-center justify-center flex-1 py-1 px-1 transition-colors ${
              activeTab === 'income'
                ? 'text-indigo-600 dark:text-indigo-400 font-semibold'
                : 'text-slate-500 dark:text-gray-400 hover:text-slate-900 dark:hover:text-gray-200'
            }`}
          >
            <TrendingUp className="w-5 h-5" />
            <span className="text-[10px] mt-1">Income</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab('transfers')
              setMoreSubView('root')
            }}
            className={`flex flex-col items-center justify-center flex-1 py-1 px-1 transition-colors ${
              activeTab === 'transfers'
                ? 'text-indigo-600 dark:text-indigo-400 font-semibold'
                : 'text-slate-500 dark:text-gray-400 hover:text-slate-900 dark:hover:text-gray-200'
            }`}
          >
            <ArrowRightLeft className="w-5 h-5" />
            <span className="text-[10px] mt-1">Transfers</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab('savings')
              setMoreSubView('root')
            }}
            className={`flex flex-col items-center justify-center flex-1 py-1 px-1 transition-colors ${
              activeTab === 'savings'
                ? 'text-indigo-600 dark:text-indigo-400 font-semibold'
                : 'text-slate-500 dark:text-gray-400 hover:text-slate-900 dark:hover:text-gray-200'
            }`}
          >
            <Coins className="w-5 h-5" />
            <span className="text-[10px] mt-1">Savings</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab('more')
              setMoreSubView('root')
            }}
            className={`flex flex-col items-center justify-center flex-1 py-1 px-1 transition-colors ${
              activeTab === 'more'
                ? 'text-indigo-600 dark:text-indigo-400 font-semibold'
                : 'text-slate-500 dark:text-gray-400 hover:text-slate-900 dark:hover:text-gray-200'
            }`}
          >
            <MoreHorizontal className="w-5 h-5" />
            <span className="text-[10px] mt-1">More</span>
          </button>
        </div>
      </nav>
    </div>
  )
}
