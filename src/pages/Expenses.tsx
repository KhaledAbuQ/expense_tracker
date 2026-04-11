import { useState } from 'react'
import { Plus } from 'lucide-react'
import { useExpenses } from '../hooks/useExpenses'
import { useCategories } from '../hooks/useCategories'
import ExpenseList from '../components/ExpenseList'
import ExpenseForm from '../components/ExpenseForm'
import Modal from '../components/Modal'
import DateRangePicker from '../components/DateRangePicker'
import { Expense, ExpenseFormData, DateRange } from '../types'
import { useAuth } from '../context/AuthContext'
import { getDateRange, formatCurrency, calculateTotalExpenses } from '../lib/utils'

export default function Expenses() {
  const [dateRange, setDateRange] = useState<DateRange>(getDateRange('month'))
  const [categoryFilter, setCategoryFilter] = useState<string>('')
  const [visibilityFilter, setVisibilityFilter] = useState<'all' | 'private' | 'household'>('all')
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null)
  const { member } = useAuth()

  const { expenses, loading, addExpense, updateExpense, deleteExpense } = useExpenses({
    dateRange,
    categoryId: categoryFilter || undefined,
    visibility: visibilityFilter === 'all' ? undefined : visibilityFilter,
  })
  const { categories } = useCategories()

  const handleSubmit = async (data: ExpenseFormData) => {
    if (!member) return

    const payload = {
      ...data,
      member_id: member.id,
    }

    if (editingExpense) {
      await updateExpense(editingExpense.id, payload)
    } else {
      await addExpense(payload)
    }
    setIsModalOpen(false)
    setEditingExpense(null)
  }

  const handleEdit = (expense: Expense) => {
    setEditingExpense(expense)
    setIsModalOpen(true)
  }

  const handleCloseModal = () => {
    setIsModalOpen(false)
    setEditingExpense(null)
  }

  const total = calculateTotalExpenses(expenses)

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Expenses</h1>
          <p className="text-gray-500 mt-1">
            Manage and track all your household expenses
          </p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
        >
          <Plus className="w-5 h-5" />
          Add Expense
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
              className="px-4 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            >
              <option value="all">All visibility</option>
              <option value="private">Personal</option>
              <option value="household">Household</option>
            </select>

            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="px-4 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            >
              <option value="">All Categories</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
            
            <div className="text-sm text-gray-500">
              Total: <span className="font-semibold text-gray-900">{formatCurrency(total)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Expense List */}
      <ExpenseList
        expenses={expenses}
        loading={loading}
        onEdit={handleEdit}
        onDelete={deleteExpense}
      />

      {/* Add/Edit Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        title={editingExpense ? 'Edit Expense' : 'Add Expense'}
      >
        <ExpenseForm
          categories={categories}
          onSubmit={handleSubmit}
          onCancel={handleCloseModal}
          initialData={editingExpense || undefined}
        />
      </Modal>
    </div>
  )
}
