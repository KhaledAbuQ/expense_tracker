import { Income } from '../types'
import IncomeRow from './IncomeRow'

interface IncomeListProps {
  income: Income[]
  loading: boolean
  onEdit: (income: Income) => void
  onDelete: (id: string) => void
}

export default function IncomeList({
  income,
  loading,
  onEdit,
  onDelete,
}: IncomeListProps) {
  if (loading) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-100">
        <div className="p-8 text-center text-gray-500">
          Loading income...
        </div>
      </div>
    )
  }

  if (income.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-100">
        <div className="p-8 text-center">
          <p className="text-gray-500">No income found</p>
          <p className="text-sm text-gray-400 mt-1">
            Add your first income to get started
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
              Source
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
          {income.map((item) => (
            <IncomeRow
              key={item.id}
              income={item}
              onEdit={onEdit}
              onDelete={onDelete}
            />
          ))}
        </tbody>
      </table>
    </div>
  )
}
