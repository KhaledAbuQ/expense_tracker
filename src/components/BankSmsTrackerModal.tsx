import { useState, useEffect, useMemo } from 'react'
import {
  X,
  MessageSquare,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Sliders,
  ArrowRight,
  ShieldCheck,
  Zap,
  Eye,
  Trash2,
  Calendar,
  TrendingDown,
  TrendingUp,
  Sparkles,
} from 'lucide-react'
import {
  ParsedBankTransaction,
  rememberSmsCategory,
  matchCategory,
} from '../lib/smsParser'
import {
  isNativeSmsAvailable,
  checkSmsPermissions,
  requestSmsPermissions,
  checkNotificationPermission,
  requestNotificationPermission,
  scanRecentBankTransactions,
  getSmsSettings,
  saveSmsSettings,
  markTransactionProcessed,
  SmsTrackingSettings,
} from '../lib/bankSms'
import { Category, ExpenseFormData, IncomeFormData, Visibility } from '../types'
import { formatCurrency } from '../lib/utils'
import toast from 'react-hot-toast'

interface BankSmsTrackerModalProps {
  isOpen: boolean
  onClose: () => void
  categories: Category[]
  onSaveExpense: (data: ExpenseFormData) => Promise<void>
  onSaveIncome?: (data: IncomeFormData) => Promise<void>
  pendingTransactions: ParsedBankTransaction[]
  onRemoveTransaction: (id: string) => void
  onAddTransactions: (txs: ParsedBankTransaction[]) => void
  initialTab?: 'pending' | 'settings'
}

function formatGroupDateHeader(dateStr: string): string {
  try {
    const todayStr = new Date().toISOString().split('T')[0]
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0]

    const parsed = new Date(`${dateStr}T00:00:00`)
    const formatted = parsed.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })

    if (dateStr === todayStr) return `Today — ${formatted}`
    if (dateStr === yesterday) return `Yesterday — ${formatted}`
    return formatted
  } catch {
    return dateStr
  }
}

export default function BankSmsTrackerModal({
  isOpen,
  onClose,
  categories,
  onSaveExpense,
  onSaveIncome,
  pendingTransactions,
  onRemoveTransaction,
  onAddTransactions,
  initialTab = 'pending',
}: BankSmsTrackerModalProps) {
  const [activeTab, setActiveTab] = useState<'pending' | 'settings'>(initialTab)

  useEffect(() => {
    if (isOpen && initialTab) {
      setActiveTab(initialTab)
    }
  }, [isOpen, initialTab])
  const [filterType, setFilterType] = useState<'all' | 'expense' | 'income'>('all')
  const [isNative, setIsNative] = useState(false)
  const [permissionsGranted, setPermissionsGranted] = useState(false)
  const [notificationsGranted, setNotificationsGranted] = useState(false)
  const [checkingPerms, setCheckingPerms] = useState(false)
  const [scanning, setScanning] = useState(false)
  const [settings, setSettings] = useState<SmsTrackingSettings>(getSmsSettings())
  const [savingIndex, setSavingIndex] = useState<string | null>(null)
  const [savingAll, setSavingAll] = useState(false)

  // Local state for pending transactions being reviewed
  const [editingTxs, setEditingTxs] = useState<{
    [id: string]: {
      merchant: string
      amount: number
      categoryId: string
      categoryChanged: boolean
      visibility: Visibility
      date: string
      showRaw: boolean
    }
  }>({})

  useEffect(() => {
    if (!isOpen) return

    void isNativeSmsAvailable().then(avail => {
      setIsNative(avail)
      if (avail) {
        void Promise.all([checkSmsPermissions(), checkNotificationPermission()]).then(([status, notificationsAllowed]) => {
          setPermissionsGranted(status.granted)
          setNotificationsGranted(notificationsAllowed)
        })
      }
    })
  }, [isOpen])

  // Sync editing items when pendingTransactions change
  useEffect(() => {
    setEditingTxs(current => {
      const nextEditing = { ...current }
      for (const tx of pendingTransactions) {
        if (!nextEditing[tx.id]) {
          nextEditing[tx.id] = {
            merchant: tx.merchant,
            amount: tx.amount,
            categoryId: tx.suggestedCategoryId || '',
            categoryChanged: false,
            visibility: settings.defaultVisibility,
            date: tx.date,
            showRaw: false,
          }
        } else if (!nextEditing[tx.id].categoryChanged) {
          nextEditing[tx.id] = { ...nextEditing[tx.id], categoryId: tx.suggestedCategoryId || '' }
        }
      }
      return nextEditing
    })
  }, [pendingTransactions, settings.defaultVisibility])

  // Filter pending transactions by type
  const filteredTransactions = useMemo(() => {
    if (filterType === 'all') return pendingTransactions
    return pendingTransactions.filter(t => t.type === filterType)
  }, [pendingTransactions, filterType])

  // Group transactions by date in reverse chronological order
  const groupedByDate = useMemo(() => {
    const map: { [dateStr: string]: ParsedBankTransaction[] } = {}
    for (const tx of filteredTransactions) {
      if (!map[tx.date]) map[tx.date] = []
      map[tx.date].push(tx)
    }
    return Object.entries(map).sort(([dateA], [dateB]) => dateB.localeCompare(dateA))
  }, [filteredTransactions])

  // Counts for tabs
  const expenseCount = useMemo(() => pendingTransactions.filter(t => t.type === 'expense').length, [pendingTransactions])
  const incomeCount = useMemo(() => pendingTransactions.filter(t => t.type === 'income').length, [pendingTransactions])

  if (!isOpen) return null

  const handleRequestPerms = async () => {
    setCheckingPerms(true)
    try {
      const res = await requestSmsPermissions()
      const notificationsAllowed = await requestNotificationPermission()
      setPermissionsGranted(res.granted)
      setNotificationsGranted(notificationsAllowed)
      if (res.granted && notificationsAllowed) {
        toast.success('SMS tracking and notifications are ready')
      } else if (res.granted) {
        toast.error('SMS tracking is ready, but Android notifications are disabled')
      } else {
        toast.error('SMS permissions denied. Enable them in Android App Settings.')
      }
    } catch {
      toast.error('Could not request permissions.')
    } finally {
      setCheckingPerms(false)
    }
  }

  const handleScan = async (days: number = 0) => {
    setScanning(true)
    try {
      const found = await scanRecentBankTransactions(categories, days, 500)
      if (found.length === 0) {
        toast('No new bank transactions found in SMS.', { icon: 'ℹ️' })
      } else {
        toast.success(`Found ${found.length} bank ${found.length === 1 ? 'transaction' : 'transactions'} organized by date!`)
        onAddTransactions(found)
        setActiveTab('pending')
      }
    } catch (err) {
      toast.error('Failed to scan SMS: ' + (err instanceof Error ? err.message : 'Unknown error'))
    } finally {
      setScanning(false)
    }
  }

  const handleSaveOne = async (tx: ParsedBankTransaction) => {
    const edit = editingTxs[tx.id]
    if (!edit) return

    setSavingIndex(tx.id)
    try {
      if (tx.type === 'income' && onSaveIncome) {
        await onSaveIncome({
          amount: edit.amount,
          description: edit.merchant,
          category_id: edit.categoryId,
          visibility: edit.visibility,
          date: edit.date,
          account_type: 'bank',
        })
        toast.success(`Saved Income: ${edit.merchant}`)
      } else {
        await onSaveExpense({
          amount: edit.amount,
          description: edit.merchant,
          category_id: edit.categoryId,
          visibility: edit.visibility,
          date: edit.date,
          account_type: 'bank',
        })
        toast.success(`Saved Expense: ${edit.merchant}`)
      }
      if (edit.categoryChanged && edit.categoryId && edit.merchant) {
        rememberSmsCategory(tx, edit.categoryId, edit.merchant)
      }
      markTransactionProcessed(tx.smsId)
      onRemoveTransaction(tx.id)
    } catch {
      toast.error('Failed to save transaction')
    } finally {
      setSavingIndex(null)
    }
  }

  const handleSaveAll = async () => {
    if (pendingTransactions.length === 0) return
    setSavingAll(true)
    let savedCount = 0

    try {
      for (const tx of pendingTransactions) {
        const edit = editingTxs[tx.id]
        if (!edit) continue

        if (tx.type === 'income' && onSaveIncome) {
          await onSaveIncome({
            amount: edit.amount,
            description: edit.merchant,
            category_id: edit.categoryId,
            visibility: edit.visibility,
            date: edit.date,
            account_type: 'bank',
          })
        } else {
          await onSaveExpense({
            amount: edit.amount,
            description: edit.merchant,
            category_id: edit.categoryId,
            visibility: edit.visibility,
            date: edit.date,
            account_type: 'bank',
          })
        }
        if (edit.categoryChanged && edit.categoryId && edit.merchant) {
          rememberSmsCategory(tx, edit.categoryId, edit.merchant)
        }
        markTransactionProcessed(tx.smsId)
        onRemoveTransaction(tx.id)
        savedCount++
      }
      toast.success(`Saved all ${savedCount} transactions!`)
    } catch {
      toast.error(`Saved ${savedCount} transactions, but some failed.`)
    } finally {
      setSavingAll(false)
    }
  }

  const handleDismiss = (tx: ParsedBankTransaction) => {
    markTransactionProcessed(tx.smsId)
    onRemoveTransaction(tx.id)
  }

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="bank-sms-title" className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm">
      <div className="flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-3xl bg-white text-slate-900 shadow-2xl dark:bg-gray-900 dark:text-gray-100">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 dark:border-gray-700">
          <div className="flex items-center gap-2.5">
            <div className="rounded-xl bg-indigo-50 p-2 text-indigo-600 dark:bg-indigo-950 dark:text-indigo-300">
              <MessageSquare size={22} />
            </div>
            <div>
              <h2 id="bank-sms-title" className="text-lg font-bold text-slate-900 dark:text-white">Bank SMS Auto-Tracking</h2>
              <p className="text-xs text-slate-500 dark:text-gray-400">Scan & auto-track bank debit/credit messages by date</p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close modal"
            className="rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-gray-800 dark:hover:text-gray-200"
          >
            <X size={20} />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-100 bg-slate-50/70 px-4 text-xs font-semibold dark:border-gray-700 dark:bg-gray-800">
          <button
            onClick={() => setActiveTab('pending')}
            className={`relative flex items-center gap-1.5 px-3 py-3 ${
              activeTab === 'pending'
                ? 'text-indigo-600 border-b-2 border-indigo-600 font-bold'
                : 'text-slate-600 hover:text-slate-900 dark:text-gray-300 dark:hover:text-white'
            }`}
          >
            Pending Approvals
            {pendingTransactions.length > 0 && (
              <span className="ml-1 rounded-full bg-indigo-600 px-1.5 py-0.5 text-[10px] text-white">
                {pendingTransactions.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('settings')}
            className={`flex items-center gap-1.5 px-3 py-3 ${
              activeTab === 'settings'
                ? 'text-indigo-600 border-b-2 border-indigo-600 font-bold'
                : 'text-slate-600 hover:text-slate-900 dark:text-gray-300 dark:hover:text-white'
            }`}
          >
            Settings
          </button>


        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* Permission warning banner if on native and not granted */}
          {isNative && (!permissionsGranted || !notificationsGranted) && (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-900 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-100">
              <div className="flex items-start gap-3">
                <AlertCircle className="mt-0.5 shrink-0 text-amber-600" size={18} />
                <div className="text-xs">
                  <p className="font-semibold">Enable bank alerts</p>
                  <p className="mt-1 text-amber-700 dark:text-amber-200">
                    Grant SMS access to detect bank transactions and allow notifications so alerts appear in Android’s notification shade.
                  </p>
                  <button
                    disabled={checkingPerms}
                    onClick={() => void handleRequestPerms()}
                    className="mt-3 inline-flex items-center gap-1 rounded-xl bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-amber-700"
                  >
                    <ShieldCheck size={14} /> Enable SMS & Notifications
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 1: PENDING TRANSACTIONS GROUPED BY DATE */}
          {activeTab === 'pending' && (
            <div className="space-y-4">
              {pendingTransactions.length === 0 ? (
                <div className="py-12 text-center">
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400 dark:bg-gray-800 dark:text-gray-500">
                    <CheckCircle2 size={24} />
                  </div>
                  <h3 className="mt-3 text-sm font-semibold text-slate-900 dark:text-white">All caught up!</h3>
                  <p className="mt-1 text-xs text-slate-500 dark:text-gray-400 max-w-xs mx-auto">
                    No pending bank transactions waiting for approval. To scan past bank messages (last 7 days, 30 days, or all messages), open the Settings tab.
                  </p>
                  <button
                    onClick={() => setActiveTab('settings')}
                    className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-indigo-700"
                  >
                    <Sliders size={14} /> Open SMS Settings
                  </button>
                </div>
              ) : (
                <>
                  {/* Top Bar: Filter Pills & Bulk Action */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => setFilterType('all')}
                        className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition ${
                          filterType === 'all'
                            ? 'bg-indigo-600 text-white shadow-sm'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700'
                        }`}
                      >
                        All ({pendingTransactions.length})
                      </button>
                      <button
                        onClick={() => setFilterType('expense')}
                        className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition ${
                          filterType === 'expense'
                            ? 'bg-rose-600 text-white shadow-sm'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700'
                        }`}
                      >
                        Expenses ({expenseCount})
                      </button>
                      <button
                        onClick={() => setFilterType('income')}
                        className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition ${
                          filterType === 'income'
                            ? 'bg-emerald-600 text-white shadow-sm'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700'
                        }`}
                      >
                        Income ({incomeCount})
                      </button>
                    </div>

                    <button
                      disabled={savingAll || savingIndex !== null}
                      data-haptic="impact" onClick={() => void handleSaveAll()}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-indigo-700 disabled:opacity-50"
                    >
                      {savingAll ? <RefreshCw size={13} className="animate-spin" /> : <Zap size={13} />}
                      Save All ({pendingTransactions.length})
                    </button>
                  </div>

                  {/* Date Groups */}
                  <div className="space-y-6">
                    {groupedByDate.map(([dateKey, txList]) => {
                      const dayExpenses = txList.filter(t => t.type === 'expense').reduce((sum, t) => sum + (editingTxs[t.id]?.amount || t.amount), 0)
                      const dayIncome = txList.filter(t => t.type === 'income').reduce((sum, t) => sum + (editingTxs[t.id]?.amount || t.amount), 0)

                      return (
                        <div key={dateKey} className="space-y-2.5">
                          {/* Date Group Header */}
                          <div className="flex items-center justify-between border-b border-slate-200 pb-1.5 dark:border-gray-700">
                            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800 dark:text-gray-100">
                              <Calendar size={14} className="text-indigo-600" />
                              <span>{formatGroupDateHeader(dateKey)}</span>
                            </div>
                            <div className="flex items-center gap-2 text-[11px]">
                              {dayIncome > 0 && (
                                <span className="font-semibold text-emerald-600">
                                  +{formatCurrency(dayIncome)}
                                </span>
                              )}
                              {dayExpenses > 0 && (
                                <span className="font-semibold text-rose-600">
                                  -{formatCurrency(dayExpenses)}
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Transaction Cards for this Date */}
                          <div className="space-y-3">
                            {txList.map(tx => {
                              const edit = editingTxs[tx.id] || {
                                merchant: tx.merchant,
                                amount: tx.amount,
                                categoryId: tx.suggestedCategoryId || '',
                                categoryChanged: false,
                                visibility: settings.defaultVisibility,
                                date: tx.date,
                                showRaw: false,
                              }

                              const isIncome = tx.type === 'income'
                              const categoryOptions = categories.filter(c =>
                                isIncome ? c.category_type !== 'expense' : c.category_type !== 'income'
                              )

                              return (
                                <div
                                  key={tx.id}
                                  className={`rounded-2xl border p-4 shadow-sm space-y-3 ${
                                    isIncome
                                      ? 'border-emerald-200 bg-emerald-50/20 dark:border-emerald-900 dark:bg-emerald-950/20'
                                      : 'border-slate-200 bg-white dark:border-gray-700 dark:bg-gray-900'
                                  }`}
                                >
                                  {/* Card Header: Type Badge, Amount, Card ending */}
                                  <div className="flex items-start justify-between gap-2">
                                    <div>
                                      <div className="flex items-center gap-1.5 flex-wrap">
                                        <span
                                          className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                                            isIncome
                                              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200'
                                              : 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-200'
                                          }`}
                                        >
                                          {isIncome ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
                                          {isIncome ? 'Credited / Income' : 'Debited / Expense'}
                                        </span>

                                        <span className="text-xs font-semibold text-slate-700 dark:text-gray-200">{tx.sender}</span>

                                        {tx.accountEnding && (
                                          <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-600 font-mono dark:bg-gray-800 dark:text-gray-300">
                                            •{tx.accountEnding}
                                          </span>
                                        )}
                                      </div>

                                      {tx.availableBalance !== undefined && (
                                        <p className="mt-1 text-[11px] text-slate-400 dark:text-gray-500">
                                          Balance: <span className="font-mono">{formatCurrency(tx.availableBalance)}</span>
                                        </p>
                                      )}
                                    </div>

                                    <span
                                      className={`text-base font-bold ${
                                        isIncome ? 'text-emerald-600' : 'text-slate-900 dark:text-white'
                                      }`}
                                    >
                                      {isIncome ? '+' : '-'}{formatCurrency(edit.amount)}
                                    </span>
                                  </div>

                                  {/* Editable Description & Category */}
                                  <div className="grid grid-cols-2 gap-2 text-xs">
                                    <div>
                                      <label className="mb-1 block text-[10px] font-medium text-slate-500 dark:text-gray-400">
                                        {isIncome ? 'Source / Sender' : 'Merchant / Description'}
                                      </label>
                                      <input
                                        type="text"
                                        value={edit.merchant}
                                        onChange={e => {
                                          setEditingTxs(prev => ({
                                            ...prev,
                                            [tx.id]: { ...prev[tx.id], merchant: e.target.value },
                                          }))
                                        }}
                                        className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-800 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
                                      />
                                    </div>

                                    <div>
                                      <div className="flex items-center justify-between mb-1">
                                        <label className="text-[10px] font-medium text-slate-500 dark:text-gray-400">
                                          Category
                                        </label>
                                        {tx.isAutoDetected && !edit.categoryChanged && (
                                        <span className="inline-flex items-center gap-0.5 rounded bg-indigo-50 px-1.5 py-0.5 text-[9px] font-semibold text-indigo-600 dark:bg-indigo-950 dark:text-indigo-300">
                                            <Sparkles size={9} /> Auto-detected
                                          </span>
                                        )}
                                      </div>
                                      <select
                                        value={edit.categoryId}
                                        onChange={e => {
                                          const categoryId = e.target.value
                                          rememberSmsCategory(tx, categoryId, edit.merchant)
                                          setEditingTxs(prev => {
                                            const next = { ...prev, [tx.id]: { ...prev[tx.id], categoryId, categoryChanged: true } }
                                            if (categoryId) for (const other of pendingTransactions) {
                                              if (other.id === tx.id || !next[other.id] || next[other.id].categoryChanged) continue
                                              const match = matchCategory(other.merchant, other.rawBody, other.type, categories, other.sender)
                                              if (match.categoryId) next[other.id] = { ...next[other.id], categoryId: match.categoryId }
                                            }
                                            return next
                                          })
                                        }}
                                        className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-800 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
                                      >
                                        <option value="">Select Category</option>
                                        {categoryOptions.map(c => (
                                          <option key={c.id} value={c.id}>
                                            {c.name}
                                          </option>
                                        ))}
                                      </select>
                                      {edit.categoryChanged && edit.categoryId && <p className="mt-1 text-[10px] text-indigo-600">Remembered for similar future messages</p>}
                                    </div>
                                  </div>

                                  {/* Visibility & Toggle Raw */}
                                  <div className="flex items-center justify-between gap-2 border-t border-slate-100 pt-1 dark:border-gray-700">
                                    <div className="flex items-center gap-3">
                                      <label className="flex items-center gap-1 text-[11px] text-slate-600 dark:text-gray-300">
                                        <input
                                          type="radio"
                                          name={`vis-${tx.id}`}
                                          checked={edit.visibility === 'household'}
                                          onChange={() =>
                                            setEditingTxs(prev => ({
                                              ...prev,
                                              [tx.id]: { ...prev[tx.id], visibility: 'household' },
                                            }))
                                          }
                                          className="text-indigo-600"
                                        />
                                        Shared
                                      </label>
                                      <label className="flex items-center gap-1 text-[11px] text-slate-600 dark:text-gray-300">
                                        <input
                                          type="radio"
                                          name={`vis-${tx.id}`}
                                          checked={edit.visibility === 'private'}
                                          onChange={() =>
                                            setEditingTxs(prev => ({
                                              ...prev,
                                              [tx.id]: { ...prev[tx.id], visibility: 'private' },
                                            }))
                                          }
                                          className="text-indigo-600"
                                        />
                                        Personal
                                      </label>
                                    </div>

                                    <button
                                      type="button"
                                      onClick={() => {
                                        setEditingTxs(prev => ({
                                          ...prev,
                                          [tx.id]: { ...prev[tx.id], showRaw: !prev[tx.id]?.showRaw },
                                        }))
                                      }}
                                      className="inline-flex items-center gap-1 text-[11px] text-slate-400 hover:text-slate-600 dark:hover:text-gray-200"
                                    >
                                      <Eye size={12} /> {edit.showRaw ? 'Hide SMS' : 'View SMS'}
                                    </button>
                                  </div>

                                  {edit.showRaw && (
                                    <div className="rounded-lg bg-slate-50 p-2.5 text-[11px] text-slate-600 font-mono whitespace-pre-wrap dark:bg-gray-800 dark:text-gray-300">
                                      {tx.rawBody}
                                    </div>
                                  )}

                                  {/* Action Buttons */}
                                  <div className="flex items-center justify-end gap-2 pt-1">
                                    <button
                                      data-haptic="impact" onClick={() => handleDismiss(tx)}
                                      className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs text-slate-500 hover:bg-slate-100 dark:text-gray-400 dark:hover:bg-gray-800"
                                    >
                                      <Trash2 size={13} /> Dismiss
                                    </button>
                                    <button
                                      disabled={savingAll || savingIndex !== null}
                                      data-haptic="impact" onClick={() => void handleSaveOne(tx)}
                                      className={`inline-flex items-center gap-1 rounded-lg px-3.5 py-1.5 text-xs font-semibold text-white shadow-sm disabled:opacity-50 ${
                                        isIncome
                                          ? 'bg-emerald-600 hover:bg-emerald-700'
                                          : 'bg-indigo-600 hover:bg-indigo-700'
                                      }`}
                                    >
                                      {savingIndex === tx.id ? (
                                        <RefreshCw size={13} className="animate-spin" />
                                      ) : (
                                        <ArrowRight size={13} />
                                      )}
                                      {isIncome ? 'Save Income' : 'Save Expense'}
                                    </button>
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </>
              )}
            </div>
          )}

          {/* TAB 2: SETTINGS (Includes Auto/Approval mode & Scan Old Messages: 7 days, 30 days, all) */}
          {activeTab === 'settings' && (
            <div className="space-y-4 text-xs">
              {/* Scan Old Bank Messages Section */}
              <div className="space-y-3 rounded-2xl border border-indigo-100 bg-indigo-50/60 p-4 dark:border-indigo-900 dark:bg-indigo-950/30">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="flex items-center gap-1.5 font-bold text-indigo-950 dark:text-indigo-100">
                      <RefreshCw size={15} className={scanning ? 'animate-spin text-indigo-600' : 'text-indigo-600'} />
                      Scan Old Bank Messages
                    </h4>
                    <p className="mt-0.5 text-[11px] text-slate-600 dark:text-gray-300">
                      Scan your inbox for past bank transactions with automatically detected categories:
                    </p>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-2 pt-1">
                  <button
                    disabled={scanning}
                    onClick={() => void handleScan(7)}
                    className="flex-1 rounded-xl border border-indigo-200 bg-white px-3 py-2.5 text-xs font-semibold text-indigo-900 shadow-sm transition hover:bg-indigo-50/80 disabled:opacity-50 dark:border-indigo-800 dark:bg-gray-800 dark:text-indigo-200 dark:hover:bg-gray-700"
                  >
                    📅 Last 7 Days
                  </button>
                  <button
                    disabled={scanning}
                    onClick={() => void handleScan(30)}
                    className="flex-1 rounded-xl border border-indigo-200 bg-white px-3 py-2.5 text-xs font-semibold text-indigo-900 shadow-sm transition hover:bg-indigo-50/80 disabled:opacity-50 dark:border-indigo-800 dark:bg-gray-800 dark:text-indigo-200 dark:hover:bg-gray-700"
                  >
                    📅 Last 30 Days
                  </button>
                  <button
                    disabled={scanning}
                    onClick={() => void handleScan(0)}
                    className="flex-1 rounded-xl bg-indigo-600 py-2.5 px-3 text-xs font-bold text-white shadow-sm hover:bg-indigo-700 disabled:opacity-50 transition"
                  >
                    🔄 All Messages
                  </button>
                </div>

                {scanning && (
                  <p className="text-center text-[11px] font-medium text-indigo-700 animate-pulse pt-1">
                    Scanning SMS messages and detecting categories…
                  </p>
                )}

                {!isNative && (
                  <div className="rounded-xl border border-indigo-100 bg-white/80 p-2.5 text-[11px] text-slate-500 dark:border-indigo-900 dark:bg-gray-900/80 dark:text-gray-400">
                    Bank SMS scanning is available in the Android app.
                  </div>
                )}
              </div>

              {/* Mode Selection */}
              <div className="space-y-4 rounded-2xl border border-slate-200 p-4 dark:border-gray-700">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-bold text-slate-900 dark:text-white">Auto-Tracking Mode</h4>
                    <p className="text-[11px] text-slate-500 dark:text-gray-400">
                      Choose whether incoming bank messages require confirmation or are logged automatically.
                    </p>
                  </div>
                  <Sliders size={18} className="text-slate-400" />
                </div>

                <div className="space-y-2">
                  <label className="flex cursor-pointer items-start gap-2.5 rounded-xl border border-slate-100 p-3 transition hover:bg-slate-50 dark:border-gray-700 dark:hover:bg-gray-800">
                    <input
                      type="radio"
                      name="mode"
                      checked={settings.mode !== 'auto'}
                      onChange={() => {
                        const updated = saveSmsSettings({ mode: 'approval', notifyEveryTransaction: true })
                        setSettings(updated)
                      }}
                      className="mt-0.5 text-indigo-600"
                    />
                    <div>
                      <span className="font-semibold text-slate-800 dark:text-gray-100">
                        Notify & Ask for Approval (with Edit Option)
                      </span>
                      <p className="mt-0.5 text-[11px] text-slate-500 dark:text-gray-400">
                        Sends a notification for each transaction and lets you review, edit category/amount, and approve before adding.
                      </p>
                    </div>
                  </label>

                  <label className="flex cursor-pointer items-start gap-2.5 rounded-xl border border-slate-100 p-3 transition hover:bg-slate-50 dark:border-gray-700 dark:hover:bg-gray-800">
                    <input
                      type="radio"
                      name="mode"
                      checked={settings.mode === 'auto'}
                      onChange={() => {
                        const updated = saveSmsSettings({ mode: 'auto' })
                        setSettings(updated)
                      }}
                      className="mt-0.5 text-indigo-600"
                    />
                    <div>
                      <span className="font-semibold text-slate-800 dark:text-gray-100">Zero-Click Auto-Save</span>
                      <p className="mt-0.5 text-[11px] text-slate-500 dark:text-gray-400">
                        Saves transactions with a recognized category when the app is active. Uncertain matches stay in the review inbox.
                      </p>
                    </div>
                  </label>
                </div>

                {/* Category Detection Info */}
                <div className="flex items-start gap-2.5 border-t border-slate-100 pt-3 text-[11px] text-slate-600 dark:border-gray-700 dark:text-gray-300">
                  <Sparkles size={16} className="text-indigo-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold text-slate-800 dark:text-gray-100">Automatic Category Detection Active</span>
                    <p className="mt-0.5 text-slate-500 dark:text-gray-400">
                      Intelligently matches Jordanian bank merchants and CliQ transfers to categories. Your category choices are remembered for future messages from the same merchant or SMS pattern.
                    </p>
                  </div>
                </div>

                {/* Default Visibility */}
                <div className="border-t border-slate-100 pt-3 dark:border-gray-700">
                  <label className="mb-1 block font-medium text-slate-700 dark:text-gray-200">
                    Default Visibility for Bank Transactions
                  </label>
                  <select
                    value={settings.defaultVisibility}
                    onChange={e => {
                      const updated = saveSmsSettings({ defaultVisibility: e.target.value as Visibility })
                      setSettings(updated)
                    }}
                    className="w-full rounded-xl border border-slate-200 bg-white p-2 text-xs text-slate-800 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
                  >
                    <option value="household">Shared Household (Everyone in household sees it)</option>
                    <option value="private">Personal (Only visible to you)</option>
                  </select>
                </div>
              </div>
            </div>
          )}

        </div>

        {/* Modal Footer */}
        <div className="border-t border-slate-100 bg-slate-50/50 px-6 py-3 text-right dark:border-gray-700 dark:bg-gray-800/80">
          <button
            onClick={onClose}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-700"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
