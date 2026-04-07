import { Pencil, Trash2 } from 'lucide-react'
import { Income } from '../types'
import { formatCurrency, formatDate } from '../lib/utils'
import CategoryBadge from './CategoryBadge'

interface IncomeRowProps {
  income: Income
  onEdit: (income: Income) => void
  onDelete: (id: string) => void
}

export default function IncomeRow({ income, onEdit, onDelete }: IncomeRowProps) {
  const handleDelete = () => {
    if (window.confirm('Are you sure you want to delete this income?')) {
      onDelete(income.id)
    }
  }

  return (
    <tr className="hover:bg-gray-50 transition-colors">
      <td className="px-6 py-4 text-sm text-gray-600">
        {formatDate(income.date)}
      </td>
      <td className="px-6 py-4 text-sm text-gray-900">
        {income.description || <span className="text-gray-400 italic">No description</span>}
      </td>
      <td className="px-6 py-4">
        <CategoryBadge category={income.category} />
      </td>
      <td className="px-6 py-4 text-sm font-medium text-green-600 text-right">
        +{formatCurrency(income.amount)}
      </td>
      <td className="px-6 py-4 text-right">
        <div className="flex items-center justify-end gap-2">
          <button
            onClick={() => onEdit(income)}
            className="p-2 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors"
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
