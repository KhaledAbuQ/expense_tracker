import RapidTapPeek from '../components/RapidTapPeek'
import { SAVINGS_PLAN_CHANGED, readSavingsPlan } from '../lib/savingsPlan'
import { useGoldPrice } from '../hooks/useGoldPrice'
import { calculateGoldFineGrams, valueOfFineGrams } from '../lib/gold'
import { useEffect, useLayoutEffect, useState, useCallback, useRef } from 'react'
import { App as NativeApp } from '@capacitor/app'
import { addDays, format, startOfMonth, startOfWeek, subMonths } from 'date-fns'
import {
  Wallet,
  LogOut,
  ArrowLeft,
  Fingerprint,
  Lock,
  Receipt,
  TrendingUp,
  ArrowRightLeft,
  Coins,
  ChevronRight,
  Users,
  Tag,
  Database,
  Sun,
  Moon,
  Trash2,
  MessageSquare,
  Home,
  Settings,
  Bell,
  Vibrate,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { useAuth } from '../context/AuthContext'
import { useExpenses } from '../hooks/useExpenses'
import { useCategories } from '../hooks/useCategories'
import { useIncome } from '../hooks/useIncome'
import { useTransfers } from '../hooks/useTransfers'
import ExpenseForm from '../components/ExpenseForm'
import BankSmsTrackerModal from '../components/BankSmsTrackerModal'
import IncomePage from './Income'
import TransfersPage from './Transfers'
import SavingsPage from './Savings'
import CategoriesPage from './Categories'
import MembersPage from './Members'
import MoneyMascot from '../components/MoneyMascot'
import { celebrateMoney } from '../lib/moneyCelebration'
import MobileHome from '../components/MobileHome'
import MobileExpenses from '../components/MobileExpenses'
import ServerConfigForm from '../components/ServerConfigForm'
import {
  calculateTotalExpenses,
  formatCurrency,
  getDateRange,
} from '../lib/utils'
import { syncExpenseWidget, ExpenseWidget } from '../lib/widget'
import { checkBiometricStatus, BiometricAuth, type BiometricAvailability } from '../lib/biometrics'
import {
  subscribeToIncomingSms,
  fetchPendingBackgroundTransactions,
  getSmsSettings,
  markTransactionProcessed,
  checkLaunchApprovalIntent,
  subscribeToApprovalIntent,
  getPendingSmsTransactions,
  savePendingSmsTransactions,
  isTransactionProcessed,
} from '../lib/bankSms'
import { matchCategory, type ParsedBankTransaction } from '../lib/smsParser'
import ThemeToggle from '../components/ThemeToggle'
import { getHapticsEnabled, setHapticsEnabled, feedback } from '../lib/haptics'
import type { Expense, ExpenseFormData, IncomeFormData } from '../types'

type MobileTab = 'home' | 'expenses' | 'income' | 'more'
type MoreSubView = 'root' | 'transfers' | 'savings' | 'categories' | 'members' | 'server'

export default function Mobile({
  standalone = false,
  onLock,
}: {
  standalone?: boolean
  onLock?: () => void
}) {
  const { member, loading: profileLoading, refreshMember, signOut } = useAuth()
  const [activeTab, setActiveTab] = useState<MobileTab>('home')
  const [moreSubView, setMoreSubView] = useState<MoreSubView>('root')

  useLayoutEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' })
  }, [activeTab, moreSubView])
  const [adding, setAdding] = useState(false)
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null)
  const [period, setPeriod] = useState<'month' | 'last-month' | 'week'>('month')
  const [visibility, setVisibility] = useState<'all' | 'private' | 'household'>('all')
  const [online, setOnline] = useState(navigator.onLine)
  const [saveError, setSaveError] = useState('')
  const [smsModalOpen, setSmsModalOpen] = useState(false)
  const [reportOpen, setReportOpen] = useState(false)
  const [smsModalTab, setSmsModalTab] = useState<'pending' | 'settings'>('pending')
  const [savingsGoalRequested, setSavingsGoalRequested] = useState(0)
  const [savingsPlanRevision, setSavingsPlanRevision] = useState(0)
  const { price: widgetGoldPrice } = useGoldPrice()
  useEffect(() => {
    const update = () => setSavingsPlanRevision(value => value + 1)
    window.addEventListener(SAVINGS_PLAN_CHANGED, update)
    return () => window.removeEventListener(SAVINGS_PLAN_CHANGED, update)
  }, [])
  const [pendingSmsTxs, setPendingSmsTxs] = useState(getPendingSmsTransactions)
  const processingSms = useRef(new Set<string>())
  const [hapticsEnabled, setHapticsPreference] = useState(getHapticsEnabled)
  const { addIncome, income: widgetIncome, loading: widgetIncomeLoading, error: widgetIncomeError } = useIncome()
  const { transfers: widgetTransfers, loading: widgetTransfersLoading, error: widgetTransfersError } = useTransfers()
  const { expenses: widgetExpenses, loading: widgetLoading, error: widgetError } = useExpenses()

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
    dateRange: activeTab === 'expenses' ? undefined : getDateRange(period),
    visibility: visibility === 'all' ? undefined : visibility,
  })
  const { categories, loading: categoriesLoading, error: categoriesError, fetchCategories } =
    useCategories()

  const categoriesRef = useRef(categories)
  useEffect(() => {
    categoriesRef.current = categories
    setPendingSmsTxs(items => items.map(tx => {
      if (!getSmsSettings().autoDetectCategory) return { ...tx, categoryGuess: 'Choose a category', suggestedCategoryId: undefined, isAutoDetected: false }
      const result = matchCategory(tx.merchant, tx.rawBody, tx.type, categories, tx.sender)
      return { ...tx, categoryGuess: result.categoryGuess, suggestedCategoryId: result.categoryId, isAutoDetected: result.isAutoDetected }
    }))
  }, [categories])

  useEffect(() => { savePendingSmsTransactions(pendingSmsTxs) }, [pendingSmsTxs])

  useEffect(() => {
    if (!member) return
    for (const tx of pendingSmsTxs) {
      if (tx.type === 'income' && tx.isFinancial) celebrateMoney('income', tx.amount, `${member.id}:sms:${tx.smsId}`)
    }
  }, [pendingSmsTxs, member])

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
      if (smsModalOpen) {
        setSmsModalOpen(false)
      } else if (reportOpen) {
        setReportOpen(false)
      } else if (adding || editingExpense) {
        setAdding(false)
        setEditingExpense(null)
      } else if (moreSubView !== 'root') {
        setMoreSubView('root')
      } else if (activeTab !== 'home') {
        setActiveTab('home')
      } else {
        void NativeApp.exitApp()
      }
    })
    return () => {
      void backListener.then((handle) => handle.remove())
    }
  }, [standalone, adding, editingExpense, moreSubView, activeTab, smsModalOpen, reportOpen])

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

  // Handle widget shortcuts on cold launch and while the app is running.
  useEffect(() => {
    const openWidgetAction = (action: string | null) => {
      if (!action) return
      setReportOpen(false)
      if (action === 'add_expense') {
        setActiveTab('expenses'); setEditingExpense(null); setAdding(true)
      } else if (action === 'transfers') {
        setActiveTab('more'); setMoreSubView('transfers'); setAdding(false)
      } else if (action === 'income') {
        setActiveTab('income'); setAdding(false)
      } else if (action === 'savings' || action === 'savings_goal') {
        setSavingsGoalRequested(action === 'savings_goal' ? Date.now() : 0)
        setActiveTab('more'); setMoreSubView('savings'); setAdding(false)
      } else if (action === 'expenses') {
        setActiveTab('expenses'); setAdding(false); setEditingExpense(null)
      } else if (action === 'home') {
        setActiveTab('home'); setMoreSubView('root'); setAdding(false)
      }
    }
    void ExpenseWidget.checkLaunchIntent().then(res => openWidgetAction(res.action)).catch(() => {})
    const sub = ExpenseWidget.addListener('widgetAction', info => openWidgetAction(info.action))
    return () => { void sub.then(handle => handle.remove()).catch(() => {}) }
  }, [])

  // Keep widget data independent of the screen's period and visibility filters.
  useEffect(() => {
    if (!member || widgetLoading || widgetError || widgetIncomeLoading || widgetIncomeError || widgetTransfersLoading || widgetTransfersError) return
    const todayIso = format(new Date(), 'yyyy-MM-dd')
    const mine = widgetExpenses.filter(expense => expense.member_id === member.id)
    const monthExpenses = mine.filter(expense => expense.date.startsWith(todayIso.slice(0, 7)) && expense.date <= todayIso)
    const groups = new Map<string, { name: string; icon: string; total: number }>()
    monthExpenses.forEach(expense => {
      const key = expense.category_id || 'other'
      const category = groups.get(key) || { name: expense.category?.name || 'Other', icon: expense.category?.icon || 'tag', total: 0 }
      category.total += Number(expense.amount)
      groups.set(key, category)
    })
    const top = [...groups.values()].sort((a, b) => b.total - a.total).slice(0, 2)
    const now = new Date()
    const balance = (account: 'bank' | 'cash' | 'savings') => widgetIncome.filter(row => row.member_id === member.id && row.date <= todayIso && row.account_type === account).reduce((sum, row) => sum + Number(row.amount), 0)
      - calculateTotalExpenses(mine.filter(row => row.date <= todayIso && row.account_type === account))
      + widgetTransfers.filter(row => row.member_id === member.id && row.date <= todayIso).reduce((sum, row) => sum + (row.to_account === account ? Number(row.amount) : 0) - (row.from_account === account ? Number(row.amount) : 0), 0)
    const recent = [...mine].filter(row => row.date <= todayIso).sort((a, b) => b.date.localeCompare(a.date) || b.created_at.localeCompare(a.created_at))[0]
    const myIncome = widgetIncome.filter(row => row.member_id === member.id && row.date <= todayIso)
    const monthIncome = myIncome.filter(row => row.date.startsWith(todayIso.slice(0, 7)))
    const incomeAmount = (rows: typeof myIncome) => rows.reduce((sum, row) => sum + Number(row.amount), 0)
    const categories = [...groups.values()].sort((a, b) => b.total - a.total)
    const weekStart = startOfWeek(now, { weekStartsOn: 1 })
    const savingsPlan = readSavingsPlan(member.id)
    const savingsTotal = balance('savings') + valueOfFineGrams(calculateGoldFineGrams(widgetTransfers.filter(row => row.member_id === member.id && row.date <= todayIso)), widgetGoldPrice)
    const snapshot = {
      monthName: format(now, 'MMMM').toUpperCase(), dateLabel: format(now, 'MMM, d'), weekday: format(now, 'EEEE'),
      monthIncome: incomeAmount(monthIncome), monthNet: incomeAmount(monthIncome) - calculateTotalExpenses(monthExpenses),
      availableAmount: balance('bank') + balance('cash'), savingsAmount: savingsTotal, savingsGoal: Math.max(0, Number(savingsPlan.goalAmount) || 0), savingsGoalBalance: savingsPlan.currentSavings !== '' ? Math.max(0, Number(savingsPlan.currentSavings) || 0) : savingsTotal, bankAmount: balance('bank'),
      todayAmount: calculateTotalExpenses(mine.filter(row => row.date === todayIso)),
      todayCount: mine.filter(row => row.date === todayIso).length,
      todayMerchants: mine.filter(row => row.date === todayIso).slice(0, 3).map(row => row.description || row.category?.name || 'Expense'),
      categories,
      weekNet: Array.from({ length: 4 }, (_, i) => {
        const inWeek = (date: string) => date.startsWith(todayIso.slice(0, 7)) && Number(date.slice(8)) >= i * 7 + 1 && Number(date.slice(8)) <= (i === 3 ? 31 : (i + 1) * 7)
        return { label: `Week ${i + 1}`, value: incomeAmount(monthIncome.filter(row => inWeek(row.date))) - calculateTotalExpenses(monthExpenses.filter(row => inWeek(row.date))) }
      }),
      monthAmount: calculateTotalExpenses(monthExpenses),
      recent: recent ? `${recent.description || recent.category?.name || 'Expense'} · ${formatCurrency(Number(recent.amount))}` : 'No purchases yet',
      bank: formatCurrency(balance('bank')), cash: formatCurrency(balance('cash')), available: formatCurrency(balance('bank') + balance('cash')),
      months: Array.from({ length: 6 }, (_, i) => {
        const date = subMonths(startOfMonth(now), 5 - i)
        const key = format(date, 'yyyy-MM')
        return { label: format(date, 'MMM'), value: calculateTotalExpenses(mine.filter(row => row.date.startsWith(key) && row.date <= todayIso)) }
      }),
      week: Array.from({ length: 7 }, (_, i) => {
        const date = addDays(weekStart, i)
        const key = format(date, 'yyyy-MM-dd')
        return { label: format(date, 'EEE'), value: key <= todayIso ? calculateTotalExpenses(mine.filter(row => row.date === key)) : 0, earned: incomeAmount(myIncome.filter(row => row.date === key)), future: key > todayIso }
      }),
    }
    void syncExpenseWidget({
      snapshot: JSON.stringify(snapshot),
      monthTotal: formatCurrency(calculateTotalExpenses(monthExpenses)),
      expenseCount: monthExpenses.length,
      todayTotal: formatCurrency(calculateTotalExpenses(mine.filter(expense => expense.date === todayIso))),
      diningTotal: formatCurrency(top[0]?.total || 0),
      groceryTotal: formatCurrency(top[1]?.total || 0),
      firstCategoryName: top[0]?.name || 'Dining Out',
      secondCategoryName: top[1]?.name || 'Groceries',
      firstCategoryIcon: top[0]?.icon || 'utensils',
      secondCategoryIcon: top[1]?.icon || 'shopping-cart',
    })
  }, [widgetExpenses, widgetLoading, widgetError, widgetIncome, widgetIncomeLoading, widgetIncomeError, widgetTransfers, widgetTransfersLoading, widgetTransfersError, member, widgetGoldPrice, savingsPlanRevision])

  const handleToggleBiometrics = async () => {
    if (biometrics.hasSavedCredentials) {
      await BiometricAuth.clearCredentials()
      setBiometrics((prev) => ({ ...prev, hasSavedCredentials: false }))
      toast.success('Biometric login disabled on this device')
    } else {
      toast('To enable biometrics, check "Remember with Fingerprint / Face Unlock" next time you sign in.', {
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
      setEditingExpense(null)
      toast.success('Expense deleted')
    } catch {
      toast.error('Could not delete expense')
    }
  }

  const saveSmsExpense = async (data: ExpenseFormData) => {
    if (!member || !navigator.onLine) throw new Error('Connect to the internet before approving transactions.')
    await addExpense({ ...data, member_id: member.id }, { silent: true })
  }

  const saveIncome = async (data: IncomeFormData) => {
    if (!member || !navigator.onLine) throw new Error('Connect to the internet before approving transactions.')
    await addIncome({ ...data, member_id: member.id }, { silent: true })
  }

  // Check if opened from notification approval intent & listen for runtime triggers
  useEffect(() => {
    void checkLaunchApprovalIntent().then(openApproval => {
      if (openApproval) {
        setSmsModalTab('pending')
        setSmsModalOpen(true)
      }
    })
    const unsub = subscribeToApprovalIntent(() => {
      setSmsModalTab('pending')
      setSmsModalOpen(true)
    })
    return () => {
      unsub()
    }
  }, [])

  // Handle incoming or background SMS transactions (both expenses and income)
  const processIncomingTransaction = useCallback(async (tx: ParsedBankTransaction) => {
    const settings = getSmsSettings()
    if (!settings.enabled || isTransactionProcessed(tx.smsId) || processingSms.current.has(tx.smsId)) return

    if (member && tx.type === 'income') celebrateMoney('income', tx.amount, `${member.id}:sms:${tx.smsId}`)

    if (settings.mode === 'auto' && tx.isAutoDetected && tx.suggestedCategoryId && member && navigator.onLine) {
      processingSms.current.add(tx.smsId)
      try {
        if (tx.type === 'income') {
          await addIncome({
            amount: tx.amount,
            description: tx.merchant,
            category_id: tx.suggestedCategoryId,
            visibility: settings.defaultVisibility,
            date: tx.date,
            account_type: 'bank',
            member_id: member.id,
          }, { silent: true, celebrate: false })
          markTransactionProcessed(tx.smsId)
        } else {
          await addExpense({
            amount: tx.amount,
            description: tx.merchant,
            category_id: tx.suggestedCategoryId,
            visibility: settings.defaultVisibility,
            date: tx.date,
            account_type: 'bank',
            member_id: member.id,
          }, { silent: true })
          markTransactionProcessed(tx.smsId)
        }
        await fetchExpenses()
      } catch (err) {
        console.error('Failed to auto-save SMS transaction:', err)
        setPendingSmsTxs(prev => [...prev.filter(item => item.smsId !== tx.smsId), tx])
      } finally {
        processingSms.current.delete(tx.smsId)
      }
    } else {
      setPendingSmsTxs(prev => {
        if (prev.some(item => item.id === tx.id || item.smsId === tx.smsId)) return prev
        return [tx, ...prev]
      })
      // Pending bank transactions stay in the review inbox; the native notification
      // provides the alert without stacking app toasts over the screen.
    }
  }, [member, addExpense, addIncome, fetchExpenses])

  const checkPendingBackgroundSms = useCallback(async () => {
    try {
      const pending = await fetchPendingBackgroundTransactions(categoriesRef.current)
      for (const tx of pending) {
        void processIncomingTransaction(tx)
      }
    } catch {
      // ignore
    }
  }, [processIncomingTransaction])

  useEffect(() => {
    if (!member || categoriesLoading || categoriesError) return
    void checkPendingBackgroundSms()
    const resume = NativeApp.addListener('resume', () => { void checkPendingBackgroundSms() })
    const unsubscribe = subscribeToIncomingSms(tx => {
      void processIncomingTransaction(tx)
    }, () => categoriesRef.current)
    return () => {
      unsubscribe()
      void resume.then(handle => handle.remove())
    }
  }, [checkPendingBackgroundSms, processIncomingTransaction, member, categoriesLoading, categoriesError])

  // Android holds SMS received while the app is backgrounded in a native queue.
  // Refresh it on every inbox open so opening the notification reveals the new items.
  useEffect(() => {
    if (!smsModalOpen || !member || categoriesLoading || categoriesError) return
    void checkPendingBackgroundSms()
  }, [smsModalOpen, member, categoriesLoading, categoriesError, checkPendingBackgroundSms])


  const mobileHeader = <header className="monetra-header mb-6 flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#5267f5] text-white"><Wallet size={19} /></span>
            <div className="min-w-0">
              <p className="text-base font-semibold text-slate-900 dark:text-white">{activeTab === 'home' ? 'Pocket Expenses' : activeTab === 'expenses' ? 'Expenses' : activeTab === 'income' ? 'Income' : 'Your finances'}</p>

            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button type="button" onClick={() => { setSmsModalTab('pending'); setSmsModalOpen(true) }} aria-label="Review bank transactions" className="relative flex h-10 w-10 items-center justify-center rounded-full bg-white text-slate-700 dark:bg-gray-800 dark:text-gray-200">
              <Bell size={19} />
              {pendingSmsTxs.length > 0 && <span className="absolute -right-1 -top-1 rounded-full bg-[#e95235] px-1.5 text-[10px] font-bold text-white">{pendingSmsTxs.length}</span>}
            </button>
            <button type="button" aria-current={activeTab === 'more' ? 'page' : undefined} onClick={() => { setReportOpen(false); setActiveTab('more'); setMoreSubView('root') }} aria-label="Settings and household tools" className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-slate-700 dark:bg-gray-800 dark:text-gray-200"><Settings size={19} /></button>
          </div>
        </header>

  return (
    <div className={`mobile-client ${activeTab === 'home' ? 'monetra-home-screen' : activeTab === 'expenses' && !adding && !editingExpense ? 'monetra-tool-screen monetra-expenses-screen' : 'monetra-tool-screen'} min-h-dvh bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100`}>
      <div className="monetra-shell mx-auto max-w-2xl px-4 sm:px-6 pb-28 pt-4">
        {activeTab !== 'home' && !(activeTab === 'expenses' && !adding && !editingExpense) && mobileHeader}

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
            {activeTab === 'home' && <MobileHome
              header={mobileHeader}
              reportOpen={reportOpen}
              onOpenReport={() => setReportOpen(true)}
              onCloseReport={() => setReportOpen(false)}
              onAdd={() => { setActiveTab('expenses'); setSaveError(''); setEditingExpense(null); setAdding(true) }}
              onExpenses={() => setActiveTab('expenses')}
              onIncome={() => setActiveTab('income')}
              onSavings={() => { setSavingsGoalRequested(0); setActiveTab('more'); setMoreSubView('savings') }}
              onTransfers={() => { setActiveTab('more'); setMoreSubView('transfers') }}
              onCategories={() => { setActiveTab('more'); setMoreSubView('categories') }}
            />}

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
                    {editingExpense && <button type="button" data-haptic="impact" className="mt-5 flex items-center gap-2 text-sm text-red-600" onClick={() => void handleDeleteExpense(editingExpense.id)}><Trash2 size={16} /> Delete expense</button>}
                  </section>
                ) : (
                  <MobileExpenses
                    expenses={expenses}
                    categories={categories}
                    loading={loading}
                    error={error}
                    online={online}
                    period={period}
                    visibility={visibility}
                    pendingCount={pendingSmsTxs.length}
                    onPeriod={setPeriod}
                    onVisibility={setVisibility}
                    onRefresh={() => void fetchExpenses()}
                    onAdd={() => { setSaveError(''); setEditingExpense(null); setAdding(true) }}
                    onEdit={expense => { setSaveError(''); setEditingExpense(expense); setAdding(false) }}
                    onReview={() => { setSmsModalTab('pending'); setSmsModalOpen(true) }}
                    onSettings={() => { setActiveTab('more'); setMoreSubView('root') }}
                  />
                )}

              </>
            )}

            {/* TAB: INCOME */}
            {activeTab === 'income' && <IncomePage />}

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
                        Transfers, savings, categories, and household tools.
                      </p>
                    </div>

                    <div className="rounded-2xl bg-white dark:bg-gray-800 border border-slate-100 dark:border-gray-700 divide-y divide-slate-100 dark:divide-gray-700 overflow-hidden shadow-sm">
                      {/* Bank SMS Auto-Tracking & Inbox Scan (Settings tab option) */}
                      <button
                        type="button"
                        onClick={() => {
                          setSmsModalTab('settings')
                          setSmsModalOpen(true)
                        }}
                        className="w-full flex items-center justify-between p-4 hover:bg-slate-50 dark:hover:bg-gray-700/50 transition text-left"
                      >
                        <div className="flex items-center gap-3.5">
                          <div className="relative p-2.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400">
                            <MessageSquare size={20} />
                            {pendingSmsTxs.length > 0 && (
                              <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[9px] font-bold text-white shadow-sm">
                                {pendingSmsTxs.length}
                              </span>
                            )}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="font-semibold text-sm text-slate-900 dark:text-white">
                                Bank SMS Auto-Tracking
                              </p>
                              {pendingSmsTxs.length > 0 && (
                                <span className="rounded-full bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300 px-2 py-0.5 text-[10px] font-bold">
                                  {pendingSmsTxs.length} pending
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-slate-500 dark:text-gray-400 mt-0.5">
                              Auto-detection, approval mode & scan inbox (7/30/all days)
                            </p>
                          </div>
                        </div>
                        <ChevronRight size={18} className="text-slate-400 dark:text-gray-500" />
                      </button>

                      <button
                        type="button"
                        onClick={() => setMoreSubView('transfers')}
                        className="w-full flex items-center justify-between p-4 hover:bg-slate-50 dark:hover:bg-gray-700/50 transition text-left"
                      >
                        <div className="flex items-center gap-3.5">
                          <div className="p-2.5 rounded-xl bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400">
                            <ArrowRightLeft size={20} />
                          </div>
                          <div>
                            <p className="font-semibold text-sm text-slate-900 dark:text-white">Transfers</p>
                            <p className="text-xs text-slate-500 dark:text-gray-400 mt-0.5">Move money between accounts and review trends</p>
                          </div>
                        </div>
                        <ChevronRight size={18} className="text-slate-400 dark:text-gray-500" />
                      </button>

                      <button
                        type="button"
                        onClick={() => { setSavingsGoalRequested(0); setMoreSubView('savings') }}
                        className="w-full flex items-center justify-between p-4 hover:bg-slate-50 dark:hover:bg-gray-700/50 transition text-left"
                      >
                        <div className="flex items-center gap-3.5">
                          <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400">
                            <Coins size={20} />
                          </div>
                          <div>
                            <p className="font-semibold text-sm text-slate-900 dark:text-white">Savings</p>
                            <p className="text-xs text-slate-500 dark:text-gray-400 mt-0.5">Balances, assets, and monthly savings</p>
                          </div>
                        </div>
                        <ChevronRight size={18} className="text-slate-400 dark:text-gray-500" />
                      </button>

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

                      {standalone && (
                        <div className="flex items-center justify-between gap-3 p-4">
                          <div className="flex items-center gap-3.5">
                            <div className="rounded-xl bg-indigo-50 p-2.5 text-indigo-600"><Vibrate size={20} /></div>
                            <div>
                              <p className="text-sm font-semibold text-slate-900 dark:text-white">Haptic feedback</p>
                              <p className="mt-0.5 text-xs text-slate-500">Subtle taps for actions and confirmations</p>
                            </div>
                          </div>
                          <button type="button" role="switch" aria-label="Haptic feedback" aria-checked={hapticsEnabled} onClick={() => {
                            const enabled = !hapticsEnabled
                            setHapticsEnabled(enabled)
                            setHapticsPreference(enabled)
                            if (enabled) feedback()
                          }} className="flex h-11 w-14 shrink-0 items-center justify-center">
                            <span className={`relative block h-7 w-12 rounded-full ${hapticsEnabled ? 'bg-[#1b1c1f]' : 'bg-gray-200'}`}>
                              <span className={`absolute top-1 h-5 w-5 rounded-full bg-white transition-all ${hapticsEnabled ? 'left-6' : 'left-1'}`} />
                            </span>
                          </button>
                        </div>
                      )}

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
                            data-haptic="impact" onClick={() => void handleToggleBiometrics()}
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
                          data-haptic="impact" onClick={onLock}
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
                        data-haptic="impact" onClick={() => void signOut()}
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
                      <p className="font-semibold">Pocket Expenses · v1.5.2</p>
                      <p className="mt-0.5 text-[11px]">Your household finances, together</p>
                      <p className="mt-2 text-[11px] leading-relaxed">
                        Made by{' '}
                        <a href="https://github.com/tareqarnaout" target="_blank" rel="noopener noreferrer" className="font-semibold text-indigo-500 hover:underline">@tareqarnaout</a>
                        {', '}
                        <a href="https://github.com/nasseralbess" target="_blank" rel="noopener noreferrer" className="font-semibold text-indigo-500 hover:underline">@nasseralbess</a>
                        {' & '}
                        <a href="https://github.com/KhaledAbuQ" target="_blank" rel="noopener noreferrer" className="font-semibold text-indigo-500 hover:underline">@KhaledAbuQ</a>
                      </p>
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

                {moreSubView === 'transfers' && (
                  <div>
                    <button
                      type="button"
                      onClick={() => setMoreSubView('root')}
                      className="mb-4 inline-flex items-center gap-2 rounded-xl bg-white dark:bg-gray-800 border border-slate-200 dark:border-gray-700 px-3.5 py-2 text-xs font-semibold text-slate-700 dark:text-gray-200 shadow-sm hover:bg-slate-50 dark:hover:bg-gray-700 transition"
                    >
                      <ArrowLeft size={16} /> Back to More
                    </button>
                    <TransfersPage />
                  </div>
                )}

                {moreSubView === 'savings' && (
                  <div>
                    <button
                      type="button"
                      onClick={() => setMoreSubView('root')}
                      className="mb-4 inline-flex items-center gap-2 rounded-xl bg-white dark:bg-gray-800 border border-slate-200 dark:border-gray-700 px-3.5 py-2 text-xs font-semibold text-slate-700 dark:text-gray-200 shadow-sm hover:bg-slate-50 dark:hover:bg-gray-700 transition"
                    >
                      <ArrowLeft size={16} /> Back to More
                    </button>
                    <SavingsPage key={member?.id} openGoalPlanner={savingsGoalRequested} />
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
        className="pocket-bottom-nav fixed inset-x-0 bottom-0 z-40 border-t border-slate-200/80 dark:border-gray-800 bg-white/95 dark:bg-gray-900/95 backdrop-blur-md px-2 py-1.5 safe-area-pb shadow-lg"
      >
        <div className="monetra-nav-inner mx-auto flex max-w-lg items-center justify-between"><div className="monetra-nav-capsule">
          <button type="button" aria-label="Home" aria-current={activeTab === 'home' ? 'page' : undefined} onClick={() => { setReportOpen(false); setActiveTab('home'); setMoreSubView('root') }} className={`flex flex-1 flex-col items-center justify-center py-1 transition-colors ${activeTab === 'home' ? 'text-indigo-600 dark:text-indigo-400 font-semibold' : 'text-slate-500 dark:text-gray-400'}`}>
            <Home className="w-5 h-5" /><span className="mt-1 text-[10px]">Home</span>
          </button>
          <button type="button" aria-label="Expenses" aria-current={activeTab === 'expenses' ? 'page' : undefined} onClick={() => { setReportOpen(false); setActiveTab('expenses'); setMoreSubView('root') }} className={`flex flex-1 flex-col items-center justify-center py-1 transition-colors ${activeTab === 'expenses' ? 'text-indigo-600 dark:text-indigo-400 font-semibold' : 'text-slate-500 dark:text-gray-400'}`}>
            <Receipt className="w-5 h-5" /><span className="mt-1 text-[10px]">Expenses</span>
          </button>
          <button type="button" aria-label="Income" aria-current={activeTab === 'income' ? 'page' : undefined} onClick={() => { setReportOpen(false); setActiveTab('income'); setMoreSubView('root') }} className={`flex flex-1 flex-col items-center justify-center py-1 transition-colors ${activeTab === 'income' ? 'text-indigo-600 dark:text-indigo-400 font-semibold' : 'text-slate-500 dark:text-gray-400'}`}>
            <TrendingUp className="w-5 h-5" /><span className="mt-1 text-[10px]">Income</span>
          </button>
          </div>
        </div>
      </nav>

      <MoneyMascot />
      <RapidTapPeek />

      {/* Bank SMS Auto-Tracking & Approvals Modal */}
      <BankSmsTrackerModal
        isOpen={smsModalOpen}
        initialTab={smsModalTab}
        onClose={() => setSmsModalOpen(false)}
        categories={categories}
        onSaveExpense={saveSmsExpense}
        onSaveIncome={saveIncome}
        pendingTransactions={pendingSmsTxs}
        onRemoveTransaction={id => setPendingSmsTxs(prev => prev.filter(t => t.id !== id))}
        onAddTransactions={txs => {
          setPendingSmsTxs(prev => {
            const existingIds = new Set(prev.map(t => t.smsId))
            const newTxs = txs.filter(t => !existingIds.has(t.smsId))
            return [...newTxs, ...prev]
          })
        }}
      />
    </div>
  )
}
