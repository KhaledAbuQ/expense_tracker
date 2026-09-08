import { registerPlugin } from '@capacitor/core'
import { parseBankSms, ParsedBankTransaction, RawSms } from './smsParser'
import { Category, Visibility, AccountType } from '../types'

export interface SmsTrackingSettings {
  enabled: boolean
  mode: 'review' | 'auto'
  defaultVisibility: Visibility
  defaultAccount: AccountType
  scanDays: number
  lastScanTimestamp?: number
}

const SETTINGS_STORAGE_KEY = 'pocket_expenses_sms_settings'
const PROCESSED_IDS_STORAGE_KEY = 'pocket_expenses_processed_sms_ids'

interface NativeBankSmsPlugin {
  isAvailable(): Promise<{ available: boolean; platform: string }>
  checkSmsPermissions(): Promise<{ granted: boolean; receiveSms: boolean; readSms: boolean }>
  requestSmsPermissions(): Promise<{ granted: boolean; receiveSms: boolean; readSms: boolean }>
  getRecentSms(options: { limit?: number; days?: number }): Promise<{ messages: RawSms[]; count: number }>
  getPendingReceivedSms(): Promise<{ messages: RawSms[]; count: number }>
  clearPendingReceivedSms(): Promise<{ success: boolean }>
  addListener(eventName: 'smsReceived', listenerFunc: (data: RawSms) => void): Promise<{ remove: () => Promise<void> }>
}

const BankSms = registerPlugin<NativeBankSmsPlugin>('BankSms')

/**
 * Returns user settings for SMS auto-tracking from localStorage.
 */
export function getSmsSettings(): SmsTrackingSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_STORAGE_KEY)
    if (raw) {
      return JSON.parse(raw)
    }
  } catch {
    // fallback
  }

  return {
    enabled: true,
    mode: 'review', // Default to review for user control, toggleable to auto
    defaultVisibility: 'household',
    defaultAccount: 'bank',
    scanDays: 14,
  }
}

/**
 * Saves user settings for SMS auto-tracking.
 */
export function saveSmsSettings(partial: Partial<SmsTrackingSettings>): SmsTrackingSettings {
  const current = getSmsSettings()
  const updated = { ...current, ...partial }
  try {
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(updated))
  } catch {
    // ignore
  }
  return updated
}

/**
 * Gets the set of SMS IDs that have already been imported or dismissed.
 */
export function getProcessedSmsIds(): Set<string> {
  try {
    const raw = localStorage.getItem(PROCESSED_IDS_STORAGE_KEY)
    if (raw) {
      const arr = JSON.parse(raw)
      if (Array.isArray(arr)) return new Set(arr)
    }
  } catch {
    // ignore
  }
  return new Set()
}

/**
 * Marks an SMS as processed so it won't be prompted or added again.
 */
export function markTransactionProcessed(smsId: string): void {
  try {
    const set = getProcessedSmsIds()
    set.add(smsId)
    // Keep max 500 ids to avoid storage bloat
    const arr = Array.from(set).slice(-500)
    localStorage.setItem(PROCESSED_IDS_STORAGE_KEY, JSON.stringify(arr))
  } catch {
    // ignore
  }
}

/**
 * Checks if an SMS transaction was already processed.
 */
export function isTransactionProcessed(smsId: string): boolean {
  return getProcessedSmsIds().has(smsId)
}

/**
 * Clears processed history (useful for testing or rescan).
 */
export function clearProcessedSmsHistory(): void {
  try {
    localStorage.removeItem(PROCESSED_IDS_STORAGE_KEY)
  } catch {
    // ignore
  }
}

/**
 * Checks if the native Bank SMS Capacitor plugin is available (running on Android APK).
 */
export async function isNativeSmsAvailable(): Promise<boolean> {
  try {
    const res = await BankSms.isAvailable()
    return !!res?.available
  } catch {
    return false
  }
}

/**
 * Checks current SMS permissions status.
 */
export async function checkSmsPermissions(): Promise<{ granted: boolean; receiveSms: boolean; readSms: boolean }> {
  try {
    return await BankSms.checkSmsPermissions()
  } catch {
    return { granted: false, receiveSms: false, readSms: false }
  }
}

/**
 * Requests SMS permissions from Android runtime dialog.
 */
export async function requestSmsPermissions(): Promise<{ granted: boolean; receiveSms: boolean; readSms: boolean }> {
  try {
    return await BankSms.requestSmsPermissions()
  } catch {
    return { granted: false, receiveSms: false, readSms: false }
  }
}

/**
 * Scans recent SMS from device inbox and filters for financial bank transactions.
 */
export async function scanRecentBankTransactions(
  categories: Category[] = [],
  days: number = 0,
  limit: number = 500
): Promise<ParsedBankTransaction[]> {
  try {
    const res = await BankSms.getRecentSms({ days, limit })
    if (!res || !res.messages) return []

    const processed = getProcessedSmsIds()
    const transactions: ParsedBankTransaction[] = []

    for (const msg of res.messages) {
      if (processed.has(msg.id)) continue

      const parsed = parseBankSms(msg, categories)
      if (parsed.isFinancial && (parsed.type === 'expense' || parsed.type === 'income')) {
        transactions.push(parsed)
      }
    }

    // Sort by date descending (newest date first)
    transactions.sort((a, b) => b.date.localeCompare(a.date))
    return transactions
  } catch (err) {
    console.error('Error scanning SMS:', err)
    return []
  }
}

/**
 * Retrieves transactions captured by the background broadcast receiver while app was closed.
 */
export async function fetchPendingBackgroundTransactions(
  categories: Category[] = []
): Promise<ParsedBankTransaction[]> {
  try {
    const res = await BankSms.getPendingReceivedSms()
    if (!res || !res.messages || res.messages.length === 0) return []

    const processed = getProcessedSmsIds()
    const transactions: ParsedBankTransaction[] = []

    for (const msg of res.messages) {
      if (processed.has(msg.id)) continue

      const parsed = parseBankSms(msg, categories)
      if (parsed.isFinancial && (parsed.type === 'expense' || parsed.type === 'income')) {
        transactions.push(parsed)
      }
    }

    // Clear native queue once read
    await BankSms.clearPendingReceivedSms()

    // Sort by date descending
    transactions.sort((a, b) => b.date.localeCompare(a.date))
    return transactions
  } catch (err) {
    console.error('Error reading pending background SMS:', err)
    return []
  }
}

/**
 * Subscribes to real-time incoming SMS events while app is open.
 */
export function subscribeToIncomingSms(
  onTransaction: (tx: ParsedBankTransaction) => void,
  categories: Category[] = []
): () => void {
  let removeHandle: (() => void) | null = null

  void BankSms.addListener('smsReceived', (data: RawSms) => {
    if (isTransactionProcessed(data.id)) return

    const parsed = parseBankSms(data, categories)
    if (parsed.isFinancial && (parsed.type === 'expense' || parsed.type === 'income')) {
      onTransaction(parsed)
    }
  }).then(handle => {
    removeHandle = () => { void handle.remove() }
  }).catch(err => {
    console.warn('BankSms listener registration failed:', err)
  })

  return () => {
    if (removeHandle) removeHandle()
  }
}
