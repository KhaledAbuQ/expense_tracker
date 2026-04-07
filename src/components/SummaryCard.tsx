import { ReactNode, useState } from 'react'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'

interface SummaryCardProps {
  title: string
  value: string
  subtitle?: string
  icon: ReactNode
  trend?: number
  trendLabel?: string
  secondaryValue?: string
  secondaryLabel?: string
}

export default function SummaryCard({
  title,
  value,
  subtitle,
  icon,
  trend,
  trendLabel,
  secondaryValue,
  secondaryLabel,
}: SummaryCardProps) {
  const [showSecondary, setShowSecondary] = useState(false)

  const getTrendIcon = () => {
    if (trend === undefined || trend === 0) return <Minus className="w-4 h-4" />
    return trend > 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />
  }

  const getTrendColor = () => {
    if (trend === undefined || trend === 0) return 'text-gray-500'
    // For expenses, trending down is good (green), trending up is concerning (red)
    return trend > 0 ? 'text-red-500' : 'text-green-500'
  }

  const hasSecondary = secondaryValue !== undefined

  return (
    <div 
      className={`bg-white rounded-xl p-6 shadow-sm border border-gray-100 ${hasSecondary ? 'cursor-pointer hover:border-indigo-200 transition-colors' : ''}`}
      onClick={() => hasSecondary && setShowSecondary(!showSecondary)}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-gray-500">
            {showSecondary && secondaryLabel ? secondaryLabel : title}
          </p>
          <p className="text-2xl font-bold text-gray-900 mt-1">
            {showSecondary && secondaryValue ? secondaryValue : value}
          </p>
          {subtitle && !showSecondary && (
            <p className="text-sm text-gray-500 mt-1">{subtitle}</p>
          )}
          {showSecondary && (
            <p className="text-sm text-gray-500 mt-1">Full month</p>
          )}
        </div>
        <div className="p-3 bg-indigo-50 rounded-lg">
          {icon}
        </div>
      </div>
      
      {trend !== undefined && !showSecondary && (
        <div className={`flex items-center gap-1 mt-4 ${getTrendColor()}`}>
          {getTrendIcon()}
          <span className="text-sm font-medium">
            {Math.abs(trend).toFixed(1)}%
          </span>
          {trendLabel && (
            <span className="text-sm text-gray-500 ml-1">{trendLabel}</span>
          )}
        </div>
      )}

      {hasSecondary && (
        <p className="text-xs text-indigo-400 mt-3">
          {showSecondary ? 'Viewing last month' : 'Click for last month'}
        </p>
      )}
    </div>
  )
}
