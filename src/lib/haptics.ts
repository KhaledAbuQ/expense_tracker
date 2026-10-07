import { Capacitor, registerPlugin } from '@capacitor/core'

export type FeedbackKind = 'selection' | 'navigation' | 'impact' | 'success' | 'error'
const STORAGE_KEY = 'pocket_expenses_haptics'
const PocketHaptics = registerPlugin<{ feedback(options: { kind: FeedbackKind }): Promise<void> }>('PocketHaptics')
let lastTap = 0

export function getHapticsEnabled(): boolean {
  try { return localStorage.getItem(STORAGE_KEY) !== 'off' } catch { return true }
}

export function setHapticsEnabled(enabled: boolean): void {
  try { localStorage.setItem(STORAGE_KEY, enabled ? 'on' : 'off') } catch { /* Device storage may be unavailable. */ }
}

export function feedback(kind: FeedbackKind = 'selection'): void {
  if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== 'android' || !getHapticsEnabled()) return
  const now = Date.now()
  // Capture handlers and form submission can describe the same physical tap.
  if (['selection', 'navigation', 'impact'].includes(kind)) {
    if (now - lastTap < 65) return
    lastTap = now
  }
  void PocketHaptics.feedback({ kind }).catch(() => { /* Haptics are optional on older devices. */ })
}
