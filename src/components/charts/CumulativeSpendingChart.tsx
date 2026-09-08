import { useId } from 'react'
import { format, isValid, subMonths } from 'date-fns'
import { Area, ComposedChart, Line, ReferenceDot, ReferenceLine, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import { Expense } from '../../types'
import { cumulativeMonthlySpending } from '../../lib/analytics'
import { formatCurrency, parseDateOnly } from '../../lib/utils'

interface Props {
  expenses: Expense[]
  scopeLabel: string
  comparisonMonth: string
  onComparisonChange: (month: string) => void
}

export default function CumulativeSpendingChart({ expenses, scopeLabel, comparisonMonth, onComparisonChange }: Props) {
  const gradientId = useId().replace(/:/g, '')
  const now = new Date()
  const data = cumulativeMonthlySpending(expenses, comparisonMonth, now)
  const currentLabel = format(now, 'MMMM yyyy')
  const comparisonLabel = format(parseDateOnly(`${comparisonMonth}-01`), 'MMMM yyyy')
  const currentTotal = data[now.getDate() - 1].current || 0
  const comparisonDays = data.filter(row => row.comparison !== null).length
  const matchedDay = Math.min(now.getDate(), comparisonDays)
  const matchedCurrent = data[matchedDay - 1].current || 0
  const matchedPrevious = data[matchedDay - 1].comparison || 0
  const difference = matchedCurrent - matchedPrevious
  const comparisonTotal = data[comparisonDays - 1].comparison || 0
  const changeLabel = difference === 0 ? 'Same spending' : `${formatCurrency(Math.abs(difference))} ${difference < 0 ? 'less' : 'more'}`

  return <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm" aria-labelledby="cumulative-title">
    <div className="px-5 pt-5 sm:px-7 sm:pt-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 id="cumulative-title" className="text-lg font-semibold tracking-tight text-gray-900">Monthly spending pace</h2>
          <p className="mt-1 text-xs text-gray-500">Cumulative spending · {scopeLabel}</p>
        </div>
        <label className="flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-500">
          Compare
          <input type="month" aria-label="Comparison month" className="min-w-0 bg-transparent text-xs font-medium text-gray-800 outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 rounded" value={comparisonMonth} max={format(subMonths(now, 1), 'yyyy-MM')} onChange={event => {
            const value = event.target.value
            if (/^\d{4}-\d{2}$/.test(value) && isValid(parseDateOnly(`${value}-01`)) && value < format(now, 'yyyy-MM')) onComparisonChange(value)
          }} />
        </label>
      </div>
      <div className="mt-6 flex flex-wrap items-end justify-between gap-5">
        <div>
          <div className="flex items-center gap-2 text-xs font-medium text-gray-500"><span className="h-2 w-2 rounded-full bg-indigo-500" />{currentLabel} · through today</div>
          <p className="mt-2 text-3xl font-semibold tracking-tight text-gray-900 tabular-nums">{formatCurrency(currentTotal)}</p>
        </div>
        <div className="sm:text-right">
          <span className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${difference < 0 ? 'bg-emerald-50 text-emerald-700' : difference > 0 ? 'bg-amber-50 text-amber-700' : 'bg-gray-100 text-gray-600'}`}>{changeLabel}</span>
          <p className="mt-2 text-xs text-gray-500">vs {format(parseDateOnly(`${comparisonMonth}-01`), 'MMM')} through day {matchedDay}</p>
        </div>
      </div>
      <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-xs text-gray-500">
        <span className="inline-flex items-center gap-2"><span className="w-5 border-t-2 border-indigo-500" />{currentLabel}</span>
        <span className="inline-flex items-center gap-2"><span className="w-5 border-t-2 border-dashed border-slate-400" />{comparisonLabel}</span>
      </div>
    </div>
    <div className="mt-5 h-64 pr-3 sm:h-80 sm:pr-6">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 22, right: 12, bottom: 8, left: 0 }} accessibilityLayer>
          <defs><linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#6366f1" stopOpacity={0.18} /><stop offset="100%" stopColor="#6366f1" stopOpacity={0.01} /></linearGradient></defs>
          <CartesianGrid stroke="#f1f5f9" vertical={false} />
          <XAxis dataKey="day" type="number" domain={[1, data.length]} ticks={[1, 5, 10, 15, 20, 25, data.length]} tick={{ fontSize: 11, fill: '#94a3b8' }} tickLine={false} axisLine={false} tickMargin={12} />
          <YAxis width={62} tickCount={5} tick={{ fontSize: 11, fill: '#94a3b8' }} tickLine={false} axisLine={false} tickMargin={8} tickFormatter={value => new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 }).format(value)} />
          <Tooltip labelFormatter={day => `Through day ${day}`} formatter={(value: number) => formatCurrency(value)} contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', boxShadow: '0 8px 24px rgb(15 23 42 / 0.08)', fontSize: 12, padding: '12px 16px' }} labelStyle={{ color: '#64748b', marginBottom: 6 }} cursor={{ stroke: '#cbd5e1', strokeDasharray: '3 4' }} />
          <ReferenceLine x={now.getDate()} stroke="#c7d2fe" strokeDasharray="3 4" label={{ value: 'Today', position: 'top', fill: '#6366f1', fontSize: 10 }} />
          <Line type="monotone" dataKey="comparison" name={comparisonLabel} stroke="#94a3b8" strokeWidth={2} strokeDasharray="5 5" dot={false} activeDot={{ r: 4, stroke: '#fff', strokeWidth: 2 }} connectNulls={false} />
          <Area type="monotone" dataKey="current" name={currentLabel} stroke="#6366f1" strokeWidth={3} fill={`url(#${gradientId})`} dot={false} activeDot={{ r: 5, stroke: '#fff', strokeWidth: 2 }} connectNulls={false} />
          <ReferenceDot x={now.getDate()} y={currentTotal} r={5} fill="#6366f1" stroke="#fff" strokeWidth={2} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
    <div className="mt-3 flex flex-wrap justify-between gap-2 border-t border-gray-100 bg-gray-50/70 px-5 py-3 text-xs text-gray-500 sm:px-7">
      <span>Day of month · JOD · current month comparison</span>
      <span>{format(parseDateOnly(`${comparisonMonth}-01`), 'MMM')} full month: <span className="font-medium text-gray-700">{formatCurrency(comparisonTotal)}</span></span>
    </div>
  </section>
}
