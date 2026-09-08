import { Expense } from '../types'
import ExpenseRow, { ExpenseCard } from './ExpenseRow'

interface ExpenseListProps {
  expenses: Expense[]
  loading: boolean
  onEdit: (expense: Expense) => void
  onDelete: (id: string) => void
}

export default function ExpenseList({
  expenses,
  loading,
  onEdit,
  onDelete,
}: ExpenseListProps) {
  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
        <div className="p-8 text-center text-gray-500 dark:text-gray-400">
          Loading expenses...
        </div>
      </div>
    )
  }

  if (expenses.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
        <div className="p-8 text-center">
          <p className="text-gray-500 dark:text-gray-400">No expenses found</p>
          <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">
            Add your first expense to get started
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
      {/* Mobile Card View */}
      <div className="md:hidden divide-y divide-gray-100 dark:divide-gray-700">
        {expenses.map((expense) => (
          <ExpenseCard
            key={expense.id}
            expense={expense}
            onEdit={onEdit}
            onDelete={onDelete}
          />
        ))}
      </div>

      {/* Desktop Table View */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="bg-gray-50 dark:bg-gray-900/60 border-b border-gray-100 dark:border-gray-700">
              <th className="text-left px-6 py-4 text-sm font-medium text-gray-500 dark:text-gray-400">
                Date
              </th>
              <th className="text-left px-6 py-4 text-sm font-medium text-gray-500 dark:text-gray-400">
                Description
              </th>
              <th className="text-left px-6 py-4 text-sm font-medium text-gray-500 dark:text-gray-400">
                Category
              </th>
              <th className="text-right px-6 py-4 text-sm font-medium text-gray-500 dark:text-gray-400">
                Amount
              </th>
              <th className="text-right px-6 py-4 text-sm font-medium text-gray-500 dark:text-gray-400">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
            {expenses.map((expense) => (
              <ExpenseRow
                key={expense.id}
                expense={expense}
                onEdit={onEdit}
                onDelete={onDelete}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
