import { useState } from 'react'
import { Plus } from 'lucide-react'
import { useCategories } from '../hooks/useCategories'
import CategoryList from '../components/CategoryList'
import CategoryForm from '../components/CategoryForm'
import Modal from '../components/Modal'
import { Category, CategoryFormData } from '../types'

export default function Categories() {
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingCategory, setEditingCategory] = useState<Category | null>(null)

  const { categories, loading, addCategory, updateCategory, deleteCategory } = useCategories()

  const handleSubmit = async (data: CategoryFormData) => {
    if (editingCategory) {
      await updateCategory(editingCategory.id, data)
    } else {
      await addCategory(data)
    }
    setIsModalOpen(false)
    setEditingCategory(null)
  }

  const handleEdit = (category: Category) => {
    setEditingCategory(category)
    setIsModalOpen(true)
  }

  const handleCloseModal = () => {
    setIsModalOpen(false)
    setEditingCategory(null)
  }

  const defaultCategories = categories.filter((c) => c.is_default)
  const customCategories = categories.filter((c) => !c.is_default)

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Categories</h1>
          <p className="text-gray-500 mt-1">
            Organize your expenses with custom categories
          </p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
        >
          <Plus className="w-5 h-5" />
          Add Category
        </button>
      </div>

      {/* Custom Categories */}
      {customCategories.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Custom Categories ({customCategories.length})
          </h2>
          <CategoryList
            categories={customCategories}
            loading={false}
            onEdit={handleEdit}
            onDelete={deleteCategory}
          />
        </div>
      )}

      {/* Default Categories */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          Default Categories ({defaultCategories.length})
        </h2>
        <CategoryList
          categories={defaultCategories}
          loading={loading}
          onEdit={handleEdit}
          onDelete={deleteCategory}
        />
      </div>

      {/* Add/Edit Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        title={editingCategory ? 'Edit Category' : 'Add Category'}
      >
        <CategoryForm
          onSubmit={handleSubmit}
          onCancel={handleCloseModal}
          initialData={editingCategory || undefined}
        />
      </Modal>
    </div>
  )
}
