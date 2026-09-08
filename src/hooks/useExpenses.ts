import { fetchAllRows } from '../lib/pagination'
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
  const matchesFilters = useCallback((expense: Expense) => {
    if (!member) return false

    const visibleToMe =
      expense.member_id === member.id
      || (expense.visibility === 'household' && householdMemberIds.includes(expense.member_id))
    if (!visibleToMe) return false

    if (startDateStr && expense.date < startDateStr) return false
    if (endDateStr && expense.date > endDateStr) return false
    if (categoryId && expense.category_id !== categoryId) return false

    if (visibility === 'private') {
      return expense.visibility === 'private' && expense.member_id === member.id
    }
    if (visibility === 'household') {
      return expense.visibility === 'household'
    }
    return true
  }, [member, householdMemberIds, startDateStr, endDateStr, categoryId, visibility])

  const fetchExpenses = useCallback(async () => {
    if (!isSupabaseConfigured || !member || householdMemberIds.length === 0) {
      setExpenses([])
      setError(null)
      setLoading(false)
      return
    }

    const currentRequest = ++requestId.current

    try {
      setLoading(true)
      setError(null)

      let query = supabase
        .from('expenses')
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

      const scopedExpenses = (data || []).filter(expense =>
        expense.member_id === member.id
        || (expense.visibility === 'household' && householdMemberIds.includes(expense.member_id))
      )
      setExpenses(scopedExpenses)
      hasShownError.current = false
    } catch (err) {
      if (currentRequest !== requestId.current) return
      const message = err instanceof Error ? err.message : 'Failed to fetch expenses'
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
      // Only show it here if it actually belongs in the current view. Otherwise
      // an expense dated outside the selected range would appear in the list and
      // in the total until the next refresh.
      if (matchesFilters(data)) {
        setExpenses(prev => [data, ...prev])
      }
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
      // An edit can move a row out of the active filter (new date, new category,
      // new visibility), in which case it should drop out of the list.
      setExpenses(prev =>
        matchesFilters(data)
          ? prev.map(e => (e.id === id ? data : e))
          : prev.filter(e => e.id !== id)
      )
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
