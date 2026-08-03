import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase, isSupabaseConfigured } from '../lib/supabase'
import { Category, CategoryFormData } from '../types'
import { useAuth } from '../context/AuthContext'
import toast from 'react-hot-toast'

/** Pull the most useful message out of a Supabase/Postgrest error. */
function describeError(err: unknown, fallback: string): string {
  if (err && typeof err === 'object') {
    const candidate = err as { message?: unknown; details?: unknown; hint?: unknown }
    if (typeof candidate.message === 'string' && candidate.message) return candidate.message
    if (typeof candidate.details === 'string' && candidate.details) return candidate.details
    if (typeof candidate.hint === 'string' && candidate.hint) return candidate.hint
  }
  return fallback
}

export function useCategories() {
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const hasShownError = useRef(false)
  const requestId = useRef(0)
  const { member } = useAuth()

  const fetchCategories = useCallback(async () => {
    if (!isSupabaseConfigured) {
      setLoading(false)
      return
    }

    const currentRequest = ++requestId.current

    try {
      setLoading(true)
      setError(null)
      // RLS returns the shared defaults plus this household's own categories.
      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .order('is_default', { ascending: false })
        .order('name')

      if (error) throw error
      if (currentRequest !== requestId.current) return

      setCategories(data || [])
      hasShownError.current = false
    } catch (err) {
      if (currentRequest !== requestId.current) return
      const message = describeError(err, 'Failed to fetch categories')
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
  }, [])

  useEffect(() => {
    fetchCategories()
  }, [fetchCategories])

  const addCategory = async (formData: CategoryFormData) => {
    if (!isSupabaseConfigured) {
      toast.error('Please configure Supabase first')
      throw new Error('Supabase not configured')
    }

    if (!member) {
      toast.error('Your household profile is still loading')
      throw new Error('No member profile')
    }

    try {
      const { data, error } = await supabase
        .from('categories')
        .insert([{ ...formData, is_default: false, household_id: member.household_id }])
        .select()
        .single()

      if (error) throw error
      setCategories(prev => [...prev, data])
      toast.success('Category added successfully')
      return data
    } catch (err) {
      const message = describeError(err, 'Failed to add category')
      toast.error(message)
      throw err
    }
  }

  const updateCategory = async (id: string, formData: Partial<CategoryFormData>) => {
    if (!isSupabaseConfigured) {
      toast.error('Please configure Supabase first')
      throw new Error('Supabase not configured')
    }

    try {
      const { data, error } = await supabase
        .from('categories')
        .update(formData)
        .eq('id', id)
        .select()
        .single()

      if (error) throw error
      setCategories(prev => prev.map(c => (c.id === id ? data : c)))
      toast.success('Category updated successfully')
      return data
    } catch (err) {
      const message = describeError(err, 'Failed to update category')
      toast.error(message)
      throw err
    }
  }

  const deleteCategory = async (id: string) => {
    if (!isSupabaseConfigured) {
      toast.error('Please configure Supabase first')
      throw new Error('Supabase not configured')
    }

    try {
      // Also enforced by RLS; this just avoids a pointless round trip.
      const category = categories.find(c => c.id === id)
      if (category?.is_default) {
        toast.error('Cannot delete default categories')
        return
      }

      const { error } = await supabase
        .from('categories')
        .delete()
        .eq('id', id)

      if (error) throw error
      setCategories(prev => prev.filter(c => c.id !== id))
      toast.success('Category deleted successfully')
    } catch (err) {
      const message = describeError(err, 'Failed to delete category')
      toast.error(message)
      throw err
    }
  }

  return {
    categories,
    loading,
    error,
    fetchCategories,
    addCategory,
    updateCategory,
    deleteCategory,
  }
}
