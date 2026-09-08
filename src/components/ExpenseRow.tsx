import { Pencil, Trash2, Building2, Banknote, Users } from 'lucide-react'
import { Expense } from '../types'
import { formatCurrency, formatDate } from '../lib/utils'
import { useAuth } from '../context/AuthContext'
import CategoryBadge from './CategoryBadge'

export interface ExpenseRowProps {
  expense: Expense
  onEdit: (expense: Expense) => void
  onDelete: (id: string) => void
}

export function ExpenseCard({ expense, onEdit, onDelete }: ExpenseRowProps) {
  const { member } = useAuth()

  const handleDelete = () => {
    if (window.confirm('Are you sure you want to delete this expense?')) {
      onDelete(expense.id)
    }
  }

  const accountType = expense.account_type || 'bank'
  const isOwn = !!member && expense.member_id === member.id

  return (
    <div className="p-4 hover:bg-gray-50/80 dark:hover:bg-gray-700/40 transition-colors">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="font-medium text-gray-900 dark:text-white text-sm">
            {expense.description || <span className="text-gray-400 dark:text-gray-500 italic">No description</span>}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            {formatDate(expense.date)}
          </p>
        </div>
        <div className="text-right shrink-0">
          <span className="text-base font-bold text-gray-900 dark:text-white">
            {formatCurrency(expense.amount)}
          </span>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-1.5 mt-2.5">
        <CategoryBadge category={expense.category} />
        <span className={`inline-flex items-center px-2 py-0.5 text-xs rounded font-medium ${
          expense.visibility === 'household' 
            ? 'bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300' 
            : 'bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300'
        }`}>
          {expense.visibility === 'household' ? 'Household' : 'Personal'}
        </span>
        <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 font-medium">
          <Users className="w-3 h-3" />
          {expense.member?.name || 'Member'}
        </span>
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded font-medium ${
          accountType === 'bank' 
            ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-300' 
            : 'bg-green-50 dark:bg-green-950/60 text-green-600 dark:text-green-300'
        }`}>
          {accountType === 'bank' ? <Building2 className="w-3 h-3" /> : <Banknote className="w-3 h-3" />}
          {accountType === 'bank' ? 'Bank' : 'Cash'}
        </span>
      </div>

      {isOwn && (
        <div className="flex items-center justify-end gap-2 mt-3 pt-2 border-t border-gray-100 dark:border-gray-700">
          <button
            onClick={() => onEdit(expense)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 dark:text-gray-300 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 rounded-lg transition-colors"
          >
            <Pencil className="w-3.5 h-3.5" />
            Edit
          </button>
          <button
            onClick={handleDelete}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 dark:text-gray-300 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/50 rounded-lg transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Delete
          </button>
        </div>
      )}
    </div>
  )
}

export default function ExpenseRow({ expense, onEdit, onDelete }: ExpenseRowProps) {
  const { member } = useAuth()

  const handleDelete = () => {
    if (window.confirm('Are you sure you want to delete this expense?')) {
      onDelete(expense.id)
    }
  }

  const accountType = expense.account_type || 'bank'
  // A shared expense is visible to the household but only its owner may change
  // it, so don't offer controls that the database will reject.
  const isOwn = !!member && expense.member_id === member.id

  return (
    <tr className="hover:bg-gray-50 dark:hover:bg-gray-700/40 transition-colors">
      <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-300 whitespace-nowrap">
        {formatDate(expense.date)}
      </td>
      <td className="px-6 py-4 text-sm text-gray-900 dark:text-white">
        <div className="flex flex-col">
          <span>{expense.description || <span className="text-gray-400 dark:text-gray-500 italic">No description</span>}</span>
          <div className="flex items-center gap-2 mt-1">
            <span className={`inline-flex items-center px-2 py-0.5 text-xs rounded ${
              expense.visibility === 'household' 
                ? 'bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300' 
                : 'bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300'
            }`}>
              {expense.visibility === 'household' ? 'Household' : 'Personal'}
            </span>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300">
              <Users className="w-3 h-3" />
              {expense.member?.name || 'Member'}
            </span>
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded ${
              accountType === 'bank' 
                ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-300' 
                : 'bg-green-50 dark:bg-green-950/60 text-green-600 dark:text-green-300'
            }`}>
              {accountType === 'bank' ? <Building2 className="w-3 h-3" /> : <Banknote className="w-3 h-3" />}
              {accountType === 'bank' ? 'Bank' : 'Cash'}
            </span>
          </div>
        </div>
      </td>
      <td className="px-6 py-4 whitespace-nowrap">
        <CategoryBadge category={expense.category} />
      </td>
      <td className="px-6 py-4 text-sm font-medium text-gray-900 dark:text-white text-right whitespace-nowrap">
        {formatCurrency(expense.amount)}
      </td>
      <td className="px-6 py-4 text-right whitespace-nowrap">
        <div className="flex items-center justify-end gap-2">
          {isOwn ? (
            <>
              <button
                onClick={() => onEdit(expense)}
                className="p-2 text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 rounded-lg transition-colors"
                title="Edit"
              >
                <Pencil className="w-4 h-4" />
              </button>
              <button
                onClick={handleDelete}
                className="p-2 text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/50 rounded-lg transition-colors"
                title="Delete"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </>
          ) : (
            <span className="text-xs text-gray-400 dark:text-gray-500 pr-2">
              {expense.member?.name ? `${expense.member.name}'s` : 'Shared'}
            </span>
          )}
        </div>
      </td>
    </tr>
  )
}
