import { useEffect, useState } from 'react'
import { App as NativeApp } from '@capacitor/app'
import { Link } from 'react-router-dom'
import { Plus, Wallet, RefreshCw, LogOut, ArrowLeft, Fingerprint, Lock } from 'lucide-react'
import toast from 'react-hot-toast'
import { useAuth } from '../context/AuthContext'
import { useExpenses } from '../hooks/useExpenses'
import { useCategories } from '../hooks/useCategories'
import ExpenseForm from '../components/ExpenseForm'
import { calculateTotalExpenses, formatCurrency, formatDateShort, getDateRange, groupExpensesByCategory } from '../lib/utils'
import { syncExpenseWidget, ExpenseWidget } from '../lib/widget'
import { checkBiometricStatus, BiometricAuth, type BiometricAvailability } from '../lib/biometrics'
import type { ExpenseFormData } from '../types'

export default function Mobile({
  standalone = false,
  onLock,
}: {
  standalone?: boolean
  onLock?: () => void
}) {
  const { member, loading: profileLoading, refreshMember, signOut } = useAuth()
  const [adding, setAdding] = useState(false)
  const [period, setPeriod] = useState<'month' | 'last-month' | 'week'>('month')
  const [visibility, setVisibility] = useState<'all' | 'private' | 'household'>('all')
  const [online, setOnline] = useState(navigator.onLine)
  const [saveError, setSaveError] = useState('')
  const [biometrics, setBiometrics] = useState<BiometricAvailability>({
    isAvailable: false,
    isEnrolled: false,
    hasSavedCredentials: false,
  })
  const { expenses, loading, error, fetchExpenses, addExpense } = useExpenses({
    dateRange: getDateRange(period), visibility: visibility === 'all' ? undefined : visibility,
  })
  const { categories, loading: categoriesLoading, error: categoriesError, fetchCategories } = useCategories()

  useEffect(() => {
    const update = () => setOnline(navigator.onLine)
    window.addEventListener('online', update)
    window.addEventListener('offline', update)
    return () => {
      window.removeEventListener('online', update)
      window.removeEventListener('offline', update)
    }
  }, [])

  useEffect(() => {
    if (!standalone) return
    const backListener = NativeApp.addListener('backButton', () => {
      if (adding) setAdding(false)
      else void NativeApp.exitApp()
    })
    return () => { void backListener.then(handle => handle.remove()) }
  }, [standalone, adding])

  useEffect(() => {
    if (!standalone) return
    const resumeListener = NativeApp.addListener('resume', () => {
      if (navigator.onLine) void fetchExpenses()
    })
    return () => { void resumeListener.then(handle => handle.remove()) }
  }, [standalone, fetchExpenses])

  // Check biometrics status
  useEffect(() => {
    let mounted = true
    void checkBiometricStatus().then(status => {
      if (mounted) setBiometrics(status)
    })
    return () => {
      mounted = false
    }
  }, [])

  // Check if opened from Android Widget "+ Add" button
  useEffect(() => {
    void ExpenseWidget.checkLaunchIntent()
      .then(res => {
        if (res?.action === 'add_expense') {
          setAdding(true)
        }
      })
      .catch(() => {})

    const sub = ExpenseWidget.addListener('widgetAction', info => {
      if (info?.action === 'add_expense') {
        setAdding(true)
      }
    })

    return () => {
      void sub.then(h => h.remove()).catch(() => {})
    }
  }, [])

  // Sync widget with latest spending stats whenever expenses update
  useEffect(() => {
    if (!expenses) return
    const currentMonthTotal = calculateTotalExpenses(expenses)
    const todayIso = new Date().toISOString().slice(0, 10)
    const todayExpenses = expenses.filter(e => e.date === todayIso)
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
      setBiometrics(prev => ({ ...prev, hasSavedCredentials: false }))
      toast.success('Biometric login disabled on this device')
    } else {
      toast('To enable biometrics, check "Remember with Fingerprint" next time you sign in.', { icon: '🔐' })
    }
  }

  const save = async (data: ExpenseFormData) => {
    setSaveError('')
    if (!member || !navigator.onLine) {
      setSaveError('Connect to the internet and load your profile before saving.')
      return
    }
    try {
      await addExpense({ ...data, member_id: member.id })
      setAdding(false)
      // Reload so date ordering and the selected period remain accurate.
      await fetchExpenses()
    } catch {
      setSaveError('Could not save your expense. Your entries are still here; please try again.')
    }
  }

  const total = calculateTotalExpenses(expenses)
  const breakdown = groupExpensesByCategory(expenses, categories)

  return (
    <div className="mobile-client min-h-dvh bg-slate-50 text-slate-900">
      <div className="mx-auto max-w-lg px-5 pb-28 pt-6">
        <header className="mb-8 flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-indigo-600">Pocket expenses</p>
            <p className="mt-1 text-sm text-slate-500">{member ? `Hello, ${member.name}` : 'Your daily spending, together'}</p>
          </div>
          <div className="flex items-center gap-2">
            {biometrics.isAvailable && (
              <button
                type="button"
                onClick={() => void handleToggleBiometrics()}
                aria-label={biometrics.hasSavedCredentials ? 'Biometrics active' : 'Enable biometrics'}
                title={
                  biometrics.hasSavedCredentials
                    ? 'Biometric sign-in active on this device. Tap to disable.'
                    : 'Biometrics supported. Sign in with password to enable.'
                }
                className={`rounded-full p-3 shadow-sm transition ${
                  biometrics.hasSavedCredentials
                    ? 'bg-indigo-50 text-indigo-600 ring-1 ring-indigo-200'
                    : 'bg-white text-slate-400'
                }`}
              >
                <Fingerprint size={20} />
              </button>
            )}
            {onLock && (
              <button
                type="button"
                onClick={onLock}
                aria-label="Lock app"
                title="Lock app with biometrics now"
                className="rounded-full bg-white p-3 shadow-sm text-slate-500 hover:text-indigo-600 transition"
              >
                <Lock size={20} />
              </button>
            )}
            <button onClick={() => void signOut()} aria-label="Sign out" className="rounded-full bg-white p-3 shadow-sm"><LogOut size={20} /></button>
          </div>
        </header>

        {!online && <p role="status" className="mb-4 rounded-xl bg-amber-50 p-4 text-sm text-amber-800">You’re offline. Connect to refresh or save expenses.</p>}
        {profileLoading ? <p role="status">Loading your profile…</p> : !member ? (
          <div className="rounded-2xl bg-white p-5">
            <p>Your household profile could not be loaded.</p>
            <button onClick={() => void refreshMember()} className="mt-3 font-medium text-indigo-600">Retry profile</button>
          </div>
        ) : adding ? (
          <section className="rounded-3xl bg-white p-5 shadow-sm">
            <button onClick={() => setAdding(false)} className="mb-5 flex items-center gap-2 text-sm text-slate-500"><ArrowLeft size={18} /> Overview</button>
            <h1 className="mb-5 text-2xl font-bold">Add expense</h1>
            {saveError && <p role="alert" className="mb-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{saveError}</p>}
            {categoriesLoading ? <p role="status">Loading categories…</p> : categoriesError ? (
              <div role="alert"><p>Could not load categories.</p><button onClick={() => void fetchCategories()} className="py-3 text-indigo-600">Try again</button></div>
            ) : <ExpenseForm categories={categories} onSubmit={save} onCancel={() => setAdding(false)} />}
          </section>
        ) : (
          <div className="space-y-5">
            <div className="flex items-center justify-between">
              <h1 className="text-2xl font-bold">Overview</h1>
              <button disabled={loading || !online} onClick={() => void fetchExpenses()} aria-label="Refresh expenses" className="rounded-full bg-white p-3 disabled:opacity-40"><RefreshCw size={19} className={loading ? 'animate-spin' : ''} /></button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <select aria-label="Period" value={period} onChange={e => setPeriod(e.target.value as typeof period)} className="rounded-xl border border-slate-200 bg-white px-3 py-3">
                <option value="month">This month</option><option value="last-month">Last month</option><option value="week">This week</option>
              </select>
              <select aria-label="Visibility" value={visibility} onChange={e => setVisibility(e.target.value as typeof visibility)} className="rounded-xl border border-slate-200 bg-white px-3 py-3">
                <option value="all">All visible</option><option value="private">Personal</option><option value="household">Household</option>
              </select>
            </div>
            {error ? <div role="alert" className="rounded-2xl bg-red-50 p-5 text-red-700">Could not load expenses. <button onClick={() => void fetchExpenses()} className="underline">Try again</button></div> : loading ? <p role="status" className="py-12 text-center text-slate-500">Loading expenses…</p> : <>
              <section className="rounded-3xl bg-indigo-600 p-6 text-white shadow-lg shadow-indigo-100">
                <Wallet className="mb-5 opacity-70" size={26} />
                <p className="text-sm text-indigo-100">Total spent</p>
                <p className="mt-2 break-words text-3xl font-bold tracking-tight">{formatCurrency(total)}</p>
                <p className="mt-4 text-sm text-indigo-100">{expenses.length} {expenses.length === 1 ? 'expense' : 'expenses'} · {visibility === 'all' ? 'Your personal + shared household spending' : visibility === 'private' ? 'Your personal spending' : 'Shared household spending'}</p>
              </section>
              <section className="rounded-3xl bg-white p-5 shadow-sm">
                <h2 className="mb-4 font-semibold">By category</h2>
                {breakdown.length === 0 ? <p className="text-sm text-slate-500">Add your first expense to see where your money goes.</p> : <div className="space-y-4">{breakdown.map(item => <div key={item.name}>
                  <div className="mb-2 flex justify-between gap-3 text-sm"><span>{item.name}</span><span className="font-medium">{formatCurrency(item.value)}</span></div>
                  <div className="h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-indigo-500" style={{ width: `${total > 0 ? item.value / total * 100 : 0}%` }} /></div>
                </div>)}</div>}
              </section>
              <section className="rounded-3xl bg-white p-5 shadow-sm">
                <h2 className="mb-2 font-semibold">Recent expenses</h2>
                {expenses.length === 0 ? <p className="py-4 text-sm text-slate-500">No expenses in this period.</p> : <ul className="divide-y divide-slate-100">{expenses.slice(0, 20).map(expense => <li key={expense.id} className="flex items-start justify-between gap-3 py-4">
                  <div className="min-w-0"><p className="break-words text-sm font-medium">{expense.description || expense.category?.name || 'Expense'}</p><p className="mt-1 text-xs text-slate-500">{formatDateShort(expense.date)} · {expense.category?.name || 'Uncategorized'}</p><p className="mt-1 text-xs text-slate-400">{expense.visibility === 'private' ? 'Personal' : `Shared · ${expense.member?.name || 'Household'}`} · {expense.account_type === 'bank' ? 'Bank' : 'Cash'}</p></div>
                  <span className="shrink-0 text-sm font-semibold">{formatCurrency(Number(expense.amount))}</span>
                </li>)}</ul>}
                {expenses.length > 20 && <p className="mt-3 text-xs text-slate-500">Showing the 20 most recent expenses. Totals include all expenses in this period.</p>}
              </section>
            </>}
            {!standalone && <Link to="/" className="block py-3 text-center text-sm text-slate-500 underline">Open full dashboard</Link>}
          </div>
        )}
      </div>
      {!adding && <div className="mobile-action fixed inset-x-0 bottom-0 border-t border-slate-100 bg-white/95 px-5 pt-3">
        <button disabled={!member || profileLoading || !online} onClick={() => { setSaveError(''); setAdding(true) }} className="mx-auto flex min-h-12 w-full max-w-md items-center justify-center gap-2 rounded-2xl bg-indigo-600 py-3 font-semibold text-white disabled:opacity-40"><Plus size={20} /> Add expense</button>
      </div>}
    </div>
  )
}
