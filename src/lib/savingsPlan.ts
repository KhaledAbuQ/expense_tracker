export const SAVINGS_PLAN_CHANGED = 'pocket-savings-plan-changed'
export interface SavingsPlan {
  goalAmount: string
  months: string
  currentSavings: string
  monthlyIncome: string
  willingMonthly: string
}
const empty: SavingsPlan = { goalAmount: '', months: '', currentSavings: '', monthlyIncome: '', willingMonthly: '' }
export function readSavingsPlan(memberId?: string): SavingsPlan {
  try { return { ...empty, ...JSON.parse(localStorage.getItem(`pocket_savings_plan:${memberId}`) || '{}') } }
  catch { return { ...empty } }
}
export function saveSavingsPlan(memberId: string, plan: SavingsPlan): void {
  try { localStorage.setItem(`pocket_savings_plan:${memberId}`, JSON.stringify(plan)) } catch { /* Storage unavailable. */ }
  window.dispatchEvent(new Event(SAVINGS_PLAN_CHANGED))
}
