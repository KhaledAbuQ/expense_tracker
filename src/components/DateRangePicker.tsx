import { DateRange } from '../types'
import { getDateRange } from '../lib/utils'
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
    const date = new Date(dateStr)
    if (!isNaN(date.getTime())) {
      onChange({
        ...value,
        [field]: date,
      })
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-4">
      <div className="flex items-center gap-2">
        {presets.map((preset) => (
          <button
            key={preset.value}
            onClick={() => handlePresetClick(preset.value)}
            className="px-3 py-1.5 text-sm font-medium rounded-lg border border-gray-200 hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-600 transition-colors"
          >
            {preset.label}
          </button>
        ))}
      </div>
      
      <div className="flex items-center gap-2 text-sm">
        <input
          type="date"
          value={format(value.start, 'yyyy-MM-dd')}
          onChange={(e) => handleCustomChange('start', e.target.value)}
          className="px-3 py-1.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
        />
        <span className="text-gray-400">to</span>
        <input
          type="date"
          value={format(value.end, 'yyyy-MM-dd')}
          onChange={(e) => handleCustomChange('end', e.target.value)}
          className="px-3 py-1.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
        />
      </div>
    </div>
  )
}
