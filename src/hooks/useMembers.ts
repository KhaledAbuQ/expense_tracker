import { useCallback, useEffect, useRef, useState } from 'react'
import toast from 'react-hot-toast'
import { Member } from '../types'
import { supabase, isSupabaseConfigured } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

export function useMembers() {
  const [members, setMembers] = useState<Member[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const hasShownError = useRef(false)
  const { member } = useAuth()

  const fetchMembers = useCallback(async () => {
    if (!isSupabaseConfigured || !member) {
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      setError(null)
      const { data, error } = await supabase
        .from('members')
        .select('*')
        .eq('household_id', member.household_id)
        .order('created_at', { ascending: true })

      if (error) throw error
      setMembers(data || [])
      hasShownError.current = false
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch members'
      setError(message)
      if (!hasShownError.current) {
        hasShownError.current = true
        toast.error(message)
      }
    } finally {
      setLoading(false)
    }
  }, [member])

  useEffect(() => {
    fetchMembers()
  }, [fetchMembers])

  return {
    members,
    loading,
    error,
    fetchMembers,
  }
}
