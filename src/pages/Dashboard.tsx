import { useMemo } from 'react'
import { DollarSign, TrendingUp, PieChart, Calendar } from 'lucide-react'
import { useExpenses } from '../hooks/useExpenses'
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
} from '../lib/utils'
import { subMonths } from 'date-fns'

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

  const { expenses: currentExpenses, loading: currentLoading } = useExpenses({
    dateRange: currentMonthRange,
  })
  const { expenses: lastMonthExpenses, loading: lastLoading } = useExpenses({
    dateRange: lastMonthRange,
  })
  const { expenses: yearExpenses, loading: yearLoading } = useExpenses({
    dateRange: yearRange,
  })
  const { categories, loading: categoriesLoading } = useCategories()

  const loading = currentLoading || lastLoading || yearLoading || categoriesLoading

  const stats = useMemo(() => {
    const currentTotal = calculateTotalExpenses(currentExpenses)
    const lastTotal = calculateTotalExpenses(lastMonthExpenses)
    const days = getDaysInRange(currentMonthRange)
    const avgDaily = calculateAverageDaily(currentExpenses, days)
    const percentChange = calculatePercentChange(currentTotal, lastTotal)
    const topCategory = getTopCategory(currentExpenses, categories)

    return {
      currentTotal,
      avgDaily,
      percentChange,
      topCategory,
    }
  }, [currentExpenses, lastMonthExpenses, categories, currentMonthRange])

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
        <p className="text-gray-500 mt-1">Track your household expenses at a glance</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <SummaryCard
          title="Total This Month"
          value={loading ? '...' : formatCurrency(stats.currentTotal)}
          icon={<DollarSign className="w-6 h-6 text-indigo-600" />}
          trend={stats.percentChange}
          trendLabel="vs last month"
        />
        <SummaryCard
          title="Daily Average"
          value={loading ? '...' : formatCurrency(stats.avgDaily)}
          icon={<Calendar className="w-6 h-6 text-indigo-600" />}
          subtitle="This month"
        />
        <SummaryCard
          title="Top Category"
          value={loading ? '...' : stats.topCategory?.name || 'N/A'}
          subtitle={stats.topCategory ? formatCurrency(stats.topCategory.amount) : undefined}
          icon={<PieChart className="w-6 h-6 text-indigo-600" />}
        />
        <SummaryCard
          title="Transactions"
          value={loading ? '...' : currentExpenses.length.toString()}
          icon={<TrendingUp className="w-6 h-6 text-indigo-600" />}
          subtitle="This month"
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
