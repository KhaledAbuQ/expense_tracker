import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import toast from 'react-hot-toast'
import { supabase, isSupabaseConfigured } from '../lib/supabase'
import { Member } from '../types'

const PENDING_ONBOARDING_KEY = 'expense_tracker_pending_onboarding'

type OnboardingMetadata =
  | { mode: 'join'; displayName: string; inviteCode: string }
  | { mode: 'create'; displayName: string; householdName: string }

interface AuthContextValue {
  session: Session | null
  user: User | null
  member: Member | null
  householdId: string | null
  /** Every member id in the current household, including your own. */
  householdMemberIds: string[]
  loading: boolean
  isPasswordRecovery: boolean
  setIsPasswordRecovery: (value: boolean) => void
  refreshMember: () => Promise<Member | null>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [member, setMember] = useState<Member | null>(null)
  const [householdMemberIds, setHouseholdMemberIds] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [authReady, setAuthReady] = useState(false)
  const [isPasswordRecovery, setIsPasswordRecovery] = useState(() => {
    try {
      return (
        window.location.hash.includes('type=recovery') ||
        window.location.search.includes('type=recovery')
      )
    } catch {
      return false
    }
  })
  const provisioningAttemptedUserId = useRef<string | null>(null)

  const getOnboardingMetadata = useCallback((user: User): OnboardingMetadata | null => {
    const readMetadata = (source: Record<string, unknown> | undefined): OnboardingMetadata | null => {
      const mode = source?.onboarding_mode
      const displayName = typeof source?.display_name === 'string' ? source.display_name.trim() : ''
      // `household_id` is the legacy key from when the invite code was the raw
      // household UUID; the join RPC still accepts those.
      const inviteCode =
        typeof source?.invite_code === 'string'
          ? source.invite_code.trim()
          : typeof source?.household_id === 'string'
            ? source.household_id.trim()
            : ''
      const householdName = typeof source?.household_name === 'string' ? source.household_name.trim() : ''

      if (!displayName) return null
      if (mode === 'join' && inviteCode) {
        return { mode: 'join', displayName, inviteCode }
      }
      if (mode === 'create' && householdName) {
        return { mode: 'create', displayName, householdName }
      }
      return null
    }

    const fromUserMetadata = readMetadata(user.user_metadata as Record<string, unknown> | undefined)
    if (fromUserMetadata) return fromUserMetadata

    try {
      const raw = localStorage.getItem(PENDING_ONBOARDING_KEY)
      if (!raw) return null

      const parsed = JSON.parse(raw) as Record<string, unknown>
      const email = typeof parsed.email === 'string' ? parsed.email.trim().toLowerCase() : ''
      if (!email || email !== (user.email ?? '').trim().toLowerCase()) {
        return null
      }

      return readMetadata(parsed)
    } catch {
      return null
    }
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

    // Both RPCs are atomic and decide `role` server-side, so a half-created
    // household can't be left behind and a client can't make itself admin.
    const { data, error } =
      onboarding.mode === 'create'
        ? await supabase.rpc('create_household_with_member', {
            p_household_name: onboarding.householdName,
            p_display_name: onboarding.displayName,
          })
        : await supabase.rpc('join_household_with_code', {
            p_invite_code: onboarding.inviteCode,
            p_display_name: onboarding.displayName,
          })

    if (error) {
      const code = typeof error === 'object' && error && 'code' in error ? String(error.code) : ''

      if (code === '23505') {
        // Already provisioned by a concurrent tab.
        return fetchMember(user.id, 0)
      }

      if (code === '23503') {
        toast.error('That invite code was not found. Please check it and try again.')
        return null
      }

      console.error('Failed to provision member', error)
      toast.error(error.message || 'Failed to complete profile setup')
      return null
    }

    const provisioned = (data ?? null) as Member | null
    if (!provisioned) return null

    setMember(provisioned)

    try {
      localStorage.removeItem(PENDING_ONBOARDING_KEY)
    } catch {
      // Ignore storage errors
    }

    return provisioned
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

    const { data: authListener } = supabase.auth.onAuthStateChange((event, newSession) => {
      if (!isMounted) return
      if (event === 'PASSWORD_RECOVERY') {
        setIsPasswordRecovery(true)
      }
      // Ignore token refreshes that don't change identity: the session object is
      // new on every refresh, and propagating it would restart every data hook.
      setSession(prev => (prev?.user?.id === newSession?.user?.id ? prev : newSession))
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

  // Fetched once here rather than inside every data hook. Each of
  // useExpenses/useIncome used to run its own `members` query before its real
  // one, which meant a dozen redundant round trips on the dashboard alone.
  useEffect(() => {
    if (!isSupabaseConfigured || !member) {
      setHouseholdMemberIds([])
      return
    }

    let isMounted = true

    const loadHouseholdMemberIds = async () => {
      const { data, error } = await supabase
        .from('members')
        .select('id')
        .eq('household_id', member.household_id)

      if (!isMounted) return

      if (error) {
        console.error('Failed to load household members', error)
        setHouseholdMemberIds([member.id])
        return
      }

      setHouseholdMemberIds(
        Array.from(new Set([...(data || []).map(m => m.id as string), member.id]))
      )
    }

    loadHouseholdMemberIds()

    return () => {
      isMounted = false
    }
  }, [member])

  const signOut = useCallback(async () => {
    if (!isSupabaseConfigured) return
    const { error } = await supabase.auth.signOut()
    if (error) {
      toast.error(error.message)
    }
    provisioningAttemptedUserId.current = null
    setSession(null)
    setMember(null)
    setHouseholdMemberIds([])
  }, [])

  const value = useMemo(
    () => ({
      session,
      user: session?.user ?? null,
      member,
      householdId: member?.household_id ?? null,
      householdMemberIds,
      loading,
      isPasswordRecovery,
      setIsPasswordRecovery,
      refreshMember,
      signOut,
    }),
    [session, member, householdMemberIds, loading, isPasswordRecovery, refreshMember, signOut]
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
