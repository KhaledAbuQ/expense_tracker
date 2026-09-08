import { DateRange } from '../types'
import { getDateRange, parseDateOnly } from '../lib/utils'
import { format } from 'date-fns'

interface DateRangePickerProps {
  value: DateRange
  onChange: (range: DateRange) => void
}

const presets = [
  { label: 'This Week', value: 'week' as const },
  { label: 'This Month', value: 'month' as const },
  { label: 'This Year', value: 'year' as const },
]

export default function DateRangePicker({ value, onChange }: DateRangePickerProps) {
  const handlePresetClick = (preset: 'week' | 'month' | 'year') => {
    onChange(getDateRange(preset))
  }

  const handleCustomChange = (field: 'start' | 'end', dateStr: string) => {
    if (!dateStr) return
    // Parse as local midnight; a bare `new Date('2026-08-02')` is UTC and would
    // render back into this same input as the previous day west of UTC.
    const date = parseDateOnly(dateStr)
    if (!isNaN(date.getTime())) {
      onChange({
        ...value,
        [field]: date,
      })
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-3 sm:gap-4">
      <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
        {presets.map((preset) => (
          <button
            key={preset.value}
            onClick={() => handlePresetClick(preset.value)}
            className="px-2.5 py-1 sm:px-3 sm:py-1.5 text-xs sm:text-sm font-medium rounded-lg border border-gray-200 dark:border-gray-700 hover:border-indigo-300 dark:hover:border-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 text-gray-700 dark:text-gray-300 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
          >
            {preset.label}
          </button>
        ))}
      </div>
      
      <div className="flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm w-full sm:w-auto">
        <input
          type="date"
          value={format(value.start, 'yyyy-MM-dd')}
          onChange={(e) => handleCustomChange('start', e.target.value)}
          className="flex-1 sm:flex-none px-2.5 py-1 sm:px-3 sm:py-1.5 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 min-w-0"
        />
        <span className="text-gray-400 dark:text-gray-500 shrink-0">to</span>
        <input
          type="date"
          value={format(value.end, 'yyyy-MM-dd')}
          onChange={(e) => handleCustomChange('end', e.target.value)}
          className="flex-1 sm:flex-none px-2.5 py-1 sm:px-3 sm:py-1.5 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 min-w-0"
        />
      </div>
    </div>
  )
}
