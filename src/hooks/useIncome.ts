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
  const { member } = useAuth()

  // Convert Date objects to stable string format for dependency comparison
  const startDateStr = options?.dateRange?.start ? format(options.dateRange.start, 'yyyy-MM-dd') : null
  const endDateStr = options?.dateRange?.end ? format(options.dateRange.end, 'yyyy-MM-dd') : null

  const fetchIncome = useCallback(async () => {
    if (!isSupabaseConfigured || !member) {
      setIncome([])
      setError(null)
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      setError(null)

      const { data: householdMembers, error: householdMembersError } = await supabase
        .from('members')
        .select('id')
        .eq('household_id', member.household_id)

      if (householdMembersError) throw householdMembersError

      const householdMemberIds = Array.from(
        new Set([
          ...(householdMembers || []).map(m => m.id),
          member.id,
        ])
      )

      let query = supabase
        .from('income')
        .select(`
          *,
          category:categories(*),
          member:members(*)
        `)
        .order('date', { ascending: false })
        .order('created_at', { ascending: false })

      if (startDateStr && endDateStr) {
        query = query
          .gte('date', startDateStr)
          .lte('date', endDateStr)
      }

      if (options?.categoryId) {
        query = query.eq('category_id', options.categoryId)
      }

      if (options?.visibility === 'private') {
        query = query
          .eq('visibility', 'private')
          .eq('member_id', member.id)
      } else if (options?.visibility === 'household') {
        query = query
          .eq('visibility', 'household')
          .in('member_id', householdMemberIds)
      } else {
        query = query.or(`member_id.eq.${member.id},and(visibility.eq.household,member_id.in.(${householdMemberIds.join(',')}))`)
      }

      const { data, error } = await query

      if (error) throw error
      const scopedIncome = (data || []).filter(entry =>
        entry.member_id === member.id
        || (entry.visibility === 'household' && householdMemberIds.includes(entry.member_id))
      )
      setIncome(scopedIncome)
      hasShownError.current = false
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch income'
      setError(message)
      // Only show toast once per error
      if (!hasShownError.current) {
        hasShownError.current = true
        toast.error(message)
      }
    } finally {
      setLoading(false)
    }
  }, [startDateStr, endDateStr, options?.categoryId, options?.visibility, member])

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
      setIncome(prev => [data, ...prev])
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
      setIncome(prev => prev.map(i => (i.id === id ? data : i)))
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
