import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase, isSupabaseConfigured } from '../lib/supabase'
import { Transfer, TransferFormData, DateRange } from '../types'
import { useAuth } from '../context/AuthContext'
import { format } from 'date-fns'
import toast from 'react-hot-toast'

interface UseTransfersOptions {
  dateRange?: DateRange
}

export function useTransfers(options?: UseTransfersOptions) {
  const [transfers, setTransfers] = useState<Transfer[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const hasShownError = useRef(false)
  // Monotonic counter so a slow early response can't overwrite a newer one.
  const requestId = useRef(0)
  const { member } = useAuth()

  // Convert Date objects to stable string format for dependency comparison
  const startDateStr = options?.dateRange?.start ? format(options.dateRange.start, 'yyyy-MM-dd') : null
  const endDateStr = options?.dateRange?.end ? format(options.dateRange.end, 'yyyy-MM-dd') : null

  /** Does a row belong in the currently displayed, filtered list? */
  const matchesFilters = useCallback((transfer: Transfer) => {
    if (!member || transfer.member_id !== member.id) return false
    if (startDateStr && transfer.date < startDateStr) return false
    if (endDateStr && transfer.date > endDateStr) return false
    return true
  }, [member, startDateStr, endDateStr])

  const fetchTransfers = useCallback(async () => {
    if (!isSupabaseConfigured || !member) {
      setTransfers([])
      setError(null)
      setLoading(false)
      return
    }

    const currentRequest = ++requestId.current

    try {
      setLoading(true)
      setError(null)
      let query = supabase
        .from('transfers')
        .select(`
          *,
          member:members(*)
        `)
        .order('date', { ascending: false })
        .order('created_at', { ascending: false })

      if (startDateStr && endDateStr) {
        query = query
          .gte('date', startDateStr)
          .lte('date', endDateStr)
      }

      const { data, error } = await query

      if (error) throw error
      if (currentRequest !== requestId.current) return

      const scopedTransfers = (data || []).filter(transfer => transfer.member_id === member.id)
      setTransfers(scopedTransfers)
      hasShownError.current = false
    } catch (err) {
      if (currentRequest !== requestId.current) return
      const message = err instanceof Error ? err.message : 'Failed to fetch transfers'
      setError(message)
      // Only show toast once per error
      if (!hasShownError.current) {
        hasShownError.current = true
        toast.error(message)
      }
    } finally {
      if (currentRequest === requestId.current) {
        setLoading(false)
      }
    }
  }, [startDateStr, endDateStr, member])

  useEffect(() => {
    fetchTransfers()
  }, [fetchTransfers])

  const addTransfer = async (formData: TransferFormData) => {
    if (!isSupabaseConfigured || !member) {
      toast.error('Please configure Supabase first')
      throw new Error('Supabase not configured')
    }

    try {
      const payload = {
        ...formData,
        member_id: formData.member_id ?? member.id,
      }

      const { data, error } = await supabase
        .from('transfers')
        .insert([payload])
        .select(`
          *,
          member:members(*)
        `)
        .single()

      if (error) throw error
      // Only show it here if it actually belongs in the current view.
      if (matchesFilters(data)) {
        setTransfers(prev => [data, ...prev])
      }
      toast.success('Transfer completed successfully')
      return data
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to add transfer'
      toast.error(message)
      throw err
    }
  }

  const updateTransfer = async (id: string, formData: Partial<TransferFormData>) => {
    if (!isSupabaseConfigured || !member) {
      toast.error('Please configure Supabase first')
      throw new Error('Supabase not configured')
    }

    try {
      const { data, error } = await supabase
        .from('transfers')
        .update(formData)
        .eq('id', id)
        .select(`
          *,
          member:members(*)
        `)
        .single()

      if (error) throw error
      // An edit can move a row out of the active date filter.
      setTransfers(prev =>
        matchesFilters(data)
          ? prev.map(t => (t.id === id ? data : t))
          : prev.filter(t => t.id !== id)
      )
      toast.success('Transfer updated successfully')
      return data
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update transfer'
      toast.error(message)
      throw err
    }
  }

  const deleteTransfer = async (id: string) => {
    if (!isSupabaseConfigured || !member) {
      toast.error('Please configure Supabase first')
      throw new Error('Supabase not configured')
    }

    try {
      const { error } = await supabase
        .from('transfers')
        .delete()
        .eq('id', id)

      if (error) throw error
      setTransfers(prev => prev.filter(t => t.id !== id))
      toast.success('Transfer deleted successfully')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to delete transfer'
      toast.error(message)
      throw err
    }
  }

  return {
    transfers,
    loading,
    error,
    fetchTransfers,
    addTransfer,
    updateTransfer,
    deleteTransfer,
  }
}
