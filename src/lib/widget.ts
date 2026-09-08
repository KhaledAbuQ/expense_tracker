import { registerPlugin } from '@capacitor/core'

export interface ExpenseWidgetPluginInterface {
  updateWidget(options: {
    monthTotal: string
    subStat?: string
    lastUpdated?: string
  }): Promise<{ success: boolean }>
  checkLaunchIntent(): Promise<{ action: string | null }>
  addListener(
    eventName: 'widgetAction',
    listenerFunc: (info: { action: string }) => void
  ): Promise<{ remove: () => Promise<void> }>
}

export const ExpenseWidget = registerPlugin<ExpenseWidgetPluginInterface>('ExpenseWidget')

export async function syncExpenseWidget(data: {
  monthTotal: string
  expenseCount?: number
  todayTotal?: string
}): Promise<void> {
  try {
    const now = new Date()
    const hours = String(now.getHours()).padStart(2, '0')
    const mins = String(now.getMinutes()).padStart(2, '0')
    const lastUpdated = `Updated ${hours}:${mins}`

    const countText = data.expenseCount !== undefined ? `${data.expenseCount} expenses` : ''
    const todayText = data.todayTotal ? ` · Today: ${data.todayTotal}` : ''
    const subStat = countText ? `${countText}${todayText}` : 'Tap to view'

    await ExpenseWidget.updateWidget({
      monthTotal: data.monthTotal,
      subStat,
      lastUpdated,
    })
  } catch (err) {
    // Graceful fallback on web or non-native platforms
    console.debug('ExpenseWidget sync skipped:', err)
  }
}
