import { useState, useMemo } from 'react'
import { Plus } from 'lucide-react'
import { useIncome } from '../hooks/useIncome'
import { useCategories } from '../hooks/useCategories'
import IncomeList from '../components/IncomeList'
import IncomeForm from '../components/IncomeForm'
import Modal from '../components/Modal'
import DateRangePicker from '../components/DateRangePicker'
import { Income, IncomeFormData, DateRange } from '../types'
import { useAuth } from '../context/AuthContext'
import {
  getDateRange,
  formatCurrency,
  calculateGrossIncome,
  calculateIncomeByAccount,
} from '../lib/utils'

export default function IncomePage() {
  const [dateRange, setDateRange] = useState<DateRange>(getDateRange('month'))
  const [categoryFilter, setCategoryFilter] = useState<string>('')
  const [visibilityFilter, setVisibilityFilter] = useState<'all' | 'private' | 'household'>('all')
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingIncome, setEditingIncome] = useState<Income | null>(null)
  const { member } = useAuth()

  const { income, loading, addIncome, updateIncome, deleteIncome } = useIncome({
    dateRange,
    categoryId: categoryFilter || undefined,
    visibility: visibilityFilter === 'all' ? undefined : visibilityFilter,
  })
  const { categories } = useCategories()

  // Filter to only show income categories in the dropdown
  const incomeCategories = categories.filter(
    (c) => c.category_type === 'income' || c.category_type === 'both'
  )

  const filterCategories = useMemo(() => {
    const map = new Map<string, { id: string; name: string }>()
    for (const c of incomeCategories) {
      map.set(c.id, { id: c.id, name: c.name })
    }
    for (const i of income) {
      if (i.category_id && i.category && !map.has(i.category_id)) {
        map.set(i.category_id, { id: i.category_id, name: i.category.name })
      }
    }
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name))
  }, [incomeCategories, income])

  const handleSubmit = async (data: IncomeFormData) => {
    if (!member) return

    if (editingIncome) {
      // Never re-stamp member_id on edit; it would reassign ownership.
      const { member_id: _ignored, ...editable } = data
      await updateIncome(editingIncome.id, editable)
    } else {
      await addIncome({ ...data, member_id: member.id })
    }
    setIsModalOpen(false)
    setEditingIncome(null)
  }

  const handleEdit = (income: Income) => {
    setEditingIncome(income)
    setIsModalOpen(true)
  }

  const handleCloseModal = () => {
    setIsModalOpen(false)
    setEditingIncome(null)
  }

  // This total covers every row in the list below, savings deposits included.
  // The Dashboard's "Income This Month" excludes savings because that card
  // tracks spendable balance, so show the savings portion here to make the two
  // numbers reconcile instead of just looking inconsistent.
  const total = calculateGrossIncome(income)
  const savingsPortion = calculateIncomeByAccount(income, 'savings')

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Income</h1>
          <p className="text-gray-500 mt-1">
            Track all your income sources
          </p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
        >
          <Plus className="w-5 h-5" />
          Add Income
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <DateRangePicker value={dateRange} onChange={setDateRange} />
          
          <div className="flex items-center gap-4">
            <select
              value={visibilityFilter}
              onChange={(e) => setVisibilityFilter(e.target.value as 'all' | 'private' | 'household')}
              className="px-4 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500"
            >
              <option value="all">All visibility</option>
              <option value="private">Personal</option>
              <option value="household">Household</option>
            </select>

            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="px-4 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500"
            >
              <option value="">All Sources</option>
              {filterCategories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
            
            <div className="text-sm text-gray-500">
              Total: <span className="font-semibold text-green-600">+{formatCurrency(total)}</span>
              {savingsPortion > 0 && (
                <span className="block text-xs text-gray-400">
                  incl. {formatCurrency(savingsPortion)} to savings
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Income List */}
      <IncomeList
        income={income}
        loading={loading}
        onEdit={handleEdit}
        onDelete={deleteIncome}
      />

      {/* Add/Edit Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        title={editingIncome ? 'Edit Income' : 'Add Income'}
      >
        <IncomeForm
          categories={categories}
          onSubmit={handleSubmit}
          onCancel={handleCloseModal}
          initialData={editingIncome || undefined}
        />
      </Modal>
    </div>
  )
}
