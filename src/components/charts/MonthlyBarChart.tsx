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

interface MonthlyBarChartProps {
  data: ChartDataPoint[]
}

export default function MonthlyBarChart({ data }: MonthlyBarChartProps) {
  if (data.length === 0) {
    return (
      <div className="h-[300px] flex items-center justify-center text-gray-500">
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
        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
        <XAxis
          dataKey="name"
          tick={{ fontSize: 12, fill: '#6b7280' }}
          tickLine={false}
          axisLine={{ stroke: '#e5e7eb' }}
        />
        <YAxis
          tickFormatter={(value) => `${value} JOD`}
          tick={{ fontSize: 12, fill: '#6b7280' }}
          tickLine={false}
          axisLine={{ stroke: '#e5e7eb' }}
        />
        <Tooltip
          formatter={(value: number) => [formatCurrency(value), 'Total']}
          contentStyle={{
            borderRadius: '8px',
            border: '1px solid #e5e7eb',
            boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
          }}
          cursor={{ fill: '#f3f4f6' }}
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
