import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfYear, endOfYear, subMonths } from 'date-fns'
import { Expense, DateRange, ChartDataPoint, Category } from '../types'

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-JO', {
    style: 'currency',
    currency: 'JOD',
  }).format(amount)
}

export function formatDate(date: string): string {
  return format(new Date(date), 'MMM d, yyyy')
}

export function formatDateShort(date: string): string {
  return format(new Date(date), 'MMM d')
}

export function getDateRange(preset: 'week' | 'month' | 'year' | 'last-month'): DateRange {
  const now = new Date()
  
  switch (preset) {
    case 'week':
      return {
        start: startOfWeek(now, { weekStartsOn: 1 }),
        end: endOfWeek(now, { weekStartsOn: 1 }),
      }
    case 'month':
      return {
        start: startOfMonth(now),
        end: endOfMonth(now),
      }
    case 'year':
      return {
        start: startOfYear(now),
        end: endOfYear(now),
      }
    case 'last-month':
      const lastMonth = subMonths(now, 1)
      return {
        start: startOfMonth(lastMonth),
        end: endOfMonth(lastMonth),
      }
    default:
      return {
        start: startOfMonth(now),
        end: endOfMonth(now),
      }
  }
}

export function calculateTotalExpenses(expenses: Expense[]): number {
  return expenses.reduce((sum, expense) => sum + Number(expense.amount), 0)
}

export function calculateAverageDaily(expenses: Expense[], days: number): number {
  const total = calculateTotalExpenses(expenses)
  return days > 0 ? total / days : 0
}

export function calculatePercentChange(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0
  return ((current - previous) / previous) * 100
}

export function groupExpensesByCategory(
  expenses: Expense[],
  categories: Category[]
): ChartDataPoint[] {
  const grouped = expenses.reduce((acc, expense) => {
    const categoryId = expense.category_id || 'uncategorized'
    if (!acc[categoryId]) {
      acc[categoryId] = 0
    }
    acc[categoryId] += Number(expense.amount)
    return acc
  }, {} as Record<string, number>)

  return Object.entries(grouped).map(([categoryId, value]) => {
    const category = categories.find(c => c.id === categoryId)
    return {
      name: category?.name || 'Uncategorized',
      value: Number(value.toFixed(2)),
      color: category?.color || '#6b7280',
    }
  }).sort((a, b) => b.value - a.value)
}

export function groupExpensesByDate(expenses: Expense[]): ChartDataPoint[] {
  const grouped = expenses.reduce((acc, expense) => {
    const date = expense.date
    if (!acc[date]) {
      acc[date] = 0
    }
    acc[date] += Number(expense.amount)
    return acc
  }, {} as Record<string, number>)

  return Object.entries(grouped)
    .sort((a, b) => new Date(a[0]).getTime() - new Date(b[0]).getTime())
    .map(([date, value]) => ({
      name: formatDateShort(date),
      value: Number(value.toFixed(2)),
    }))
}

export function groupExpensesByMonth(expenses: Expense[]): ChartDataPoint[] {
  const grouped = expenses.reduce((acc, expense) => {
    const month = format(new Date(expense.date), 'MMM yyyy')
    if (!acc[month]) {
      acc[month] = 0
    }
    acc[month] += Number(expense.amount)
    return acc
  }, {} as Record<string, number>)

  return Object.entries(grouped)
    .map(([month, value]) => ({
      name: month,
      value: Number(value.toFixed(2)),
    }))
}

export function getTopCategory(
  expenses: Expense[],
  categories: Category[]
): { name: string; amount: number } | null {
  const grouped = groupExpensesByCategory(expenses, categories)
  if (grouped.length === 0) return null
  return { name: grouped[0].name, amount: grouped[0].value }
}

export function getDaysInRange(range: DateRange): number {
  const diffTime = Math.abs(range.end.getTime() - range.start.getTime())
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1
}

export function getElapsedDaysInMonth(): number {
  const now = new Date()
  return now.getDate()
}
