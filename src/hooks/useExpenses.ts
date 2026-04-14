import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase, isSupabaseConfigured } from '../lib/supabase'
import { Expense, ExpenseFormData, DateRange } from '../types'
import { useAuth } from '../context/AuthContext'
import { format } from 'date-fns'
import toast from 'react-hot-toast'

interface UseExpensesOptions {
  dateRange?: DateRange
  categoryId?: string
  visibility?: 'private' | 'household'
}

export function useExpenses(options?: UseExpensesOptions) {
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const hasShownError = useRef(false)
  const { member } = useAuth()

  // Convert Date objects to stable string format for dependency comparison
  const startDateStr = options?.dateRange?.start ? format(options.dateRange.start, 'yyyy-MM-dd') : null
  const endDateStr = options?.dateRange?.end ? format(options.dateRange.end, 'yyyy-MM-dd') : null

  const fetchExpenses = useCallback(async () => {
    if (!isSupabaseConfigured || !member) {
      setExpenses([])
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
        .from('expenses')
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
      const scopedExpenses = (data || []).filter(expense =>
        expense.member_id === member.id
        || (expense.visibility === 'household' && householdMemberIds.includes(expense.member_id))
      )
      setExpenses(scopedExpenses)
      hasShownError.current = false
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch expenses'
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
    fetchExpenses()
  }, [fetchExpenses])

  const addExpense = async (formData: ExpenseFormData) => {
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
        .from('expenses')
        .insert([payload])
        .select(`
          *,
          category:categories(*),
          member:members(*)
        `)
        .single()

      if (error) throw error
      setExpenses(prev => [data, ...prev])
      toast.success('Expense added successfully')
      return data
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to add expense'
      toast.error(message)
      throw err
    }
  }

  const updateExpense = async (id: string, formData: Partial<ExpenseFormData>) => {
    if (!isSupabaseConfigured || !member) {
      toast.error('Please configure Supabase first')
      throw new Error('Supabase not configured')
    }

    try {
      const { data, error } = await supabase
        .from('expenses')
        .update(formData)
        .eq('id', id)
        .select(`
          *,
          category:categories(*),
          member:members(*)
        `)
        .single()

      if (error) throw error
      setExpenses(prev => prev.map(e => (e.id === id ? data : e)))
      toast.success('Expense updated successfully')
      return data
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update expense'
      toast.error(message)
      throw err
    }
  }

  const deleteExpense = async (id: string) => {
    if (!isSupabaseConfigured || !member) {
      toast.error('Please configure Supabase first')
      throw new Error('Supabase not configured')
    }

    try {
      const { error } = await supabase
        .from('expenses')
        .delete()
        .eq('id', id)

      if (error) throw error
      setExpenses(prev => prev.filter(e => e.id !== id))
      toast.success('Expense deleted successfully')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to delete expense'
      toast.error(message)
      throw err
    }
  }

  return {
    expenses,
    loading,
    error,
    fetchExpenses,
    addExpense,
    updateExpense,
    deleteExpense,
  }
}
