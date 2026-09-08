import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { ChartDataPoint } from '../../types'
import { formatCurrency } from '../../lib/utils'
import { useTheme } from '../../context/ThemeContext'

interface MonthlyBarChartProps {
  data: ChartDataPoint[]
}

export default function MonthlyBarChart({ data }: MonthlyBarChartProps) {
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'

  if (data.length === 0) {
    return (
      <div className="h-[300px] flex items-center justify-center text-gray-500 dark:text-gray-400">
        No data available
      </div>
    )
  }

  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#6366f1" />
            <stop offset="100%" stopColor="#a855f7" />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#374151' : '#e5e7eb'} vertical={false} />
        <XAxis
          dataKey="name"
          tick={{ fontSize: 12, fill: isDark ? '#9ca3af' : '#6b7280' }}
          tickLine={false}
          axisLine={{ stroke: isDark ? '#374151' : '#e5e7eb' }}
        />
        <YAxis
          tickFormatter={(value) => `${value} JOD`}
          tick={{ fontSize: 12, fill: isDark ? '#9ca3af' : '#6b7280' }}
          tickLine={false}
          axisLine={{ stroke: isDark ? '#374151' : '#e5e7eb' }}
        />
        <Tooltip
          formatter={(value: number) => [formatCurrency(value), 'Total']}
          contentStyle={{
            borderRadius: '8px',
            border: isDark ? '1px solid #374151' : '1px solid #e5e7eb',
            backgroundColor: isDark ? '#1f2937' : '#ffffff',
            color: isDark ? '#f9fafb' : '#111827',
            boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
          }}
          itemStyle={{
            color: isDark ? '#f3f4f6' : '#111827',
          }}
          cursor={{ fill: isDark ? 'rgba(255, 255, 255, 0.05)' : '#f3f4f6' }}
        />
        <Bar
          dataKey="value"
          fill="url(#barGradient)"
          radius={[4, 4, 0, 0]}
          maxBarSize={50}
        />
      </BarChart>
    </ResponsiveContainer>
  )
}
