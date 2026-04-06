import { Expense } from '../types'
import ExpenseRow from './ExpenseRow'

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
      <div className="bg-white rounded-xl shadow-sm border border-gray-100">
        <div className="p-8 text-center text-gray-500">
          Loading expenses...
        </div>
      </div>
    )
  }

  if (expenses.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-100">
        <div className="p-8 text-center">
          <p className="text-gray-500">No expenses found</p>
          <p className="text-sm text-gray-400 mt-1">
            Add your first expense to get started
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
      <table className="w-full">
        <thead>
          <tr className="bg-gray-50 border-b border-gray-100">
            <th className="text-left px-6 py-4 text-sm font-medium text-gray-500">
              Date
            </th>
            <th className="text-left px-6 py-4 text-sm font-medium text-gray-500">
              Description
            </th>
            <th className="text-left px-6 py-4 text-sm font-medium text-gray-500">
              Category
            </th>
            <th className="text-right px-6 py-4 text-sm font-medium text-gray-500">
              Amount
            </th>
            <th className="text-right px-6 py-4 text-sm font-medium text-gray-500">
              Actions
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
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
  )
}
