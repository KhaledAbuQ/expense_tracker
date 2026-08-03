import { useCallback, useEffect, useRef, useState } from 'react'
import toast from 'react-hot-toast'
import { supabase, isSupabaseConfigured } from '../lib/supabase'
import { GoldPrice } from '../types'

/** Ask the Edge Function for a fresh price if the stored one is older than this. */
const REFRESH_AFTER_MS = 30 * 60 * 1000

export function useGoldPrice() {
  const [price, setPrice] = useState<GoldPrice | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const requestId = useRef(0)

  /**
   * Invoke the Edge Function, which scrapes the Jordan rates (falling back to
   * world spot) and records the result. The browser can't call either source
   * directly: neither sends CORS headers, and no free API quotes JOD.
   */
  const refresh = useCallback(async (options?: { silent?: boolean }) => {
    if (!isSupabaseConfigured) return null

    setRefreshing(true)
    try {
      const { data, error } = await supabase.functions.invoke('gold-price')
      if (error) throw error

      const fetched = (data?.price ?? null) as GoldPrice | null
      if (fetched) {
        setPrice(fetched)
        setError(null)
      }

      if (data?.warning && !options?.silent) {
        toast.error(data.warning)
      }
      return fetched
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not refresh the gold price'
      setError(message)
      // A refresh failure is not fatal: whatever price is already stored still
      // shows, flagged as stale by the UI.
      if (!options?.silent) toast.error(message)
      return null
    } finally {
      setRefreshing(false)
    }
  }, [])

  const load = useCallback(async () => {
    if (!isSupabaseConfigured) {
      setLoading(false)
      return
    }

    const currentRequest = ++requestId.current

    try {
      setLoading(true)
      // Read the recorded price first so the UI paints immediately, then top it
      // up in the background only if it has aged out.
      const { data, error } = await supabase
        .from('gold_prices')
        .select('*')
        .order('fetched_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (error) throw error
      if (currentRequest !== requestId.current) return

      const stored = (data as GoldPrice) ?? null
      setPrice(stored)
      setError(null)

      const isStale =
        !stored || Date.now() - new Date(stored.fetched_at).getTime() > REFRESH_AFTER_MS

      if (isStale) {
        await refresh({ silent: true })
      }
    } catch (err) {
      if (currentRequest !== requestId.current) return
      setError(err instanceof Error ? err.message : 'Could not load the gold price')
    } finally {
      if (currentRequest === requestId.current) setLoading(false)
    }
  }, [refresh])

  useEffect(() => {
    load()
  }, [load])

  return { price, loading, refreshing, error, refresh, reload: load }
}
