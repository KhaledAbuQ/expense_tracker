import { useEffect, useState, useCallback, useRef } from 'react'
import { App as NativeApp } from '@capacitor/app'
import { Link } from 'react-router-dom'
import {
  Plus,
  Wallet,
  RefreshCw,
  LogOut,
  ArrowLeft,
  MessageSquare,
  Fingerprint,
  Lock,
  LayoutDashboard,
  Sliders,
  Sparkles,
  TrendingDown,
  TrendingUp,
  CheckCircle2,
  Calendar,
  Trash2,
  Check,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { useAuth } from '../context/AuthContext'
import { useExpenses } from '../hooks/useExpenses'
import { useCategories } from '../hooks/useCategories'
import ExpenseForm from '../components/ExpenseForm'
import BankSmsTrackerModal from '../components/BankSmsTrackerModal'
import {
  subscribeToIncomingSms,
  fetchPendingBackgroundTransactions,
  getSmsSettings,
  saveSmsSettings,
  markTransactionProcessed,
  scanRecentBankTransactions,
  checkLaunchApprovalIntent,
  subscribeToApprovalIntent,
  saveLearnedCategory,
  SmsTrackingSettings,
} from '../lib/bankSms'
import { parseBankSms, ParsedBankTransaction } from '../lib/smsParser'
import { calculateTotalExpenses, formatCurrency, formatDateShort, getDateRange, groupExpensesByCategory } from '../lib/utils'
import { syncExpenseWidget, ExpenseWidget } from '../lib/widget'
import { checkBiometricStatus, BiometricAuth, type BiometricAvailability } from '../lib/biometrics'
import { useIncome } from '../hooks/useIncome'
import type { ExpenseFormData, IncomeFormData, Visibility } from '../types'

export default function Mobile({
  standalone = false,
  onLock,
}: {
  standalone?: boolean
  onLock?: () => void
}) {
  const { member, loading: profileLoading, refreshMember, signOut } = useAuth()
  const [mainTab, setMainTab] = useState<'home' | 'approvals' | 'settings'>('home')
  const [adding, setAdding] = useState(false)
  const [period, setPeriod] = useState<'month' | 'last-month' | 'week'>('month')
  const [visibility, setVisibility] = useState<'all' | 'private' | 'household'>('all')
  const [online, setOnline] = useState(navigator.onLine)
  const [saveError, setSaveError] = useState('')
  const [smsModalOpen, setSmsModalOpen] = useState(false)
  const [pendingSmsTxs, setPendingSmsTxs] = useState<ParsedBankTransaction[]>([])
  const [smsSettings, setSmsSettings] = useState<SmsTrackingSettings>(getSmsSettings())
  const [scanningOld, setScanningOld] = useState(false)
  const [approvingIndex, setApprovingIndex] = useState<string | null>(null)
  const [approvingAll, setApprovingAll] = useState(false)
  const [filterType, setFilterType] = useState<'all' | 'expense' | 'income'>('all')

  // Edit fields for pending transactions being approved
  const [editingTxs, setEditingTxs] = useState<{
    [id: string]: {
      merchant: string
      amount: number
      categoryId: string
      visibility: Visibility
      date: string
      showRaw: boolean
    }
  }>({})

  // Test parser state in Settings tab
  const [testSender, setTestSender] = useState('Bank')
  const [testText, setTestText] = useState('')
  const [testResult, setTestResult] = useState<ParsedBankTransaction | null>(null)

  const [biometrics, setBiometrics] = useState<BiometricAvailability>({
    isAvailable: false,
    isEnrolled: false,
    hasSavedCredentials: false,
  })
  const { expenses, loading, error, fetchExpenses, addExpense } = useExpenses({
    dateRange: getDateRange(period), visibility: visibility === 'all' ? undefined : visibility,
  })
  const { addIncome } = useIncome()
  const { categories, loading: categoriesLoading, error: categoriesError, fetchCategories } = useCategories()

  // Keep ref to latest categories for async SMS handling
  const categoriesRef = useRef(categories)
  useEffect(() => {
    categoriesRef.current = categories
  }, [categories])

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
      if (smsModalOpen) setSmsModalOpen(false)
      else if (adding) setAdding(false)
      else void NativeApp.exitApp()
    })
    return () => { void backListener.then(handle => handle.remove()) }
  }, [standalone, adding, smsModalOpen])

  useEffect(() => {
    if (!standalone) return
    const resumeListener = NativeApp.addListener('resume', () => {
      if (navigator.onLine) void fetchExpenses()
      void checkPendingBackgroundSms()
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

  const saveIncome = async (data: IncomeFormData) => {
    setSaveError('')
    if (!member || !navigator.onLine) {
      setSaveError('Connect to the internet and load your profile before saving.')
      return
    }
    try {
      await addIncome({ ...data, member_id: member.id })
      await fetchExpenses()
    } catch {
      setSaveError('Could not save your income. Please try again.')
    }
  }

  // Check if opened from notification approval intent & listen for runtime triggers
  useEffect(() => {
    void checkLaunchApprovalIntent().then(openApproval => {
      if (openApproval) {
        setMainTab('approvals')
      }
    })
    const unsub = subscribeToApprovalIntent(() => {
      setMainTab('approvals')
    })
    return () => {
      unsub()
    }
  }, [])

  // Handle incoming or background SMS transactions (both expenses and income)
  const processIncomingTransaction = useCallback(async (tx: ParsedBankTransaction) => {
    const settings = getSmsSettings()
    if (!settings.enabled) return

    if (settings.mode === 'auto' && member && navigator.onLine) {
      // Zero-click auto-save mode
      try {
        if (tx.type === 'income') {
          await addIncome({
            amount: tx.amount,
            description: tx.merchant,
            category_id: tx.suggestedCategoryId || categoriesRef.current.find(c => c.category_type === 'income')?.id || '',
            visibility: settings.defaultVisibility,
            date: tx.date,
            account_type: 'bank',
            member_id: member.id,
          })
          markTransactionProcessed(tx.smsId)
          toast.success(`Auto-logged bank income: ${tx.merchant} (+${formatCurrency(tx.amount)})`)
        } else {
          await addExpense({
            amount: tx.amount,
            description: tx.merchant,
            category_id: tx.suggestedCategoryId || categoriesRef.current.find(c => c.category_type !== 'income')?.id || '',
            visibility: settings.defaultVisibility,
            date: tx.date,
            account_type: 'bank',
            member_id: member.id,
          })
          markTransactionProcessed(tx.smsId)
          toast.success(`Auto-logged bank expense: ${tx.merchant} (-${formatCurrency(tx.amount)})`)
        }
        await fetchExpenses()
      } catch (err) {
        console.error('Failed to auto-save SMS transaction:', err)
        // Fall back to review queue if auto-save failed
        setPendingSmsTxs(prev => [...prev.filter(item => item.id !== tx.id), tx])
      }
    } else {
      // Notify & Approval mode: add to pending review queue
      setPendingSmsTxs(prev => {
        if (prev.some(item => item.id === tx.id || item.smsId === tx.smsId)) return prev
        return [tx, ...prev]
      })
      setEditingTxs(prev => {
        if (prev[tx.id]) return prev
        const appropriateCategories = categoriesRef.current.filter(c =>
          tx.type === 'income' ? c.category_type !== 'expense' : c.category_type !== 'income'
        )
        return {
          ...prev,
          [tx.id]: {
            merchant: tx.merchant,
            amount: tx.amount,
            categoryId: tx.suggestedCategoryId || appropriateCategories[0]?.id || '',
            visibility: settings.defaultVisibility,
            date: tx.date,
            showRaw: false,
          },
        }
      })
      const isInc = tx.type === 'income'
      toast(
        isInc
          ? `Bank income: ${tx.merchant} (+${formatCurrency(tx.amount)}). Approval needed.`
          : `Bank expense: ${tx.merchant} (-${formatCurrency(tx.amount)}). Approval needed.`,
        { icon: isInc ? '💰' : '💳', duration: 4000 }
      )
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

  // Setup SMS broadcast listener on mount
  useEffect(() => {
    void checkPendingBackgroundSms()
    const unsubscribe = subscribeToIncomingSms(tx => {
      void processIncomingTransaction(tx)
    }, categoriesRef.current)

    return () => {
      unsubscribe()
    }
  }, [checkPendingBackgroundSms, processIncomingTransaction])

  // Scan past bank SMS messages (Last 7 Days, Last 30 Days, or All Messages)
  const handleScanOldMessages = async (days: 7 | 30 | 0) => {
    setScanningOld(true)
    try {
      const limit = days === 0 ? 500 : days === 30 ? 200 : 100
      const results = await scanRecentBankTransactions(categoriesRef.current, days, limit)

      if (results.length === 0) {
        toast(
          days === 0
            ? 'No bank SMS messages found in inbox.'
            : `No bank SMS messages found in the last ${days} days.`,
          { icon: 'ℹ️' }
        )
        return
      }

      let newCount = 0
      setPendingSmsTxs(prev => {
        const existingIds = new Set(prev.map(t => t.id))
        const added = results.filter(t => !existingIds.has(t.id))
        newCount = added.length
        return [...added, ...prev]
      })

      setEditingTxs(prev => {
        const next = { ...prev }
        for (const tx of results) {
          if (!next[tx.id]) {
            const appropriateCategories = categoriesRef.current.filter(c =>
              tx.type === 'income' ? c.category_type !== 'expense' : c.category_type !== 'income'
            )
            next[tx.id] = {
              merchant: tx.merchant,
              amount: tx.amount,
              categoryId: tx.suggestedCategoryId || appropriateCategories[0]?.id || '',
              visibility: smsSettings.defaultVisibility,
              date: tx.date,
              showRaw: false,
            }
          }
        }
        return next
      })

      toast.success(`Found ${newCount} bank transactions to review!`)
      setMainTab('approvals')
    } catch (err: any) {
      toast.error(err?.message || 'Failed to scan SMS messages')
    } finally {
      setScanningOld(false)
    }
  }

  // Approve a single transaction with edited values
  const handleApproveOne = async (tx: ParsedBankTransaction) => {
    if (!member || !navigator.onLine) {
      toast.error('Connect to the internet before approving.')
      return
    }

    const edit = editingTxs[tx.id] || {
      merchant: tx.merchant,
      amount: tx.amount,
      categoryId: tx.suggestedCategoryId || '',
      visibility: smsSettings.defaultVisibility,
      date: tx.date,
      showRaw: false,
    }

    setApprovingIndex(tx.id)
    try {
      // Save learned merchant -> category mapping for future auto-detection
      if (edit.merchant && edit.categoryId) {
        saveLearnedCategory(edit.merchant, edit.categoryId)
      }

      if (tx.type === 'income') {
        await addIncome({
          amount: edit.amount,
          description: edit.merchant,
          category_id: edit.categoryId || categories.find(c => c.category_type === 'income')?.id || '',
          visibility: edit.visibility,
          date: edit.date,
          account_type: 'bank',
          member_id: member.id,
        })
      } else {
        await addExpense({
          amount: edit.amount,
          description: edit.merchant,
          category_id: edit.categoryId || categories.find(c => c.category_type !== 'income')?.id || '',
          visibility: edit.visibility,
          date: edit.date,
          account_type: 'bank',
          member_id: member.id,
        })
      }

      markTransactionProcessed(tx.smsId)
      setPendingSmsTxs(prev => prev.filter(t => t.id !== tx.id))
      setEditingTxs(prev => {
        const next = { ...prev }
        delete next[tx.id]
        return next
      })
      toast.success(`Approved: ${edit.merchant} (${formatCurrency(edit.amount)})`)
      await fetchExpenses()
    } catch {
      toast.error('Could not save transaction. Please try again.')
    } finally {
      setApprovingIndex(null)
    }
  }

  // Dismiss a transaction
  const handleDismissOne = (tx: ParsedBankTransaction) => {
    markTransactionProcessed(tx.smsId)
    setPendingSmsTxs(prev => prev.filter(t => t.id !== tx.id))
    setEditingTxs(prev => {
      const next = { ...prev }
      delete next[tx.id]
      return next
    })
    toast('Transaction dismissed', { icon: '🗑️' })
  }

  // Approve all pending transactions with their current values
  const handleApproveAll = async () => {
    if (!member || !navigator.onLine) {
      toast.error('Connect to the internet before approving.')
      return
    }
    if (pendingSmsTxs.length === 0) return

    setApprovingAll(true)
    let count = 0
    try {
      for (const tx of pendingSmsTxs) {
        const edit = editingTxs[tx.id] || {
          merchant: tx.merchant,
          amount: tx.amount,
          categoryId: tx.suggestedCategoryId || '',
          visibility: smsSettings.defaultVisibility,
          date: tx.date,
          showRaw: false,
        }

        if (edit.merchant && edit.categoryId) {
          saveLearnedCategory(edit.merchant, edit.categoryId)
        }

        if (tx.type === 'income') {
          await addIncome({
            amount: edit.amount,
            description: edit.merchant,
            category_id: edit.categoryId || categories.find(c => c.category_type === 'income')?.id || '',
            visibility: edit.visibility,
            date: edit.date,
            account_type: 'bank',
            member_id: member.id,
          })
        } else {
          await addExpense({
            amount: edit.amount,
            description: edit.merchant,
            category_id: edit.categoryId || categories.find(c => c.category_type !== 'income')?.id || '',
            visibility: edit.visibility,
            date: edit.date,
            account_type: 'bank',
            member_id: member.id,
          })
        }
        markTransactionProcessed(tx.smsId)
        count++
      }
      setPendingSmsTxs([])
      setEditingTxs({})
      toast.success(`Approved all ${count} transactions!`)
      await fetchExpenses()
    } catch {
      toast.error('Some transactions could not be saved.')
      await fetchExpenses()
    } finally {
      setApprovingAll(false)
    }
  }

  const handleUpdateSettings = (partial: Partial<SmsTrackingSettings>) => {
    const updated = saveSmsSettings(partial)
    setSmsSettings(updated)
    toast.success('Settings updated')
  }

  const handleTestParse = () => {
    if (!testText.trim()) {
      toast.error('Please enter SMS text to test')
      return
    }
    const result = parseBankSms(
      {
        id: 'test-' + Date.now(),
        address: testSender || 'Bank',
        body: testText,
        date: Date.now(),
      },
      categories
    )
    setTestResult(result)
  }

  const total = calculateTotalExpenses(expenses)
  const breakdown = groupExpensesByCategory(expenses, categories)

  const expenseCount = pendingSmsTxs.filter(t => t.type === 'expense').length
  const incomeCount = pendingSmsTxs.filter(t => t.type === 'income').length

  const filteredApprovals = pendingSmsTxs.filter(tx => {
    if (filterType === 'expense') return tx.type === 'expense'
    if (filterType === 'income') return tx.type === 'income'
    return true
  })

  return (
    <div className="mobile-client min-h-dvh bg-slate-50 text-slate-900 pb-20">
      <div className="mx-auto max-w-lg px-5 pb-20 pt-6">
        {/* Header */}
        <header className="mb-6 flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-indigo-600">
              {mainTab === 'home' ? 'Pocket expenses' : mainTab === 'approvals' ? 'Bank SMS' : 'Preferences'}
            </p>
            <p className="mt-1 text-sm text-slate-500">
              {mainTab === 'home'
                ? member
                  ? `Hello, ${member.name}`
                  : 'Your daily spending, together'
                : mainTab === 'approvals'
                ? `${pendingSmsTxs.length} pending ${pendingSmsTxs.length === 1 ? 'approval' : 'approvals'}`
                : 'Settings & SMS tracking'}
            </p>
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
                className={`rounded-full p-2.5 shadow-sm transition ${
                  biometrics.hasSavedCredentials
                    ? 'bg-indigo-50 text-indigo-600 ring-1 ring-indigo-200'
                    : 'bg-white text-slate-400'
                }`}
              >
                <Fingerprint size={18} />
              </button>
            )}
            {onLock && (
              <button
                type="button"
                onClick={onLock}
                aria-label="Lock app"
                title="Lock app with biometrics now"
                className="rounded-full bg-white p-2.5 shadow-sm text-slate-500 hover:text-indigo-600 transition"
              >
                <Lock size={18} />
              </button>
            )}
            <button
              onClick={() => void signOut()}
              aria-label="Sign out"
              className="rounded-full bg-white p-2.5 shadow-sm text-slate-600 hover:bg-slate-50 transition"
            >
              <LogOut size={18} />
            </button>
          </div>
        </header>

        {!online && (
          <p role="status" className="mb-4 rounded-xl bg-amber-50 p-4 text-sm text-amber-800">
            You’re offline. Connect to refresh or save expenses.
          </p>
        )}

        {profileLoading ? (
          <p role="status" className="py-12 text-center text-slate-500">Loading your profile…</p>
        ) : !member ? (
          <div className="rounded-2xl bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-700">Your household profile could not be loaded.</p>
            <button onClick={() => void refreshMember()} className="mt-3 font-medium text-indigo-600 text-sm">
              Retry profile
            </button>
          </div>
        ) : adding ? (
          /* Manual Add Expense Section */
          <section className="rounded-3xl bg-white p-5 shadow-sm">
            <button
              onClick={() => setAdding(false)}
              className="mb-5 flex items-center gap-2 text-sm text-slate-500 hover:text-slate-800 transition"
            >
              <ArrowLeft size={18} /> Overview
            </button>
            <h1 className="mb-5 text-2xl font-bold">Add expense</h1>
            {saveError && <p role="alert" className="mb-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{saveError}</p>}
            {categoriesLoading ? (
              <p role="status">Loading categories…</p>
            ) : categoriesError ? (
              <div role="alert">
                <p>Could not load categories.</p>
                <button onClick={() => void fetchCategories()} className="py-3 text-indigo-600">Try again</button>
              </div>
            ) : (
              <ExpenseForm categories={categories} onSubmit={save} onCancel={() => setAdding(false)} />
            )}
          </section>
        ) : mainTab === 'home' ? (
          /* ---------------- TAB 1: HOME PAGE ---------------- */
          <div className="space-y-5">
            {/* Pending Approvals Alert Banner (Strictly review action, NO scan options) */}
            {pendingSmsTxs.length > 0 && (
              <div
                onClick={() => setMainTab('approvals')}
                role="button"
                className="flex cursor-pointer items-center justify-between gap-3 rounded-2xl bg-indigo-50 border border-indigo-200 p-4 text-indigo-950 shadow-sm transition hover:bg-indigo-100/70"
              >
                <div className="flex items-center gap-3">
                  <div className="rounded-xl bg-indigo-600 p-2 text-white">
                    <MessageSquare size={18} />
                  </div>
                  <div>
                    <p className="text-xs font-bold">
                      {pendingSmsTxs.length} bank {pendingSmsTxs.length === 1 ? 'transaction' : 'transactions'} awaiting approval
                    </p>
                    <p className="text-[11px] text-indigo-700">Tap to review, edit details & approve</p>
                  </div>
                </div>
                <span className="rounded-xl bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm">
                  Review
                </span>
              </div>
            )}

            <div className="flex items-center justify-between">
              <h1 className="text-2xl font-bold">Overview</h1>
              <button
                disabled={loading || !online}
                onClick={() => void fetchExpenses()}
                aria-label="Refresh expenses"
                className="rounded-full bg-white p-3 shadow-sm disabled:opacity-40"
              >
                <RefreshCw size={18} className={loading ? 'animate-spin text-indigo-600' : 'text-slate-600'} />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <select
                aria-label="Period"
                value={period}
                onChange={e => setPeriod(e.target.value as typeof period)}
                className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm"
              >
                <option value="month">This month</option>
                <option value="last-month">Last month</option>
                <option value="week">This week</option>
              </select>
              <select
                aria-label="Visibility"
                value={visibility}
                onChange={e => setVisibility(e.target.value as typeof visibility)}
                className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm"
              >
                <option value="all">All visible</option>
                <option value="private">Personal</option>
                <option value="household">Household</option>
              </select>
            </div>

            {error ? (
              <div role="alert" className="rounded-2xl bg-red-50 p-5 text-red-700 text-sm">
                Could not load expenses. <button onClick={() => void fetchExpenses()} className="underline font-semibold">Try again</button>
              </div>
            ) : loading ? (
              <p role="status" className="py-12 text-center text-slate-500">Loading expenses…</p>
            ) : (
              <>
                <section className="rounded-3xl bg-indigo-600 p-6 text-white shadow-lg shadow-indigo-100">
                  <Wallet className="mb-4 opacity-80" size={26} />
                  <p className="text-xs font-medium uppercase tracking-wider text-indigo-200">Total spent</p>
                  <p className="mt-1 break-words text-3xl font-bold tracking-tight">{formatCurrency(total)}</p>
                  <p className="mt-3 text-xs text-indigo-100">
                    {expenses.length} {expenses.length === 1 ? 'expense' : 'expenses'} ·{' '}
                    {visibility === 'all'
                      ? 'Personal + Shared'
                      : visibility === 'private'
                      ? 'Personal spending'
                      : 'Shared household'}
                  </p>
                </section>

                <section className="rounded-3xl bg-white p-5 shadow-sm border border-slate-100">
                  <h2 className="mb-4 font-semibold text-sm">By category</h2>
                  {breakdown.length === 0 ? (
                    <p className="text-xs text-slate-500">Add your first expense to see where your money goes.</p>
                  ) : (
                    <div className="space-y-3.5">
                      {breakdown.map(item => (
                        <div key={item.name}>
                          <div className="mb-1.5 flex justify-between gap-3 text-xs">
                            <span className="font-medium text-slate-700">{item.name}</span>
                            <span className="font-semibold text-slate-900">{formatCurrency(item.value)}</span>
                          </div>
                          <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                            <div
                              className="h-full rounded-full bg-indigo-500 transition-all"
                              style={{ width: `${total > 0 ? (item.value / total) * 100 : 0}%` }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </section>

                <section className="rounded-3xl bg-white p-5 shadow-sm border border-slate-100">
                  <h2 className="mb-3 font-semibold text-sm">Recent expenses</h2>
                  {expenses.length === 0 ? (
                    <p className="py-4 text-center text-xs text-slate-500">No expenses in this period.</p>
                  ) : (
                    <ul className="divide-y divide-slate-100">
                      {expenses.slice(0, 15).map(expense => (
                        <li key={expense.id} className="flex items-start justify-between gap-3 py-3 text-xs">
                          <div className="min-w-0">
                            <p className="break-words font-medium text-slate-900">
                              {expense.description || expense.category?.name || 'Expense'}
                            </p>
                            <p className="mt-0.5 text-slate-500">
                              {formatDateShort(expense.date)} · {expense.category?.name || 'Uncategorized'}
                            </p>
                            <p className="mt-0.5 text-[10px] text-slate-400">
                              {expense.visibility === 'private' ? 'Personal' : `Shared · ${expense.member?.name || 'Household'}`} ·{' '}
                              {expense.account_type === 'bank' ? 'Bank' : 'Cash'}
                            </p>
                          </div>
                          <span className="shrink-0 font-bold text-slate-900">
                            {formatCurrency(Number(expense.amount))}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>

                {/* Quick Add Expense button on Home tab */}
                <button
                  onClick={() => { setSaveError(''); setAdding(true) }}
                  className="flex w-full items-center justify-center gap-2 rounded-2xl bg-indigo-600 py-3.5 text-sm font-semibold text-white shadow-md shadow-indigo-200 transition hover:bg-indigo-700"
                >
                  <Plus size={18} /> Add cash or card expense
                </button>
              </>
            )}

            {!standalone && (
              <Link to="/" className="block py-2 text-center text-xs text-slate-500 underline">
                Open full desktop dashboard
              </Link>
            )}
          </div>
        ) : mainTab === 'approvals' ? (
          /* ---------------- TAB 2: APPROVALS & EDIT TAB ---------------- */
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-xl font-bold">SMS Approvals</h1>
                <p className="text-xs text-slate-500 mt-0.5">
                  Review, edit category or amount, then approve to add
                </p>
              </div>
              {filteredApprovals.length > 1 && (
                <button
                  type="button"
                  disabled={approvingAll}
                  onClick={() => void handleApproveAll()}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-3 py-2 text-xs font-semibold text-white shadow-sm hover:bg-indigo-700 disabled:opacity-50"
                >
                  <Check size={14} />
                  {approvingAll ? 'Saving...' : `Approve All (${filteredApprovals.length})`}
                </button>
              )}
            </div>

            {/* Filter Pills */}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setFilterType('all')}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                  filterType === 'all' ? 'bg-indigo-600 text-white' : 'bg-white text-slate-600 border border-slate-200'
                }`}
              >
                All ({pendingSmsTxs.length})
              </button>
              <button
                type="button"
                onClick={() => setFilterType('expense')}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                  filterType === 'expense' ? 'bg-rose-600 text-white' : 'bg-white text-slate-600 border border-slate-200'
                }`}
              >
                Expenses ({expenseCount})
              </button>
              <button
                type="button"
                onClick={() => setFilterType('income')}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                  filterType === 'income' ? 'bg-emerald-600 text-white' : 'bg-white text-slate-600 border border-slate-200'
                }`}
              >
                Income ({incomeCount})
              </button>
            </div>

            {/* Empty State */}
            {filteredApprovals.length === 0 ? (
              <div className="rounded-3xl bg-white p-8 text-center shadow-sm border border-slate-100">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600">
                  <CheckCircle2 size={28} />
                </div>
                <h3 className="mt-4 text-base font-bold text-slate-800">All caught up!</h3>
                <p className="mt-1 text-xs text-slate-500 leading-relaxed max-w-xs mx-auto">
                  No bank transactions are currently waiting for approval. When a bank SMS arrives, it will appear here for you to edit and confirm.
                </p>
                <div className="mt-6 rounded-2xl bg-slate-50 p-4 text-left border border-slate-100">
                  <p className="text-xs font-semibold text-slate-700">Want to scan your past SMS history?</p>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Options for scanning past 7 days, 30 days, or all messages are available in the Settings tab.
                  </p>
                  <button
                    type="button"
                    onClick={() => setMainTab('settings')}
                    className="mt-3 inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-3.5 py-2 text-xs font-semibold text-white shadow-sm hover:bg-indigo-700 transition"
                  >
                    <Sliders size={13} /> Open Settings to scan
                  </button>
                </div>
              </div>
            ) : (
              /* Transaction Cards with Edit Options */
              <div className="space-y-4">
                {filteredApprovals.map(tx => {
                  const edit = editingTxs[tx.id] || {
                    merchant: tx.merchant,
                    amount: tx.amount,
                    categoryId: tx.suggestedCategoryId || '',
                    visibility: smsSettings.defaultVisibility,
                    date: tx.date,
                    showRaw: false,
                  }
                  const isIncome = tx.type === 'income'
                  const appropriateCategories = categories.filter(c =>
                    isIncome ? c.category_type !== 'expense' : c.category_type !== 'income'
                  )

                  return (
                    <div
                      key={tx.id}
                      className={`rounded-2xl border p-4 shadow-sm space-y-3 bg-white ${
                        isIncome ? 'border-emerald-200' : 'border-slate-200'
                      }`}
                    >
                      {/* Card Header: Type Badge, Amount, Sender, Account */}
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span
                              className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                                isIncome ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                              }`}
                            >
                              {isIncome ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
                              {isIncome ? 'Credited / Income' : 'Debited / Expense'}
                            </span>
                            <span className="text-xs font-semibold text-slate-700">{tx.sender}</span>
                            {tx.accountEnding && (
                              <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-600 font-mono">
                                •{tx.accountEnding}
                              </span>
                            )}
                          </div>
                          {tx.availableBalance !== undefined && (
                            <p className="mt-1 text-[11px] text-slate-400">
                              Balance: <span className="font-mono">{formatCurrency(tx.availableBalance)}</span>
                            </p>
                          )}
                        </div>
                        <span
                          className={`text-base font-bold shrink-0 ${
                            isIncome ? 'text-emerald-600' : 'text-slate-900'
                          }`}
                        >
                          {isIncome ? '+' : '-'}{formatCurrency(edit.amount)}
                        </span>
                      </div>

                      {/* Auto-detected badge if detected */}
                      {tx.isAutoDetected && (
                        <div className="flex items-center gap-1 text-[11px] font-semibold text-indigo-600 bg-indigo-50/80 px-2.5 py-1 rounded-lg border border-indigo-100/80">
                          <Sparkles size={12} className="text-indigo-600 shrink-0" />
                          <span>Auto-detected category: <strong>{tx.categoryGuess || 'Categorized'}</strong></span>
                        </div>
                      )}

                      {/* Editable Fields: Merchant, Amount, Category, Date, Visibility */}
                      <div className="grid grid-cols-2 gap-2 text-xs pt-1">
                        <div>
                          <label className="block text-[10px] font-medium text-slate-500 mb-1">
                            {isIncome ? 'Source / Description' : 'Merchant / Description'}
                          </label>
                          <input
                            type="text"
                            value={edit.merchant}
                            onChange={e =>
                              setEditingTxs(prev => ({
                                ...prev,
                                [tx.id]: { ...prev[tx.id], merchant: e.target.value },
                              }))
                            }
                            className="w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs text-slate-800 bg-white"
                          />
                        </div>

                        <div>
                          <label className="block text-[10px] font-medium text-slate-500 mb-1">
                            Amount ({formatCurrency(0).slice(0, 1) || '$'})
                          </label>
                          <input
                            type="number"
                            step="0.01"
                            value={edit.amount}
                            onChange={e =>
                              setEditingTxs(prev => ({
                                ...prev,
                                [tx.id]: { ...prev[tx.id], amount: parseFloat(e.target.value) || 0 },
                              }))
                            }
                            className="w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-800 bg-white"
                          />
                        </div>

                        <div>
                          <label className="block text-[10px] font-medium text-slate-500 mb-1">
                            Category
                          </label>
                          <select
                            value={edit.categoryId}
                            onChange={e =>
                              setEditingTxs(prev => ({
                                ...prev,
                                [tx.id]: { ...prev[tx.id], categoryId: e.target.value },
                              }))
                            }
                            className="w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs text-slate-800 bg-white"
                          >
                            <option value="">Select category...</option>
                            {appropriateCategories.map(cat => (
                              <option key={cat.id} value={cat.id}>
                                {cat.name}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="block text-[10px] font-medium text-slate-500 mb-1">
                            Date
                          </label>
                          <input
                            type="date"
                            value={edit.date}
                            onChange={e =>
                              setEditingTxs(prev => ({
                                ...prev,
                                [tx.id]: { ...prev[tx.id], date: e.target.value },
                              }))
                            }
                            className="w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs text-slate-800 bg-white"
                          />
                        </div>

                        <div className="col-span-2">
                          <label className="block text-[10px] font-medium text-slate-500 mb-1">
                            Visibility
                          </label>
                          <select
                            value={edit.visibility}
                            onChange={e =>
                              setEditingTxs(prev => ({
                                ...prev,
                                [tx.id]: { ...prev[tx.id], visibility: e.target.value as Visibility },
                              }))
                            }
                            className="w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs text-slate-800 bg-white"
                          >
                            <option value="household">Household (Shared with family)</option>
                            <option value="private">Personal (Only visible to you)</option>
                          </select>
                        </div>
                      </div>

                      {/* Toggle original SMS body */}
                      <div>
                        <button
                          type="button"
                          onClick={() =>
                            setEditingTxs(prev => ({
                              ...prev,
                              [tx.id]: { ...prev[tx.id], showRaw: !prev[tx.id]?.showRaw },
                            }))
                          }
                          className="text-[10px] text-slate-400 hover:text-slate-600 underline"
                        >
                          {edit.showRaw ? 'Hide original SMS' : 'View original SMS'}
                        </button>
                        {edit.showRaw && (
                          <p className="mt-1 rounded-lg bg-slate-50 p-2 text-[10px] font-mono text-slate-600 break-words border border-slate-100">
                            {tx.rawBody}
                          </p>
                        )}
                      </div>

                      {/* Actions: Approve & Add vs Dismiss */}
                      <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                        <button
                          type="button"
                          onClick={() => handleDismissOne(tx)}
                          className="inline-flex items-center gap-1 rounded-xl px-3 py-2 text-xs font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition"
                        >
                          <Trash2 size={13} /> Dismiss
                        </button>
                        <button
                          type="button"
                          disabled={approvingIndex === tx.id}
                          onClick={() => void handleApproveOne(tx)}
                          className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-emerald-700 transition disabled:opacity-50"
                        >
                          <Check size={14} />
                          {approvingIndex === tx.id ? 'Adding...' : 'Approve & Add'}
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        ) : (
          /* ---------------- TAB 3: SETTINGS TAB ---------------- */
          <div className="space-y-5">
            <div>
              <h1 className="text-xl font-bold">Settings</h1>
              <p className="text-xs text-slate-500 mt-0.5">
                Bank SMS auto-tracking preferences & message scanning
              </p>
            </div>

            {/* Mode Selection Section: Auto vs Notify & Approval */}
            <section className="rounded-3xl bg-white p-5 shadow-sm border border-slate-100 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="font-bold text-sm text-slate-900">Bank SMS Tracking</h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Detect transactions automatically from incoming SMS
                  </p>
                </div>
                <label className="relative inline-flex cursor-pointer items-center">
                  <input
                    type="checkbox"
                    checked={smsSettings.enabled}
                    onChange={e => handleUpdateSettings({ enabled: e.target.checked })}
                    className="peer sr-only"
                  />
                  <div className="h-6 w-11 rounded-full bg-slate-200 peer-checked:bg-indigo-600 peer-focus:outline-none after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:bg-white after:transition-all after:content-[''] peer-checked:after:translate-x-full"></div>
                </label>
              </div>

              {smsSettings.enabled && (
                <div className="space-y-3 pt-2">
                  <p className="text-xs font-semibold text-slate-700">Tracking Mode:</p>

                  {/* Mode 1: Notify & Approval (Recommended) */}
                  <label
                    className={`flex items-start gap-3 rounded-2xl border p-3.5 cursor-pointer transition ${
                      smsSettings.mode === 'approval'
                        ? 'border-indigo-500 bg-indigo-50/50 ring-1 ring-indigo-500'
                        : 'border-slate-200 bg-white hover:bg-slate-50'
                    }`}
                  >
                    <input
                      type="radio"
                      name="smsMode"
                      checked={smsSettings.mode === 'approval'}
                      onChange={() => handleUpdateSettings({ mode: 'approval', notifyEveryTransaction: true })}
                      className="mt-1 text-indigo-600 focus:ring-indigo-500"
                    />
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-semibold text-xs text-slate-900">
                          Notify & Ask for Approval
                        </span>
                        <span className="rounded bg-indigo-100 px-1.5 py-0.5 text-[9px] font-bold text-indigo-700">
                          Recommended
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                        Sends a notification for every transaction and asks for your approval before adding. Offers full edit options (amount, merchant, category, date, visibility).
                      </p>
                    </div>
                  </label>

                  {/* Mode 2: Auto-Log Mode */}
                  <label
                    className={`flex items-start gap-3 rounded-2xl border p-3.5 cursor-pointer transition ${
                      smsSettings.mode === 'auto'
                        ? 'border-indigo-500 bg-indigo-50/50 ring-1 ring-indigo-500'
                        : 'border-slate-200 bg-white hover:bg-slate-50'
                    }`}
                  >
                    <input
                      type="radio"
                      name="smsMode"
                      checked={smsSettings.mode === 'auto'}
                      onChange={() => handleUpdateSettings({ mode: 'auto', notifyEveryTransaction: false })}
                      className="mt-1 text-indigo-600 focus:ring-indigo-500"
                    />
                    <div className="min-w-0">
                      <span className="font-semibold text-xs text-slate-900">
                        Auto-Log Mode (Zero-Click)
                      </span>
                      <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                        Immediately saves every transaction directly into your ledger as soon as bank SMS arrives, without requiring manual confirmation.
                      </p>
                    </div>
                  </label>
                </div>
              )}
            </section>

            {/* Category Auto-Detection Info */}
            <section className="rounded-3xl bg-white p-5 shadow-sm border border-slate-100 space-y-2">
              <div className="flex items-center gap-2 text-indigo-600 font-bold text-sm">
                <Sparkles size={16} />
                <span>Automatic Category Detection</span>
                <span className="ml-auto rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                  Active
                </span>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                Automatically detects categories from Jordanian and regional bank keywords. Whenever you edit or approve a transaction with a category, the system learns and remembers your preference for that merchant in future SMS!
              </p>
            </section>

            {/* Scan Old Messages Section (7 Days / 30 Days / All Messages) */}
            <section className="rounded-3xl bg-white p-5 shadow-sm border border-slate-100 space-y-3">
              <div className="flex items-center gap-2">
                <Calendar size={18} className="text-indigo-600" />
                <h2 className="font-bold text-sm text-slate-900">Scan Old Bank Messages</h2>
              </div>
              <p className="text-xs text-slate-500 leading-relaxed">
                Scan your past bank SMS messages to find transactions you may have missed. Detected messages will be added to your Approvals queue for review and editing:
              </p>

              <div className="grid grid-cols-1 gap-2 pt-1">
                <button
                  type="button"
                  disabled={scanningOld}
                  onClick={() => void handleScanOldMessages(7)}
                  className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50/80 px-4 py-3 text-xs font-semibold text-slate-800 hover:bg-indigo-50 hover:border-indigo-300 hover:text-indigo-700 transition disabled:opacity-50"
                >
                  <span className="flex items-center gap-2">
                    <Calendar size={15} /> Last 7 Days
                  </span>
                  <span className="text-[10px] text-slate-500 font-normal">Fast scan</span>
                </button>

                <button
                  type="button"
                  disabled={scanningOld}
                  onClick={() => void handleScanOldMessages(30)}
                  className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50/80 px-4 py-3 text-xs font-semibold text-slate-800 hover:bg-indigo-50 hover:border-indigo-300 hover:text-indigo-700 transition disabled:opacity-50"
                >
                  <span className="flex items-center gap-2">
                    <Calendar size={15} /> Last 30 Days
                  </span>
                  <span className="text-[10px] text-slate-500 font-normal">Past month</span>
                </button>

                <button
                  type="button"
                  disabled={scanningOld}
                  onClick={() => void handleScanOldMessages(0)}
                  className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50/80 px-4 py-3 text-xs font-semibold text-slate-800 hover:bg-indigo-50 hover:border-indigo-300 hover:text-indigo-700 transition disabled:opacity-50"
                >
                  <span className="flex items-center gap-2">
                    <MessageSquare size={15} /> All Messages
                  </span>
                  <span className="text-[10px] text-slate-500 font-normal">Complete inbox scan</span>
                </button>
              </div>

              {scanningOld && (
                <div className="flex items-center justify-center gap-2 py-2 text-xs font-medium text-indigo-600">
                  <RefreshCw size={14} className="animate-spin" />
                  <span>Reading and parsing bank SMS messages...</span>
                </div>
              )}
            </section>

            {/* Default Transaction Visibility */}
            <section className="rounded-3xl bg-white p-5 shadow-sm border border-slate-100 space-y-3">
              <h2 className="font-bold text-sm text-slate-900">Default Visibility</h2>
              <p className="text-xs text-slate-500">
                Choose who can see your bank transactions by default:
              </p>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => handleUpdateSettings({ defaultVisibility: 'household' })}
                  className={`rounded-xl border p-3 text-left transition ${
                    smsSettings.defaultVisibility === 'household'
                      ? 'border-indigo-500 bg-indigo-50/60 ring-1 ring-indigo-500'
                      : 'border-slate-200 bg-white hover:bg-slate-50'
                  }`}
                >
                  <p className="text-xs font-semibold text-slate-900">Household</p>
                  <p className="text-[10px] text-slate-500 mt-0.5">Shared with family</p>
                </button>
                <button
                  type="button"
                  onClick={() => handleUpdateSettings({ defaultVisibility: 'private' })}
                  className={`rounded-xl border p-3 text-left transition ${
                    smsSettings.defaultVisibility === 'private'
                      ? 'border-indigo-500 bg-indigo-50/60 ring-1 ring-indigo-500'
                      : 'border-slate-200 bg-white hover:bg-slate-50'
                  }`}
                >
                  <p className="text-xs font-semibold text-slate-900">Personal</p>
                  <p className="text-[10px] text-slate-500 mt-0.5">Only visible to you</p>
                </button>
              </div>
            </section>

            {/* SMS Parser Test Playground */}
            <section className="rounded-3xl bg-white p-5 shadow-sm border border-slate-100 space-y-3">
              <h2 className="font-bold text-sm text-slate-900">Test SMS Parser</h2>
              <p className="text-xs text-slate-500">
                Paste any bank SMS to test auto-detection:
              </p>

              <div className="flex gap-1.5 flex-wrap">
                <button
                  type="button"
                  onClick={() => {
                    setTestSender('ArabBank')
                    setTestText('Purchase of JOD 45.50 at Carrefour on card ending 4321. Avail Bal: JOD 820.00')
                  }}
                  className="rounded-lg bg-slate-100 px-2 py-1 text-[10px] font-medium text-slate-700 hover:bg-slate-200"
                >
                  Arab Bank POS
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setTestSender('EtihadBank')
                    setTestText('Your account has been credited with JOD 950.00 for Salary transfer. Avail Bal: JOD 1,200.00')
                  }}
                  className="rounded-lg bg-slate-100 px-2 py-1 text-[10px] font-medium text-slate-700 hover:bg-slate-200"
                >
                  Etihad Salary
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setTestSender('BankJordan')
                    setTestText('Debited JOD 15.00 at Total Gas Station on 08/09. Avail Bal: JOD 310.00')
                  }}
                  className="rounded-lg bg-slate-100 px-2 py-1 text-[10px] font-medium text-slate-700 hover:bg-slate-200"
                >
                  Total Gas POS
                </button>
              </div>

              <div>
                <label className="block text-[10px] font-medium text-slate-500 mb-1">Bank Sender Name</label>
                <input
                  type="text"
                  value={testSender}
                  onChange={e => setTestSender(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs bg-white"
                  placeholder="e.g. ArabBank"
                />
              </div>

              <div>
                <label className="block text-[10px] font-medium text-slate-500 mb-1">SMS Message Text</label>
                <textarea
                  rows={3}
                  value={testText}
                  onChange={e => setTestText(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 p-3 text-xs bg-white"
                  placeholder="Paste SMS text here..."
                />
              </div>

              <button
                type="button"
                onClick={handleTestParse}
                className="w-full rounded-xl bg-slate-800 py-2.5 text-xs font-semibold text-white hover:bg-slate-900 transition"
              >
                Test Parser
              </button>

              {testResult && (
                <div className="rounded-2xl bg-slate-50 p-3.5 border border-slate-200 text-xs space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-800">
                      {testResult.isFinancial ? 'Financial Transaction' : 'Non-financial'}
                    </span>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      testResult.type === 'income' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                    }`}>
                      {testResult.type.toUpperCase()}
                    </span>
                  </div>
                  <p><strong>Merchant / Source:</strong> {testResult.merchant}</p>
                  <p><strong>Amount:</strong> {formatCurrency(testResult.amount)}</p>
                  <p className="flex items-center gap-1">
                    <strong>Category:</strong> {testResult.categoryGuess || 'None'}
                    {testResult.isAutoDetected && (
                      <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded">
                        <Sparkles size={10} /> Auto-detected
                      </span>
                    )}
                  </p>
                  {testResult.accountEnding && <p><strong>Card / Account:</strong> •{testResult.accountEnding}</p>}
                </div>
              )}
            </section>
          </div>
        )}
      </div>

      {/* Fixed Bottom Navigation Bar */}
      {!adding && (
        <nav
          aria-label="Mobile Navigation"
          className="fixed inset-x-0 bottom-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200 px-6 py-2 flex justify-around items-center"
        >
          <button
            type="button"
            onClick={() => setMainTab('home')}
            className={`flex flex-col items-center gap-1 py-1 px-4 rounded-xl transition ${
              mainTab === 'home'
                ? 'text-indigo-600 font-bold bg-indigo-50/70'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <LayoutDashboard size={20} />
            <span className="text-[11px]">Home</span>
          </button>

          <button
            type="button"
            onClick={() => setMainTab('approvals')}
            className={`relative flex flex-col items-center gap-1 py-1 px-4 rounded-xl transition ${
              mainTab === 'approvals'
                ? 'text-indigo-600 font-bold bg-indigo-50/70'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <div className="relative">
              <MessageSquare size={20} />
              {pendingSmsTxs.length > 0 && (
                <span className="absolute -top-1 -right-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[9px] font-bold text-white shadow-sm">
                  {pendingSmsTxs.length}
                </span>
              )}
            </div>
            <span className="text-[11px]">Approvals</span>
          </button>

          <button
            type="button"
            onClick={() => setMainTab('settings')}
            className={`flex flex-col items-center gap-1 py-1 px-4 rounded-xl transition ${
              mainTab === 'settings'
                ? 'text-indigo-600 font-bold bg-indigo-50/70'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <Sliders size={20} />
            <span className="text-[11px]">Settings</span>
          </button>
        </nav>
      )}

      {/* Bank SMS Tracker Modal (still available for desktop or deep modal invocation) */}
      <BankSmsTrackerModal
        isOpen={smsModalOpen}
        onClose={() => setSmsModalOpen(false)}
        categories={categories}
        onSaveExpense={save}
        onSaveIncome={saveIncome}
        pendingTransactions={pendingSmsTxs}
        onRemoveTransaction={id => setPendingSmsTxs(prev => prev.filter(t => t.id !== id))}
        onAddTransactions={txs => {
          setPendingSmsTxs(prev => {
            const existingIds = new Set(prev.map(t => t.id))
            const newTxs = txs.filter(t => !existingIds.has(t.id))
            return [...newTxs, ...prev]
          })
        }}
      />
    </div>
  )
}

