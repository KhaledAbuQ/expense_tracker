import { useRapidTapPeek } from '../hooks/useRapidTapPeek'
import { useState } from 'react'
import { addDays, addMonths, format, getDaysInMonth, startOfDay } from 'date-fns'
import { Bell, ChevronDown, ChevronLeft, ChevronRight, Plus, RefreshCw, Settings, SlidersHorizontal } from 'lucide-react'
import type { Category, Expense } from '../types'
import { calculateTotalExpenses, formatCurrency, getDateRange, groupExpensesByCategory, parseDateOnly } from '../lib/utils'
import CategoryIcon from './CategoryIcon'

interface Props {
  expenses: Expense[]
  categories: Category[]
  loading: boolean
  error: string | null
  online: boolean
  period: 'month' | 'last-month' | 'week'
  visibility: 'all' | 'private' | 'household'
  pendingCount: number
  onPeriod: (value: Props['period']) => void
  onVisibility: (value: Props['visibility']) => void
  onRefresh: () => void
  onAdd: () => void
  onEdit: (expense: Expense) => void
  onReview: () => void
  onSettings: () => void
}

export default function MobileExpenses(props: Props) {
  const recordDayTap = useRapidTapPeek()
  const [tab, setTab] = useState<'upcoming' | 'all'>('all')
  const [calendarMonth, setCalendarMonth] = useState(() => format(new Date(), 'yyyy-MM'))
  const [customMonth, setCustomMonth] = useState(false)
  const [sort, setSort] = useState('date')
  const [selectedDay, setSelectedDay] = useState<string | null>(null)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [helpOpen, setHelpOpen] = useState(false)
  const [limit, setLimit] = useState(25)
  const today = startOfDay(new Date())
  const todayKey = format(today, 'yyyy-MM-dd')
  const weekEnd = format(addDays(today, 6), 'yyyy-MM-dd')
  const monthStart = parseDateOnly(`${calendarMonth}-01`)
  const days = tab === 'upcoming' ? Array.from({ length: 7 }, (_, index) => addDays(today, index)) : Array.from({ length: getDaysInMonth(monthStart) }, (_, index) => addDays(monthStart, index))
  const changeMonth = (value: string) => {
    if (!/^\d{4}-\d{2}$/.test(value)) return
    setCalendarMonth(value); setCustomMonth(true); setTab('all'); setSelectedDay(null); setLimit(25)
  }
  const upcoming = props.expenses.filter(expense => expense.date >= todayKey && expense.date <= weekEnd)
  const range = getDateRange(props.period)
  const periodStart = format(range.start, 'yyyy-MM-dd')
  const periodEnd = format(range.end, 'yyyy-MM-dd')
  const periodExpenses = props.expenses.filter(expense => customMonth ? expense.date.startsWith(calendarMonth) : expense.date >= periodStart && expense.date <= periodEnd)
  const ordered = (rows: Expense[]) => [...rows].sort((a, b) => sort === 'amount-high' ? Number(b.amount) - Number(a.amount)
    : sort === 'amount-low' ? Number(a.amount) - Number(b.amount)
    : tab === 'upcoming' ? a.date.localeCompare(b.date) || b.created_at.localeCompare(a.created_at)
    : b.date.localeCompare(a.date) || b.created_at.localeCompare(a.created_at))
  const listed = ordered(selectedDay ? props.expenses.filter(expense => expense.date === selectedDay) : tab === 'upcoming' ? upcoming : periodExpenses)
  const summaryExpenses = listed
  const breakdown = groupExpensesByCategory(summaryExpenses, props.categories)
  const categoryFor = (expense: Expense) => expense.category || props.categories.find(category => category.id === expense.category_id)

  const row = (expense: Expense, index: number) => {
    const category = categoryFor(expense)
    return <li key={expense.id}>
      <button type="button" className="bills-expense-row" onClick={() => props.onEdit(expense)} aria-label={`Edit ${expense.description || category?.name || 'expense'}, ${formatCurrency(Number(expense.amount))}`}>
        <span className={`bills-expense-icon tint-${index % 4}`} style={category?.color ? { backgroundColor: category.color, backgroundImage: 'linear-gradient(135deg, #ffffff40, transparent)', boxShadow: 'inset 0 0 0 1px #ffffff50' } : undefined}><CategoryIcon name={category?.icon || 'tag'} className="h-5 w-5" /></span>
        <span className="bills-expense-name"><strong>{expense.description || category?.name || 'Expense'}</strong><small>{format(parseDateOnly(expense.date), 'MMM d')}</small></span>
        <span className="bills-expense-price"><strong>{formatCurrency(Number(expense.amount))}</strong><small>{category?.name || 'Uncategorized'}</small></span>
      </button>
    </li>
  }

  return <div className="bills-expenses">
    <section className="bills-top-sheet">
      <header className="bills-header"><h1>Expenses</h1><div><button type="button" aria-label="Expense help" aria-expanded={helpOpen} onClick={() => setHelpOpen(value => !value)}><span className="bills-help-icon" aria-hidden="true">?</span></button><button type="button" aria-label="Settings and household tools" onClick={props.onSettings}><Settings size={20} fill="currentColor" /></button></div></header>
      <div className="bills-toolbar">
        <div className="bills-tabs" role="tablist" aria-label="Expense view">
          <button type="button" role="tab" aria-selected={tab === 'upcoming'} onClick={() => { setTab('upcoming'); setSelectedDay(null); setLimit(25) }}>Upcoming Expenses</button>
          <button type="button" role="tab" aria-selected={tab === 'all'} onClick={() => { setTab('all'); setSelectedDay(null); setLimit(25) }}>All Expenses</button>
        </div>
        <label className="bills-sort"><span className="sr-only">Sort expenses</span><select value={sort} onChange={event => setSort(event.target.value)} aria-label="Sort expenses"><option value="date">Sort</option><option value="amount-high">Highest amount</option><option value="amount-low">Lowest amount</option></select><ChevronDown size={12} /></label>
      </div>
      {helpOpen && <p className="bills-help" role="status">Upcoming shows expenses dated today through the next six days. Select a date to show only expenses on that day. Tap an expense to edit or delete it. Choose any month to browse its days. Use Clear day to return to the full list. Visibility filters still apply.</p>}
      <p className="bills-week-summary">{props.loading ? 'Loading your expenses…' : props.error ? 'Your expenses could not be loaded.' : <>You have <strong>{upcoming.length} {upcoming.length === 1 ? 'expense' : 'expenses'}</strong> within the next 7 days</>}</p>
      <div className="bills-month-picker">
        <button type="button" aria-label="Previous month" onClick={() => changeMonth(format(addMonths(monthStart, -1), 'yyyy-MM'))}><ChevronLeft size={18} /></button>
        <label><span className="sr-only">Expense month</span><input type="month" aria-label="Expense month" value={calendarMonth} onChange={event => changeMonth(event.target.value)} /></label>
        <button type="button" aria-label="Next month" onClick={() => changeMonth(format(addMonths(monthStart, 1), 'yyyy-MM'))}><ChevronRight size={18} /></button>
      </div>
      <div className={`bills-calendar ${tab === 'all' ? 'bills-month-days' : ''}`} aria-label={tab === 'upcoming' ? 'Expenses in the next seven days' : `Expenses in ${format(monthStart, 'MMMM yyyy')}`}>

        {days.map(date => {
          const key = format(date, 'yyyy-MM-dd')
          const entries = props.expenses.filter(expense => expense.date === key)
          const category = entries[0] && categoryFor(entries[0])
          const active = selectedDay === key || (!selectedDay && key === todayKey)
          return <div className="bills-calendar-day" key={key}><span className={active ? 'active-weekday' : ''}>{format(date, 'EEEEE')}</span><button type="button" aria-pressed={selectedDay === key} aria-label={`${format(date, 'EEEE, MMMM d')}, ${entries.length} expenses${selectedDay === key ? ', selected' : ''}`} className={`${active ? 'is-current' : ''} ${selectedDay === key ? 'is-day-selected' : ''}`} onClick={event => {
            recordDayTap()
            if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
              const button = event.currentTarget
              button.style.animation = 'none'
              // Restart the original CSS animation, including its easing on each bounce.
              void button.offsetWidth
              button.style.animation = 'bills-day-jump 480ms cubic-bezier(.22, 1, .36, 1)'
            }
            if (tab === 'all') setCustomMonth(true)
            setSelectedDay(key); setLimit(25)
          }}><span>{format(date, 'd')}</span>{entries.length > 0 ? <i className={`bills-calendar-dot tint-${date.getDay() % 4}`} style={category?.color ? { background: category.color } : undefined}><CategoryIcon name={category?.icon || 'tag'} className="h-2.5 w-2.5" /></i> : <i className="bills-calendar-empty" />}</button></div>
        })}
      </div>
    </section>
    <div className="bills-action-strip" aria-label="Expense actions">
      <button type="button" disabled={!props.online} onClick={props.onAdd}><span><Plus size={16} /></span>Add expense</button>
      <button type="button" onClick={props.onReview}><span><Bell size={16} /></span>Review SMS{props.pendingCount > 0 && <em>{props.pendingCount}</em>}</button>
      <button type="button" aria-expanded={filtersOpen} onClick={() => setFiltersOpen(value => !value)}><span><SlidersHorizontal size={16} /></span>Filters</button>
    </div>
    <section className="bills-list-sheet" aria-label="Expense transactions">
      <div className="bills-sheet-handle" />
      {filtersOpen && <div className="bills-filters"><label>Period<select aria-label="Period" value={props.period} onChange={event => { const period = event.target.value as Props['period']; props.onPeriod(period); setCustomMonth(false); setCalendarMonth(format(getDateRange(period).start, 'yyyy-MM')); setTab('all'); setSelectedDay(null); setLimit(25) }}><option value="month">This month</option><option value="last-month">Last month</option><option value="week">This week</option></select></label><label>Visibility<select aria-label="Visibility" value={props.visibility} onChange={event => { props.onVisibility(event.target.value as Props['visibility']); setSelectedDay(null) }}><option value="all">All visible</option><option value="private">Personal</option><option value="household">Household</option></select></label><button type="button" disabled={props.loading || !props.online} onClick={props.onRefresh}><RefreshCw size={14} /> Refresh</button></div>}
      {selectedDay && <button type="button" className="bills-clear-day" onClick={() => { setSelectedDay(null); setLimit(25) }}>Clear day</button>}
      <h2>{selectedDay ? `Expenses · ${format(parseDateOnly(selectedDay), 'MMM d, yyyy')}` : tab === 'upcoming' ? 'Upcoming expenses' : 'All expenses'}</h2>
      {props.error ? <div className="bills-empty" role="alert"><p>Could not load expenses.</p><button type="button" onClick={props.onRefresh}>Try again</button></div> : props.loading ? <p className="bills-empty" role="status">Loading expenses…</p> : <>
        {listed.length ? <ul className="bills-expense-list">{listed.slice(0, limit).map(row)}</ul> : <p className="bills-empty">{selectedDay ? 'No expenses on this day.' : tab === 'upcoming' ? 'No expenses dated in the next 7 days.' : 'No expenses in this period.'}</p>}
        {listed.length > limit && <button type="button" className="bills-show-more" onClick={() => setLimit(value => value + 25)}>Show more expenses</button>}
        <details className="bills-breakdown"><summary>Spending summary</summary><p>{formatCurrency(calculateTotalExpenses(summaryExpenses))} · {summaryExpenses.length} {selectedDay ? 'expenses on this day' : tab === 'upcoming' ? 'upcoming expenses' : 'expenses in this period'}</p>{breakdown.map(item => <div key={item.name}><span>{item.name}</span><strong>{formatCurrency(item.value)}</strong></div>)}</details>
      </>}
    </section>
  </div>
}
