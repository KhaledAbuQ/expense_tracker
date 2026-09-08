import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts'
import { ChartDataPoint } from '../../types'
import { formatCurrency } from '../../lib/utils'
import { useTheme } from '../../context/ThemeContext'

interface CategoryPieChartProps {
  data: ChartDataPoint[]
}

export default function CategoryPieChart({ data }: CategoryPieChartProps) {
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'

  if (data.length === 0) {
    return (
      <div className="h-[300px] flex items-center justify-center text-gray-500 dark:text-gray-400">
        No expense data available
      </div>
    )
  }

  return (
    <ResponsiveContainer width="100%" height={300}>
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          innerRadius={60}
          outerRadius={100}
          paddingAngle={2}
          dataKey="value"
          nameKey="name"
        >
          {data.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={entry.color || '#6b7280'} />
          ))}
        </Pie>
        <Tooltip
          formatter={(value: number) => formatCurrency(value)}
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
        />
        <Legend
          layout="horizontal"
          verticalAlign="bottom"
          align="center"
          formatter={(value: string) => (
            <span className="text-sm text-gray-600 dark:text-gray-300">{value}</span>
          )}
        />
      </PieChart>
    </ResponsiveContainer>
  )
}
