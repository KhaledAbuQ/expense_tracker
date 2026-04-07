import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase, isSupabaseConfigured } from '../lib/supabase'
import { Income, IncomeFormData, DateRange } from '../types'
import { format } from 'date-fns'
import toast from 'react-hot-toast'

interface UseIncomeOptions {
  dateRange?: DateRange
  categoryId?: string
}

export function useIncome(options?: UseIncomeOptions) {
  const [income, setIncome] = useState<Income[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const hasShownError = useRef(false)

  // Convert Date objects to stable string format for dependency comparison
  const startDateStr = options?.dateRange?.start ? format(options.dateRange.start, 'yyyy-MM-dd') : null
  const endDateStr = options?.dateRange?.end ? format(options.dateRange.end, 'yyyy-MM-dd') : null

  const fetchIncome = useCallback(async () => {
    if (!isSupabaseConfigured) {
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      setError(null)
      let query = supabase
        .from('income')
        .select(`
          *,
          category:categories(*)
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

      const { data, error } = await query

      if (error) throw error
      setIncome(data || [])
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
  }, [startDateStr, endDateStr, options?.categoryId])

  useEffect(() => {
    fetchIncome()
  }, [fetchIncome])

  const addIncome = async (formData: IncomeFormData) => {
    if (!isSupabaseConfigured) {
      toast.error('Please configure Supabase first')
      throw new Error('Supabase not configured')
    }

    try {
      const { data, error } = await supabase
        .from('income')
        .insert([formData])
        .select(`
          *,
          category:categories(*)
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
    if (!isSupabaseConfigured) {
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
          category:categories(*)
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
    if (!isSupabaseConfigured) {
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
