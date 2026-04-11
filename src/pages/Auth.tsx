import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { supabase, isSupabaseConfigured } from '../lib/supabase'

type Mode = 'sign-in' | 'sign-up'

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const PENDING_ONBOARDING_KEY = 'expense_tracker_pending_onboarding'

export default function AuthPage() {
  const [mode, setMode] = useState<Mode>('sign-in')
  const [loading, setLoading] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [householdName, setHouseholdName] = useState('')
  const [inviteCode, setInviteCode] = useState('')
  const [joinMode, setJoinMode] = useState<'create' | 'join'>('create')
  const navigate = useNavigate()

  const title = useMemo(
    () => (mode === 'sign-in' ? 'Welcome back' : 'Create your household'),
    [mode]
  )

  const subtitle = useMemo(
    () => (mode === 'sign-in'
      ? 'Sign in to track expenses together'
      : 'Create an account to start tracking'),
    [mode]
  )

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!isSupabaseConfigured) {
      toast.error('Please configure Supabase first')
      return
    }

    setLoading(true)
    try {
      if (mode === 'sign-in') {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        })
        if (error) throw error
        navigate('/')
        return
      }

      if (!displayName.trim()) {
        toast.error('Please add your name')
        return
      }

      if (joinMode === 'create' && !householdName.trim()) {
        toast.error('Please add a household name')
        return
      }

      if (joinMode === 'join' && !inviteCode.trim()) {
        toast.error('Please enter an invite code')
        return
      }

      const onboardingData = joinMode === 'create'
        ? {
            onboarding_mode: 'create',
            display_name: displayName.trim(),
            household_name: householdName.trim(),
          }
        : {
            onboarding_mode: 'join',
            display_name: displayName.trim(),
            household_id: joinHouseholdByInvite(inviteCode.trim()),
          }

      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: onboardingData,
        },
      })

      if (error) throw error

      try {
        localStorage.setItem(
          PENDING_ONBOARDING_KEY,
          JSON.stringify({
            email: email.trim().toLowerCase(),
            ...onboardingData,
          })
        )
      } catch {
        // Ignore storage errors
      }

      if (data.session) {
        toast.success('Account created')
        navigate('/')
        return
      }

      toast.success('Account created. Verify your email, then sign in to complete setup.')
      setMode('sign-in')
      setPassword('')
    } catch (err) {
      const message = getErrorMessage(err)
      toast.error(message)
    } finally {
      setLoading(false)
    }
  }

  const getErrorMessage = (err: unknown) => {
    if (!err || typeof err !== 'object') {
      return 'Authentication failed'
    }

    return err instanceof Error ? err.message : 'Authentication failed'
  }

  const joinHouseholdByInvite = (code: string) => {
    const normalizedCode = code.trim()
    if (!UUID_REGEX.test(normalizedCode)) {
      throw new Error('Please enter a valid household ID')
    }

    return normalizedCode
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-emerald-50 flex items-center justify-center px-6 py-12">
      <div className="w-full max-w-4xl grid grid-cols-1 lg:grid-cols-[1.1fr_1fr] bg-white shadow-xl rounded-3xl overflow-hidden">
        <div className="bg-gradient-to-br from-slate-900 via-slate-900 to-emerald-900 text-white p-10 flex flex-col justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.3em] text-emerald-300">Household Ledger</p>
            <h1 className="text-3xl font-semibold mt-6 leading-tight">Keep every member in sync with shared household spending.</h1>
            <p className="mt-4 text-sm text-emerald-100/80">
              Personal expenses stay private. Household expenses are visible to everyone so the budget stays fair.
            </p>
          </div>
          <div className="mt-10 grid grid-cols-2 gap-4 text-xs text-emerald-200/90">
            <div className="rounded-2xl bg-white/10 p-4">
              <p className="text-emerald-200/70">Private</p>
              <p className="text-base font-semibold mt-1">Personal expenses</p>
            </div>
            <div className="rounded-2xl bg-white/10 p-4">
              <p className="text-emerald-200/70">Shared</p>
              <p className="text-base font-semibold mt-1">Household expenses</p>
            </div>
          </div>
        </div>

        <div className="p-10">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-semibold text-slate-900">{title}</h2>
              <p className="text-sm text-slate-500 mt-1">{subtitle}</p>
            </div>
            <button
              type="button"
              onClick={() => setMode(mode === 'sign-in' ? 'sign-up' : 'sign-in')}
              className="text-sm text-emerald-600 hover:text-emerald-700 font-medium"
            >
              {mode === 'sign-in' ? 'Create account' : 'Back to sign in'}
            </button>
          </div>

          <form onSubmit={handleSubmit} className="mt-8 space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="mt-1 w-full rounded-xl border border-slate-200 px-4 py-2 focus:border-emerald-400 focus:ring-emerald-400"
                placeholder="you@example.com"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="mt-1 w-full rounded-xl border border-slate-200 px-4 py-2 focus:border-emerald-400 focus:ring-emerald-400"
                placeholder="••••••••"
              />
            </div>

            {mode === 'sign-up' && (
              <>
                <div>
                  <label className="block text-sm font-medium text-slate-700">Your name</label>
                  <input
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-200 px-4 py-2 focus:border-emerald-400 focus:ring-emerald-400"
                    placeholder="Alex"
                  />
                </div>

                <div className="rounded-2xl border border-slate-200 p-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-slate-700">Household</p>
                    <div className="flex gap-2 text-xs">
                      <button
                        type="button"
                        onClick={() => setJoinMode('create')}
                        className={`px-3 py-1 rounded-full ${joinMode === 'create' ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-500'}`}
                      >
                        Create new
                      </button>
                      <button
                        type="button"
                        onClick={() => setJoinMode('join')}
                        className={`px-3 py-1 rounded-full ${joinMode === 'join' ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-500'}`}
                      >
                        Join existing
                      </button>
                    </div>
                  </div>

                  {joinMode === 'create' ? (
                    <div>
                      <label className="block text-sm font-medium text-slate-700">Household name</label>
                      <input
                        type="text"
                        value={householdName}
                        onChange={(e) => setHouseholdName(e.target.value)}
                        className="mt-1 w-full rounded-xl border border-slate-200 px-4 py-2 focus:border-emerald-400 focus:ring-emerald-400"
                        placeholder="Smith Household"
                      />
                      <p className="text-xs text-slate-400 mt-2">You will be the admin for this household.</p>
                    </div>
                  ) : (
                    <div>
                      <label className="block text-sm font-medium text-slate-700">Invite code</label>
                      <input
                        type="text"
                        value={inviteCode}
                        onChange={(e) => setInviteCode(e.target.value)}
                        className="mt-1 w-full rounded-xl border border-slate-200 px-4 py-2 focus:border-emerald-400 focus:ring-emerald-400"
                        placeholder="Household ID"
                      />
                      <p className="text-xs text-slate-400 mt-2">Ask your admin for the household ID.</p>
                    </div>
                  )}
                </div>
              </>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 rounded-xl bg-emerald-600 text-white py-2 font-medium hover:bg-emerald-700 transition disabled:opacity-50"
            >
              {loading ? 'Working...' : mode === 'sign-in' ? 'Sign in' : 'Create account'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
