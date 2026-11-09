import { useCallback, useEffect, useRef, useState } from 'react'
import { format } from 'date-fns'
import toast from 'react-hot-toast'
import { GoldPrice } from '../types'
import { Capacitor, CapacitorHttp } from '@capacitor/core'
import { GOLD_RETAIL_API_URL, GOLD_RETAIL_HEADERS, isRoyaRetailQuote, parseRetailGold } from '../lib/goldRetail'

const GOLD_API_URL = '/api/gold-price'
const LOCAL_CACHE_KEY = 'pocket_expense_gold_roya_retail_jod_v3'
const HISTORY_KEY = 'pocket_expense_gold_roya_retail_history_v3'
const HISTORY_LIMIT = 365
const MIN_REFRESH_INTERVAL_MS = 60 * 1000

function readLocalCache(): GoldPrice | null {
  try {
    const raw = localStorage.getItem(LOCAL_CACHE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as GoldPrice
    if (!isRoyaRetailQuote(parsed)) return null
    return parsed
  } catch {
    return null
  }
}

type GoldQuote = { timestamp: number; price: number }

function dailyQuotes(history: GoldQuote[]): GoldQuote[] {
  const days = new Map<string, GoldQuote>()
  for (const quote of history.sort((a, b) => a.timestamp - b.timestamp)) {
    days.set(format(quote.timestamp, 'yyyy-MM-dd'), quote)
  }
  return [...days.values()].slice(-HISTORY_LIMIT)
}

function readHistory(): GoldQuote[] {
  try {
    const stored: unknown = JSON.parse(localStorage.getItem(HISTORY_KEY) ?? '[]')
    if (!Array.isArray(stored)) return []
    return dailyQuotes(stored.filter((quote): quote is GoldQuote =>
      quote != null && Number.isFinite(new Date(quote.timestamp).getTime()) && typeof quote.timestamp === 'number' && Number.isFinite(quote.price) && quote.price > 0,
    ))
  } catch {
    return []
  }
}

function addQuote(history: GoldQuote[], quote: GoldPrice): GoldQuote[] {
  const timestamp = Date.parse(quote.fetched_at)
  const price = Number(quote.price_21k)
  if (!Number.isFinite(timestamp) || !Number.isFinite(price) || price <= 0) return history
  return dailyQuotes([...history, { timestamp, price }])
}

export function useGoldPrice() {
  const [price, setPrice] = useState<GoldPrice | null>(null)
  const [history, setHistory] = useState(readHistory)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const requestId = useRef(0)

  const refresh = useCallback(async (options?: { silent?: boolean }) => {
    const currentRequest = ++requestId.current
    setRefreshing(true)
    const controller = new AbortController()
    const timeout = window.setTimeout(() => controller.abort(), 12_000)
    try {
      let fresh: GoldPrice
      if (Capacitor.isNativePlatform()) {
        const response = await CapacitorHttp.get({ url: GOLD_RETAIL_API_URL, headers: GOLD_RETAIL_HEADERS, responseType: 'json', connectTimeout: 10_000, readTimeout: 10_000 })
        if (response.status !== 200) throw new Error('Could not load Roya local retail prices.')
        fresh = parseRetailGold(typeof response.data === 'string' ? JSON.parse(response.data) : response.data)
      } else {
        const response = await fetch(GOLD_API_URL, { headers: { Accept: 'application/json' }, cache: 'no-cache', signal: controller.signal })
        if (!response.ok) throw new Error(`Retail gold feed returned HTTP ${response.status}.`)
        const payload: unknown = await response.json()
        fresh = isRoyaRetailQuote(payload) ? payload : parseRetailGold(payload)
      }
      if (currentRequest === requestId.current) {
        const cached = readLocalCache()
        const savedHistory = readHistory()
        const nextHistory = addQuote(cached ? addQuote(savedHistory, cached) : savedHistory, fresh)
        setHistory(previous => dailyQuotes([...previous, ...nextHistory]))
        try { localStorage.setItem(HISTORY_KEY, JSON.stringify(nextHistory)) } catch { /* Cache is optional. */ }
        setPrice(fresh)
        setError(null)
        try { localStorage.setItem(LOCAL_CACHE_KEY, JSON.stringify(fresh)) } catch { /* Cache is optional. */ }
      }
      return fresh
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not load the gold price.'
      if (currentRequest === requestId.current) setError(message)
      if (!options?.silent) toast.error(message)
      return null
    } finally {
      window.clearTimeout(timeout)
      if (currentRequest === requestId.current) {
        setRefreshing(false)
        setLoading(false)
      }
    }
  }, [])

  const load = useCallback(async () => {
    const cached = readLocalCache()
    if (cached) {
      setPrice(cached)
      setHistory(previous => addQuote(previous, cached))
    }
    const cacheAge = cached ? Date.now() - new Date(cached.fetched_at).getTime() : Infinity
    if (cacheAge < MIN_REFRESH_INTERVAL_MS) {
      setError(null)
      setLoading(false)
      return
    }
    await refresh({ silent: true })
  }, [refresh])

  useEffect(() => {
    void load()
    const onVisible = () => { if (document.visibilityState === 'visible') void load() }
    document.addEventListener('visibilitychange', onVisible)
    const timer = window.setInterval(onVisible, 5 * 60 * 1000)
    return () => { document.removeEventListener('visibilitychange', onVisible); window.clearInterval(timer) }
  }, [load])

  return { price, history, loading, refreshing, error, refresh, reload: load }
}
