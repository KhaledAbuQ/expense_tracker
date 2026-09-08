import { createClient, SupabaseClient } from '@supabase/supabase-js'

export const SUPABASE_STORAGE_URL_KEY = 'expense_tracker_supabase_url'
export const SUPABASE_STORAGE_ANON_KEY = 'expense_tracker_supabase_anon_key'

export interface SupabaseConfig {
  url: string
  anonKey: string
  isCustom: boolean
}

export function isValidSupabaseUrl(url: string): boolean {
  try {
    const parsed = new URL(url)
    return parsed.protocol === 'https:' || parsed.protocol === 'http:'
  } catch {
    return false
  }
}

export function getStoredConfig(): { url: string; anonKey: string } | null {
  try {
    const url = localStorage.getItem(SUPABASE_STORAGE_URL_KEY)?.trim()
    const anonKey = localStorage.getItem(SUPABASE_STORAGE_ANON_KEY)?.trim()
    if (url && anonKey && isValidSupabaseUrl(url)) {
      return { url, anonKey }
    }
  } catch {
    // localStorage might be unavailable
  }
  return null
}

export function getEnvConfig(): { url: string; anonKey: string } | null {
  const url = import.meta.env.VITE_SUPABASE_URL?.trim()
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim()
  if (
    url &&
    anonKey &&
    url !== 'your-project-url-here' &&
    anonKey !== 'your-anon-key-here' &&
    url !== 'https://placeholder.supabase.co' &&
    isValidSupabaseUrl(url)
  ) {
    return { url, anonKey }
  }
  return null
}

export function getActiveSupabaseConfig(): SupabaseConfig | null {
  const stored = getStoredConfig()
  if (stored) {
    return { ...stored, isCustom: true }
  }
  const env = getEnvConfig()
  if (env) {
    return { ...env, isCustom: false }
  }
  return null
}

export function checkIsSupabaseConfigured(): boolean {
  return getActiveSupabaseConfig() !== null
}

// Check if Supabase is configured (either from localStorage or environment)
export const isSupabaseConfigured = checkIsSupabaseConfigured()

const activeConfig = getActiveSupabaseConfig()

// Create client with active config, or dummy fallback if unconfigured
export const supabase: SupabaseClient = activeConfig
  ? createClient(activeConfig.url, activeConfig.anonKey)
  : createClient('https://placeholder.supabase.co', 'placeholder-key')

function clearAuthStorage(): void {
  try {
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const key = localStorage.key(i)
      if (
        key &&
        (key.startsWith('sb-') ||
          key.includes('supabase') ||
          key.includes('expense_tracker_pending_onboarding')) &&
        key !== SUPABASE_STORAGE_URL_KEY &&
        key !== SUPABASE_STORAGE_ANON_KEY
      ) {
        localStorage.removeItem(key)
      }
    }
  } catch {
    // Ignore storage errors
  }
}

export function saveSupabaseConfig(url: string, anonKey: string): void {
  const trimmedUrl = url.trim().replace(/\/+$/, '')
  const trimmedKey = anonKey.trim()

  if (!isValidSupabaseUrl(trimmedUrl)) {
    throw new Error('Please enter a valid URL (e.g. https://your-project.supabase.co)')
  }
  if (!trimmedKey) {
    throw new Error('Please enter your Supabase anon/public key')
  }

  clearAuthStorage()
  localStorage.setItem(SUPABASE_STORAGE_URL_KEY, trimmedUrl)
  localStorage.setItem(SUPABASE_STORAGE_ANON_KEY, trimmedKey)
}

export function clearSupabaseConfig(): void {
  clearAuthStorage()
  localStorage.removeItem(SUPABASE_STORAGE_URL_KEY)
  localStorage.removeItem(SUPABASE_STORAGE_ANON_KEY)
}

