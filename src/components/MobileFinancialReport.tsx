import { useState, type ReactNode } from 'react'
import { differenceInCalendarDays, format, isValid, subMonths } from 'date-fns'
import { ArrowLeft, CalendarDays, RefreshCw, Wallet } from 'lucide-react'
import type { Expense, Income, Transfer } from '../types'
import { calculateGrossIncome, calculateIncomeByAccount, calculateTotalExpenses, formatCurrency, groupExpensesByCategory, parseDateOnly } from '../lib/utils'
import { aggregateCashFlow, analyticsRange, percentChange, previousRange, withinRange, type Horizon } from '../lib/analytics'
import CategoryPieChart from './charts/CategoryPieChart'
import CumulativeSpendingChart from './charts/CumulativeSpendingChart'
import ExpenseLineChart from './charts/ExpenseLineChart'

const periods: [Horizon, string][] = [['month', 'Month to date'], ['last-month', 'Last month'], ['3-months', 'Last 3 months'], ['6-months', 'Last 6 months'], ['12-months', 'Last 12 months'], ['year', 'Year to date'], ['all', 'All time'], ['custom', 'Custom dates']]

interface Props {
  expenses: Expense[]
  income: Income[]
  transfers: Transfer[]
  loading: boolean
  error: string | null
  onRetry: () => void
  onClose?: () => void
  children?: ReactNode
}

export default function MobileFinancialReport({ expenses, income, transfers, loading, error, onRetry, onClose, children }: Props) {
  const [comparisonMonth, setComparisonMonth] = useState(() => format(subMonths(new Date(), 1), 'yyyy-MM'))
  const [horizon, setHorizon] = useState<Horizon>('month')
  const [customStart, setCustomStart] = useState(() => format(analyticsRange('month', undefined).start, 'yyyy-MM-dd'))
  const [customEnd, setCustomEnd] = useState(() => format(new Date(), 'yyyy-MM-dd'))
  const today = format(new Date(), 'yyyy-MM-dd')
  const earliest = [...expenses, ...income].map(row => row.date).filter(date => date <= today).sort()[0]
  const customValid = isValid(parseDateOnly(customStart)) && isValid(parseDateOnly(customEnd)) && customStart <= customEnd && customEnd <= today
  const range = horizon === 'custom' && customValid ? { start: parseDateOnly(customStart), end: parseDateOnly(customEnd) } : analyticsRange(horizon, earliest)
  const previous = previousRange(range)
  const days = differenceInCalendarDays(range.end, range.start) + 1
  const selected = withinRange(expenses, range)
  const selectedIncome = withinRange(income, range)
  const total = calculateTotalExpenses(selected)
  const priorTotal = calculateTotalExpenses(withinRange(expenses, previous))
  const grossIncome = calculateGrossIncome(selectedIncome)
  const net = grossIncome - total
  const categoryData = groupExpensesByCategory(selected, [])
  const interval = days <= 45 ? 'day' : days <= 180 ? 'week' : 'month'
  const spending = aggregateCashFlow(selected, [], range, interval)
  const balance = (account: 'bank' | 'cash') => calculateIncomeByAccount(income.filter(row => row.date <= today), account)
    - calculateTotalExpenses(expenses.filter(row => row.account_type === account && row.date <= today))
    + transfers.filter(row => row.date <= today).reduce((sum, row) => sum + (row.to_account === account ? Number(row.amount) : 0) - (row.from_account === account ? Number(row.amount) : 0), 0)
  const label = `${format(range.start, 'MMM d, yyyy')} – ${format(range.end, 'MMM d, yyyy')}`
  const card = (title: string, value: string, subtitle: string) => <article className="mobile-report-summary"><div><p>{title}</p><strong>{value}</strong><small>{subtitle}</small></div><span aria-hidden="true"><Wallet size={21} /></span></article>

  return <section className="mobile-financial-report" aria-labelledby="mobile-report-title">
    <header className="mobile-report-header">{onClose && <button type="button" onClick={onClose} aria-label="Back to Home"><ArrowLeft size={20} /></button>}<div><h2 id="mobile-report-title">Financial report</h2><p>Your spending, at a glance</p></div><button type="button" disabled={loading} onClick={onRetry} aria-label="Refresh financial report"><RefreshCw size={18} className={loading ? 'animate-spin' : ''} /></button></header>
    <div className="mobile-report-content">
      {error && <p className="mobile-report-error" role="alert">Could not refresh your expenses. <button type="button" onClick={onRetry}>Try again</button></p>}
      {loading && <p role="status" className="mobile-report-loading">Loading financial report…</p>}
      {children}
      <div className="mobile-report-period"><label><CalendarDays size={18} aria-hidden="true" /><span className="sr-only">Report period</span><select value={horizon} onChange={event => setHorizon(event.target.value as Horizon)}>{periods.map(([value, name]) => <option key={value} value={value}>{name}</option>)}</select></label></div>
      {horizon === 'custom' && <div className="mobile-report-dates"><label>Start date<input type="date" max={customEnd || today} value={customStart} onChange={event => setCustomStart(event.target.value)} /></label><label>End date<input type="date" min={customStart} max={today} value={customEnd} onChange={event => setCustomEnd(event.target.value)} /></label></div>}
      {horizon === 'custom' && !customValid && <p role="alert" className="mobile-report-error">Choose valid dates ending on or before today.</p>}
      {!loading && !error && (horizon !== 'custom' || customValid) && <>
        <section className="mobile-report-section"><h2>Current balances</h2><div className="mobile-report-summary-grid">
          {card('Available balance', formatCurrency(balance('bank') + balance('cash')), 'Bank + cash · all history through today')}
          {card('Bank account', formatCurrency(balance('bank')), 'Your current bank balance')}
          {card('Cash', formatCurrency(balance('cash')), 'Your current cash balance')}
        </div></section>
        <section className="mobile-report-section"><h2>Spending analytics</h2><p>{label} · {days} calendar days · Paid by me</p><div className="mobile-report-summary-grid">
          {card('Total spending', formatCurrency(total), horizon === 'all' ? 'All recorded spending through today' : `${percentChange(total, priorTotal)} vs previous ${days} days (${formatCurrency(priorTotal)})`)}
          {card('Daily average', formatCurrency(total / days), 'Includes days with no spending')}
          {card('Transactions', String(selected.length), `Average purchase: ${formatCurrency(selected.length ? total / selected.length : 0)}`)}
          {card('Top category', categoryData[0]?.name || 'No spending', categoryData[0] ? `${formatCurrency(categoryData[0].value)} · ${total ? (categoryData[0].value / total * 100).toFixed(1) : '0.0'}% of spending` : 'No expenses in this period')}
        </div>{horizon !== 'all' && <p className="mobile-report-comparison">Comparison: {format(previous.start, 'MMM d, yyyy')} – {format(previous.end, 'MMM d, yyyy')}</p>}</section>
        <section className="mobile-report-panel mobile-report-categories" aria-labelledby="mobile-report-categories-title"><h2 id="mobile-report-categories-title">Expenses by category</h2><p>{label} · {formatCurrency(total)}</p><CategoryPieChart data={categoryData} /></section>
        <section className="mobile-report-panel mobile-report-daily"><h2>Spending by {interval}</h2><ExpenseLineChart data={spending} /></section>
        <section className="mobile-report-section"><h2>Your income and spending</h2><p>{label} · Your entries only. Income includes savings deposits. Transfers between accounts are excluded.</p><div className="mobile-report-summary-grid">
          {card('Total income', formatCurrency(grossIncome), `Bank + cash: ${formatCurrency(grossIncome - calculateIncomeByAccount(selectedIncome, 'savings'))}`)}
          {card('Income minus spending', formatCurrency(net), `Your expenses: ${formatCurrency(total)}`)}
          {card('Income retained', grossIncome > 0 ? `${(net / grossIncome * 100).toFixed(1)}%` : '—', grossIncome > 0 ? 'Income minus expenses, as a share of income' : 'Requires income in this period')}
        </div></section>
        <CumulativeSpendingChart expenses={expenses} scopeLabel="Paid by me" comparisonMonth={comparisonMonth} onComparisonChange={setComparisonMonth} />
      </>}
    </div>
  </section>
}
