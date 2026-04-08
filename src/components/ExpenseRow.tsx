import { Pencil, Trash2, User, Users, Building2, Banknote } from 'lucide-react'
import { Expense } from '../types'
import { formatCurrency, formatDate } from '../lib/utils'
import CategoryBadge from './CategoryBadge'

interface ExpenseRowProps {
  expense: Expense
  onEdit: (expense: Expense) => void
  onDelete: (id: string) => void
}

export default function ExpenseRow({ expense, onEdit, onDelete }: ExpenseRowProps) {
  const handleDelete = () => {
    if (window.confirm('Are you sure you want to delete this expense?')) {
      onDelete(expense.id)
    }
  }

  const accountType = expense.account_type || 'bank'

  return (
    <tr className="hover:bg-gray-50 transition-colors">
      <td className="px-6 py-4 text-sm text-gray-600">
        {formatDate(expense.date)}
      </td>
      <td className="px-6 py-4 text-sm text-gray-900">
        <div className="flex flex-col">
          <span>{expense.description || <span className="text-gray-400 italic">No description</span>}</span>
          <div className="flex items-center gap-2 mt-1">
            <span className={`inline-flex items-center px-2 py-0.5 text-xs rounded ${
              expense.expense_type === 'personal' 
                ? 'bg-blue-100 text-blue-700' 
                : 'bg-purple-100 text-purple-700'
            }`}>
              {expense.expense_type === 'personal' ? 'Personal' : 'Household'}
            </span>
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded ${
              expense.paid_by === 'me' 
                ? 'bg-gray-100 text-gray-700' 
                : 'bg-orange-100 text-orange-700'
            }`}>
              {expense.paid_by === 'me' ? <User className="w-3 h-3" /> : <Users className="w-3 h-3" />}
              {expense.paid_by === 'me' ? 'Me' : 'Family'}
            </span>
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded ${
              accountType === 'bank' 
                ? 'bg-blue-50 text-blue-600' 
                : 'bg-green-50 text-green-600'
            }`}>
              {accountType === 'bank' ? <Building2 className="w-3 h-3" /> : <Banknote className="w-3 h-3" />}
              {accountType === 'bank' ? 'Bank' : 'Cash'}
            </span>
          </div>
        </div>
      </td>
      <td className="px-6 py-4">
        <CategoryBadge category={expense.category} />
      </td>
      <td className="px-6 py-4 text-sm font-medium text-gray-900 text-right">
        {formatCurrency(expense.amount)}
      </td>
      <td className="px-6 py-4 text-right">
        <div className="flex items-center justify-end gap-2">
          <button
            onClick={() => onEdit(expense)}
            className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
            title="Edit"
          >
            <Pencil className="w-4 h-4" />
          </button>
          <button
            onClick={handleDelete}
            className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
            title="Delete"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </td>
    </tr>
  )
}
