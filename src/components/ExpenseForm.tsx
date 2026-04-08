import { useState, useEffect } from 'react'
import { format } from 'date-fns'
import { Category, ExpenseFormData, Expense, AccountType } from '../types'

interface ExpenseFormProps {
  categories: Category[]
  onSubmit: (data: ExpenseFormData) => Promise<void>
  onCancel: () => void
  initialData?: Expense
}

export default function ExpenseForm({
  categories,
  onSubmit,
  onCancel,
  initialData,
}: ExpenseFormProps) {
  const [formData, setFormData] = useState<ExpenseFormData>({
    amount: initialData?.amount || 0,
    description: initialData?.description || '',
    category_id: initialData?.category_id || '',
    date: initialData?.date || format(new Date(), 'yyyy-MM-dd'),
    expense_type: initialData?.expense_type || 'personal',
    paid_by: initialData?.paid_by || 'me',
    account_type: initialData?.account_type || 'bank',
  })
  const [loading, setLoading] = useState(false)

  // Filter categories to only show expense-related ones
  const expenseCategories = categories.filter(
    (c) => c.category_type === 'expense' || c.category_type === 'both'
  )

  useEffect(() => {
    // Reset form when initialData changes (both for edit mode and new expense mode)
    setFormData({
      amount: initialData?.amount || 0,
      description: initialData?.description || '',
      category_id: initialData?.category_id || '',
      date: initialData?.date || format(new Date(), 'yyyy-MM-dd'),
      expense_type: initialData?.expense_type || 'personal',
      paid_by: initialData?.paid_by || 'me',
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
            step="0.01"
            min="0.01"
            required
            value={formData.amount || ''}
            onChange={(e) => setFormData({ ...formData, amount: parseFloat(e.target.value) || 0 })}
            className="w-full pl-12 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            placeholder="0.00"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="expense_type" className="block text-sm font-medium text-gray-700 mb-1">
            Type
          </label>
          <select
            id="expense_type"
            value={formData.expense_type}
            onChange={(e) => setFormData({ ...formData, expense_type: e.target.value as 'personal' | 'household' })}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
          >
            <option value="personal">Personal</option>
            <option value="household">Household</option>
          </select>
        </div>

        <div>
          <label htmlFor="paid_by" className="block text-sm font-medium text-gray-700 mb-1">
            Paid By
          </label>
          <select
            id="paid_by"
            value={formData.paid_by}
            onChange={(e) => setFormData({ ...formData, paid_by: e.target.value as 'me' | 'family' })}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
          >
            <option value="me">Me</option>
            <option value="family">Family Member</option>
          </select>
        </div>
      </div>

      <div>
        <label htmlFor="account_type" className="block text-sm font-medium text-gray-700 mb-1">
          Account
        </label>
        <select
          id="account_type"
          value={formData.account_type}
          onChange={(e) => setFormData({ ...formData, account_type: e.target.value as AccountType })}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
        >
          <option value="bank">Bank Account</option>
          <option value="cash">Cash</option>
        </select>
      </div>

      <div>
        <label htmlFor="category" className="block text-sm font-medium text-gray-700 mb-1">
          Category
        </label>
        <select
          id="category"
          value={formData.category_id}
          onChange={(e) => setFormData({ ...formData, category_id: e.target.value })}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
        >
          <option value="">Select a category</option>
          {expenseCategories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
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
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
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
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 resize-none"
          placeholder="What was this expense for?"
        />
      </div>

      {formData.paid_by === 'me' && (
        <p className="text-sm text-gray-500 bg-gray-50 p-2 rounded">
          This expense will be deducted from your {formData.account_type === 'bank' ? 'bank account' : 'cash'} balance.
        </p>
      )}

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
          className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? 'Saving...' : initialData ? 'Update' : 'Add Expense'}
        </button>
      </div>
    </form>
  )
}
