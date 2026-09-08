import { useEffect, useMemo, useState } from 'react'
import { format } from 'date-fns'
import { TransferFormData, Transfer, TransferAccountType, GoldItemType, Karat } from '../types'
import { ArrowRight, RefreshCw } from 'lucide-react'
import { useGoldPrice } from '../hooks/useGoldPrice'
import {
  COIN_SPECS,
  GOLD_ITEM_LABELS,
  KARAT_OPTIONS,
  formatGrams,
  isPriceStale,
  measureGoldItem,
  pricePerGram,
} from '../lib/gold'
import { formatCurrency, formatDate } from '../lib/utils'

interface TransferFormProps {
  onSubmit: (data: TransferFormData) => Promise<void>
  onCancel: () => void
  initialData?: Transfer
}

const accountLabels: Record<TransferAccountType, string> = {
  bank: 'Bank Account',
  cash: 'Cash',
  savings: 'Savings',
  gold: 'Gold',
}

const accountOptions: TransferAccountType[] = ['bank', 'cash', 'savings', 'gold']

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
  const [itemType, setItemType] = useState<GoldItemType>(initialData?.gold_item_type || 'english_lira')
  const [quantity, setQuantity] = useState<string>(
    initialData?.gold_quantity ? String(initialData.gold_quantity) : '1'
  )
  const [bullionKarat, setBullionKarat] = useState<Karat>((initialData?.gold_karat as Karat) || 21)
  // Once the user types their own amount we stop overwriting it with the market
  // estimate, because what you actually paid includes workmanship and haggling.
  const [amountTouched, setAmountTouched] = useState(!!initialData)
  const [loading, setLoading] = useState(false)

  const { price, loading: priceLoading, refreshing, refresh } = useGoldPrice()

  const involvesGold = formData.from_account === 'gold' || formData.to_account === 'gold'
  const isBuyingGold = formData.to_account === 'gold'

  useEffect(() => {
    setFormData({
      amount: initialData?.amount || 0,
      from_account: initialData?.from_account || 'bank',
      to_account: initialData?.to_account || 'savings',
      description: initialData?.description || '',
      date: initialData?.date || format(new Date(), 'yyyy-MM-dd'),
    })
    setItemType(initialData?.gold_item_type || 'english_lira')
    setQuantity(initialData?.gold_quantity ? String(initialData.gold_quantity) : '1')
    setBullionKarat((initialData?.gold_karat as Karat) || 21)
    setAmountTouched(!!initialData)
  }, [initialData])

  const measurement = useMemo(
    () => measureGoldItem(itemType, parseFloat(quantity) || 0, bullionKarat),
    [itemType, quantity, bullionKarat]
  )

  // Value the metal at the rate for its own carat against its gross weight.
  const marketValue = useMemo(() => {
    if (!measurement || !price) return null
    return measurement.grams * pricePerGram(price, measurement.karat)
  }, [measurement, price])

  // Prefill the dinar amount from the live price until the user overrides it.
  useEffect(() => {
    if (!involvesGold || amountTouched || marketValue === null) return
    setFormData(prev => ({ ...prev, amount: Number(marketValue.toFixed(3)) }))
  }, [involvesGold, amountTouched, marketValue])

  const handleFromAccountChange = (value: TransferAccountType) => {
    if (value === formData.to_account) {
      setFormData({ ...formData, from_account: value, to_account: formData.from_account })
    } else {
      setFormData({ ...formData, from_account: value })
    }
  }

  const handleToAccountChange = (value: TransferAccountType) => {
    if (value === formData.from_account) {
      setFormData({ ...formData, to_account: value, from_account: formData.to_account })
    } else {
      setFormData({ ...formData, to_account: value })
    }
  }

  const goldIncomplete = involvesGold && !measurement

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (formData.amount <= 0) return
    if (formData.from_account === formData.to_account) return
    if (goldIncomplete) return

    setLoading(true)
    try {
      const payload: TransferFormData = { ...formData }

      if (involvesGold && measurement) {
        payload.gold_item_type = itemType
        payload.gold_quantity = parseFloat(quantity)
        payload.gold_karat = measurement.karat
        payload.gold_grams = Number(measurement.grams.toFixed(4))
        payload.gold_fine_grams = Number(measurement.fine_grams.toFixed(4))
      } else {
        // The database rejects gold columns on a non-gold transfer, so make sure
        // switching accounts mid-edit doesn't leave them behind.
        payload.gold_item_type = undefined
        payload.gold_quantity = undefined
        payload.gold_karat = undefined
        payload.gold_grams = undefined
        payload.gold_fine_grams = undefined
      }

      await onSubmit(payload)
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="flex items-center gap-2">
        <div className="flex-1 min-w-0">
          <label htmlFor="from_account" className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            From
          </label>
          <select
            id="from_account"
            value={formData.from_account}
            onChange={(e) => handleFromAccountChange(e.target.value as TransferAccountType)}
            className="w-full px-2 sm:px-4 py-2 text-xs sm:text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            {accountOptions.map((account) => (
              <option key={account} value={account}>{accountLabels[account]}</option>
            ))}
          </select>
        </div>

        <div className="pt-5 sm:pt-6 shrink-0">
          <ArrowRight className="w-4 h-4 sm:w-5 sm:h-5 text-gray-400 dark:text-gray-500" />
        </div>

        <div className="flex-1 min-w-0">
          <label htmlFor="to_account" className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            To
          </label>
          <select
            id="to_account"
            value={formData.to_account}
            onChange={(e) => handleToAccountChange(e.target.value as TransferAccountType)}
            className="w-full px-2 sm:px-4 py-2 text-xs sm:text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            {accountOptions.map((account) => (
              <option key={account} value={account}>{accountLabels[account]}</option>
            ))}
          </select>
        </div>
      </div>

      {involvesGold && (
        <div className="rounded-lg border border-amber-200 dark:border-amber-800/60 bg-amber-50/60 dark:bg-amber-950/40 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-amber-900 dark:text-amber-200">
              {isBuyingGold ? 'What are you buying?' : 'What are you selling?'}
            </p>
            <button
              type="button"
              onClick={() => refresh()}
              disabled={refreshing}
              className="inline-flex items-center gap-1 text-xs text-amber-700 dark:text-amber-400 hover:text-amber-900 dark:hover:text-amber-200 disabled:opacity-50"
              title="Refresh gold price"
            >
              <RefreshCw className={`w-3 h-3 ${refreshing ? 'animate-spin' : ''}`} />
              {refreshing ? 'Updating' : 'Update price'}
            </button>
          </div>

          <div>
            <label htmlFor="gold_item" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Item
            </label>
            <select
              id="gold_item"
              value={itemType}
              onChange={(e) => setItemType(e.target.value as GoldItemType)}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
            >
              {(Object.keys(GOLD_ITEM_LABELS) as GoldItemType[]).map((key) => (
                <option key={key} value={key}>{GOLD_ITEM_LABELS[key]}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="gold_quantity" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {itemType === 'bullion' ? 'Weight (grams)' : 'Number of coins'}
              </label>
              <input
                type="number"
                id="gold_quantity"
                step={itemType === 'bullion' ? '0.01' : '1'}
                min={itemType === 'bullion' ? '0.01' : '1'}
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
              />
            </div>

            <div>
              <label htmlFor="gold_karat" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Carat
              </label>
              {itemType === 'bullion' ? (
                <select
                  id="gold_karat"
                  value={bullionKarat}
                  onChange={(e) => setBullionKarat(Number(e.target.value) as Karat)}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                >
                  {KARAT_OPTIONS.map((k) => (
                    <option key={k} value={k}>{k}k</option>
                  ))}
                </select>
              ) : (
                <div className="w-full px-4 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-300">
                  {COIN_SPECS[itemType].karat}k &middot; {COIN_SPECS[itemType].grams} g each
                </div>
              )}
            </div>
          </div>

          {measurement && (
            <div className="text-sm text-amber-900 dark:text-amber-200 bg-white/70 dark:bg-gray-800/80 rounded-lg p-3 space-y-1">
              <div className="flex justify-between">
                <span>Total weight</span>
                <span className="font-medium">{formatGrams(measurement.grams)}</span>
              </div>
              <div className="flex justify-between">
                <span>Pure gold content</span>
                <span className="font-medium">{formatGrams(measurement.fine_grams)}</span>
              </div>
              <div className="flex justify-between">
                <span>Market value today</span>
                <span className="font-medium">
                  {priceLoading && !price
                    ? 'Loading price...'
                    : marketValue === null
                      ? 'Price unavailable'
                      : formatCurrency(marketValue)}
                </span>
              </div>
            </div>
          )}

          {price && (
            <p className="text-xs text-amber-700 dark:text-amber-400">
              {formatCurrency(Number(price.price_24k))}/g for 24k
              {price.source === 'spot_peg' && ' (from world spot)'}
              {' '}&middot; {formatDate(price.fetched_at.slice(0, 10))}
              {isPriceStale(price) && (
                <span className="text-red-600 font-medium"> &middot; out of date</span>
              )}
            </p>
          )}

          {!price && !priceLoading && (
            <p className="text-xs text-red-600">
              No gold price available. Enter the amount manually and it will still be recorded.
            </p>
          )}
        </div>
      )}

      <div>
        <label htmlFor="amount" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Amount *
          {involvesGold && (
            <span className="font-normal text-gray-500 dark:text-gray-400">
              {' '}&mdash; what actually {isBuyingGold ? 'left' : 'reached'} the account
            </span>
          )}
        </label>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 dark:text-gray-400 text-sm">JOD</span>
          <input
            type="number"
            id="amount"
            step="0.001"
            min="0.001"
            required
            value={formData.amount || ''}
            onChange={(e) => {
              setAmountTouched(true)
              setFormData({ ...formData, amount: parseFloat(e.target.value) || 0 })
            }}
            className="w-full pl-12 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            placeholder="0.000"
          />
        </div>
        {involvesGold && !amountTouched && marketValue !== null && (
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            Prefilled from today&apos;s price. Adjust it to what you really paid, including
            workmanship.
          </p>
        )}
      </div>

      <div>
        <label htmlFor="date" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Date *
        </label>
        <input
          type="date"
          id="date"
          required
          value={formData.date}
          onChange={(e) => setFormData({ ...formData, date: e.target.value })}
          className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        />
      </div>

      <div>
        <label htmlFor="description" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Note
        </label>
        <textarea
          id="description"
          rows={2}
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
          placeholder="Optional note about this transfer"
        />
      </div>

      <p className="text-sm text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/50 p-2.5 rounded-lg">
        Transfer from {accountLabels[formData.from_account]} to {accountLabels[formData.to_account]}
      </p>

      <div className="flex gap-3 pt-4">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={
            loading ||
            formData.amount <= 0 ||
            formData.from_account === formData.to_account ||
            goldIncomplete
          }
          className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? 'Processing...' : initialData ? 'Update' : 'Transfer'}
        </button>
      </div>
    </form>
  )
}
