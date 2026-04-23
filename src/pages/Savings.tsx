import { useMemo, useState } from 'react'
import { TrendingUp, TrendingDown, HandCoins } from 'lucide-react'
import { useIncome } from '../hooks/useIncome'
import { useTransfers } from '../hooks/useTransfers'
import { useExpenses } from '../hooks/useExpenses'
import { Income, Transfer, Expense } from '../types'
import { formatCurrency } from '../lib/utils'
import MonthlyBarChart from '../components/charts/MonthlyBarChart'
import { format, parseISO, subMonths, addMonths } from 'date-fns'

interface MonthlySavingsData {
  month: string
  monthLabel: string
  deposits: number
  transfersIn: number
  transfersOut: number
  netChange: number
}

// Calculate total savings from direct deposits
function calculateSavingsDeposits(income: Income[]): number {
  return income
    .filter(i => i.account_type === 'savings')
    .reduce((sum, item) => sum + Number(item.amount), 0)
}

// Calculate net transfers to/from savings
function calculateSavingsTransferImpact(transfers: Transfer[]): number {
  let impact = 0
  transfers.forEach(t => {
    if (t.to_account === 'savings') {
      impact += Number(t.amount)
    }
    if (t.from_account === 'savings') {
      impact -= Number(t.amount)
    }
  })
  return impact
}

// Group savings activity by month
function groupSavingsByMonth(income: Income[], transfers: Transfer[]): MonthlySavingsData[] {
  const monthMap = new Map<string, MonthlySavingsData>()
  
  // Process savings deposits from income
  income
    .filter(i => i.account_type === 'savings')
    .forEach(i => {
      const date = parseISO(i.date)
      const monthKey = format(date, 'yyyy-MM')
      const monthLabel = format(date, 'MMM yyyy')
      
      if (!monthMap.has(monthKey)) {
        monthMap.set(monthKey, {
          month: monthKey,
          monthLabel,
          deposits: 0,
          transfersIn: 0,
          transfersOut: 0,
          netChange: 0,
        })
      }
      
      const data = monthMap.get(monthKey)!
      data.deposits += Number(i.amount)
      data.netChange += Number(i.amount)
    })
  
  // Process transfers to/from savings
  transfers.forEach(t => {
    const date = parseISO(t.date)
    const monthKey = format(date, 'yyyy-MM')
    const monthLabel = format(date, 'MMM yyyy')
    
    if (!monthMap.has(monthKey)) {
      monthMap.set(monthKey, {
        month: monthKey,
        monthLabel,
        deposits: 0,
        transfersIn: 0,
        transfersOut: 0,
        netChange: 0,
      })
    }
    
    const data = monthMap.get(monthKey)!
    
    if (t.to_account === 'savings') {
      data.transfersIn += Number(t.amount)
      data.netChange += Number(t.amount)
    }
    if (t.from_account === 'savings') {
      data.transfersOut += Number(t.amount)
      data.netChange -= Number(t.amount)
    }
  })
  
  // Sort by month (most recent first)
  return Array.from(monthMap.values()).sort((a, b) => b.month.localeCompare(a.month))
}

export default function SavingsPage() {
  // Fetch all income and transfers (no date filter for total balance)
  const { income: allIncome, loading: incomeLoading } = useIncome({})
  const { transfers: allTransfers, loading: transfersLoading } = useTransfers({})
  const { expenses: allExpenses, loading: expensesLoading } = useExpenses({})

  const loading = incomeLoading || transfersLoading || expensesLoading

  // Calculate total savings balance
  const totalSavings = useMemo(() => {
    const deposits = calculateSavingsDeposits(allIncome)
    const transferImpact = calculateSavingsTransferImpact(allTransfers)
    return deposits + transferImpact
  }, [allIncome, allTransfers])

  // Calculate monthly breakdown
  const monthlyData = useMemo(() => {
    return groupSavingsByMonth(allIncome, allTransfers)
  }, [allIncome, allTransfers])

  // Prepare chart data for savings over time
  const monthlyChartData = useMemo(
    () =>
      // Sort chronologically (oldest to newest) for the chart axis
      [...monthlyData]
        .sort((a, b) => a.month.localeCompare(b.month))
        .map((m) => ({
          name: m.monthLabel,
          value: Number(m.netChange.toFixed(3)),
        })),
    [monthlyData]
  )

  // Calculate this month's savings
  const thisMonthSavings = useMemo(() => {
    const currentMonth = format(new Date(), 'yyyy-MM')
    const thisMonth = monthlyData.find(m => m.month === currentMonth)
    return thisMonth?.netChange || 0
  }, [monthlyData])

  // Calculate last month's savings for comparison
  const lastMonthSavings = useMemo(() => {
    const lastMonth = format(subMonths(new Date(), 1), 'yyyy-MM')
    const data = monthlyData.find(m => m.month === lastMonth)
    return data?.netChange || 0
  }, [monthlyData])

  // Average monthly income across history (for goal calculator context)
  const incomeStats = useMemo(() => {
    const monthMap = new Map<string, number>()

    allIncome.forEach((i) => {
      const date = parseISO(i.date)
      const monthKey = format(date, 'yyyy-MM')
      monthMap.set(monthKey, (monthMap.get(monthKey) || 0) + Number(i.amount))
    })

    const months = monthMap.size
    const total = Array.from(monthMap.values()).reduce((sum, value) => sum + value, 0)

    return {
      averageMonthlyIncome: months > 0 ? total / months : 0,
       monthsOfHistory: months,
    }
  }, [allIncome])

  // Average monthly expenses across history (for goal calculator context)
  const expenseStats = useMemo(() => {
    const monthMap = new Map<string, number>()

    allExpenses.forEach((e: Expense) => {
      // Focus on money you personally spend when judging goal difficulty
      if (e.visibility !== 'private') return

      const date = parseISO(e.date)
      const monthKey = format(date, 'yyyy-MM')
      monthMap.set(monthKey, (monthMap.get(monthKey) || 0) + Number(e.amount))
    })

    const months = monthMap.size
    const total = Array.from(monthMap.values()).reduce((sum, value) => sum + value, 0)

    return {
      averageMonthlyExpenses: months > 0 ? total / months : 0,
      monthsOfHistory: months,
    }
  }, [allExpenses])

  // Savings goal calculator state
  const [goalAmountInput, setGoalAmountInput] = useState('')
  const [monthsInput, setMonthsInput] = useState('')
  const [currentSavingsInput, setCurrentSavingsInput] = useState('')
  const [monthlyIncomeInput, setMonthlyIncomeInput] = useState('')
  const [willingMonthlyInput, setWillingMonthlyInput] = useState('')

  const goalAmount = parseFloat(goalAmountInput) || 0
  const monthsToGoal = parseInt(monthsInput, 10) || 0
  const willingMonthly = parseFloat(willingMonthlyInput) || 0
  const effectiveCurrentSavings =
    currentSavingsInput !== '' ? parseFloat(currentSavingsInput) || 0 : totalSavings

  const remainingToGoal = Math.max(goalAmount - effectiveCurrentSavings, 0)
  const monthlyRequired =
    monthsToGoal > 0 ? remainingToGoal / monthsToGoal : 0

  const effectiveMonthlyIncome =
    monthlyIncomeInput !== ''
      ? parseFloat(monthlyIncomeInput) || 0
      : incomeStats.averageMonthlyIncome

  const savingsPercentOfIncome =
    effectiveMonthlyIncome > 0 && monthlyRequired > 0
      ? (monthlyRequired / effectiveMonthlyIncome) * 100
      : 0

  const averageMonthlyExpenses = expenseStats.averageMonthlyExpenses
  const discretionaryMonthly = Math.max(effectiveMonthlyIncome - averageMonthlyExpenses, 0)

  const savingsPercentOfDiscretionary =
    discretionaryMonthly > 0 && monthlyRequired > 0
      ? (monthlyRequired / discretionaryMonthly) * 100
      : 0

  let savingsDoabilityLabel = ''
  let savingsDoabilityColor = 'text-gray-600'

  if (monthlyRequired > 0 && discretionaryMonthly > 0) {
    if (savingsPercentOfDiscretionary <= 40) {
      savingsDoabilityLabel = 'This goal looks very doable based on your usual spending.'
      savingsDoabilityColor = 'text-green-600'
    } else if (savingsPercentOfDiscretionary <= 70) {
      savingsDoabilityLabel = 'This goal is doable but will require some discipline.'
      savingsDoabilityColor = 'text-emerald-600'
    } else if (savingsPercentOfDiscretionary <= 100) {
      savingsDoabilityLabel = 'This goal is aggressive and may feel tight.'
      savingsDoabilityColor = 'text-amber-600'
    } else {
      savingsDoabilityLabel = 'This goal is very aggressive vs what you usually have left after expenses.'
      savingsDoabilityColor = 'text-red-600'
    }
  }

  const monthsRequiredFromWilling =
    willingMonthly > 0 && remainingToGoal > 0 ? remainingToGoal / willingMonthly : 0
  const monthsRequiredRounded =
    monthsRequiredFromWilling > 0 ? Math.ceil(monthsRequiredFromWilling) : 0
  const targetDateFromWilling =
    monthsRequiredRounded > 0 ? addMonths(new Date(), monthsRequiredRounded) : null

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Savings</h1>
        <p className="text-gray-500 mt-1">
          Track your savings progress over time
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Total Savings - Featured */}
        <div className="bg-gradient-to-r from-purple-600 to-purple-700 rounded-xl p-5 shadow-lg text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-purple-200 text-sm font-medium">Total Savings</p>
              <p className="text-2xl font-bold mt-1">
                {loading ? '...' : formatCurrency(totalSavings)}
              </p>
              <p className="text-purple-200 text-xs mt-1">All-time balance</p>
            </div>
            <div className="p-3 bg-white/10 rounded-xl">
              <HandCoins className="w-6 h-6" />
            </div>
          </div>
        </div>

        {/* This Month */}
        <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-500 text-sm font-medium">This Month</p>
              <p className={`text-xl font-bold mt-1 ${thisMonthSavings >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {loading ? '...' : (thisMonthSavings >= 0 ? '+' : '') + formatCurrency(thisMonthSavings)}
              </p>
            </div>
            <div className={`p-3 rounded-xl ${thisMonthSavings >= 0 ? 'bg-green-50' : 'bg-red-50'}`}>
              {thisMonthSavings >= 0 ? (
                <TrendingUp className={`w-6 h-6 ${thisMonthSavings >= 0 ? 'text-green-600' : 'text-red-600'}`} />
              ) : (
                <TrendingDown className="w-6 h-6 text-red-600" />
              )}
            </div>
          </div>
        </div>

        {/* Last Month */}
        <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-500 text-sm font-medium">Last Month</p>
              <p className={`text-xl font-bold mt-1 ${lastMonthSavings >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {loading ? '...' : (lastMonthSavings >= 0 ? '+' : '') + formatCurrency(lastMonthSavings)}
              </p>
            </div>
            <div className={`p-3 rounded-xl ${lastMonthSavings >= 0 ? 'bg-green-50' : 'bg-red-50'}`}>
              {lastMonthSavings >= 0 ? (
                <TrendingUp className={`w-6 h-6 ${lastMonthSavings >= 0 ? 'text-green-600' : 'text-red-600'}`} />
              ) : (
                <TrendingDown className="w-6 h-6 text-red-600" />
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Savings Overview Chart */}
      <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
        <h2 className="text-lg font-semibold text-gray-900">Savings Over Time</h2>
        <p className="text-sm text-gray-500 mt-1">
          See how your savings are changing month by month
        </p>
        <div className="mt-4">
          {loading ? (
            <div className="h-[300px] flex items-center justify-center text-gray-500">
              Loading savings data...
            </div>
          ) : (
            <MonthlyBarChart data={monthlyChartData} />
          )}
        </div>
      </div>

      {/* Monthly Breakdown */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-4 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900">Monthly Savings History</h2>
          <p className="text-sm text-gray-500 mt-1">
            Track how much you've saved each month
          </p>
        </div>
        
        {loading ? (
          <div className="p-8 text-center text-gray-500">Loading savings data...</div>
        ) : monthlyData.length === 0 ? (
          <div className="p-8 text-center">
            <HandCoins className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">No savings activity yet</p>
            <p className="text-sm text-gray-400 mt-1">
              Add income to savings or transfer money to your savings account
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Month
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Direct Deposits
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Transfers In
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Transfers Out
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Net Change
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {monthlyData.map((data) => (
                  <tr key={data.month} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-4 whitespace-nowrap">
                      <span className="font-medium text-gray-900">{data.monthLabel}</span>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-right">
                      {data.deposits > 0 ? (
                        <span className="text-green-600 font-medium">
                          +{formatCurrency(data.deposits)}
                        </span>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-right">
                      {data.transfersIn > 0 ? (
                        <span className="text-green-600 font-medium">
                          +{formatCurrency(data.transfersIn)}
                        </span>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-right">
                      {data.transfersOut > 0 ? (
                        <span className="text-red-600 font-medium">
                          -{formatCurrency(data.transfersOut)}
                        </span>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-right">
                      <span className={`font-semibold ${data.netChange >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {data.netChange >= 0 ? '+' : ''}{formatCurrency(data.netChange)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Savings Goal Calculator */}
      <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
        <h2 className="text-lg font-semibold text-gray-900">Savings Goal Planner</h2>
        <p className="text-sm text-gray-500 mt-1">
          Set a goal and see how much you need to save each month to reach it.
        </p>

        <div className="mt-4 grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Goal amount</label>
            <input
              type="number"
              min="0"
              value={goalAmountInput}
              onChange={(e) => setGoalAmountInput(e.target.value)}
              placeholder="e.g. 2000"
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-purple-500 focus:ring-purple-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Months to reach goal</label>
            <input
              type="number"
              min="1"
              value={monthsInput}
              onChange={(e) => setMonthsInput(e.target.value)}
              placeholder="e.g. 12"
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-purple-500 focus:ring-purple-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Current savings</label>
            <input
              type="number"
              min="0"
              value={currentSavingsInput}
              onChange={(e) => setCurrentSavingsInput(e.target.value)}
              placeholder={loading ? 'Detecting current savings...' : String(totalSavings.toFixed(3))}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-purple-500 focus:ring-purple-500"
            />
            <p className="mt-1 text-xs text-gray-500">
              Leave blank to use your total savings balance.
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Monthly income</label>
            <input
              type="number"
              min="0"
              value={monthlyIncomeInput}
              onChange={(e) => setMonthlyIncomeInput(e.target.value)}
              placeholder={
                incomeStats.averageMonthlyIncome > 0
                  ? String(incomeStats.averageMonthlyIncome.toFixed(3))
                  : 'e.g. 1000'
              }
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-purple-500 focus:ring-purple-500"
            />
            <p className="mt-1 text-xs text-gray-500">
              Leave blank to use your average monthly income.
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Monthly amount you can save</label>
            <input
              type="number"
              min="0"
              value={willingMonthlyInput}
              onChange={(e) => setWillingMonthlyInput(e.target.value)}
              placeholder="e.g. 150"
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-purple-500 focus:ring-purple-500"
            />
            <p className="mt-1 text-xs text-gray-500">
              Optional: enter what you&apos;re comfortable saving each month to see how long it would take.
            </p>
          </div>
        </div>

        {goalAmount > 0 && (monthsToGoal > 0 || (willingMonthly > 0 && remainingToGoal > 0)) && (
          <div className="mt-6 border-t border-gray-100 pt-4">
            {remainingToGoal <= 0 ? (
              <p className="text-sm font-medium text-green-600">
                You have already reached this goal.
              </p>
            ) : (
              <>
                {monthsToGoal > 0 && (
                  <>
                    <p className="text-sm text-gray-700">
                      To reach a goal of <span className="font-semibold">{formatCurrency(goalAmount)}</span> in{' '}
                      <span className="font-semibold">{monthsToGoal}</span> months, starting from{' '}
                      <span className="font-semibold">{formatCurrency(effectiveCurrentSavings)}</span>, you need to
                      save approximately:
                    </p>
                    <p className="mt-2 text-2xl font-bold text-purple-600">
                      {formatCurrency(monthlyRequired)} <span className="text-base font-medium text-gray-500">per month</span>
                    </p>

                    {effectiveMonthlyIncome > 0 && (
                      <p className="mt-2 text-sm text-gray-600">
                        Based on a monthly income of{' '}
                        <span className="font-medium">{formatCurrency(effectiveMonthlyIncome)}</span>
                        {incomeStats.monthsOfHistory > 0 && monthlyIncomeInput === '' && (
                          <>
                            {' '} (average over {incomeStats.monthsOfHistory} month
                            {incomeStats.monthsOfHistory === 1 ? '' : 's'})
                          </>
                        )}
                        , this is about{' '}
                        <span className="font-medium">{savingsPercentOfIncome.toFixed(1)}%</span> of your income.
                      </p>
                    )}

                    {expenseStats.monthsOfHistory > 0 && (
                      <p className="mt-2 text-sm text-gray-600">
                        Your average monthly expenses are{' '}
                        <span className="font-medium">{formatCurrency(averageMonthlyExpenses)}</span>
                        {' '} (based on {expenseStats.monthsOfHistory} month
                        {expenseStats.monthsOfHistory === 1 ? '' : 's'}). That typically leaves about{' '}
                        <span className="font-medium">{formatCurrency(discretionaryMonthly)}</span> per month after expenses.
                      </p>
                    )}

                    {savingsDoabilityLabel && (
                      <p className={`mt-3 text-sm font-medium ${savingsDoabilityColor}`}>
                        {savingsDoabilityLabel}{' '}
                        {discretionaryMonthly > 0 && monthlyRequired > 0 && (
                          <>
                            You're aiming to save about{' '}
                            <span className="font-semibold">
                              {savingsPercentOfDiscretionary.toFixed(1)}%
                            </span>{' '}
                            of what you usually have left after expenses.
                          </>
                        )}
                      </p>
                    )}
                  </>
                )}

                {willingMonthly > 0 && remainingToGoal > 0 && (
                  <>
                    <p className="mt-4 text-sm text-gray-700">
                      If you save <span className="font-semibold">{formatCurrency(willingMonthly)}</span> per month toward
                      this goal, starting from{' '}
                      <span className="font-semibold">{formatCurrency(effectiveCurrentSavings)}</span>, it will take
                      approximately{' '}
                      <span className="font-semibold">{monthsRequiredFromWilling.toFixed(1)}</span> months
                      {monthsRequiredRounded > 0 && targetDateFromWilling && (
                        <>
                          {' '} (about{' '}
                          <span className="font-semibold">
                            {monthsRequiredRounded} month{monthsRequiredRounded === 1 ? '' : 's'}
                          </span>
                          , around{' '}
                          <span className="font-semibold">
                            {format(targetDateFromWilling, 'MMM yyyy')}
                          </span>
                          ).
                        </>
                      )}
                      .
                    </p>
                  </>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
