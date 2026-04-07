import { useMemo } from 'react'
import { TrendingUp, Calendar, Wallet, DollarSign } from 'lucide-react'
import { useExpenses } from '../hooks/useExpenses'
import { useIncome } from '../hooks/useIncome'
import { useCategories } from '../hooks/useCategories'
import SummaryCard from '../components/SummaryCard'
import CategoryPieChart from '../components/charts/CategoryPieChart'
import ExpenseLineChart from '../components/charts/ExpenseLineChart'
import MonthlyBarChart from '../components/charts/MonthlyBarChart'
import {
  formatCurrency,
  getDateRange,
  calculateTotalExpenses,
  calculateAverageDaily,
  calculatePercentChange,
  groupExpensesByCategory,
  groupExpensesByDate,
  groupExpensesByMonth,
  getTopCategory,
  getDaysInRange,
  getElapsedDaysInMonth,
} from '../lib/utils'
import { subMonths } from 'date-fns'
import { Income } from '../types'

// Calculate total income
function calculateTotalIncome(income: Income[]): number {
  return income.reduce((sum, item) => sum + Number(item.amount), 0)
}

export default function Dashboard() {
  // Memoize date ranges to prevent infinite re-renders
  const currentMonthRange = useMemo(() => getDateRange('month'), [])
  const lastMonthRange = useMemo(() => getDateRange('last-month'), [])
  
  // Get last 6 months for monthly chart
  const yearRange = useMemo(() => {
    const sixMonthsAgo = subMonths(new Date(), 6)
    return {
      start: sixMonthsAgo,
      end: new Date(),
    }
  }, [])

  // All-time range for balance calculation (no date filter)
  const { expenses: allExpenses, loading: allExpensesLoading } = useExpenses({})
  const { income: allIncome, loading: allIncomeLoading } = useIncome({})

  const { expenses: currentExpenses, loading: currentLoading } = useExpenses({
    dateRange: currentMonthRange,
  })
  const { expenses: lastMonthExpenses, loading: lastLoading } = useExpenses({
    dateRange: lastMonthRange,
  })
  const { expenses: yearExpenses, loading: yearLoading } = useExpenses({
    dateRange: yearRange,
  })
  
  const { income: currentIncome, loading: currentIncomeLoading } = useIncome({
    dateRange: currentMonthRange,
  })
  const { income: lastMonthIncome, loading: lastIncomeLoading } = useIncome({
    dateRange: lastMonthRange,
  })

  const { categories, loading: categoriesLoading } = useCategories()

  const loading = currentLoading || lastLoading || yearLoading || categoriesLoading || 
                  currentIncomeLoading || lastIncomeLoading || allExpensesLoading || allIncomeLoading

  // Calculate balance: Total Income - Expenses paid by "me"
  const balance = useMemo(() => {
    const totalIncome = calculateTotalIncome(allIncome)
    const myExpenses = allExpenses.filter(e => e.paid_by === 'me')
    const totalMyExpenses = calculateTotalExpenses(myExpenses)
    return totalIncome - totalMyExpenses
  }, [allIncome, allExpenses])

  const stats = useMemo(() => {
    const currentTotal = calculateTotalExpenses(currentExpenses)
    const lastTotal = calculateTotalExpenses(lastMonthExpenses)
    const currentIncomeTotal = calculateTotalIncome(currentIncome)
    const lastIncomeTotal = calculateTotalIncome(lastMonthIncome)
    const elapsedDays = getElapsedDaysInMonth()
    const lastMonthDays = getDaysInRange(lastMonthRange)
    const avgDailyCurrent = calculateAverageDaily(currentExpenses, elapsedDays)
    const avgDailyLastMonth = calculateAverageDaily(lastMonthExpenses, lastMonthDays)
    const percentChange = calculatePercentChange(currentTotal, lastTotal)
    const incomePercentChange = calculatePercentChange(currentIncomeTotal, lastIncomeTotal)
    const topCategory = getTopCategory(currentExpenses, categories)

    // Expenses paid by me this month
    const myExpensesThisMonth = currentExpenses.filter(e => e.paid_by === 'me')
    const myExpensesTotal = calculateTotalExpenses(myExpensesThisMonth)

    return {
      currentTotal,
      currentIncomeTotal,
      myExpensesTotal,
      avgDailyCurrent,
      avgDailyLastMonth,
      elapsedDays,
      percentChange,
      incomePercentChange,
      topCategory,
    }
  }, [currentExpenses, lastMonthExpenses, currentIncome, lastMonthIncome, categories, lastMonthRange])

  const categoryChartData = useMemo(
    () => groupExpensesByCategory(currentExpenses, categories),
    [currentExpenses, categories]
  )

  const dailyChartData = useMemo(
    () => groupExpensesByDate(currentExpenses),
    [currentExpenses]
  )

  const monthlyChartData = useMemo(
    () => groupExpensesByMonth(yearExpenses),
    [yearExpenses]
  )

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-500 mt-1">Track your finances at a glance</p>
      </div>

      {/* Balance Card - Featured */}
      <div className="bg-gradient-to-r from-indigo-600 to-indigo-700 rounded-xl p-6 shadow-lg text-white">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-indigo-200 text-sm font-medium">Your Balance</p>
            <p className="text-3xl font-bold mt-1">
              {loading ? '...' : formatCurrency(balance)}
            </p>
            <p className="text-indigo-200 text-sm mt-2">
              Total income minus your expenses
            </p>
          </div>
          <div className="p-4 bg-white/10 rounded-xl">
            <Wallet className="w-8 h-8" />
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <SummaryCard
          title="Income This Month"
          value={loading ? '...' : formatCurrency(stats.currentIncomeTotal)}
          icon={<span className="text-green-600 font-bold text-lg">د.ا</span>}
          trend={stats.incomePercentChange}
          trendLabel="vs last month"
        />
        <SummaryCard
          title="My Expenses"
          value={loading ? '...' : formatCurrency(stats.myExpensesTotal)}
          icon={<span className="text-red-600 font-bold text-lg">د.ا</span>}
          subtitle="Paid by me this month"
        />
        <SummaryCard
          title="Daily Avg (This Month)"
          value={loading ? '...' : formatCurrency(stats.avgDailyCurrent)}
          icon={<Calendar className="w-6 h-6 text-indigo-600" />}
          subtitle={`Based on ${stats.elapsedDays} days`}
          secondaryValue={loading ? '...' : formatCurrency(stats.avgDailyLastMonth)}
          secondaryLabel="Daily Avg (Last Month)"
        />
        <SummaryCard
          title="All Expenses"
          value={loading ? '...' : formatCurrency(stats.currentTotal)}
          icon={<TrendingUp className="w-6 h-6 text-indigo-600" />}
          trend={stats.percentChange}
          trendLabel="vs last month"
        />
      </div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Expenses by Category
          </h2>
          <CategoryPieChart data={categoryChartData} />
        </div>

        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Daily Spending Trend
          </h2>
          <ExpenseLineChart data={dailyChartData} />
        </div>
      </div>

      {/* Charts Row 2 */}
      <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          Monthly Comparison (Last 6 Months)
        </h2>
        <MonthlyBarChart data={monthlyChartData} />
      </div>
    </div>
  )
}
