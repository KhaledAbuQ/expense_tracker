import { useCallback, useEffect, useRef, useState } from 'react'
import toast from 'react-hot-toast'
import { GoldPrice } from '../types'

const GOLD_API_URL = 'https://api.gold-api.com/price/XAU'
const LOCAL_CACHE_KEY = 'pocket_expense_gold_spot_jod_v1'
const MIN_REFRESH_INTERVAL_MS = 60 * 1000
const JOD_PER_USD = 0.709
const GRAMS_PER_TROY_OUNCE = 31.1034768
interface GoldApiResponse {
  symbol?: unknown
  currency?: unknown
  price?: unknown
  updatedAt?: unknown
}

function fromUsdSpot(body: GoldApiResponse): GoldPrice {
  const usdPerOunce = Number(body.price)
  if (body.symbol !== 'XAU' || body.currency !== 'USD' || !Number.isFinite(usdPerOunce) || usdPerOunce <= 0) {
    throw new Error('The gold price API returned an invalid quote.')
  }

  const updatedAt = typeof body.updatedAt === 'string' ? new Date(body.updatedAt) : new Date()
  if (!Number.isFinite(updatedAt.getTime())) throw new Error('The gold price API returned an invalid timestamp.')

  const price24k = usdPerOunce * JOD_PER_USD / GRAMS_PER_TROY_OUNCE
  const priceAtKarat = (karat: number) => Number((price24k * karat / 24).toFixed(4))
  const fetchedAt = updatedAt.toISOString()

  return {
    id: `gold-api-xau-${updatedAt.getTime()}`,
    price_24k: priceAtKarat(24),
    price_22k: priceAtKarat(22),
    price_21k: priceAtKarat(21),
    price_18k: priceAtKarat(18),
    price_14k: priceAtKarat(14),
    source: 'spot_peg',
    source_detail: `${GOLD_API_URL} — USD/troy oz converted at 0.709 JOD/USD`,
    fetched_at: fetchedAt,
  }
}

function readLocalCache(): GoldPrice | null {
  try {
    const raw = localStorage.getItem(LOCAL_CACHE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as GoldPrice
    if (!parsed.fetched_at || !Number.isFinite(Number(parsed.price_24k)) || Number(parsed.price_24k) <= 0) return null
    return parsed
  } catch {
    return null
  }
}

export function useGoldPrice() {
  const [price, setPrice] = useState<GoldPrice | null>(null)
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
      const response = await fetch(GOLD_API_URL, {
        headers: { Accept: 'application/json' },
        cache: 'no-cache',
        signal: controller.signal,
      })
      if (!response.ok) throw new Error(`Gold price API returned HTTP ${response.status}.`)

      const fresh = fromUsdSpot(await response.json() as GoldApiResponse)
      if (currentRequest === requestId.current) {
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
    if (cached) setPrice(cached)
    const cacheAge = cached ? Date.now() - new Date(cached.fetched_at).getTime() : Infinity
    if (cacheAge < MIN_REFRESH_INTERVAL_MS) {
      setError(null)
      setLoading(false)
      return
    }
    await refresh({ silent: true })
  }, [refresh])

  useEffect(() => { void load() }, [load])

  return { price, loading, refreshing, error, refresh, reload: load }
}
