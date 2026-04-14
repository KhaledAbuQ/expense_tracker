import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import toast from 'react-hot-toast'
import { supabase, isSupabaseConfigured } from '../lib/supabase'
import { Member } from '../types'

const PENDING_ONBOARDING_KEY = 'expense_tracker_pending_onboarding'

type OnboardingMetadata =
  | { mode: 'join'; displayName: string; householdId: string; role: 'member' }
  | { mode: 'create'; displayName: string; householdName: string; role: 'admin' }

interface AuthContextValue {
  session: Session | null
  user: User | null
  member: Member | null
  householdId: string | null
  loading: boolean
  refreshMember: () => Promise<Member | null>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [member, setMember] = useState<Member | null>(null)
  const [loading, setLoading] = useState(true)
  const [authReady, setAuthReady] = useState(false)
  const provisioningAttemptedUserId = useRef<string | null>(null)

  const getOnboardingMetadata = useCallback((user: User): OnboardingMetadata | null => {
    const metadata = user.user_metadata as Record<string, unknown> | undefined
    const mode = metadata?.onboarding_mode
    const displayName = typeof metadata?.display_name === 'string' ? metadata.display_name.trim() : ''
    const householdId = typeof metadata?.household_id === 'string' ? metadata.household_id.trim() : ''
    const householdName = typeof metadata?.household_name === 'string' ? metadata.household_name.trim() : ''

    if (displayName) {
      if (mode === 'join' && householdId) {
        return { mode: 'join', displayName, householdId, role: 'member' }
      }
      if (mode === 'create' && householdName) {
        return { mode: 'create', displayName, householdName, role: 'admin' }
      }
    }

    try {
      const raw = localStorage.getItem(PENDING_ONBOARDING_KEY)
      if (!raw) return null

      const parsed = JSON.parse(raw) as Record<string, unknown>
      const email = typeof parsed.email === 'string' ? parsed.email.trim().toLowerCase() : ''
      if (!email || email !== (user.email ?? '').trim().toLowerCase()) {
        return null
      }

      const pendingMode = parsed.onboarding_mode
      const pendingDisplayName = typeof parsed.display_name === 'string' ? parsed.display_name.trim() : ''
      const pendingHouseholdId = typeof parsed.household_id === 'string' ? parsed.household_id.trim() : ''
      const pendingHouseholdName = typeof parsed.household_name === 'string' ? parsed.household_name.trim() : ''

      if (!pendingDisplayName) return null
      if (pendingMode === 'join' && pendingHouseholdId) {
        return { mode: 'join', displayName: pendingDisplayName, householdId: pendingHouseholdId, role: 'member' }
      }
      if (pendingMode === 'create' && pendingHouseholdName) {
        return { mode: 'create', displayName: pendingDisplayName, householdName: pendingHouseholdName, role: 'admin' }
      }
    } catch {
      return null
    }

    return null
  }, [])

  const getMemberByUserId = useCallback(async (userId: string) => {
    const { data, error } = await supabase
      .from('members')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle()

    if (error) {
      console.error('Failed to fetch member', error)
      return { data: null, error }
    }

    return { data: data ?? null, error: null }
  }, [])

  const fetchMember = useCallback(async (userId: string, retries = 2) => {
    let attempts = 0
    let lastError: unknown = null

    while (attempts <= retries) {
      const { data, error } = await getMemberByUserId(userId)
      if (data) {
        setMember(data)
        return data
      }

      if (error) {
        lastError = error
      }

      attempts += 1
      if (attempts <= retries) {
        await new Promise(resolve => setTimeout(resolve, 250 * attempts))
      }
    }

    if (lastError) {
      toast.error('Failed to load your household profile')
    }

    setMember(null)
    return null
  }, [getMemberByUserId])

  const provisionMemberFromMetadata = useCallback(async (user: User) => {
    const onboarding = getOnboardingMetadata(user)
    if (!onboarding) return null

    let householdId = onboarding.mode === 'join' ? onboarding.householdId : null

    if (onboarding.mode === 'create') {
      const createdHouseholdId = crypto.randomUUID()
      const { error: householdError } = await supabase
        .from('households')
        .insert({ id: createdHouseholdId, name: onboarding.householdName })

      if (householdError) {
        console.error('Failed to create household during provisioning', householdError)
        toast.error('Failed to complete profile setup')
        return null
      }

      householdId = createdHouseholdId
    }

    if (!householdId) return null

    const { data, error } = await supabase
      .from('members')
      .insert({
        household_id: householdId,
        user_id: user.id,
        name: onboarding.displayName,
        role: onboarding.role,
      })
      .select('*')
      .single()

    if (error) {
      const errorCode = typeof error === 'object' && error && 'code' in error ? String(error.code) : ''

      if (errorCode === '23505') {
        return fetchMember(user.id, 0)
      }

      if (errorCode === '23503') {
        toast.error('Household ID was not found. Please check the invite code.')
        return null
      }

      console.error('Failed to provision member from metadata', error)
      toast.error('Failed to complete profile setup')
      return null
    }

    setMember(data)

    try {
      localStorage.removeItem(PENDING_ONBOARDING_KEY)
    } catch {
      // Ignore storage errors
    }

    return data
  }, [fetchMember, getOnboardingMetadata])

  const refreshMember = useCallback(async () => {
    if (!session?.user) {
      setMember(null)
      return null
    }

    const existingMember = await fetchMember(session.user.id)
    if (existingMember) return existingMember

    provisioningAttemptedUserId.current = null
    return provisionMemberFromMetadata(session.user)
  }, [fetchMember, provisionMemberFromMetadata, session])

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setAuthReady(true)
      setLoading(false)
      return
    }

    let isMounted = true

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      if (!isMounted) return
      setSession(newSession)
    })

    const init = async () => {
      const { data } = await supabase.auth.getSession()
      if (!isMounted) return
      setSession(data.session)
      setAuthReady(true)
    }

    init()

    return () => {
      isMounted = false
      authListener.subscription.unsubscribe()
    }
  }, [])

  useEffect(() => {
    if (!isSupabaseConfigured || !authReady) return

    let isMounted = true

    const loadMember = async () => {
      if (!session?.user) {
        provisioningAttemptedUserId.current = null
        setMember(null)
        setLoading(false)
        return
      }

      setLoading(true)
      const existingMember = await fetchMember(session.user.id)

      if (!existingMember && provisioningAttemptedUserId.current !== session.user.id) {
        provisioningAttemptedUserId.current = session.user.id
        await provisionMemberFromMetadata(session.user)
      }

      if (isMounted) {
        setLoading(false)
      }
    }

    loadMember()

    return () => {
      isMounted = false
    }
  }, [authReady, fetchMember, provisionMemberFromMetadata, session])

  const signOut = useCallback(async () => {
    if (!isSupabaseConfigured) return
    const { error } = await supabase.auth.signOut()
    if (error) {
      toast.error(error.message)
    }
    provisioningAttemptedUserId.current = null
    setSession(null)
    setMember(null)
  }, [])

  const value = useMemo(
    () => ({
      session,
      user: session?.user ?? null,
      member,
      householdId: member?.household_id ?? null,
      loading,
      refreshMember,
      signOut,
    }),
    [session, member, loading, refreshMember, signOut]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
