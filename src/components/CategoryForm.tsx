import CategoryIcon from './CategoryIcon'
import { categoryIcons } from '../lib/categoryIcons'
import { useState, useEffect } from 'react'
import { Category, CategoryFormData, CategoryType } from '../types'

const PRESET_COLORS = [
  '#ef4444', '#f97316', '#eab308', '#22c55e', '#14b8a6',
  '#3b82f6', '#6366f1', '#a855f7', '#ec4899', '#6b7280',
  '#991b1b', '#c2410c', '#a16207', '#15803d', '#0f766e',
  '#1d4ed8', '#4338ca', '#7e22ce', '#be185d', '#374151',
  '#fb7185', '#fb923c', '#facc15', '#a3e635', '#2dd4bf',
  '#38bdf8', '#818cf8', '#c084fc', '#f472b6', '#a8a29e',
]

const PRESET_ICONS = Object.keys(categoryIcons)

interface CategoryFormProps {
  onSubmit: (data: CategoryFormData) => Promise<void>
  onCancel: () => void
  initialData?: Category
}

export default function CategoryForm({
  onSubmit,
  onCancel,
  initialData,
}: CategoryFormProps) {
  const [formData, setFormData] = useState<CategoryFormData>({
    name: initialData?.name || '',
    icon: initialData?.icon || 'tag',
    color: initialData?.color || '#6366f1',
    category_type: initialData?.category_type || 'expense',
  })
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (initialData) {
      setFormData({
        name: initialData.name,
        icon: initialData.icon,
        color: initialData.color,
        category_type: initialData.category_type || 'expense',
      })
    }
  }, [initialData])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.name.trim()) return

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
        <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
          Category Name *
        </label>
        <input
          type="text"
          id="name"
          required
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
          placeholder="e.g., Pet Supplies"
        />
      </div>

      <div>
        <label htmlFor="category_type" className="block text-sm font-medium text-gray-700 mb-1">
          Category Type
        </label>
        <select
          id="category_type"
          value={formData.category_type}
          onChange={(e) => setFormData({ ...formData, category_type: e.target.value as CategoryType })}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
        >
          <option value="expense">Expense</option>
          <option value="income">Income</option>
          <option value="both">Both</option>
        </select>
        <p className="mt-1 text-xs text-gray-500">
          {formData.category_type === 'expense' && 'This category will only appear when adding expenses.'}
          {formData.category_type === 'income' && 'This category will only appear when adding income.'}
          {formData.category_type === 'both' && 'This category will appear for both expenses and income.'}
        </p>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Color
        </label>
        <div className="flex flex-wrap gap-2">
          {PRESET_COLORS.map((color) => (
            <button
              key={color}
              type="button"
              aria-label={`Select color ${color}`}
              aria-pressed={formData.color.toLowerCase() === color}
              title={color}
              onClick={() => setFormData({ ...formData, color })}
              className={`w-8 h-8 rounded-full border-2 transition-all ${
                formData.color === color
                  ? 'border-gray-900 scale-110'
                  : 'border-transparent hover:scale-105'
              }`}
              style={{ backgroundColor: color }}
            />
          ))}
        </div>
        <div className="flex items-center gap-3 mt-3">
          <label htmlFor="custom-color" className="text-sm text-gray-700">Custom color</label>
          <input id="custom-color" type="color" value={formData.color} onChange={e => setFormData({ ...formData, color: e.target.value })} className="w-12 h-10 cursor-pointer rounded border border-gray-300" />
          <span className="text-sm text-gray-500">{formData.color.toUpperCase()}</span>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Icon
        </label>
        <div className="flex flex-wrap gap-2">
          {PRESET_ICONS.map((icon) => (
            <button
              key={icon}
              type="button"
              aria-label={`Select ${icon.replace(/-/g, ' ')} icon`}
              aria-pressed={formData.icon === icon}
              onClick={() => setFormData({ ...formData, icon })}
              className={`inline-flex items-center gap-2 px-3 py-2 text-sm border rounded-lg transition-colors ${
                formData.icon === icon
                  ? 'border-indigo-500 bg-indigo-50 text-indigo-600'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <CategoryIcon name={icon} />
              {icon.replace(/-/g, ' ')}
            </button>
          ))}
        </div>
      </div>

      <div className="pt-2">
        <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-lg">
          <span className="text-sm text-gray-500">Preview:</span>
          <span
            className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium"
            style={{
              backgroundColor: `${formData.color}20`,
              color: formData.color,
            }}
          >
            <CategoryIcon name={formData.icon} />
            {formData.name || 'Category Name'}
          </span>
          <span className="text-xs text-gray-400">
            ({formData.category_type})
          </span>
        </div>
      </div>

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
          disabled={loading || !formData.name.trim()}
          className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? 'Saving...' : initialData ? 'Update' : 'Add Category'}
        </button>
      </div>
    </form>
  )
}
