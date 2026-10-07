import { registerPlugin } from '@capacitor/core'

export interface ExpenseWidgetPluginInterface {
  updateSavingsPlan(options: { goalAmount: number; currentSavings?: number }): Promise<{ success: boolean }>
  updateWidget(options: {
    firstCategoryName?: string
    secondCategoryName?: string
    firstCategoryIcon?: string
    secondCategoryIcon?: string
    monthLabel?: string
    diningTotal?: string
    groceryTotal?: string
    snapshot?: string
    monthTotal: string
    todayTotal?: string
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
  snapshot?: string
  monthTotal: string
  diningTotal?: string
  groceryTotal?: string
  firstCategoryName?: string
  secondCategoryName?: string
  firstCategoryIcon?: string
  secondCategoryIcon?: string
  expenseCount?: number
  todayTotal?: string
}): Promise<void> {
  try {
    const now = new Date()
    const hours = String(now.getHours()).padStart(2, '0')
    const mins = String(now.getMinutes()).padStart(2, '0')
    const lastUpdated = `Updated ${hours}:${mins}`

    const countText = data.expenseCount !== undefined ? `${data.expenseCount} expenses` : ''
    const subStat = countText || 'Tap to view'

    await ExpenseWidget.updateWidget({
      snapshot: data.snapshot,
      monthTotal: data.monthTotal,
      monthLabel: `Spent in ${now.toLocaleString('en', { month: 'long' }).toLowerCase()}`,
      firstCategoryName: data.firstCategoryName,
      secondCategoryName: data.secondCategoryName,
      firstCategoryIcon: data.firstCategoryIcon,
      secondCategoryIcon: data.secondCategoryIcon,
      diningTotal: data.diningTotal,
      groceryTotal: data.groceryTotal,
      todayTotal: data.todayTotal || '$0.00',
      subStat,
      lastUpdated,
    })
  } catch (err) {
    // Graceful fallback on web or non-native platforms
    console.debug('ExpenseWidget sync skipped:', err)
  }
}
