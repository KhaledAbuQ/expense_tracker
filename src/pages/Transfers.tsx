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
import { useAuth } from '../context/AuthContext'

const accountIcons: Record<TransferAccountType, typeof Building2> = {
  bank: Building2,
  cash: Banknote,
  savings: HandCoins,
}

const accountLabels: Record<TransferAccountType, string> = {
  bank: 'Bank',
  cash: 'Cash',
  savings: 'Savings',
}

const accountColors: Record<TransferAccountType, string> = {
  bank: 'text-blue-600 bg-blue-50',
  cash: 'text-green-600 bg-green-50',
  savings: 'text-purple-600 bg-purple-50',
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
      percentChange: 0,
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
          <h1 className="text-2xl font-bold text-gray-900">Transfers</h1>
          <p className="text-gray-500 mt-1">
            Move money between your accounts
          </p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <ArrowRightLeft className="w-5 h-5" />
          New Transfer
        </button>
      </div>

      <div className="bg-white rounded-xl p-1 shadow-sm border border-gray-100 flex w-full sm:w-fit">
        <button
          type="button"
          onClick={() => setActiveTab('activity')}
          className={`flex-1 sm:flex-none px-3 sm:px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
            activeTab === 'activity'
              ? 'bg-blue-600 text-white'
              : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
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
              : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
          }`}
        >
          History & Trends
        </button>
      </div>

      {activeTab === 'activity' ? (
        <>
          <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
            <DateRangePicker value={dateRange} onChange={setDateRange} />
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            {loading ? (
              <div className="p-8 text-center text-gray-500">Loading transfers...</div>
            ) : transfers.length === 0 ? (
              <div className="p-8 text-center">
                <ArrowRightLeft className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500">No transfers found</p>
                <p className="text-sm text-gray-400 mt-1">
                  Transfer money between your bank, cash, and savings accounts
                </p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {transfers.map((transfer) => {
                  const FromIcon = accountIcons[transfer.from_account]
                  const ToIcon = accountIcons[transfer.to_account]

                  return (
                    <div
                      key={transfer.id}
                      className="p-4 hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className={`p-2 rounded-lg ${accountColors[transfer.from_account]}`}>
                            <FromIcon className="w-5 h-5" />
                          </div>

                          <ArrowRight className="w-4 h-4 text-gray-400" />

                          <div className={`p-2 rounded-lg ${accountColors[transfer.to_account]}`}>
                            <ToIcon className="w-5 h-5" />
                          </div>

                          <div>
                            <p className="font-medium text-gray-900">
                              {accountLabels[transfer.from_account]} → {accountLabels[transfer.to_account]}
                            </p>
                            <p className="text-sm text-gray-500">
                              {formatDate(transfer.date)}
                              {transfer.description && ` • ${transfer.description}`}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-4">
                          <span className="font-semibold text-gray-900">
                            {formatCurrency(transfer.amount)}
                          </span>

                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => handleEdit(transfer)}
                              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                              title="Edit transfer"
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => deleteTransfer(transfer.id)}
                              className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
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
          <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100 space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Spending Trends Periods</h2>
                <p className="text-sm text-gray-500 mt-1">
                  Pick a month or custom range to analyze category spending trends.
                </p>
              </div>

              <label className="inline-flex items-center gap-2 text-sm font-medium text-gray-700">
                <input
                  type="checkbox"
                  checked={isComparisonEnabled}
                  onChange={(e) => setIsComparisonEnabled(e.target.checked)}
                  className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                Enable period comparison
              </label>
            </div>

            <div className={`grid gap-4 ${isComparisonEnabled ? 'lg:grid-cols-2' : 'grid-cols-1'}`}>
              <div className="rounded-xl border border-gray-200 p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-gray-900">Primary Period</p>
                  <span className="text-xs text-gray-500">{primaryLabel}</span>
                </div>

                <div className="inline-flex rounded-lg border border-gray-200 p-1">
                  <button
                    type="button"
                    onClick={() => setPrimaryPeriod((prev) => ({ ...prev, mode: 'month' }))}
                    className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                      primaryPeriod.mode === 'month'
                        ? 'bg-blue-600 text-white'
                        : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
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
                        : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
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
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <input
                      type="date"
                      value={format(primaryPeriod.range.start, 'yyyy-MM-dd')}
                      onChange={(e) => handlePrimaryRangeChange('start', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                    <input
                      type="date"
                      value={format(primaryPeriod.range.end, 'yyyy-MM-dd')}
                      onChange={(e) => handlePrimaryRangeChange('end', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                )}
              </div>

              {isComparisonEnabled && (
                <div className="rounded-xl border border-gray-200 p-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-gray-900">Comparison Period</p>
                    <span className="text-xs text-gray-500">{comparisonLabel}</span>
                  </div>

                  <div className="inline-flex rounded-lg border border-gray-200 p-1">
                    <button
                      type="button"
                      onClick={() => setComparisonPeriod((prev) => ({ ...prev, mode: 'month' }))}
                      className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                        comparisonPeriod.mode === 'month'
                          ? 'bg-blue-600 text-white'
                          : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
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
                          : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
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
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <input
                        type="date"
                        value={format(comparisonPeriod.range.start, 'yyyy-MM-dd')}
                        onChange={(e) => handleComparisonRangeChange('start', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                      <input
                        type="date"
                        value={format(comparisonPeriod.range.end, 'yyyy-MM-dd')}
                        onChange={(e) => handleComparisonRangeChange('end', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-500">Total Spent</p>
                  <p className="text-xl font-bold text-gray-900 mt-1">
                    {trendsLoading ? '...' : formatCurrency(primaryTotal)}
                  </p>
                </div>
                <div className="p-2.5 bg-red-50 rounded-lg">
                  <BarChart3 className="w-5 h-5 text-red-600" />
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-500">Daily Average</p>
                  <p className="text-xl font-bold text-gray-900 mt-1">
                    {trendsLoading ? '...' : formatCurrency(primaryAverageDaily)}
                  </p>
                </div>
                <div className="p-2.5 bg-blue-50 rounded-lg">
                  <ArrowRightLeft className="w-5 h-5 text-blue-600" />
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-500">Transactions</p>
                  <p className="text-xl font-bold text-gray-900 mt-1">
                    {trendsLoading ? '...' : primaryExpenses.length}
                  </p>
                </div>
                <div className="p-2.5 bg-emerald-50 rounded-lg">
                  <GitCompareArrows className="w-5 h-5 text-emerald-600" />
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-500">Top Category</p>
                  <p className="text-lg font-bold text-gray-900 mt-1 truncate max-w-[180px]">
                    {trendsLoading ? '...' : primaryTopCategory?.name || 'No spending'}
                  </p>
                  <p className="text-sm text-gray-500 mt-1">
                    {trendsLoading
                      ? ''
                      : primaryTopCategory
                        ? formatCurrency(primaryTopCategory.value)
                        : 'Add expenses to see trends'}
                  </p>
                </div>
                <div className="p-2.5 bg-amber-50 rounded-lg">
                  <HandCoins className="w-5 h-5 text-amber-600" />
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
            <h2 className="text-lg font-semibold text-gray-900">Spending Trend for Selected Period</h2>
            <p className="text-sm text-gray-500 mt-1">
              {primaryLabel} • {primaryDays} day{primaryDays === 1 ? '' : 's'} in range
            </p>
            <div className="mt-4">
              {trendsLoading ? (
                <div className="h-[300px] flex items-center justify-center text-gray-500">Loading spending trend...</div>
              ) : (
                <ExpenseLineChart data={primaryTrendData} />
              )}
            </div>
          </div>

          <div className={`grid gap-6 ${isComparisonEnabled ? 'xl:grid-cols-2' : 'grid-cols-1'}`}>
            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
              <h2 className="text-lg font-semibold text-gray-900">Category Ranking</h2>
              <p className="text-sm text-gray-500 mt-1">Ordered by highest spending first</p>

              <div className="mt-4 space-y-3">
                {trendsLoading ? (
                  <div className="text-sm text-gray-500">Loading category breakdown...</div>
                ) : primaryCategoryBreakdown.length === 0 ? (
                  <div className="text-sm text-gray-500">No expense data found for the selected period.</div>
                ) : (
                  primaryCategoryBreakdown.map((item, index) => {
                    const share = primaryTotal > 0 ? (item.value / primaryTotal) * 100 : 0

                    return (
                      <div key={item.name} className="rounded-lg border border-gray-100 p-3">
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-3 min-w-0">
                            <span className="w-6 text-sm font-semibold text-gray-500">#{index + 1}</span>
                            <div
                              className="w-2.5 h-2.5 rounded-full shrink-0"
                              style={{ backgroundColor: item.color || '#6b7280' }}
                            />
                            <span className="font-medium text-gray-900 truncate">{item.name}</span>
                          </div>
                          <div className="text-right">
                            <p className="font-semibold text-gray-900">{formatCurrency(item.value)}</p>
                            <p className="text-xs text-gray-500">{share.toFixed(1)}%</p>
                          </div>
                        </div>
                        <div className="mt-2 h-1.5 bg-gray-100 rounded-full overflow-hidden">
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
              <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
                <h2 className="text-lg font-semibold text-gray-900">Period Comparison</h2>
                <p className="text-sm text-gray-500 mt-1">Compare two periods of your choosing</p>

                <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="rounded-lg border border-gray-100 p-3">
                    <p className="text-xs text-gray-500">Primary</p>
                    <p className="text-sm font-medium text-gray-700 mt-1 truncate">{primaryLabel}</p>
                    <p className="text-lg font-bold text-gray-900 mt-1">
                      {comparisonLoading ? '...' : formatCurrency(primaryTotal)}
                    </p>
                  </div>

                  <div className="rounded-lg border border-gray-100 p-3">
                    <p className="text-xs text-gray-500">Comparison</p>
                    <p className="text-sm font-medium text-gray-700 mt-1 truncate">{comparisonLabel}</p>
                    <p className="text-lg font-bold text-gray-900 mt-1">
                      {comparisonLoading ? '...' : formatCurrency(comparisonTotal)}
                    </p>
                  </div>

                  <div className="rounded-lg border border-gray-100 p-3">
                    <p className="text-xs text-gray-500">Difference</p>
                    <p className={`text-lg font-bold mt-1 ${totalComparisonDiff > 0 ? 'text-red-600' : totalComparisonDiff < 0 ? 'text-green-600' : 'text-gray-700'}`}>
                      {comparisonLoading ? '...' : `${totalComparisonDiff >= 0 ? '+' : ''}${formatCurrency(totalComparisonDiff)}`}
                    </p>
                    {!comparisonLoading && (
                      <p className="text-xs text-gray-500 mt-1">
                        {totalComparisonPercent >= 0 ? '+' : ''}{totalComparisonPercent.toFixed(1)}%
                      </p>
                    )}
                  </div>
                </div>

                <div className="mt-4">
                  {comparisonLoading ? (
                    <div className="text-sm text-gray-500">Loading category comparison...</div>
                  ) : categoryComparisonRows.length === 0 ? (
                    <div className="text-sm text-gray-500">No category data to compare yet.</div>
                  ) : (
                    <div className="space-y-2 max-h-[420px] overflow-auto pr-1">
                      {categoryComparisonRows.map((row) => (
                        <div key={row.name} className="rounded-lg border border-gray-100 p-3">
                          <div className="flex items-center justify-between gap-3">
                            <div className="flex items-center gap-2 min-w-0">
                              <div
                                className="w-2.5 h-2.5 rounded-full shrink-0"
                                style={{ backgroundColor: row.color || '#6b7280' }}
                              />
                              <span className="font-medium text-gray-900 truncate">{row.name}</span>
                            </div>
                            <span className={`text-sm font-semibold ${row.difference > 0 ? 'text-red-600' : row.difference < 0 ? 'text-green-600' : 'text-gray-600'}`}>
                              {row.difference >= 0 ? '+' : ''}{formatCurrency(row.difference)}
                            </span>
                          </div>

                          <div className="mt-2 flex items-center justify-between text-xs text-gray-500">
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
