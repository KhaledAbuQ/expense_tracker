import { useMemo } from 'react'
import { PiggyBank, TrendingUp, TrendingDown } from 'lucide-react'
import { useIncome } from '../hooks/useIncome'
import { useTransfers } from '../hooks/useTransfers'
import { Income, Transfer } from '../types'
import { formatCurrency } from '../lib/utils'
import { format, parseISO, subMonths } from 'date-fns'

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

  const loading = incomeLoading || transfersLoading

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
              <PiggyBank className="w-6 h-6" />
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
            <PiggyBank className="w-12 h-12 text-gray-300 mx-auto mb-3" />
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

      {/* Tips Section
      <div className="bg-purple-50 rounded-xl p-5 border border-purple-100">
        <div className="flex items-start gap-3">
          <div className="p-2 bg-purple-100 rounded-lg">
            <ArrowRightLeft className="w-5 h-5 text-purple-600" />
          </div>
          <div>
            <h3 className="font-medium text-purple-900">How Savings Work</h3>
            <ul className="text-sm text-purple-700 mt-2 space-y-1">
              <li>• Add income directly to savings from the Income page</li>
              <li>• Transfer money to savings from bank or cash accounts</li>
              <li>• Savings balance is separate from your available balance</li>
              <li>• Transfer out of savings when you need to use the funds</li>
            </ul>
          </div>
        </div>
      </div> */}
    </div>
  )
}
