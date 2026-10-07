export const MONEY_CELEBRATION_EVENT = 'pocket-money-celebration'
export interface MoneyCelebration { kind: 'income' | 'savings'; amount: number }
const PENDING_KEY = 'pocket_pending_money_celebration'
const SEEN_KEY = 'pocket_seen_money_celebrations'

export function celebrateMoney(kind: MoneyCelebration['kind'], amount: number, receiptId?: string): void {
  if (typeof window === 'undefined' || !Number.isFinite(amount) || amount <= 0) return
  try {
    if (receiptId) {
      const seen: string[] = JSON.parse(localStorage.getItem(SEEN_KEY) || '[]')
      if (seen.includes(receiptId)) return
      localStorage.setItem(SEEN_KEY, JSON.stringify([...seen, receiptId].slice(-500)))
    }
    if (document.visibilityState !== 'visible') {
      const pending: MoneyCelebration | null = JSON.parse(localStorage.getItem(PENDING_KEY) || 'null')
      localStorage.setItem(PENDING_KEY, JSON.stringify({ kind, amount: pending?.kind === kind ? pending.amount + amount : amount }))
      return
    }
  } catch { /* Still celebrate if storage is unavailable. */ }
  window.dispatchEvent(new CustomEvent<MoneyCelebration>(MONEY_CELEBRATION_EVENT, { detail: { kind, amount } }))
}

export function replayMoneyCelebration(): void {
  if (document.visibilityState !== 'visible') return
  try {
    const pending: MoneyCelebration | null = JSON.parse(localStorage.getItem(PENDING_KEY) || 'null')
    localStorage.removeItem(PENDING_KEY)
    if (pending) celebrateMoney(pending.kind, pending.amount)
  } catch { /* No pending celebration. */ }
}
