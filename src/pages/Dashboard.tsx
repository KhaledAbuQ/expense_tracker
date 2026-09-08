import { useEffect, useRef, useState } from 'react'
import { format, differenceInCalendarDays, isValid, subMonths } from 'date-fns'
import { CalendarDays, ChevronDown, SlidersHorizontal, Wallet } from 'lucide-react'
import CumulativeSpendingChart from '../components/charts/CumulativeSpendingChart'
import { useExpenses } from '../hooks/useExpenses'
import { useIncome } from '../hooks/useIncome'
import { useTransfers } from '../hooks/useTransfers'
import { useCategories } from '../hooks/useCategories'
import { useAuth } from '../context/AuthContext'
import SummaryCard from '../components/SummaryCard'
import CategoryPieChart from '../components/charts/CategoryPieChart'
import ExpenseLineChart from '../components/charts/ExpenseLineChart'
import { formatCurrency, calculateTotalExpenses, calculateGrossIncome, calculateIncomeByAccount, groupExpensesByCategory, parseDateOnly } from '../lib/utils'
import { aggregateCashFlow, analyticsRange, previousRange, withinRange, percentChange, Horizon, Aggregation } from '../lib/analytics'

const horizons: [Horizon, string][] = [['month', 'Month to date'], ['last-month', 'Last month'], ['3-months', 'Last 3 months'], ['6-months', 'Last 6 months'], ['12-months', 'Last 12 months'], ['year', 'Year to date'], ['all', 'All time'], ['custom', 'Custom']]
const panel = 'bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-100 dark:border-gray-700'
const input = 'border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-white bg-white dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500'

export default function Dashboard() {
  const filtersRef = useRef<HTMLDetailsElement>(null)
  useEffect(() => {
    const closeOutside = (event: PointerEvent) => {
      if (filtersRef.current && !filtersRef.current.contains(event.target as Node)) filtersRef.current.open = false
    }
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && filtersRef.current?.open) {
        filtersRef.current.open = false
        filtersRef.current.querySelector('summary')?.focus()
      }
    }
    document.addEventListener('pointerdown', closeOutside)
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('pointerdown', closeOutside)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [])
  const { member } = useAuth()
  const { expenses, loading: expensesLoading, error: expensesError } = useExpenses()
  const { income, loading: incomeLoading, error: incomeError } = useIncome()
  const { transfers, loading: transfersLoading, error: transfersError } = useTransfers()
  const { categories, loading: categoriesLoading, error: categoriesError } = useCategories()
  const [horizon, setHorizon] = useState<Horizon>('month')
  const [comparisonMonth, setComparisonMonth] = useState(() => format(subMonths(new Date(), 1), 'yyyy-MM'))
  const [scope, setScope] = useState('mine')
  const [aggregation, setAggregation] = useState<Aggregation | 'auto'>('auto')
  const [customStart, setCustomStart] = useState(() => format(analyticsRange('month', undefined).start, 'yyyy-MM-dd'))
  const [customEnd, setCustomEnd] = useState(() => format(new Date(), 'yyyy-MM-dd'))
  const today = format(new Date(), 'yyyy-MM-dd')
  const earliest = [...expenses, ...income].map(row => row.date).filter(date => date <= today).sort()[0]
  const customValid = isValid(parseDateOnly(customStart)) && isValid(parseDateOnly(customEnd)) && customStart <= customEnd && customEnd <= today
  const range = horizon === 'custom' && customValid ? { start: parseDateOnly(customStart), end: parseDateOnly(customEnd) } : analyticsRange(horizon, earliest)
  const previous = previousRange(range)
  const days = differenceInCalendarDays(range.end, range.start) + 1
  const interval = aggregation === 'auto' ? (days <= 45 ? 'day' : days <= 180 ? 'week' : 'month') : aggregation
  const mine = expenses.filter(row => row.member_id === member?.id)
  const myIncome = income.filter(row => row.member_id === member?.id)
  const scoped = expenses.filter(row => scope === 'mine' ? row.member_id === member?.id : scope === 'household' ? row.visibility === 'household' : true)
  const selected = withinRange(scoped, range)
  const total = calculateTotalExpenses(selected)
  const priorTotal = calculateTotalExpenses(withinRange(scoped, previous))
  const personalExpenses = withinRange(mine, range)
  const personalIncome = withinRange(myIncome, range)
  const grossIncome = calculateGrossIncome(personalIncome)
  const personalTotal = calculateTotalExpenses(personalExpenses)
  const net = grossIncome - personalTotal
  const categoryData = groupExpensesByCategory(selected, categories)
  const spending = aggregateCashFlow(selected, [], range, interval)
  const balance = (account: 'bank' | 'cash') => calculateIncomeByAccount(myIncome.filter(row => row.date <= today), account)
    - calculateTotalExpenses(mine.filter(row => row.account_type === account && row.date <= today))
    + transfers.filter(row => row.member_id === member?.id && row.date <= today).reduce((sum, row) => sum + (row.to_account === account ? Number(row.amount) : 0) - (row.from_account === account ? Number(row.amount) : 0), 0)
  const loading = expensesLoading || incomeLoading || transfersLoading || categoriesLoading
  const error = expensesError || incomeError || transfersError || categoriesError
  const label = `${format(range.start, 'MMM d, yyyy')} – ${format(range.end, 'MMM d, yyyy')}`
  const money = (value: number) => formatCurrency(value)
  const card = (title: string, value: string, subtitle: string) => <SummaryCard title={title} value={value} subtitle={subtitle} icon={<Wallet className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />} />

  return <div className="space-y-8">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><h1 className="text-2xl font-bold text-gray-900 dark:text-white">Dashboard</h1><p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Your finances at a glance</p></div>
      <details ref={filtersRef} className="relative group ml-auto">
        <summary className="flex cursor-pointer list-none items-center gap-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 shadow-sm hover:bg-gray-50 dark:hover:bg-gray-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 [&::-webkit-details-marker]:hidden">
          <CalendarDays className="w-4 h-4 text-indigo-500" aria-hidden="true" />
          {horizons.find(([value]) => value === horizon)?.[1]}
          <SlidersHorizontal className="w-3.5 h-3.5 text-gray-400 dark:text-gray-500 ml-1" aria-hidden="true" />
          <span className="sr-only">Dashboard filters</span>
          <ChevronDown className="w-4 h-4 text-gray-400 dark:text-gray-500 group-open:rotate-180 transition-transform" aria-hidden="true" />
        </summary>
        <div className="absolute right-0 z-30 mt-2 w-80 max-w-[calc(100vw-2rem)] rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 shadow-xl max-h-[70vh] overflow-y-auto">
          <p className="text-sm font-semibold text-gray-900 dark:text-white mb-4">Dashboard filters</p>
          <div className="space-y-4">
            <label className="flex flex-col gap-1.5 text-xs font-medium text-gray-500 dark:text-gray-400">Time period<select className={input} value={horizon} onChange={e => setHorizon(e.target.value as Horizon)}>{horizons.map(([value, name]) => <option key={value} value={value}>{name}</option>)}</select></label>
            {horizon === 'custom' && <div className="space-y-3">
              <label className="flex flex-col gap-1.5 text-xs font-medium text-gray-500 dark:text-gray-400">Start date<input className={input} type="date" max={customEnd || today} value={customStart} onChange={e => setCustomStart(e.target.value)} /></label>
              <label className="flex flex-col gap-1.5 text-xs font-medium text-gray-500 dark:text-gray-400">End date<input className={input} type="date" min={customStart} max={today} value={customEnd} onChange={e => setCustomEnd(e.target.value)} /></label>
            </div>}
            <label className="flex flex-col gap-1.5 text-xs font-medium text-gray-500 dark:text-gray-400">Spending scope<select className={input} value={scope} onChange={e => setScope(e.target.value)}><option value="mine">Paid by me</option><option value="household">Household spending</option><option value="all">All visible spending</option></select></label>
            <label className="flex flex-col gap-1.5 text-xs font-medium text-gray-500 dark:text-gray-400">Group charts by<select className={input} value={aggregation} onChange={e => setAggregation(e.target.value as Aggregation | 'auto')}><option value="auto">Automatic</option><option value="day">Day</option><option value="week">Week</option><option value="month">Month</option></select></label>
          </div>
          <p className="text-xs leading-relaxed text-gray-400 dark:text-gray-500 mt-4">Multi-month periods run through today. Household includes shared spending; all visible also includes your private entries.</p>
          <button type="button" onClick={() => {
            if (filtersRef.current) {
              filtersRef.current.open = false
              filtersRef.current.querySelector('summary')?.focus()
            }
          }} className="mt-4 w-full rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2">Done</button>
        </div>
      </details>
    </div>
    {loading ? <p role="status" className="text-gray-600 dark:text-gray-400">Loading your financial history…</p> : error ? <p role="alert" className="text-red-600 dark:text-red-400">Unable to load complete analytics. Please refresh to try again.</p> : horizon === 'custom' && !customValid ? <p role="alert" className="text-red-600 dark:text-red-400">Choose valid dates with the start on or before the end, and the end no later than today.</p> : <>
      <div><h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">Current balances</h2><div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {card('Available balance', money(balance('bank') + balance('cash')), 'Bank + cash · all history through today')}
        {card('Bank account', money(balance('bank')), 'Your current bank balance')}
        {card('Cash', money(balance('cash')), 'Your current cash balance')}
      </div></div>
      <div><h2 className="text-lg font-semibold text-gray-900 dark:text-white">Spending analytics</h2><p className="text-sm text-gray-500 dark:text-gray-400 mt-1 mb-4">{label} · {days} calendar days · {scope === 'mine' ? 'Paid by me' : scope === 'household' ? 'Household spending' : 'All visible spending'}</p>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          {card('Total spending', money(total), horizon === 'all' ? 'All recorded spending through today' : `${percentChange(total, priorTotal)} vs previous ${days} days (${money(priorTotal)})`)}
          {card('Daily average', money(total / days), 'Includes days with no spending')}
          {card('Transactions', String(selected.length), `Average purchase: ${money(selected.length ? total / selected.length : 0)}`)}
          {card('Top category', categoryData[0]?.name || 'No spending', categoryData[0] ? `${money(categoryData[0].value)} · ${total ? (categoryData[0].value / total * 100).toFixed(1) : 0}% of spending` : 'No expenses in this period')}
        </div>
        {horizon !== 'all' && <p className="text-xs text-gray-500 dark:text-gray-400 mt-3">Comparison: {format(previous.start, 'MMM d, yyyy')} – {format(previous.end, 'MMM d, yyyy')} (same number of calendar days).</p>}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className={`${panel} min-w-0`}><h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Expenses by category</h2><CategoryPieChart data={categoryData} /></div>
        <div className={`${panel} min-w-0`}><h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Spending by {interval}</h2><ExpenseLineChart data={spending} /></div>
      </div>
      <div><h2 className="text-lg font-semibold text-gray-900 dark:text-white">Your income and spending</h2><p className="text-sm text-gray-500 dark:text-gray-400 mt-1 mb-4">{label} · Your entries only. Income includes savings deposits. Transfers between accounts are excluded.</p><div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {card('Total income', money(grossIncome), `Bank + cash: ${money(grossIncome - calculateIncomeByAccount(personalIncome, 'savings'))}`)}
        {card('Income minus spending', money(net), `Your expenses: ${money(personalTotal)}`)}
        {card('Income retained', grossIncome > 0 ? `${(net / grossIncome * 100).toFixed(1)}%` : '—', grossIncome > 0 ? 'Income minus expenses, as a share of income' : 'Requires income in this period')}
      </div></div>
      <CumulativeSpendingChart
        expenses={scoped}
        scopeLabel={scope === 'mine' ? 'Paid by me' : scope === 'household' ? 'Household spending' : 'All visible spending'}
        comparisonMonth={comparisonMonth}
        onComparisonChange={setComparisonMonth}
      />
      <div className={panel}><h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Category breakdown</h2>{categoryData.length === 0 ? <p className="text-gray-500 dark:text-gray-400">No expenses in this period.</p> : <div className="overflow-x-auto"><table className="w-full text-sm text-left text-gray-600 dark:text-gray-300"><thead><tr className="border-b border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white"><th className="py-3">Category</th><th>Amount</th><th>Share</th></tr></thead><tbody>{categoryData.map((row, index) => <tr key={index} className="border-b border-gray-100 dark:border-gray-700/60 last:border-0"><td className="py-3 font-medium text-gray-800 dark:text-gray-200">{row.name}</td><td>{money(row.value)}</td><td>{total ? (row.value / total * 100).toFixed(1) : '0.0'}%</td></tr>)}</tbody></table></div>}</div>
    </>}
  </div>
}
