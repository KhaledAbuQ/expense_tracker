import { useMemo } from 'react'
import { TrendingUp, Calendar, Wallet, Building2, Banknote } from 'lucide-react'
import { useExpenses } from '../hooks/useExpenses'
import { useIncome } from '../hooks/useIncome'
import { useTransfers } from '../hooks/useTransfers'
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
import { Income, Expense, Transfer, AccountType, TransferAccountType, IncomeAccountType } from '../types'

// Calculate total income (excluding savings)
function calculateTotalIncome(income: Income[]): number {
  return income
    .filter(i => i.account_type !== 'savings')
    .reduce((sum, item) => sum + Number(item.amount), 0)
}

// Calculate income by account type
function calculateIncomeByAccount(income: Income[], accountType: IncomeAccountType): number {
  return income
    .filter(i => i.account_type === accountType)
    .reduce((sum, item) => sum + Number(item.amount), 0)
}

// Calculate expenses by account type (only expenses paid by 'me')
function calculateExpensesByAccount(expenses: Expense[], accountType: AccountType): number {
  return expenses
    .filter(e => e.paid_by === 'me' && e.account_type === accountType)
    .reduce((sum, e) => sum + Number(e.amount), 0)
}

// Calculate transfer impact on an account
function calculateTransferImpact(transfers: Transfer[], accountType: TransferAccountType): number {
  let impact = 0
  transfers.forEach(t => {
    if (t.to_account === accountType) {
      impact += Number(t.amount)
    }
    if (t.from_account === accountType) {
      impact -= Number(t.amount)
    }
  })
  return impact
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
  const { transfers: allTransfers, loading: allTransfersLoading } = useTransfers({})

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
                  currentIncomeLoading || lastIncomeLoading || allExpensesLoading || allIncomeLoading || 
                  allTransfersLoading

  // Calculate balances by account type
  const balances = useMemo(() => {
    // Bank balance: bank income - bank expenses + transfers to bank - transfers from bank
    const bankIncome = calculateIncomeByAccount(allIncome, 'bank')
    const bankExpenses = calculateExpensesByAccount(allExpenses, 'bank')
    const bankTransferImpact = calculateTransferImpact(allTransfers, 'bank')
    const bankBalance = bankIncome - bankExpenses + bankTransferImpact

    // Cash balance: cash income - cash expenses + transfers to cash - transfers from cash
    const cashIncome = calculateIncomeByAccount(allIncome, 'cash')
    const cashExpenses = calculateExpensesByAccount(allExpenses, 'cash')
    const cashTransferImpact = calculateTransferImpact(allTransfers, 'cash')
    const cashBalance = cashIncome - cashExpenses + cashTransferImpact

    // Total balance: only bank + cash (savings is separate)
    const totalBalance = bankBalance + cashBalance

    return {
      bank: bankBalance,
      cash: cashBalance,
      total: totalBalance,
    }
  }, [allIncome, allExpenses, allTransfers])

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

      {/* Balance Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Total Balance - Featured */}
        <div className="bg-gradient-to-r from-indigo-600 to-indigo-700 rounded-xl p-5 shadow-lg text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-indigo-200 text-sm font-medium">Available Balance</p>
              <p className="text-2xl font-bold mt-1">
                {loading ? '...' : formatCurrency(balances.total)}
              </p>
              <p className="text-indigo-200 text-xs mt-1">Bank + Cash</p>
            </div>
            <div className="p-3 bg-white/10 rounded-xl">
              <Wallet className="w-6 h-6" />
            </div>
          </div>
        </div>

        {/* Bank Balance */}
        <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-500 text-sm font-medium">Bank Account</p>
              <p className="text-xl font-bold text-gray-900 mt-1">
                {loading ? '...' : formatCurrency(balances.bank)}
              </p>
            </div>
            <div className="p-3 bg-blue-50 rounded-xl">
              <Building2 className="w-6 h-6 text-blue-600" />
            </div>
          </div>
        </div>

        {/* Cash Balance */}
        <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-500 text-sm font-medium">Cash</p>
              <p className="text-xl font-bold text-gray-900 mt-1">
                {loading ? '...' : formatCurrency(balances.cash)}
              </p>
            </div>
            <div className="p-3 bg-green-50 rounded-xl">
              <Banknote className="w-6 h-6 text-green-600" />
            </div>
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
