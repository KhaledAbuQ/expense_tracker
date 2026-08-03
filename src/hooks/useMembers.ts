import { useCallback, useEffect, useRef, useState } from 'react'
import toast from 'react-hot-toast'
import { Household, Member } from '../types'
import { supabase, isSupabaseConfigured } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

export function useMembers() {
  const [members, setMembers] = useState<Member[]>([])
  const [household, setHousehold] = useState<Household | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const hasShownError = useRef(false)
  const requestId = useRef(0)
  const { member, refreshMember } = useAuth()

  const fetchMembers = useCallback(async () => {
    if (!isSupabaseConfigured || !member) {
      setMembers([])
      setHousehold(null)
      setLoading(false)
      return
    }

    const currentRequest = ++requestId.current

    try {
      setLoading(true)
      setError(null)

      const [membersResult, householdResult] = await Promise.all([
        supabase
          .from('members')
          .select('*')
          .eq('household_id', member.household_id)
          .order('created_at', { ascending: true }),
        supabase
          .from('households')
          .select('*')
          .eq('id', member.household_id)
          .maybeSingle(),
      ])

      if (membersResult.error) throw membersResult.error
      if (householdResult.error) throw householdResult.error

      // A slower earlier request must not overwrite a newer result.
      if (currentRequest !== requestId.current) return

      setMembers(membersResult.data || [])
      setHousehold((householdResult.data as Household) ?? null)
      hasShownError.current = false
    } catch (err) {
      if (currentRequest !== requestId.current) return
      const message = err instanceof Error ? err.message : 'Failed to fetch members'
      setError(message)
      if (!hasShownError.current) {
        hasShownError.current = true
        toast.error(message)
      }
    } finally {
      if (currentRequest === requestId.current) {
        setLoading(false)
      }
    }
  }, [member])

  useEffect(() => {
    fetchMembers()
  }, [fetchMembers])

  const renameMember = useCallback(async (id: string, name: string) => {
    const trimmed = name.trim()
    if (!trimmed) {
      toast.error('Name cannot be empty')
      return
    }

    try {
      const { data, error } = await supabase
        .from('members')
        .update({ name: trimmed })
        .eq('id', id)
        .select('*')
        .single()

      if (error) throw error
      setMembers(prev => prev.map(m => (m.id === id ? data : m)))
      toast.success('Name updated')
      if (member?.id === id) await refreshMember()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update name')
      throw err
    }
  }, [member, refreshMember])

  const removeMember = useCallback(async (id: string) => {
    try {
      const { error } = await supabase.from('members').delete().eq('id', id)
      if (error) throw error
      setMembers(prev => prev.filter(m => m.id !== id))
      toast.success('Member removed')
      if (member?.id === id) await refreshMember()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to remove member')
      throw err
    }
  }, [member, refreshMember])

  const rotateInviteCode = useCallback(async () => {
    try {
      const { data, error } = await supabase.rpc('rotate_household_invite')
      if (error) throw error
      const freshCode = data as string
      setHousehold(prev => (prev ? { ...prev, invite_code: freshCode } : prev))
      toast.success('Invite code rotated. The old code no longer works.')
      return freshCode
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to rotate invite code')
      throw err
    }
  }, [])

  return {
    members,
    household,
    inviteCode: household?.invite_code ?? '',
    loading,
    error,
    fetchMembers,
    renameMember,
    removeMember,
    rotateInviteCode,
  }
}
