import { useRapidTapPeek } from '../hooks/useRapidTapPeek'
import { useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { format, startOfMonth, subMonths } from 'date-fns'
import { ArrowDownCircle, BarChart3, ChevronRight, Coins, HandCoins, Plus, Wallet, RefreshCw } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useExpenses } from '../hooks/useExpenses'
import { useIncome } from '../hooks/useIncome'
import { useTransfers } from '../hooks/useTransfers'
import { calculateIncomeByAccount, calculateTotalExpenses, formatCurrency, groupExpensesByCategory, parseDateOnly } from '../lib/utils'
import CategoryIcon from './CategoryIcon'
import MonthlySpendingBars from './MonthlySpendingBars'
import MobileFinancialReport from './MobileFinancialReport'
import { isPriceStale } from '../lib/gold'
import type { GoldPrice } from '../types'

interface Props {
  header: ReactNode
  goldPrice: GoldPrice | null
  goldHistory: { timestamp: number; price: number }[]
  goldLoading: boolean
  goldRefreshing: boolean
  goldError: string | null
  onRefreshGold: (options?: { silent?: boolean }) => Promise<GoldPrice | null>
  reportOpen: boolean
  onOpenReport: () => void
  onCloseReport: () => void
  onAdd: () => void
  onExpenses: () => void
  onIncome: () => void
  onSavings: () => void
  onTransfers: () => void
  onCategories: () => void
}

function GoldPriceTrend({ history }: { history: Props['goldHistory'] }) {
  if (history.length < 2) return <span>Trend appears after two different quote times are saved.</span>

  const first = history[0]
  const last = history[history.length - 1]
  const prices = history.map(quote => quote.price)
  const min = Math.min(...prices)
  const max = Math.max(...prices)
  const change = last.price - first.price
  const points = history.map(quote => {
    const x = 2 + 196 * (quote.timestamp - first.timestamp) / (last.timestamp - first.timestamp)
    const y = max === min ? 22 : 40 - 36 * (quote.price - min) / (max - min)
    return `${x},${y}`
  }).join(' ')
  const dateLabel = (timestamp: number) => format(new Date(timestamp), 'MMM d, h:mm a')
  const changeLabel = `${change > 0 ? '+' : ''}${change.toFixed(2)} JOD/g`

  return <figure className="monetra-gold-trend">
    <svg viewBox="0 0 200 44" preserveAspectRatio="none" aria-hidden="true">
      <polyline points={points} fill="none" stroke="currentColor" strokeWidth="2" vectorEffect="non-scaling-stroke" />
    </svg>
    <figcaption>21k change {changeLabel} · {dateLabel(first.timestamp)} to {dateLabel(last.timestamp)}</figcaption>
  </figure>
}

export default function MobileHome({ header, goldPrice, goldHistory, goldLoading, goldRefreshing, goldError, onRefreshGold, reportOpen, onOpenReport, onCloseReport, onAdd, onExpenses, onIncome, onSavings, onTransfers, onCategories }: Props) {
  const recordMonthTap = useRapidTapPeek()
  const homeRef = useRef<HTMLDivElement>(null)
  const homeScroll = useRef<number | null>(null)
  const reportLink = useRef<HTMLButtonElement>(null)
  const { member } = useAuth()
  const { expenses, loading: expensesLoading, error: expensesError, fetchExpenses } = useExpenses()
  const { income, loading: incomeLoading, error: incomeError, fetchIncome } = useIncome()
  const { transfers, loading: transfersLoading, error: transfersError, fetchTransfers } = useTransfers()
  const [selectedMonth, setSelectedMonth] = useState(() => format(new Date(), 'yyyy-MM'))
  const today = format(new Date(), 'yyyy-MM-dd')
  const mine = expenses.filter(row => row.member_id === member?.id && row.date <= today)
  const myIncome = income.filter(row => row.member_id === member?.id && row.date <= today)
  const myTransfers = transfers.filter(row => row.member_id === member?.id && row.date <= today)
  const refreshReport = () => { void Promise.all([fetchExpenses(), fetchIncome(), fetchTransfers()]) }
  const months = Array.from({ length: 6 }, (_, index) => {
    const date = subMonths(startOfMonth(new Date()), 5 - index)
    const key = format(date, 'yyyy-MM')
    return { key, label: format(date, 'MMM'), amount: calculateTotalExpenses(mine.filter(row => row.date.startsWith(key))) }
  })
  const bank = calculateIncomeByAccount(myIncome, 'bank') - calculateTotalExpenses(mine.filter(row => row.account_type === 'bank'))
    + transfers.filter(row => row.member_id === member?.id && row.date <= today).reduce((sum, row) => sum + (row.to_account === 'bank' ? Number(row.amount) : 0) - (row.from_account === 'bank' ? Number(row.amount) : 0), 0)
  const monthToDate = mine.filter(row => row.date.startsWith(format(new Date(), 'yyyy-MM')))
  const todaySpending = calculateTotalExpenses(mine.filter(row => row.date === today))
  const dailyAverage = calculateTotalExpenses(monthToDate) / new Date().getDate()
  const topCategory = groupExpensesByCategory(monthToDate, [])[0]
  const upcoming = expenses.filter(row => row.member_id === member?.id && row.date > today)
    .sort((a, b) => a.date.localeCompare(b.date) || a.created_at.localeCompare(b.created_at))
  const loading = expensesLoading || incomeLoading || transfersLoading
  const error = expensesError || incomeError || transfersError

  useLayoutEffect(() => {
    if (reportOpen) {
      window.scrollTo({ top: 0, behavior: 'instant' })
      homeRef.current?.querySelector<HTMLElement>('[aria-label="Back to Home"]')?.focus({ preventScroll: true })
    } else if (homeScroll.current !== null) {
      window.scrollTo({ top: homeScroll.current, behavior: 'instant' })
      homeScroll.current = null
      reportLink.current?.focus({ preventScroll: true })
    }
  }, [reportOpen])

  if (reportOpen) return <div ref={homeRef} className="monetra-home home-report-page">
    <MobileFinancialReport expenses={mine} income={myIncome} transfers={myTransfers} loading={loading} error={error} onRetry={refreshReport} onClose={onCloseReport}>
      <section className="mobile-report-panel mobile-report-months" aria-label="Monthly spending bars"><div className="mobile-report-panel-heading"><p>Spent in {format(parseDateOnly(`${selectedMonth}-01`), 'MMMM yyyy')}</p><h2>{expensesLoading ? '…' : formatCurrency(months.find(month => month.key === selectedMonth)?.amount || 0)}</h2></div><MonthlySpendingBars months={months} selectedMonth={selectedMonth} onSelect={setSelectedMonth} /></section>
    </MobileFinancialReport>
  </div>
  return <div className="monetra-home">
    <section className="monetra-overview" aria-label="Spending overview">
      {header}
      <div className="monetra-stat">
        <div><p>Spent in {format(parseDateOnly(`${selectedMonth}-01`), 'MMMM')}</p><h1>{loading ? '…' : formatCurrency(months.find(month => month.key === selectedMonth)?.amount || 0)}</h1></div>
        <div className="monetra-stat-aside"><span>Bank account</span><strong>{loading ? '…' : formatCurrency(bank)}</strong><small>Current balance</small></div>
      </div>
      {error && <p role="alert" className="monetra-data-error">Could not load your finances. Open your report to retry.</p>}
      <MonthlySpendingBars months={months} selectedMonth={selectedMonth} onSelect={month => { recordMonthTap(1000); setSelectedMonth(month) }} />
      <button type="button" ref={reportLink} className="monetra-report-link" onClick={() => {
        homeScroll.current = window.scrollY
        onOpenReport()
      }}><span className="monetra-outline-icon"><BarChart3 size={17} /></span><span>View financial report</span><ChevronRight size={17} /></button>
    </section>
    <div className="monetra-action-strip" aria-label="Account shortcuts">
      <button type="button" onClick={onTransfers}><span><Wallet size={16} /></span>Transfers</button>
      <button type="button" onClick={onSavings}><span><HandCoins size={16} /></span>Savings</button>
      <button type="button" onClick={onIncome}><span><Coins size={16} /></span>Income</button>
    </div>
    <section className="monetra-activity" aria-label="Spending summary and upcoming bills">
      <div className="monetra-sheet-handle" />
      <button type="button" className="monetra-category-review" onClick={onCategories}><span className="monetra-review-icon"><CategoryIcon name="shopping-bag" className="h-[22px] w-[22px]" /></span><span><strong>Category review</strong><small>Review your spending categories</small></span><ChevronRight size={17} /></button>
      {expensesLoading ? <p role="status" className="monetra-empty">Loading your spending…</p> : expensesError ? <p role="alert" className="monetra-empty">Could not load your spending. <button type="button" onClick={() => void fetchExpenses()}>Try again</button></p> : <>
        <div className="monetra-home-insights" aria-label="Current month spending summary">
          <button type="button" onClick={onOpenReport}><small>Today's spending</small><strong>{formatCurrency(todaySpending)}</strong><span>{format(new Date(), 'MMM d')}</span></button>
          <button type="button" onClick={onOpenReport}><small>Daily average</small><strong>{formatCurrency(dailyAverage)}</strong><span>Month to date · includes every day</span></button>
          <button type="button" className="monetra-home-top-category" onClick={onCategories}><small>Top category</small><strong>{topCategory?.name || 'No spending yet'}</strong><span>{topCategory ? `${formatCurrency(topCategory.value)} · this month` : 'Your leading category this month'}</span><ChevronRight size={16} aria-hidden="true" /></button>
        </div>
        <div className="monetra-upcoming-heading"><h2>Upcoming bills</h2><span>All future dates</span></div>
        {upcoming.length === 0 ? <div className="monetra-empty"><p>No upcoming bills</p><button type="button" onClick={onAdd}><Plus size={16} /> Add a bill</button></div> : <div className="monetra-upcoming-bills">
          {upcoming.map((row, index) => <button type="button" key={row.id} onClick={onExpenses} className="monetra-transaction">
            <span className={`monetra-transaction-icon tint-${index % 4}`}><CategoryIcon name={row.category?.icon || 'shopping-bag'} className="h-[19px] w-[19px]" /></span>
            <span className="monetra-transaction-name"><strong>{row.description || row.category?.name || 'Upcoming bill'}</strong><small>{format(parseDateOnly(row.date), 'MMM d, yyyy')} · {row.category?.name || 'Uncategorized'}</small></span>
            <span className="monetra-transaction-amount expense"><strong><ArrowDownCircle size={10} />{formatCurrency(Number(row.amount))}</strong><small>{row.account_type === 'bank' ? 'Bank account' : 'Cash'}</small></span>
          </button>)}
        </div>}
        <button type="button" className="monetra-all-activity" onClick={onExpenses}>View expenses <ChevronRight size={15} /></button>
      </>}
      <section className="monetra-gold-card" aria-label="Gold spot reference in Jordanian dinars">
        <div className="monetra-gold-card-icon"><Coins size={20} /></div>
        <div className="monetra-gold-card-copy">
          <p>Gold in JOD <a href="https://api.gold-api.com/price/XAU" target="_blank" rel="noreferrer">· Live spot reference</a></p>
          {goldPrice ? <>
            <strong>{Number(goldPrice.price_21k).toFixed(2)} <small>JOD / g · 21k</small></strong>
            <span>24k: {Number(goldPrice.price_24k).toFixed(2)} JOD / g · indicative market spot</span>
            <span>Updated {format(new Date(goldPrice.fetched_at), 'MMM d, h:mm a')}</span>
            <GoldPriceTrend history={goldHistory} />
            {isPriceStale(goldPrice) && <span className="monetra-gold-stale">Price may be out of date</span>}
          </> : <span role={goldError ? 'alert' : 'status'}>{goldLoading ? 'Loading price…' : goldError ? `Could not load price: ${goldError}` : 'Price unavailable. Check your connection and try again.'}</span>}
        </div>
        <button type="button" className="monetra-gold-refresh" onClick={() => void onRefreshGold()} disabled={goldRefreshing} aria-label="Refresh gold price" title="Refresh gold price">
          <RefreshCw size={16} className={goldRefreshing ? 'animate-spin' : ''} />
        </button>
      </section>
    </section>

  </div>
}
