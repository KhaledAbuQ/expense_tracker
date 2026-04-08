import { useState } from 'react'
import { ArrowRightLeft, Trash2, Pencil, Building2, Banknote, PiggyBank, ArrowRight } from 'lucide-react'
import { useTransfers } from '../hooks/useTransfers'
import TransferForm from '../components/TransferForm'
import Modal from '../components/Modal'
import DateRangePicker from '../components/DateRangePicker'
import { Transfer, TransferFormData, DateRange, TransferAccountType } from '../types'
import { getDateRange, formatCurrency, formatDate } from '../lib/utils'

const accountIcons: Record<TransferAccountType, typeof Building2> = {
  bank: Building2,
  cash: Banknote,
  savings: PiggyBank,
}

const accountLabels: Record<TransferAccountType, string> = {
  bank: 'Bank',
  cash: 'Cash',
  savings: 'Savings',
}

const accountColors: Record<TransferAccountType, string> = {
  bank: 'text-blue-600 bg-blue-50',
  cash: 'text-green-600 bg-green-50',
  savings: 'text-purple-600 bg-purple-50',
}

export default function TransfersPage() {
  const [dateRange, setDateRange] = useState<DateRange>(getDateRange('month'))
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingTransfer, setEditingTransfer] = useState<Transfer | null>(null)

  const { transfers, loading, addTransfer, updateTransfer, deleteTransfer } = useTransfers({
    dateRange,
  })

  const handleSubmit = async (data: TransferFormData) => {
    if (editingTransfer) {
      await updateTransfer(editingTransfer.id, data)
    } else {
      await addTransfer(data)
    }
    setIsModalOpen(false)
    setEditingTransfer(null)
  }

  const handleEdit = (transfer: Transfer) => {
    setEditingTransfer(transfer)
    setIsModalOpen(true)
  }

  const handleCloseModal = () => {
    setIsModalOpen(false)
    setEditingTransfer(null)
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Transfers</h1>
          <p className="text-gray-500 mt-1">
            Move money between your accounts
          </p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <ArrowRightLeft className="w-5 h-5" />
          New Transfer
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
        <DateRangePicker value={dateRange} onChange={setDateRange} />
      </div>

      {/* Transfers List */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-500">Loading transfers...</div>
        ) : transfers.length === 0 ? (
          <div className="p-8 text-center">
            <ArrowRightLeft className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">No transfers found</p>
            <p className="text-sm text-gray-400 mt-1">
              Transfer money between your bank, cash, and savings accounts
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {transfers.map((transfer) => {
              const FromIcon = accountIcons[transfer.from_account]
              const ToIcon = accountIcons[transfer.to_account]
              
              return (
                <div
                  key={transfer.id}
                  className="p-4 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      {/* From Account */}
                      <div className={`p-2 rounded-lg ${accountColors[transfer.from_account]}`}>
                        <FromIcon className="w-5 h-5" />
                      </div>
                      
                      <ArrowRight className="w-4 h-4 text-gray-400" />
                      
                      {/* To Account */}
                      <div className={`p-2 rounded-lg ${accountColors[transfer.to_account]}`}>
                        <ToIcon className="w-5 h-5" />
                      </div>
                      
                      <div>
                        <p className="font-medium text-gray-900">
                          {accountLabels[transfer.from_account]} → {accountLabels[transfer.to_account]}
                        </p>
                        <p className="text-sm text-gray-500">
                          {formatDate(transfer.date)}
                          {transfer.description && ` • ${transfer.description}`}
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-4">
                      <span className="font-semibold text-gray-900">
                        {formatCurrency(transfer.amount)}
                      </span>
                      
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleEdit(transfer)}
                          className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                          title="Edit transfer"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => deleteTransfer(transfer.id)}
                          className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="Delete transfer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Add/Edit Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        title={editingTransfer ? 'Edit Transfer' : 'New Transfer'}
      >
        <TransferForm
          onSubmit={handleSubmit}
          onCancel={handleCloseModal}
          initialData={editingTransfer || undefined}
        />
      </Modal>
    </div>
  )
}
