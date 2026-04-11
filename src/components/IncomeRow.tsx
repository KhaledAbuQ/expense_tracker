import { Pencil, Trash2, Building2, Banknote, PiggyBank, Users } from 'lucide-react'
import { Income, IncomeAccountType } from '../types'
import { formatCurrency, formatDate } from '../lib/utils'
import CategoryBadge from './CategoryBadge'

interface IncomeRowProps {
  income: Income
  onEdit: (income: Income) => void
  onDelete: (id: string) => void
}

const accountConfig: Record<IncomeAccountType, { icon: typeof Building2; label: string; className: string }> = {
  bank: { icon: Building2, label: 'Bank', className: 'bg-blue-50 text-blue-600' },
  cash: { icon: Banknote, label: 'Cash', className: 'bg-green-50 text-green-600' },
  savings: { icon: PiggyBank, label: 'Savings', className: 'bg-purple-50 text-purple-600' },
}

export default function IncomeRow({ income, onEdit, onDelete }: IncomeRowProps) {
  const handleDelete = () => {
    if (window.confirm('Are you sure you want to delete this income?')) {
      onDelete(income.id)
    }
  }

  const accountType = (income.account_type || 'bank') as IncomeAccountType
  const config = accountConfig[accountType]
  const Icon = config.icon

  return (
    <tr className="hover:bg-gray-50 transition-colors">
      <td className="px-6 py-4 text-sm text-gray-600">
        {formatDate(income.date)}
      </td>
      <td className="px-6 py-4 text-sm text-gray-900">
        <div className="flex flex-col">
          <span>{income.description || <span className="text-gray-400 italic">No description</span>}</span>
          <div className="flex items-center gap-2 mt-1">
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded ${config.className}`}>
              <Icon className="w-3 h-3" />
              {config.label}
            </span>
            <span className={`inline-flex items-center px-2 py-0.5 text-xs rounded ${
              income.visibility === 'household'
                ? 'bg-purple-100 text-purple-700'
                : 'bg-blue-100 text-blue-700'
            }`}>
              {income.visibility === 'household' ? 'Household' : 'Personal'}
            </span>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded bg-emerald-50 text-emerald-700">
              <Users className="w-3 h-3" />
              {income.member?.name || 'Member'}
            </span>
          </div>
        </div>
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
