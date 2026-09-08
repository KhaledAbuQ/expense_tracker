import { useMemo, useState } from 'react'
import {
  ArrowRightLeft,
  Trash2,
  Pencil,
  Building2,
  Banknote,
  ArrowRight,
  HandCoins,
  BarChart3,
  GitCompareArrows,
  Coins,
} from 'lucide-react'
import { endOfMonth, format, parse, startOfMonth, subMonths } from 'date-fns'
import { useTransfers } from '../hooks/useTransfers'
import { useExpenses } from '../hooks/useExpenses'
import { useCategories } from '../hooks/useCategories'
import TransferForm from '../components/TransferForm'
import Modal from '../components/Modal'
import DateRangePicker from '../components/DateRangePicker'
import ExpenseLineChart from '../components/charts/ExpenseLineChart'
import { Transfer, TransferFormData, DateRange, TransferAccountType, ChartDataPoint } from '../types'
import {
  getDateRange,
  formatCurrency,
  formatDate,
  calculateAverageDaily,
  calculatePercentChange,
  calculateTotalExpenses,
  getDaysInRange,
  groupExpensesByCategory,
  groupExpensesByDate,
} from '../lib/utils'
import { GOLD_ITEM_LABELS } from '../lib/gold'
import { useAuth } from '../context/AuthContext'

const accountIcons: Record<TransferAccountType, typeof Building2> = {
  bank: Building2,
  cash: Banknote,
  savings: HandCoins,
  gold: Coins,
}

const accountLabels: Record<TransferAccountType, string> = {
  bank: 'Bank',
  cash: 'Cash',
  savings: 'Savings',
  gold: 'Gold',
}

const accountColors: Record<TransferAccountType, string> = {
  bank: 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/50',
  cash: 'text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-950/50',
  savings: 'text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-950/50',
  gold: 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/50',
}

/** One-line summary of the metal a gold transfer moved, e.g. "2 x English lira (22k, 15.98 g)". */
function describeGold(transfer: Transfer): string | null {
  if (!transfer.gold_item_type || !transfer.gold_grams) return null

  const grams = `${Number(transfer.gold_grams).toFixed(2)} g`
  const karat = transfer.gold_karat ? `${transfer.gold_karat}k` : ''

  if (transfer.gold_item_type === 'bullion') {
    return `${grams} of ${karat} gold`
  }

  const count = Number(transfer.gold_quantity ?? 0)
  const name = GOLD_ITEM_LABELS[transfer.gold_item_type]
  return `${count} x ${name} (${karat}, ${grams})`
}

type TransfersTab = 'activity' | 'history'
type PeriodMode = 'month' | 'range'

interface HistoryPeriodState {
  mode: PeriodMode
  month: string
  range: DateRange
}

interface CategoryComparisonRow {
  name: string
  color?: string
  periodA: number
  periodB: number
  difference: number
  percentChange: number
}

function getCurrentMonthKey(): string {
  return format(new Date(), 'yyyy-MM')
}

function monthToDateRange(month: string): DateRange {
  const parsed = parse(month, 'yyyy-MM', new Date())
  const safeDate = Number.isNaN(parsed.getTime()) ? new Date() : parsed
  return {
    start: startOfMonth(safeDate),
    end: endOfMonth(safeDate),
  }
}

function normalizeRange(range: DateRange): DateRange {
  if (range.start <= range.end) return range
  return { start: range.end, end: range.start }
}

function parseDateInput(value: string): Date | null {
  const parsed = new Date(`${value}T00:00:00`)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

function formatRangeLabel(range: DateRange): string {
  return `${format(range.start, 'MMM d, yyyy')} to ${format(range.end, 'MMM d, yyyy')}`
}

function buildCategoryComparison(periodAData: ChartDataPoint[], periodBData: ChartDataPoint[]): CategoryComparisonRow[] {
  const merged = new Map<string, CategoryComparisonRow>()

  periodAData.forEach((item) => {
    merged.set(item.name, {
      name: item.name,
      color: item.color,
      periodA: item.value,
      periodB: 0,
      difference: item.value,
      // Spent in the primary period, nothing in the comparison period. This was
      // hardcoded to 0, so a brand-new category displayed "+0.0%" beside a large
      // positive difference. The mirrored branch below already did this right.
      percentChange: calculatePercentChange(item.value, 0),
    })
  })

  periodBData.forEach((item) => {
    const existing = merged.get(item.name)
    if (existing) {
      existing.periodB = item.value
      existing.color = existing.color || item.color
      existing.difference = existing.periodA - existing.periodB
      existing.percentChange = calculatePercentChange(existing.periodA, existing.periodB)
      return
    }

    merged.set(item.name, {
      name: item.name,
      color: item.color,
      periodA: 0,
      periodB: item.value,
      difference: -item.value,
      percentChange: calculatePercentChange(0, item.value),
    })
  })

  return Array.from(merged.values()).sort((a, b) => b.periodA - a.periodA || b.periodB - a.periodB)
}

export default function TransfersPage() {
  const [activeTab, setActiveTab] = useState<TransfersTab>('activity')
  const [dateRange, setDateRange] = useState<DateRange>(getDateRange('month'))
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingTransfer, setEditingTransfer] = useState<Transfer | null>(null)
  const [isComparisonEnabled, setIsComparisonEnabled] = useState(true)

  const [primaryPeriod, setPrimaryPeriod] = useState<HistoryPeriodState>({
    mode: 'month',
    month: getCurrentMonthKey(),
    range: getDateRange('month'),
  })

  const [comparisonPeriod, setComparisonPeriod] = useState<HistoryPeriodState>({
    mode: 'month',
    month: format(subMonths(new Date(), 1), 'yyyy-MM'),
    range: getDateRange('last-month'),
  })

  const { member } = useAuth()

  const { transfers, loading, addTransfer, updateTransfer, deleteTransfer } = useTransfers({
    dateRange,
  })

  const primaryDateRange = useMemo(
    () => (primaryPeriod.mode === 'month' ? monthToDateRange(primaryPeriod.month) : normalizeRange(primaryPeriod.range)),
    [primaryPeriod]
  )

  const comparisonDateRange = useMemo(
    () => (
      comparisonPeriod.mode === 'month'
        ? monthToDateRange(comparisonPeriod.month)
        : normalizeRange(comparisonPeriod.range)
    ),
    [comparisonPeriod]
  )

  const { expenses: primaryExpenses, loading: primaryExpensesLoading } = useExpenses({
    dateRange: primaryDateRange,
  })

  const { expenses: comparisonExpenses, loading: comparisonExpensesLoading } = useExpenses({
    dateRange: isComparisonEnabled ? comparisonDateRange : primaryDateRange,
  })

  const { categories, loading: categoriesLoading } = useCategories()

  const primaryCategoryBreakdown = useMemo(
    () => groupExpensesByCategory(primaryExpenses, categories),
    [primaryExpenses, categories]
  )

  const comparisonCategoryBreakdown = useMemo(
    () => groupExpensesByCategory(comparisonExpenses, categories),
    [comparisonExpenses, categories]
  )

  const primaryTotal = useMemo(() => calculateTotalExpenses(primaryExpenses), [primaryExpenses])
  const comparisonTotal = useMemo(() => calculateTotalExpenses(comparisonExpenses), [comparisonExpenses])

  const primaryDays = useMemo(() => getDaysInRange(primaryDateRange), [primaryDateRange])

  const primaryAverageDaily = useMemo(
    () => calculateAverageDaily(primaryExpenses, primaryDays),
    [primaryExpenses, primaryDays]
  )

  const primaryTopCategory = primaryCategoryBreakdown[0] ?? null

  const primaryTrendData = useMemo(() => groupExpensesByDate(primaryExpenses), [primaryExpenses])

  const categoryComparisonRows = useMemo(
    () => buildCategoryComparison(primaryCategoryBreakdown, comparisonCategoryBreakdown),
    [primaryCategoryBreakdown, comparisonCategoryBreakdown]
  )

  const totalComparisonDiff = primaryTotal - comparisonTotal
  const totalComparisonPercent = calculatePercentChange(primaryTotal, comparisonTotal)

  const primaryLabel =
    primaryPeriod.mode === 'month'
      ? format(primaryDateRange.start, 'MMMM yyyy')
      : formatRangeLabel(primaryDateRange)

  const comparisonLabel =
    comparisonPeriod.mode === 'month'
      ? format(comparisonDateRange.start, 'MMMM yyyy')
      : formatRangeLabel(comparisonDateRange)

  const trendsLoading = primaryExpensesLoading || categoriesLoading
  const comparisonLoading = comparisonExpensesLoading || categoriesLoading

  const handleSubmit = async (data: TransferFormData) => {
    if (!member) return
    const payload = {
      ...data,
      member_id: member.id,
    }

    if (editingTransfer) {
      await updateTransfer(editingTransfer.id, payload)
    } else {
      await addTransfer(payload)
    }
    setIsModalOpen(false)
    setEditingTransfer(null)
  }

  const handleEdit = (transfer: Transfer) => {
    setEditingTransfer(transfer)
    setIsModalOpen(true)
  }

  const handleCloseModal = () => {
    setIsModalOpen(false)
    setEditingTransfer(null)
  }

  const handlePrimaryRangeChange = (field: 'start' | 'end', value: string) => {
    const parsed = parseDateInput(value)
    if (!parsed) return

    setPrimaryPeriod((prev) => ({
      ...prev,
      range: {
        ...prev.range,
        [field]: parsed,
      },
    }))
  }

  const handleComparisonRangeChange = (field: 'start' | 'end', value: string) => {
    const parsed = parseDateInput(value)
    if (!parsed) return

    setComparisonPeriod((prev) => ({
      ...prev,
      range: {
        ...prev.range,
        [field]: parsed,
      },
    }))
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Transfers</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            Move money between your accounts
          </p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors w-full sm:w-auto"
        >
          <ArrowRightLeft className="w-5 h-5" />
          New Transfer
        </button>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl p-1 shadow-sm border border-gray-100 dark:border-gray-700 flex w-full sm:w-fit">
        <button
          type="button"
          onClick={() => setActiveTab('activity')}
          className={`flex-1 sm:flex-none px-3 sm:px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
            activeTab === 'activity'
              ? 'bg-blue-600 text-white'
              : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-gray-700'
          }`}
        >
          Transfer Activity
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('history')}
          className={`flex-1 sm:flex-none px-3 sm:px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
            activeTab === 'history'
              ? 'bg-blue-600 text-white'
              : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-gray-700'
          }`}
        >
          History & Trends
        </button>
      </div>

      {activeTab === 'activity' ? (
        <>
          <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border border-gray-100 dark:border-gray-700">
            <DateRangePicker value={dateRange} onChange={setDateRange} />
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
            {loading ? (
              <div className="p-8 text-center text-gray-500 dark:text-gray-400">Loading transfers...</div>
            ) : transfers.length === 0 ? (
              <div className="p-8 text-center">
                <ArrowRightLeft className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
                <p className="text-gray-500 dark:text-gray-400">No transfers found</p>
                <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">
                  Transfer money between your bank, cash, and savings accounts
                </p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100 dark:divide-gray-700">
                {transfers.map((transfer) => {
                  const FromIcon = accountIcons[transfer.from_account]
                  const ToIcon = accountIcons[transfer.to_account]

                  return (
                    <div
                      key={transfer.id}
                      className="p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                        <div className="flex items-start sm:items-center gap-3 min-w-0">
                          <div className="flex items-center gap-1.5 shrink-0">
                            <div className={`p-2 rounded-lg ${accountColors[transfer.from_account]}`}>
                              <FromIcon className="w-4 h-4 sm:w-5 sm:h-5" />
                            </div>

                            <ArrowRight className="w-3.5 h-3.5 text-gray-400 dark:text-gray-500 shrink-0" />

                            <div className={`p-2 rounded-lg ${accountColors[transfer.to_account]}`}>
                              <ToIcon className="w-4 h-4 sm:w-5 sm:h-5" />
                            </div>
                          </div>

                          <div className="min-w-0">
                            <p className="font-medium text-gray-900 dark:text-white text-sm sm:text-base">
                              {accountLabels[transfer.from_account]} → {accountLabels[transfer.to_account]}
                            </p>
                            <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">
                              {formatDate(transfer.date)}
                              {transfer.description && ` • ${transfer.description}`}
                            </p>
                            {describeGold(transfer) && (
                              <p className="text-xs text-amber-700 dark:text-amber-400 mt-0.5">
                                {describeGold(transfer)}
                              </p>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center justify-between sm:justify-end gap-3 pt-2 sm:pt-0 border-t sm:border-t-0 border-gray-100 dark:border-gray-700">
                          <span className="font-semibold text-gray-900 dark:text-white text-base sm:text-sm">
                            {formatCurrency(transfer.amount)}
                          </span>

                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => handleEdit(transfer)}
                              className="p-2 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                              title="Edit transfer"
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => deleteTransfer(transfer.id)}
                              className="p-2 text-gray-400 dark:text-gray-500 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-lg transition-colors"
                              title="Delete transfer"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </>
      ) : (
        <>
          <div className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow-sm border border-gray-100 dark:border-gray-700 space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Spending Trends Periods</h2>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  Pick a month or custom range to analyze category spending trends.
                </p>
              </div>

              <label className="inline-flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                <input
                  type="checkbox"
                  checked={isComparisonEnabled}
                  onChange={(e) => setIsComparisonEnabled(e.target.checked)}
                  className="w-4 h-4 rounded border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-blue-600 focus:ring-blue-500"
                />
                Enable period comparison
              </label>
            </div>

            <div className={`grid gap-4 ${isComparisonEnabled ? 'lg:grid-cols-2' : 'grid-cols-1'}`}>
              <div className="rounded-xl border border-gray-200 dark:border-gray-700 p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-gray-900 dark:text-white">Primary Period</p>
                  <span className="text-xs text-gray-500 dark:text-gray-400">{primaryLabel}</span>
                </div>

                <div className="inline-flex rounded-lg border border-gray-200 dark:border-gray-700 p-1">
                  <button
                    type="button"
                    onClick={() => setPrimaryPeriod((prev) => ({ ...prev, mode: 'month' }))}
                    className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                      primaryPeriod.mode === 'month'
                        ? 'bg-blue-600 text-white'
                        : 'text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-white'
                    }`}
                  >
                    Month
                  </button>
                  <button
                    type="button"
                    onClick={() => setPrimaryPeriod((prev) => ({ ...prev, mode: 'range' }))}
                    className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                      primaryPeriod.mode === 'range'
                        ? 'bg-blue-600 text-white'
                        : 'text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-white'
                    }`}
                  >
                    Custom Range
                  </button>
                </div>

                {primaryPeriod.mode === 'month' ? (
                  <input
                    type="month"
                    value={primaryPeriod.month}
                    onChange={(e) => setPrimaryPeriod((prev) => ({ ...prev, month: e.target.value || getCurrentMonthKey() }))}
                    className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <input
                      type="date"
                      value={format(primaryPeriod.range.start, 'yyyy-MM-dd')}
                      onChange={(e) => handlePrimaryRangeChange('start', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                    <input
                      type="date"
                      value={format(primaryPeriod.range.end, 'yyyy-MM-dd')}
                      onChange={(e) => handlePrimaryRangeChange('end', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                )}
              </div>

              {isComparisonEnabled && (
                <div className="rounded-xl border border-gray-200 dark:border-gray-700 p-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-gray-900 dark:text-white">Comparison Period</p>
                    <span className="text-xs text-gray-500 dark:text-gray-400">{comparisonLabel}</span>
                  </div>

                  <div className="inline-flex rounded-lg border border-gray-200 dark:border-gray-700 p-1">
                    <button
                      type="button"
                      onClick={() => setComparisonPeriod((prev) => ({ ...prev, mode: 'month' }))}
                      className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                        comparisonPeriod.mode === 'month'
                          ? 'bg-blue-600 text-white'
                          : 'text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-white'
                      }`}
                    >
                      Month
                    </button>
                    <button
                      type="button"
                      onClick={() => setComparisonPeriod((prev) => ({ ...prev, mode: 'range' }))}
                      className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                        comparisonPeriod.mode === 'range'
                          ? 'bg-blue-600 text-white'
                          : 'text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-white'
                      }`}
                    >
                      Custom Range
                    </button>
                  </div>

                  {comparisonPeriod.mode === 'month' ? (
                    <input
                      type="month"
                      value={comparisonPeriod.month}
                      onChange={(e) =>
                        setComparisonPeriod((prev) => ({ ...prev, month: e.target.value || format(subMonths(new Date(), 1), 'yyyy-MM') }))
                      }
                      className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <input
                        type="date"
                        value={format(comparisonPeriod.range.start, 'yyyy-MM-dd')}
                        onChange={(e) => handleComparisonRangeChange('start', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                      <input
                        type="date"
                        value={format(comparisonPeriod.range.end, 'yyyy-MM-dd')}
                        onChange={(e) => handleComparisonRangeChange('end', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            <div className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow-sm border border-gray-100 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Total Spent</p>
                  <p className="text-xl font-bold text-gray-900 dark:text-white mt-1">
                    {trendsLoading ? '...' : formatCurrency(primaryTotal)}
                  </p>
                </div>
                <div className="p-2.5 bg-red-50 dark:bg-red-950/40 rounded-lg">
                  <BarChart3 className="w-5 h-5 text-red-600 dark:text-red-400" />
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow-sm border border-gray-100 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Daily Average</p>
                  <p className="text-xl font-bold text-gray-900 dark:text-white mt-1">
                    {trendsLoading ? '...' : formatCurrency(primaryAverageDaily)}
                  </p>
                </div>
                <div className="p-2.5 bg-blue-50 dark:bg-blue-950/40 rounded-lg">
                  <ArrowRightLeft className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow-sm border border-gray-100 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Transactions</p>
                  <p className="text-xl font-bold text-gray-900 dark:text-white mt-1">
                    {trendsLoading ? '...' : primaryExpenses.length}
                  </p>
                </div>
                <div className="p-2.5 bg-emerald-50 dark:bg-emerald-950/40 rounded-lg">
                  <GitCompareArrows className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow-sm border border-gray-100 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Top Category</p>
                  <p className="text-lg font-bold text-gray-900 dark:text-white mt-1 truncate max-w-[180px]">
                    {trendsLoading ? '...' : primaryTopCategory?.name || 'No spending'}
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                    {trendsLoading
                      ? ''
                      : primaryTopCategory
                        ? formatCurrency(primaryTopCategory.value)
                        : 'Add expenses to see trends'}
                  </p>
                </div>
                <div className="p-2.5 bg-amber-50 dark:bg-amber-950/40 rounded-lg">
                  <HandCoins className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-100 dark:border-gray-700">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Spending Trend for Selected Period</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              {primaryLabel} • {primaryDays} day{primaryDays === 1 ? '' : 's'} in range
            </p>
            <div className="mt-4">
              {trendsLoading ? (
                <div className="h-[300px] flex items-center justify-center text-gray-500 dark:text-gray-400">Loading spending trend...</div>
              ) : (
                <ExpenseLineChart data={primaryTrendData} />
              )}
            </div>
          </div>

          <div className={`grid gap-6 ${isComparisonEnabled ? 'xl:grid-cols-2' : 'grid-cols-1'}`}>
            <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-100 dark:border-gray-700">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Category Ranking</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Ordered by highest spending first</p>

              <div className="mt-4 space-y-3">
                {trendsLoading ? (
                  <div className="text-sm text-gray-500 dark:text-gray-400">Loading category breakdown...</div>
                ) : primaryCategoryBreakdown.length === 0 ? (
                  <div className="text-sm text-gray-500 dark:text-gray-400">No expense data found for the selected period.</div>
                ) : (
                  primaryCategoryBreakdown.map((item, index) => {
                    const share = primaryTotal > 0 ? (item.value / primaryTotal) * 100 : 0

                    return (
                      <div key={item.name} className="rounded-lg border border-gray-100 dark:border-gray-700 p-3">
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-3 min-w-0">
                            <span className="w-6 text-sm font-semibold text-gray-500 dark:text-gray-400">#{index + 1}</span>
                            <div
                              className="w-2.5 h-2.5 rounded-full shrink-0"
                              style={{ backgroundColor: item.color || '#6b7280' }}
                            />
                            <span className="font-medium text-gray-900 dark:text-white truncate">{item.name}</span>
                          </div>
                          <div className="text-right">
                            <p className="font-semibold text-gray-900 dark:text-white">{formatCurrency(item.value)}</p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">{share.toFixed(1)}%</p>
                          </div>
                        </div>
                        <div className="mt-2 h-1.5 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full"
                            style={{
                              width: `${Math.min(100, Math.max(0, share))}%`,
                              backgroundColor: item.color || '#6b7280',
                            }}
                          />
                        </div>
                      </div>
                    )
                  })
                )}
              </div>
            </div>

            {isComparisonEnabled && (
              <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-100 dark:border-gray-700">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Period Comparison</h2>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Compare two periods of your choosing</p>

                <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="rounded-lg border border-gray-100 dark:border-gray-700 p-3">
                    <p className="text-xs text-gray-500 dark:text-gray-400">Primary</p>
                    <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mt-1 truncate">{primaryLabel}</p>
                    <p className="text-lg font-bold text-gray-900 dark:text-white mt-1">
                      {comparisonLoading ? '...' : formatCurrency(primaryTotal)}
                    </p>
                  </div>

                  <div className="rounded-lg border border-gray-100 dark:border-gray-700 p-3">
                    <p className="text-xs text-gray-500 dark:text-gray-400">Comparison</p>
                    <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mt-1 truncate">{comparisonLabel}</p>
                    <p className="text-lg font-bold text-gray-900 dark:text-white mt-1">
                      {comparisonLoading ? '...' : formatCurrency(comparisonTotal)}
                    </p>
                  </div>

                  <div className="rounded-lg border border-gray-100 dark:border-gray-700 p-3">
                    <p className="text-xs text-gray-500 dark:text-gray-400">Difference</p>
                    <p className={`text-lg font-bold mt-1 ${totalComparisonDiff > 0 ? 'text-red-600 dark:text-red-400' : totalComparisonDiff < 0 ? 'text-green-600 dark:text-green-400' : 'text-gray-700 dark:text-gray-300'}`}>
                      {comparisonLoading ? '...' : `${totalComparisonDiff >= 0 ? '+' : ''}${formatCurrency(totalComparisonDiff)}`}
                    </p>
                    {!comparisonLoading && (
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        {totalComparisonPercent >= 0 ? '+' : ''}{totalComparisonPercent.toFixed(1)}%
                      </p>
                    )}
                  </div>
                </div>

                <div className="mt-4">
                  {comparisonLoading ? (
                    <div className="text-sm text-gray-500 dark:text-gray-400">Loading category comparison...</div>
                  ) : categoryComparisonRows.length === 0 ? (
                    <div className="text-sm text-gray-500 dark:text-gray-400">No category data to compare yet.</div>
                  ) : (
                    <div className="space-y-2 max-h-[420px] overflow-auto pr-1">
                      {categoryComparisonRows.map((row) => (
                        <div key={row.name} className="rounded-lg border border-gray-100 dark:border-gray-700 p-3">
                          <div className="flex items-center justify-between gap-3">
                            <div className="flex items-center gap-2 min-w-0">
                              <div
                                className="w-2.5 h-2.5 rounded-full shrink-0"
                                style={{ backgroundColor: row.color || '#6b7280' }}
                              />
                              <span className="font-medium text-gray-900 dark:text-white truncate">{row.name}</span>
                            </div>
                            <span className={`text-sm font-semibold ${row.difference > 0 ? 'text-red-600 dark:text-red-400' : row.difference < 0 ? 'text-green-600 dark:text-green-400' : 'text-gray-600 dark:text-gray-400'}`}>
                              {row.difference >= 0 ? '+' : ''}{formatCurrency(row.difference)}
                            </span>
                          </div>

                          <div className="mt-2 flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
                            <span>Primary: {formatCurrency(row.periodA)}</span>
                            <span>Comparison: {formatCurrency(row.periodB)}</span>
                            <span>
                              {row.percentChange >= 0 ? '+' : ''}
                              {row.percentChange.toFixed(1)}%
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </>
      )}

      <Modal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        title={editingTransfer ? 'Edit Transfer' : 'New Transfer'}
      >
        <TransferForm
          onSubmit={handleSubmit}
          onCancel={handleCloseModal}
          initialData={editingTransfer || undefined}
        />
      </Modal>
    </div>
  )
}
