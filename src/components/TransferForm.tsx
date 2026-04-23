import { useState, useEffect } from 'react'
import { format } from 'date-fns'
import { TransferFormData, Transfer, TransferAccountType } from '../types'
import { ArrowRight } from 'lucide-react'

interface TransferFormProps {
  onSubmit: (data: TransferFormData) => Promise<void>
  onCancel: () => void
  initialData?: Transfer
}

const accountLabels: Record<TransferAccountType, string> = {
  bank: 'Bank Account',
  cash: 'Cash',
  savings: 'Savings',
}

export default function TransferForm({
  onSubmit,
  onCancel,
  initialData,
}: TransferFormProps) {
  const [formData, setFormData] = useState<TransferFormData>({
    amount: initialData?.amount || 0,
    from_account: initialData?.from_account || 'bank',
    to_account: initialData?.to_account || 'savings',
    description: initialData?.description || '',
    date: initialData?.date || format(new Date(), 'yyyy-MM-dd'),
  })
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    // Reset form when initialData changes (both for edit mode and new transfer mode)
    setFormData({
      amount: initialData?.amount || 0,
      from_account: initialData?.from_account || 'bank',
      to_account: initialData?.to_account || 'savings',
      description: initialData?.description || '',
      date: initialData?.date || format(new Date(), 'yyyy-MM-dd'),
    })
  }, [initialData])

  // Ensure from and to accounts are different
  const handleFromAccountChange = (value: TransferAccountType) => {
    if (value === formData.to_account) {
      // Swap accounts
      setFormData({ ...formData, from_account: value, to_account: formData.from_account })
    } else {
      setFormData({ ...formData, from_account: value })
    }
  }

  const handleToAccountChange = (value: TransferAccountType) => {
    if (value === formData.from_account) {
      // Swap accounts
      setFormData({ ...formData, to_account: value, from_account: formData.to_account })
    } else {
      setFormData({ ...formData, to_account: value })
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (formData.amount <= 0) return
    if (formData.from_account === formData.to_account) return

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
            className="w-full pl-12 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            placeholder="0.000"
          />
        </div>
      </div>

      <div className="flex items-center gap-2">
        <div className="flex-1">
          <label htmlFor="from_account" className="block text-sm font-medium text-gray-700 mb-1">
            From
          </label>
          <select
            id="from_account"
            value={formData.from_account}
            onChange={(e) => handleFromAccountChange(e.target.value as TransferAccountType)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="bank">Bank Account</option>
            <option value="cash">Cash</option>
            <option value="savings">Savings</option>
          </select>
        </div>

        <div className="pt-6">
          <ArrowRight className="w-5 h-5 text-gray-400" />
        </div>

        <div className="flex-1">
          <label htmlFor="to_account" className="block text-sm font-medium text-gray-700 mb-1">
            To
          </label>
          <select
            id="to_account"
            value={formData.to_account}
            onChange={(e) => handleToAccountChange(e.target.value as TransferAccountType)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="bank">Bank Account</option>
            <option value="cash">Cash</option>
            <option value="savings">Savings</option>
          </select>
        </div>
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
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        />
      </div>

      <div>
        <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">
          Note
        </label>
        <textarea
          id="description"
          rows={2}
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
          placeholder="Optional note about this transfer"
        />
      </div>

      <p className="text-sm text-blue-600 bg-blue-50 p-2 rounded">
        Transfer from {accountLabels[formData.from_account]} to {accountLabels[formData.to_account]}
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
          disabled={loading || formData.amount <= 0 || formData.from_account === formData.to_account}
          className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? 'Processing...' : initialData ? 'Update' : 'Transfer'}
        </button>
      </div>
    </form>
  )
}
