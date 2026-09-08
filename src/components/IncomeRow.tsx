import { Pencil, Trash2, Building2, Banknote, PiggyBank, Users } from 'lucide-react'
import { Income, IncomeAccountType } from '../types'
import { formatCurrency, formatDate } from '../lib/utils'
import { useAuth } from '../context/AuthContext'
import CategoryBadge from './CategoryBadge'

export interface IncomeRowProps {
  income: Income
  onEdit: (income: Income) => void
  onDelete: (id: string) => void
}

const accountConfig: Record<IncomeAccountType, { icon: typeof Building2; label: string; className: string }> = {
  bank: { icon: Building2, label: 'Bank', className: 'bg-blue-50 text-blue-600' },
  cash: { icon: Banknote, label: 'Cash', className: 'bg-green-50 text-green-600' },
  savings: { icon: PiggyBank, label: 'Savings', className: 'bg-purple-50 text-purple-600' },
}

export function IncomeCard({ income, onEdit, onDelete }: IncomeRowProps) {
  const { member } = useAuth()

  const handleDelete = () => {
    if (window.confirm('Are you sure you want to delete this income?')) {
      onDelete(income.id)
    }
  }

  const accountType = (income.account_type || 'bank') as IncomeAccountType
  const config = accountConfig[accountType]
  const Icon = config.icon
  const isOwn = !!member && income.member_id === member.id

  return (
    <div className="p-4 hover:bg-gray-50/80 transition-colors">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="font-medium text-gray-900 text-sm">
            {income.description || <span className="text-gray-400 italic">No description</span>}
          </p>
          <p className="text-xs text-gray-500 mt-0.5">
            {formatDate(income.date)}
          </p>
        </div>
        <div className="text-right shrink-0">
          <span className="text-base font-bold text-green-600">
            +{formatCurrency(income.amount)}
          </span>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-1.5 mt-2.5">
        <CategoryBadge category={income.category} />
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded font-medium ${config.className}`}>
          <Icon className="w-3 h-3" />
          {config.label}
        </span>
        <span className={`inline-flex items-center px-2 py-0.5 text-xs rounded font-medium ${
          income.visibility === 'household'
            ? 'bg-purple-100 text-purple-700'
            : 'bg-blue-100 text-blue-700'
        }`}>
          {income.visibility === 'household' ? 'Household' : 'Personal'}
        </span>
        <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded bg-emerald-50 text-emerald-700 font-medium">
          <Users className="w-3 h-3" />
          {income.member?.name || 'Member'}
        </span>
      </div>

      {isOwn && (
        <div className="flex items-center justify-end gap-2 mt-3 pt-2 border-t border-gray-100">
          <button
            onClick={() => onEdit(income)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors"
          >
            <Pencil className="w-3.5 h-3.5" />
            Edit
          </button>
          <button
            onClick={handleDelete}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Delete
          </button>
        </div>
      )}
    </div>
  )
}

export default function IncomeRow({ income, onEdit, onDelete }: IncomeRowProps) {
  const { member } = useAuth()

  const handleDelete = () => {
    if (window.confirm('Are you sure you want to delete this income?')) {
      onDelete(income.id)
    }
  }

  const accountType = (income.account_type || 'bank') as IncomeAccountType
  const config = accountConfig[accountType]
  const Icon = config.icon
  // Shared income is visible to the household but only its owner may change it.
  const isOwn = !!member && income.member_id === member.id

  return (
    <tr className="hover:bg-gray-50 transition-colors">
      <td className="px-6 py-4 text-sm text-gray-600 whitespace-nowrap">
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
      <td className="px-6 py-4 whitespace-nowrap">
        <CategoryBadge category={income.category} />
      </td>
      <td className="px-6 py-4 text-sm font-medium text-green-600 text-right whitespace-nowrap">
        +{formatCurrency(income.amount)}
      </td>
      <td className="px-6 py-4 text-right whitespace-nowrap">
        <div className="flex items-center justify-end gap-2">
          {isOwn ? (
            <>
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
            </>
          ) : (
            <span className="text-xs text-gray-400 pr-2">
              {income.member?.name ? `${income.member.name}'s` : 'Shared'}
            </span>
          )}
        </div>
      </td>
    </tr>
  )
}

