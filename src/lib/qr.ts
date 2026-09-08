import QRCode from 'qrcode'
import { isValidSupabaseUrl } from './supabase'

export interface ParsedSupabaseConfig {
  url: string
  anonKey: string
}

/**
 * Generate a JSON payload encoding the Supabase credentials.
 */
export function generateSupabaseQrPayload(url: string, anonKey: string): string {
  return JSON.stringify({
    type: 'pocket-expenses-config',
    version: 1,
    url: url.trim().replace(/\/+$/, ''),
    anonKey: anonKey.trim(),
  })
}

/**
 * Parses a QR code string which could be:
 * 1. JSON payload: { type: '...', url: '...', anonKey: '...' }
 * 2. Deep link URL: expensetracker://config?url=...&key=...
 * 3. Two newline or pipe separated strings (url and anonKey)
 */
export function parseSupabaseQrCode(data: string): ParsedSupabaseConfig | null {
  const trimmed = data.trim()
  if (!trimmed) return null

  // 1. Try parsing JSON
  try {
    const parsed = JSON.parse(trimmed)
    const url = parsed.url || parsed.supabaseUrl || parsed.supabase_url
    const anonKey = parsed.anonKey || parsed.anon_key || parsed.key || parsed.supabaseAnonKey
    if (
      typeof url === 'string' &&
      typeof anonKey === 'string' &&
      isValidSupabaseUrl(url) &&
      anonKey.trim().length > 0
    ) {
      return {
        url: url.trim().replace(/\/+$/, ''),
        anonKey: anonKey.trim(),
      }
    }
  } catch {
    // Not valid JSON, continue to next formats
  }

  // 2. Try parsing URL with query params
  try {
    let urlObj: URL
    if (trimmed.startsWith('expensetracker://') || trimmed.startsWith('pocketexpenses://')) {
      urlObj = new URL(trimmed.replace(/^[a-z]+:\/\//, 'https://dummy.local/'))
    } else {
      urlObj = new URL(trimmed)
    }

    const urlParam =
      urlObj.searchParams.get('url') ||
      urlObj.searchParams.get('supabaseUrl') ||
      urlObj.searchParams.get('supabase_url')
    const keyParam =
      urlObj.searchParams.get('key') ||
      urlObj.searchParams.get('anonKey') ||
      urlObj.searchParams.get('anon_key')

    if (urlParam && keyParam && isValidSupabaseUrl(urlParam) && keyParam.trim().length > 0) {
      return {
        url: urlParam.trim().replace(/\/+$/, ''),
        anonKey: keyParam.trim(),
      }
    }
  } catch {
    // Not standard URL
  }

  // 3. Try newline / pipe separated values (e.g. url\nkey)
  const parts = trimmed.split(/[\n|]/).map((p) => p.trim()).filter(Boolean)
  if (parts.length >= 2) {
    const potentialUrl = parts[0]
    const potentialKey = parts[1]
    if (isValidSupabaseUrl(potentialUrl) && potentialKey.length > 10) {
      return {
        url: potentialUrl.replace(/\/+$/, ''),
        anonKey: potentialKey,
      }
    }
  }

  return null
}

/**
 * Generate a PNG data URL for a given string using the `qrcode` library.
 */
export async function generateQrDataUrl(text: string): Promise<string> {
  return QRCode.toDataURL(text, {
    width: 320,
    margin: 2,
    color: {
      dark: '#1e1b4b', // deep indigo
      light: '#ffffff',
    },
    errorCorrectionLevel: 'M',
  })
}
