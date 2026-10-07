import { useRapidTapPeek } from '../hooks/useRapidTapPeek'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { format, startOfMonth, subMonths } from 'date-fns'
import { ArrowDownCircle, BarChart3, ChevronRight, Coins, HandCoins, Plus, Wallet } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useExpenses } from '../hooks/useExpenses'
import { useIncome } from '../hooks/useIncome'
import { useTransfers } from '../hooks/useTransfers'
import { calculateIncomeByAccount, calculateTotalExpenses, formatCurrency, groupExpensesByCategory, parseDateOnly } from '../lib/utils'
import CategoryIcon from './CategoryIcon'
import MonthlySpendingBars from './MonthlySpendingBars'
import MobileFinancialReport from './MobileFinancialReport'

interface Props {
  header: ReactNode
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

export default function MobileHome({ header, reportOpen, onOpenReport, onCloseReport, onAdd, onExpenses, onIncome, onSavings, onTransfers, onCategories }: Props) {
  const recordMonthTap = useRapidTapPeek()
  const homeRef = useRef<HTMLDivElement>(null)
  const homeScroll = useRef(0)
  const reportWasPage = useRef(false)
  const [reportPage, setReportPage] = useState(false)
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

  useEffect(() => {
    if (!reportOpen) {
      setReportPage(false)
      if (reportWasPage.current) {
        reportWasPage.current = false
        const frame = window.requestAnimationFrame(() => window.scrollTo({ top: homeScroll.current, behavior: 'auto' }))
        return () => window.cancelAnimationFrame(frame)
      }
      return
    }
    homeScroll.current = window.scrollY
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const timer = window.setTimeout(() => {
      reportWasPage.current = true
      setReportPage(true)
    }, reducedMotion ? 0 : 800)
    return () => window.clearTimeout(timer)
  }, [reportOpen])

  useEffect(() => {
    if (reportOpen && reportPage) {
      window.scrollTo({ top: 0, behavior: 'auto' })
      homeRef.current?.querySelector<HTMLElement>('[aria-label="Back to Home"]')?.focus({ preventScroll: true })
    }
  }, [reportOpen, reportPage])

  if (reportOpen && reportPage) return <div ref={homeRef} className="monetra-home home-report-page">
    <MobileFinancialReport expenses={mine} income={myIncome} transfers={myTransfers} loading={loading} error={error} onRetry={refreshReport} onClose={onCloseReport}>
      <section className="mobile-report-panel mobile-report-months" aria-label="Monthly spending bars"><div className="mobile-report-panel-heading"><p>Spent in {format(parseDateOnly(`${selectedMonth}-01`), 'MMMM yyyy')}</p><h2>{expensesLoading ? '…' : formatCurrency(months.find(month => month.key === selectedMonth)?.amount || 0)}</h2></div><MonthlySpendingBars months={months} selectedMonth={selectedMonth} onSelect={setSelectedMonth} /></section>
    </MobileFinancialReport>
  </div>
  return <div ref={homeRef} className={`monetra-home ${reportOpen ? 'is-report-expanded' : ''}`}>
    <section className="monetra-overview" aria-label="Spending overview">
      {header}
      <div className="monetra-stat">
        <div><p>Spent in {format(parseDateOnly(`${selectedMonth}-01`), 'MMMM')}</p><h1>{loading ? '…' : formatCurrency(months.find(month => month.key === selectedMonth)?.amount || 0)}</h1></div>
        <div className="monetra-stat-aside"><span>Bank account</span><strong>{loading ? '…' : formatCurrency(bank)}</strong><small>Current balance</small></div>
      </div>
      {error && <p role="alert" className="monetra-data-error">Could not load your finances. Open your report to retry.</p>}
      <MonthlySpendingBars months={months} selectedMonth={selectedMonth} onSelect={month => { recordMonthTap(1000); setSelectedMonth(month) }} />
      <button type="button" className="monetra-report-link" onClick={reportOpen ? onCloseReport : onOpenReport} aria-controls="home-financial-report" aria-expanded={reportOpen}><span className="monetra-outline-icon"><BarChart3 size={17} /></span><span>{reportOpen ? 'Close financial report' : 'View financial report'}</span><ChevronRight size={17} /></button>
      <div id="home-financial-report" className={`home-report-reveal ${reportOpen ? 'is-open' : ''}`} aria-hidden={!reportOpen} ref={element => { if (element) { if (reportOpen) element.removeAttribute('inert'); else element.setAttribute('inert', '') } }}>
        <div className="home-report-reveal-inner"><MobileFinancialReport expenses={mine} income={myIncome} transfers={myTransfers} loading={loading} error={error} onRetry={refreshReport} /></div>
      </div>
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
    </section>

  </div>
}
