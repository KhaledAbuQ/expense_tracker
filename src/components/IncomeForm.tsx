import { useState, useEffect } from 'react'
import { format } from 'date-fns'
import { Category, IncomeFormData, Income, IncomeAccountType, Visibility } from '../types'

interface IncomeFormProps {
  categories: Category[]
  onSubmit: (data: IncomeFormData) => Promise<void>
  onCancel: () => void
  initialData?: Income
}

const accountLabels: Record<IncomeAccountType, string> = {
  bank: 'bank account',
  cash: 'cash',
  savings: 'savings',
}

export default function IncomeForm({
  categories,
  onSubmit,
  onCancel,
  initialData,
}: IncomeFormProps) {
  const [formData, setFormData] = useState<IncomeFormData>({
    amount: initialData?.amount || 0,
    description: initialData?.description || '',
    category_id: initialData?.category_id || '',
    date: initialData?.date || format(new Date(), 'yyyy-MM-dd'),
    visibility: initialData?.visibility || 'private',
    account_type: initialData?.account_type || 'bank',
  })
  const [loading, setLoading] = useState(false)

  // Filter categories to only show income-related ones
  const incomeCategories = categories.filter(
    (c) => c.category_type === 'income' || c.category_type === 'both'
  )

  useEffect(() => {
    // Reset form when initialData changes (both for edit mode and new income mode)
    setFormData({
      amount: initialData?.amount || 0,
      description: initialData?.description || '',
      category_id: initialData?.category_id || '',
      date: initialData?.date || format(new Date(), 'yyyy-MM-dd'),
      visibility: initialData?.visibility || 'private',
      account_type: initialData?.account_type || 'bank',
    })
  }, [initialData])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (formData.amount <= 0) return

    setLoading(true)
    try {
      await onSubmit(formData)
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="amount" className="block text-sm font-medium text-gray-700 mb-1">
          Amount *
        </label>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">JOD</span>
          <input
            type="number"
            id="amount"
            step="0.001"
            min="0.001"
            required
            value={formData.amount || ''}
            onChange={(e) => setFormData({ ...formData, amount: parseFloat(e.target.value) || 0 })}
            className="w-full pl-12 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
            placeholder="0.000"
          />
        </div>
      </div>

      <div>
        <label htmlFor="category" className="block text-sm font-medium text-gray-700 mb-1">
          Source
        </label>
        <select
          id="category"
          value={formData.category_id}
          onChange={(e) => setFormData({ ...formData, category_id: e.target.value })}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
        >
          <option value="">Select a source</option>
          {incomeCategories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="visibility" className="block text-sm font-medium text-gray-700 mb-1">
          Visibility
        </label>
        <select
          id="visibility"
          value={formData.visibility}
          onChange={(e) => setFormData({ ...formData, visibility: e.target.value as Visibility })}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
        >
          <option value="private">Personal</option>
          <option value="household">Household (shared)</option>
        </select>
      </div>

      <div>
        <label htmlFor="account_type" className="block text-sm font-medium text-gray-700 mb-1">
          Deposit To
        </label>
        <select
          id="account_type"
          value={formData.account_type}
          onChange={(e) => setFormData({ ...formData, account_type: e.target.value as IncomeAccountType })}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
        >
          <option value="bank">Bank Account</option>
          <option value="cash">Cash</option>
          <option value="savings">Savings</option>
        </select>
      </div>

      <div>
        <label htmlFor="date" className="block text-sm font-medium text-gray-700 mb-1">
          Date *
        </label>
        <input
          type="date"
          id="date"
          required
          value={formData.date}
          onChange={(e) => setFormData({ ...formData, date: e.target.value })}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
        />
      </div>

      <div>
        <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">
          Description
        </label>
        <textarea
          id="description"
          rows={3}
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 resize-none"
          placeholder="What is the source of this income?"
        />
      </div>

      <p className={`text-sm p-2 rounded ${
        formData.account_type === 'savings' 
          ? 'text-purple-600 bg-purple-50' 
          : 'text-green-600 bg-green-50'
      }`}>
        This income will be added to your {accountLabels[formData.account_type]}.
      </p>

      <div className="flex gap-3 pt-4">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={loading || formData.amount <= 0}
          className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? 'Saving...' : initialData ? 'Update' : 'Add Income'}
        </button>
      </div>
    </form>
  )
}
