import {
  format,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  startOfYear,
  endOfYear,
  subMonths,
  differenceInCalendarDays,
  parseISO,
} from 'date-fns'
import {
  Expense,
  DateRange,
  ChartDataPoint,
  Category,
  Income,
  IncomeAccountType,
} from '../types'

/**
 * Parse a `YYYY-MM-DD` date column as local midnight.
 *
 * `new Date('2026-08-02')` is spec'd to parse as *UTC* midnight, but date-fns
 * formats in local time. West of UTC that combination renders every stored date
 * one day early, buckets the 1st of a month into the previous month, and shifts
 * the daily chart off the end of its own data. Always go through this helper
 * when turning a date column into a Date.
 */
export function parseDateOnly(date: string): Date {
  const parsed = parseISO(date)
  return Number.isNaN(parsed.getTime()) ? new Date(date) : parsed
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-JO', {
    style: 'currency',
    currency: 'JOD',
    minimumFractionDigits: 3,
    maximumFractionDigits: 3,
  }).format(amount)
}

export function formatDate(date: string): string {
  return format(parseDateOnly(date), 'MMM d, yyyy')
}

export function formatDateShort(date: string): string {
  return format(parseDateOnly(date), 'MMM d')
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
    case 'last-month': {
      const lastMonth = subMonths(now, 1)
      return {
        start: startOfMonth(lastMonth),
        end: endOfMonth(lastMonth),
      }
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

/**
 * Income that landed in a spendable account (bank or cash).
 *
 * Savings deposits are deliberately excluded: they are money you have, but not
 * money in your available balance. Use `calculateGrossIncome` when you want
 * every row, and keep the two names distinct -- the Dashboard and the Income
 * page previously had separate local functions both called
 * `calculateTotalIncome` that disagreed on this exact point, so the same month
 * showed two different income totals on two pages.
 */
export function calculateSpendableIncome(income: Income[]): number {
  return income
    .filter(i => i.account_type !== 'savings')
    .reduce((sum, item) => sum + Number(item.amount), 0)
}

/** Every income row, savings deposits included. */
export function calculateGrossIncome(income: Income[]): number {
  return income.reduce((sum, item) => sum + Number(item.amount), 0)
}

export function calculateIncomeByAccount(
  income: Income[],
  accountType: IncomeAccountType
): number {
  return income
    .filter(i => i.account_type === accountType)
    .reduce((sum, item) => sum + Number(item.amount), 0)
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
      value: Number(value.toFixed(3)),
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

	const dates = Object.keys(grouped).sort(
		(a, b) => parseDateOnly(a).getTime() - parseDateOnly(b).getTime()
	)

	// If there are no expenses, return empty so the chart can show its empty state
	if (dates.length === 0) return []

	const result: ChartDataPoint[] = []
	const start = parseDateOnly(dates[0])
	const end = parseDateOnly(dates[dates.length - 1])

	// Walk day-by-day between first and last expense date,
	// filling missing days with zero values so the chart is continuous
	for (
		let current = new Date(start.getTime());
		current <= end;
		current.setDate(current.getDate() + 1)
	) {
		const key = format(current, 'yyyy-MM-dd')
		const value = grouped[key] ?? 0
		result.push({
			name: formatDateShort(key),
			value: Number(value.toFixed(3)),
		})
	}

	return result
}

export function groupExpensesByMonth(expenses: Expense[]): ChartDataPoint[] {
  const grouped = expenses.reduce((acc, expense) => {
    const date = parseDateOnly(expense.date)
    // Use YYYY-MM format as key for proper sorting, store display name separately
    const sortKey = format(date, 'yyyy-MM')
    const displayName = format(date, 'MMM yyyy')
    if (!acc[sortKey]) {
      acc[sortKey] = { displayName, value: 0 }
    }
    acc[sortKey].value += Number(expense.amount)
    return acc
  }, {} as Record<string, { displayName: string; value: number }>)

  return Object.entries(grouped)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([, { displayName, value }]) => ({
      name: displayName,
      value: Number(value.toFixed(3)),
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

/**
 * Number of calendar days covered by an inclusive range.
 *
 * Counts calendar days rather than elapsed milliseconds. The old millisecond
 * arithmetic reported 32 days for a 31-day month, because `endOfMonth` lands on
 * 23:59:59.999 and `Math.ceil` rounded that partial day up before adding one.
 */
export function getDaysInRange(range: DateRange): number {
  const days = Math.abs(differenceInCalendarDays(range.end, range.start)) + 1
  return Number.isFinite(days) ? days : 0
}

export function getElapsedDaysInMonth(): number {
  const now = new Date()
  return now.getDate()
}
