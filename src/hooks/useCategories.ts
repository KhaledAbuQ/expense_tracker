import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase, isSupabaseConfigured } from '../lib/supabase'
import { Category, CategoryFormData } from '../types'
import toast from 'react-hot-toast'

export function useCategories() {
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const hasShownError = useRef(false)

  const fetchCategories = useCallback(async () => {
    if (!isSupabaseConfigured) {
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      setError(null)
      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .order('is_default', { ascending: false })
        .order('name')

      if (error) throw error
      setCategories(data || [])
      hasShownError.current = false
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch categories'
      setError(message)
      // Only show toast once per error
      if (!hasShownError.current) {
        hasShownError.current = true
        toast.error(message)
      }
    } finally {
      setLoading(false)
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

    try {
      const { data, error } = await supabase
        .from('categories')
        .insert([{ ...formData, is_default: false }])
        .select()
        .single()

      if (error) throw error
      setCategories(prev => [...prev, data])
      toast.success('Category added successfully')
      return data
    } catch (err: any) {
      console.error('Full ERROR:', err)
      
      const message = 
        err?.message || 
        err?.details || 
        err?.hint || 
        JSON.stringify(error) ||
        'Failed to add category'

      toast.error(message)
      throw(err)
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
      const message = err instanceof Error ? err.message : 'Failed to update category'
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
    } catch (err: any) {
      const message = err instanceof Error ? err.message : 'Failed to delete category' 
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
