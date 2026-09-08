import { fetchAllRows } from '../lib/pagination'
import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase, isSupabaseConfigured } from '../lib/supabase'
import { Income, IncomeFormData, DateRange } from '../types'
import { useAuth } from '../context/AuthContext'
import { format } from 'date-fns'
import toast from 'react-hot-toast'

interface UseIncomeOptions {
  dateRange?: DateRange
  categoryId?: string
  visibility?: 'private' | 'household'
}

export function useIncome(options?: UseIncomeOptions) {
  const [income, setIncome] = useState<Income[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const hasShownError = useRef(false)
  // Monotonic counter so a slow early response can't overwrite a newer one.
  const requestId = useRef(0)
  const { member, householdMemberIds } = useAuth()

  // Convert Date objects to stable string format for dependency comparison
  const startDateStr = options?.dateRange?.start ? format(options.dateRange.start, 'yyyy-MM-dd') : null
  const endDateStr = options?.dateRange?.end ? format(options.dateRange.end, 'yyyy-MM-dd') : null
  const categoryId = options?.categoryId
  const visibility = options?.visibility
  const memberIdsKey = householdMemberIds.join(',')

  /** Does a row belong in the currently displayed, filtered list? */
  const matchesFilters = useCallback((entry: Income) => {
    if (!member) return false

    const visibleToMe =
      entry.member_id === member.id
      || (entry.visibility === 'household' && householdMemberIds.includes(entry.member_id))
    if (!visibleToMe) return false

    if (startDateStr && entry.date < startDateStr) return false
    if (endDateStr && entry.date > endDateStr) return false
    if (categoryId && entry.category_id !== categoryId) return false

    if (visibility === 'private') {
      return entry.visibility === 'private' && entry.member_id === member.id
    }
    if (visibility === 'household') {
      return entry.visibility === 'household'
    }
    return true
  }, [member, householdMemberIds, startDateStr, endDateStr, categoryId, visibility])

  const fetchIncome = useCallback(async () => {
    if (!isSupabaseConfigured || !member || householdMemberIds.length === 0) {
      setIncome([])
      setError(null)
      setLoading(false)
      return
    }

    const currentRequest = ++requestId.current

    try {
      setLoading(true)
      setError(null)

      let query = supabase
        .from('income')
        .select(`
          *,
          category:categories(*),
          member:members(*)
        `)
        .order('date', { ascending: false })
        .order('created_at', { ascending: false })
        .order('id', { ascending: false })

      if (startDateStr && endDateStr) {
        query = query
          .gte('date', startDateStr)
          .lte('date', endDateStr)
      }

      if (categoryId) {
        query = query.eq('category_id', categoryId)
      }

      if (visibility === 'private') {
        query = query
          .eq('visibility', 'private')
          .eq('member_id', member.id)
      } else if (visibility === 'household') {
        query = query
          .eq('visibility', 'household')
          .in('member_id', householdMemberIds)
      } else {
        query = query.or(`member_id.eq.${member.id},and(visibility.eq.household,member_id.in.(${householdMemberIds.join(',')}))`)
      }

      const data = await fetchAllRows((from, to) => query.range(from, to))
      if (currentRequest !== requestId.current) return

      const scopedIncome = (data || []).filter(entry =>
        entry.member_id === member.id
        || (entry.visibility === 'household' && householdMemberIds.includes(entry.member_id))
      )
      setIncome(scopedIncome)
      hasShownError.current = false
    } catch (err) {
      if (currentRequest !== requestId.current) return
      const message = err instanceof Error ? err.message : 'Failed to fetch income'
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startDateStr, endDateStr, categoryId, visibility, member, memberIdsKey])

  useEffect(() => {
    fetchIncome()
  }, [fetchIncome])

  const addIncome = async (formData: IncomeFormData) => {
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
        .from('income')
        .insert([payload])
        .select(`
          *,
          category:categories(*),
          member:members(*)
        `)
        .single()

      if (error) throw error
      // Only show it here if it actually belongs in the current view.
      if (matchesFilters(data)) {
        setIncome(prev => [data, ...prev])
      }
      toast.success('Income added successfully')
      return data
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to add income'
      toast.error(message)
      throw err
    }
  }

  const updateIncome = async (id: string, formData: Partial<IncomeFormData>) => {
    if (!isSupabaseConfigured || !member) {
      toast.error('Please configure Supabase first')
      throw new Error('Supabase not configured')
    }

    try {
      const { data, error } = await supabase
        .from('income')
        .update(formData)
        .eq('id', id)
        .select(`
          *,
          category:categories(*),
          member:members(*)
        `)
        .single()

      if (error) throw error
      // An edit can move a row out of the active filter.
      setIncome(prev =>
        matchesFilters(data)
          ? prev.map(i => (i.id === id ? data : i))
          : prev.filter(i => i.id !== id)
      )
      toast.success('Income updated successfully')
      return data
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update income'
      toast.error(message)
      throw err
    }
  }

  const deleteIncome = async (id: string) => {
    if (!isSupabaseConfigured || !member) {
      toast.error('Please configure Supabase first')
      throw new Error('Supabase not configured')
    }

    try {
      const { error } = await supabase
        .from('income')
        .delete()
        .eq('id', id)

      if (error) throw error
      setIncome(prev => prev.filter(i => i.id !== id))
      toast.success('Income deleted successfully')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to delete income'
      toast.error(message)
      throw err
    }
  }

  return {
    income,
    loading,
    error,
    fetchIncome,
    addIncome,
    updateIncome,
    deleteIncome,
  }
}
