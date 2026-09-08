import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Database, Fingerprint } from 'lucide-react'
import toast from 'react-hot-toast'
import { supabase, isSupabaseConfigured, getActiveSupabaseConfig } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import ServerConfigForm from '../components/ServerConfigForm'
import ResetPasswordModal from '../components/ResetPasswordModal'
import { BiometricAuth, checkBiometricStatus, type BiometricAvailability } from '../lib/biometrics'
import ThemeToggle from '../components/ThemeToggle'

type Mode = 'sign-in' | 'sign-up'

const PENDING_ONBOARDING_KEY = 'expense_tracker_pending_onboarding'

export default function AuthPage() {
  const activeConfig = getActiveSupabaseConfig()
  const [showServerConfig, setShowServerConfig] = useState(!isSupabaseConfigured)
  const [mode, setMode] = useState<Mode>('sign-in')
  const [loading, setLoading] = useState(false)
  const [sendingReset, setSendingReset] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [householdName, setHouseholdName] = useState('')
  const [inviteCode, setInviteCode] = useState('')
  const [joinMode, setJoinMode] = useState<'create' | 'join'>('create')
  const [biometricStatus, setBiometricStatus] = useState<BiometricAvailability>({
    isAvailable: false,
    isEnrolled: false,
    hasSavedCredentials: false,
  })
  const [enableBiometrics, setEnableBiometrics] = useState(true)
  const [biometricAuthenticating, setBiometricAuthenticating] = useState(false)
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const destination = searchParams.get('next') === 'mobile' ? '/mobile' : '/'
  const { session, isPasswordRecovery, setIsPasswordRecovery } = useAuth()

  // Don't show a login form to someone who is already signed in (unless in recovery).
  useEffect(() => {
    if (session && !isPasswordRecovery) navigate(destination, { replace: true })
  }, [session, navigate, destination, isPasswordRecovery])

  const triggerBiometricSignIn = useCallback(async (savedEmail?: string) => {
    setBiometricAuthenticating(true)
    try {
      const res = await BiometricAuth.authenticateAndGetCredentials({
        title: 'Sign in to Pocket Expenses',
        subtitle: savedEmail ? `Confirm fingerprint or face to sign in as ${savedEmail}` : 'Confirm your biometric identity',
        cancelText: 'Use password',
      })

      if (res.success && res.email && res.password) {
        setLoading(true)
        const { error } = await supabase.auth.signInWithPassword({
          email: res.email,
          password: res.password,
        })
        if (error) throw error
        toast.success('Signed in with biometrics!')
        navigate(destination)
      } else if (res.canceled) {
        // User cancelled or chose password
      } else if (res.error) {
        toast.error(res.error)
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Biometric authentication failed')
    } finally {
      setBiometricAuthenticating(false)
      setLoading(false)
    }
  }, [destination, navigate])

  useEffect(() => {
    let isMounted = true
    void checkBiometricStatus().then(status => {
      if (!isMounted) return
      setBiometricStatus(status)
      if (status.hasSavedCredentials) {
        void triggerBiometricSignIn(status.savedEmail)
      }
    })
    return () => {
      isMounted = false
    }
  }, [triggerBiometricSignIn])

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

        if (enableBiometrics && biometricStatus.isAvailable) {
          try {
            await BiometricAuth.saveCredentials({ email: email.trim(), password })
          } catch (e) {
            console.warn('Failed to save biometric credentials:', e)
          }
        }

        navigate(destination)
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
            invite_code: inviteCode.trim().toUpperCase(),
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
        navigate(destination)
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

  const handleForgotPassword = async () => {
    if (!email.trim()) {
      toast.error('Please enter your email first.')
      return
    }

    setSendingReset(true)
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: window.location.origin + '/auth',
      })
      if (error) throw error
      toast.success('Password recovery email sent! Check your inbox.')
    } catch (err) {
      toast.error(getErrorMessage(err))
    } finally {
      setSendingReset(false)
    }
  }

  const getErrorMessage = (err: unknown) => {
    if (!err || typeof err !== 'object') {
      return 'Authentication failed'
    }

    return err instanceof Error ? err.message : 'Authentication failed'
  }


  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-emerald-50 dark:from-gray-950 dark:via-gray-900 dark:to-slate-950 flex items-center justify-center p-4 sm:p-6 lg:p-12 relative transition-colors">
      <div className="fixed top-4 right-4 z-50">
        <ThemeToggle variant="dropdown" />
      </div>

      <div className="w-full max-w-4xl grid grid-cols-1 lg:grid-cols-[1.1fr_1fr] bg-white dark:bg-gray-800 shadow-xl rounded-2xl sm:rounded-3xl overflow-hidden border border-gray-100 dark:border-gray-700">
        <div className="bg-gradient-to-br from-slate-900 via-slate-900 to-emerald-900 dark:from-slate-950 dark:via-gray-900 dark:to-emerald-950 text-white p-6 sm:p-8 lg:p-10 flex flex-col justify-between">
          <div>
            <p className="text-xs sm:text-sm uppercase tracking-[0.3em] text-emerald-300">Household Ledger</p>
            <h1 className="text-2xl sm:text-3xl font-semibold mt-3 sm:mt-6 leading-tight">Keep every member in sync with shared household spending.</h1>
            <p className="mt-2 sm:mt-4 text-xs sm:text-sm text-emerald-100/80">
              Personal expenses stay private. Household expenses are visible to everyone so the budget stays fair.
            </p>
          </div>
          <div className="hidden sm:grid mt-6 lg:mt-10 grid-cols-2 gap-4 text-xs text-emerald-200/90">
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

        <div className="p-6 sm:p-8 lg:p-10 bg-white dark:bg-gray-800">
          {showServerConfig || !isSupabaseConfigured ? (
            <ServerConfigForm
              onCancel={isSupabaseConfigured ? () => setShowServerConfig(false) : undefined}
              title="Database Setup"
              subtitle="Connect your own Supabase project URL and anon public key."
            />
          ) : (
            <>
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-semibold text-slate-900 dark:text-white">{title}</h2>
                  <p className="text-sm text-slate-500 dark:text-gray-400 mt-1">{subtitle}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setMode(mode === 'sign-in' ? 'sign-up' : 'sign-in')}
                  className="text-sm text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 font-medium"
                >
                  {mode === 'sign-in' ? 'Create account' : 'Back to sign in'}
                </button>
              </div>

              {mode === 'sign-in' && biometricStatus.hasSavedCredentials && (
                <div className="mt-6">
                  <button
                    type="button"
                    onClick={() => void triggerBiometricSignIn(biometricStatus.savedEmail)}
                    disabled={loading || biometricAuthenticating}
                    className="w-full flex items-center justify-center gap-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border-2 border-emerald-200 dark:border-emerald-800 py-3 px-4 font-medium text-emerald-800 dark:text-emerald-200 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 transition shadow-sm disabled:opacity-50"
                  >
                    <Fingerprint className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                    <span>
                      {biometricAuthenticating
                        ? 'Authenticating…'
                        : biometricStatus.savedEmail
                          ? `Sign in with Biometrics (${biometricStatus.savedEmail})`
                          : 'Sign in with Biometrics'}
                    </span>
                  </button>
                  <div className="relative my-4 text-center text-xs text-slate-400 dark:text-gray-500 before:absolute before:inset-0 before:top-1/2 before:border-t before:border-slate-200 dark:before:border-gray-700">
                    <span className="relative bg-white dark:bg-gray-800 px-3">or continue with password</span>
                  </div>
                </div>
              )}

              <form onSubmit={handleSubmit} className={`${mode === 'sign-in' && biometricStatus.hasSavedCredentials ? 'mt-2' : 'mt-8'} space-y-4`}>
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-slate-700 dark:text-gray-300">Email</label>
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="mt-1 w-full rounded-xl border border-slate-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-slate-900 dark:text-white px-4 py-2 focus:border-emerald-400 focus:ring-emerald-400"
                    placeholder="you@example.com"
                  />
                </div>
                <div>
                  <div className="flex items-center justify-between">
                    <label htmlFor="password" className="block text-sm font-medium text-slate-700 dark:text-gray-300">Password</label>
                    {mode === 'sign-in' && (
                      <button
                        type="button"
                        onClick={handleForgotPassword}
                        disabled={sendingReset}
                        className="text-xs text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 font-medium disabled:opacity-50"
                      >
                        {sendingReset ? 'Sending…' : 'Forgot password?'}
                      </button>
                    )}
                  </div>
                  <input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="mt-1 w-full rounded-xl border border-slate-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-slate-900 dark:text-white px-4 py-2 focus:border-emerald-400 focus:ring-emerald-400"
                    placeholder="••••••••"
                  />
                </div>

                {mode === 'sign-in' && biometricStatus.isAvailable && (
                  <label className="flex items-center gap-2 pt-1 text-xs text-slate-600 dark:text-gray-300 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={enableBiometrics}
                      onChange={e => setEnableBiometrics(e.target.checked)}
                      className="h-4 w-4 rounded border-slate-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-emerald-600 focus:ring-emerald-500"
                    />
                    <span>Remember with Fingerprint / Face Unlock</span>
                  </label>
                )}

                {mode === 'sign-up' && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-gray-300">Your name</label>
                      <input
                        type="text"
                        value={displayName}
                        onChange={(e) => setDisplayName(e.target.value)}
                        className="mt-1 w-full rounded-xl border border-slate-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-slate-900 dark:text-white px-4 py-2 focus:border-emerald-400 focus:ring-emerald-400"
                        placeholder="Alex"
                      />
                    </div>

                    <div className="rounded-2xl border border-slate-200 dark:border-gray-700 p-4 space-y-4">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium text-slate-700 dark:text-gray-300">Household</p>
                        <div className="flex gap-2 text-xs">
                          <button
                            type="button"
                            onClick={() => setJoinMode('create')}
                            className={`px-3 py-1 rounded-full ${joinMode === 'create' ? 'bg-emerald-600 text-white' : 'bg-slate-100 dark:bg-gray-700 text-slate-500 dark:text-gray-400'}`}
                          >
                            Create new
                          </button>
                          <button
                            type="button"
                            onClick={() => setJoinMode('join')}
                            className={`px-3 py-1 rounded-full ${joinMode === 'join' ? 'bg-emerald-600 text-white' : 'bg-slate-100 dark:bg-gray-700 text-slate-500 dark:text-gray-400'}`}
                          >
                            Join existing
                          </button>
                        </div>
                      </div>

                      {joinMode === 'create' ? (
                        <div>
                          <label className="block text-sm font-medium text-slate-700 dark:text-gray-300">Household name</label>
                          <input
                            type="text"
                            value={householdName}
                            onChange={(e) => setHouseholdName(e.target.value)}
                            className="mt-1 w-full rounded-xl border border-slate-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-slate-900 dark:text-white px-4 py-2 focus:border-emerald-400 focus:ring-emerald-400"
                            placeholder="Smith Household"
                          />
                          <p className="text-xs text-slate-400 dark:text-gray-500 mt-2">You will be the admin for this household.</p>
                        </div>
                      ) : (
                        <div>
                          <label className="block text-sm font-medium text-slate-700 dark:text-gray-300">Invite code</label>
                          <input
                            type="text"
                            value={inviteCode}
                            onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                            className="mt-1 w-full rounded-xl border border-slate-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-slate-900 dark:text-white px-4 py-2 font-mono tracking-widest uppercase focus:border-emerald-400 focus:ring-emerald-400"
                            placeholder="ABCD2345"
                            autoComplete="off"
                            spellCheck={false}
                          />
                          <p className="text-xs text-slate-400 dark:text-gray-500 mt-2">Ask a household admin for the invite code.</p>
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

              {activeConfig && (
                <div className="mt-8 pt-5 border-t border-slate-100 dark:border-gray-700 flex items-center justify-between text-xs text-slate-500 dark:text-gray-400">
                  <div className="truncate flex items-center gap-1.5">
                    <Database className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    <span className="truncate max-w-[180px] font-mono text-slate-700 dark:text-gray-300">{new URL(activeConfig.url).hostname}</span>
                    {activeConfig.isCustom && (
                      <span className="px-1.5 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 text-[10px] font-medium">
                        Custom
                      </span>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowServerConfig(true)}
                    className="text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 font-medium shrink-0 ml-2"
                  >
                    Change server
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {isPasswordRecovery && (
        <ResetPasswordModal
          isOpen={isPasswordRecovery}
          onClose={() => setIsPasswordRecovery(false)}
        />
      )}
    </div>
  )
}
