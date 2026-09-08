import { addDays, addMonths, differenceInCalendarDays, endOfMonth, format, startOfDay, startOfMonth, startOfWeek, startOfYear, subDays, subMonths } from 'date-fns'
import { DateRange, Expense, Income } from '../types'
import { parseDateOnly } from './utils'

export type Horizon = 'month' | 'last-month' | '3-months' | '6-months' | '12-months' | 'year' | 'all' | 'custom'
export type Aggregation = 'day' | 'week' | 'month'
export function analyticsRange(horizon: Horizon, earliest: string | undefined, now = new Date()): DateRange {
  const end = startOfDay(now)
  if (horizon === 'last-month') return { start: startOfMonth(subMonths(end, 1)), end: startOfDay(endOfMonth(subMonths(end, 1))) }
  const months = { '3-months': 2, '6-months': 5, '12-months': 11 }
  const start = horizon === 'all' ? (earliest ? parseDateOnly(earliest) : end)
    : horizon === 'year' ? startOfYear(end)
    : horizon in months ? startOfMonth(subMonths(end, months[horizon as keyof typeof months]))
    : startOfMonth(end)
  return { start: start > end ? end : start, end }
}
export function previousRange(range: DateRange): DateRange {
  const days = differenceInCalendarDays(range.end, range.start) + 1
  return { start: subDays(range.start, days), end: subDays(range.start, 1) }
}
export function withinRange<T extends { date: string }>(rows: T[], range: DateRange): T[] {
  const start = format(range.start, 'yyyy-MM-dd'), end = format(range.end, 'yyyy-MM-dd')
  return rows.filter(row => row.date >= start && row.date <= end)
}
export function percentChange(current: number, previous: number): string {
  if (previous === 0) return current === 0 ? 'No change' : 'No prior spending'
  const change = (current - previous) / previous * 100
  return `${change > 0 ? '+' : ''}${change.toFixed(1)}%`
}
export function aggregateCashFlow(expenses: Expense[], income: Income[], range: DateRange, aggregation: Aggregation) {
  const bucket = (date: Date) => aggregation === 'month' ? startOfMonth(date) : aggregation === 'week' ? startOfWeek(date, { weekStartsOn: 1 }) : startOfDay(date)
  const result = new Map<string, { name: string; expenses: number; income: number; net: number; value: number }>()
  for (let date = bucket(range.start); date <= range.end; date = aggregation === 'month' ? addMonths(date, 1) : addDays(date, aggregation === 'week' ? 7 : 1)) {
    const first = date < range.start ? range.start : date
    const last = aggregation === 'month' ? endOfMonth(date) : addDays(date, aggregation === 'week' ? 6 : 0)
    const label = aggregation === 'month' ? format(date, 'MMM yyyy') : aggregation === 'week' ? `${format(first, 'MMM d, yyyy')} – ${format(last > range.end ? range.end : last, 'MMM d, yyyy')}` : format(date, 'MMM d')
    result.set(format(date, 'yyyy-MM-dd'), { name: label, expenses: 0, income: 0, net: 0, value: 0 })
  }
  for (const [rows, field] of [[expenses, 'expenses'], [income, 'income']] as const) {
    for (const row of withinRange(rows, range)) {
      const entry = result.get(format(bucket(parseDateOnly(row.date)), 'yyyy-MM-dd'))!
      entry[field] += Number(row.amount)
    }
  }
  return [...result.values()].map(row => ({ ...row, net: row.income - row.expenses, value: row.expenses }))
}

/** Align monthly running totals by day number; future/nonexistent days stay empty. */
export function cumulativeMonthlySpending(expenses: Expense[], comparisonMonth: string, now = new Date()) {
  const currentMonth = format(now, 'yyyy-MM')
  const currentDays = endOfMonth(now).getDate()
  const comparisonDays = endOfMonth(parseDateOnly(`${comparisonMonth}-01`)).getDate()
  const daily = new Map<string, number>()
  for (const expense of expenses) {
    daily.set(expense.date, (daily.get(expense.date) || 0) + Number(expense.amount))
  }
  let current = 0, comparison = 0
  return Array.from({ length: Math.max(currentDays, comparisonDays) }, (_, index) => {
    const day = index + 1
    const suffix = String(day).padStart(2, '0')
    current += daily.get(`${currentMonth}-${suffix}`) || 0
    comparison += daily.get(`${comparisonMonth}-${suffix}`) || 0
    return {
      day,
      current: day <= now.getDate() ? Number(current.toFixed(3)) : null,
      comparison: day <= comparisonDays ? Number(comparison.toFixed(3)) : null,
    }
  })
}
