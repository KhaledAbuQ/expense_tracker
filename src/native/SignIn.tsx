import { useCallback, useEffect, useState } from 'react'
import { App } from '@capacitor/app'
import { Wallet, Database, Fingerprint } from 'lucide-react'
import toast from 'react-hot-toast'
import { supabase, isSupabaseConfigured, getActiveSupabaseConfig } from '../lib/supabase'
import ServerConfigForm from '../components/ServerConfigForm'
import { BiometricAuth, checkBiometricStatus, type BiometricAvailability } from '../lib/biometrics'

const PENDING_ONBOARDING_KEY = 'expense_tracker_pending_onboarding'

export default function NativeSignIn() {
  const activeConfig = getActiveSupabaseConfig()
  const [showServerConfig, setShowServerConfig] = useState(!isSupabaseConfigured)
  const [mode, setMode] = useState<'sign-in' | 'sign-up'>('sign-in')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [householdName, setHouseholdName] = useState('')
  const [inviteCode, setInviteCode] = useState('')
  const [joinMode, setJoinMode] = useState<'create' | 'join'>('create')
  const [saving, setSaving] = useState(false)
  const [sendingReset, setSendingReset] = useState(false)
  const [error, setError] = useState('')
  const [biometricStatus, setBiometricStatus] = useState<BiometricAvailability>({
    isAvailable: false,
    isEnrolled: false,
    hasSavedCredentials: false,
  })
  const [enableBiometrics, setEnableBiometrics] = useState(true)
  const [biometricAuthenticating, setBiometricAuthenticating] = useState(false)

  const triggerBiometricSignIn = useCallback(async (savedEmail?: string) => {
    setError('')
    setBiometricAuthenticating(true)
    try {
      const res = await BiometricAuth.authenticateAndGetCredentials({
        title: 'Sign in to Pocket Expenses',
        subtitle: savedEmail ? `Confirm fingerprint or face to sign in as ${savedEmail}` : 'Confirm your biometric identity to sign in',
        cancelText: 'Use password',
      })

      if (res.success && res.email && res.password) {
        setSaving(true)
        const { error: authError } = await supabase.auth.signInWithPassword({
          email: res.email,
          password: res.password,
        })
        if (authError) throw authError
        toast.success('Signed in with biometrics!')
      } else if (res.canceled) {
        // User deliberately canceled or chose password
      } else if (res.error) {
        setError(res.error)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Biometric sign-in failed.')
    } finally {
      setBiometricAuthenticating(false)
      setSaving(false)
    }
  }, [])

  useEffect(() => {
    const listener = App.addListener('backButton', () => {
      if (showServerConfig && isSupabaseConfigured) {
        setShowServerConfig(false)
      } else {
        void App.exitApp()
      }
    })
    return () => {
      void listener.then(handle => handle.remove())
    }
  }, [showServerConfig])

  useEffect(() => {
    let isMounted = true
    void checkBiometricStatus().then(status => {
      if (!isMounted) return
      setBiometricStatus(status)
      if (status.hasSavedCredentials) {
        // Auto-prompt once on arrival
        void triggerBiometricSignIn(status.savedEmail)
      }
    })
    return () => {
      isMounted = false
    }
  }, [triggerBiometricSignIn])


  async function handleForgotPassword() {
    if (!email.trim()) {
      setError('Please enter your email above and tap Forgot password again.')
      return
    }

    setSendingReset(true)
    setError('')
    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: window.location.origin,
      })
      if (resetError) throw resetError
      toast.success('Password recovery email sent! Check your inbox.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send recovery email.')
    } finally {
      setSendingReset(false)
    }
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setError('')

    if (!isSupabaseConfigured) {
      setShowServerConfig(true)
      return
    }

    setSaving(true)
    try {
      if (mode === 'sign-in') {
        const { error: authError } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        })
        if (authError) throw authError

        if (enableBiometrics && biometricStatus.isAvailable) {
          try {
            await BiometricAuth.saveCredentials({ email: email.trim(), password })
          } catch (e) {
            console.warn('Failed to save biometric credentials:', e)
          }
        }
        return
      }

      // Sign up flow
      if (!displayName.trim()) {
        throw new Error('Please enter your name.')
      }

      if (joinMode === 'create' && !householdName.trim()) {
        throw new Error('Please enter a household name.')
      }

      if (joinMode === 'join' && !inviteCode.trim()) {
        throw new Error('Please enter an invite code.')
      }

      const onboardingData =
        joinMode === 'create'
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

      const { data, error: signUpError } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: onboardingData,
        },
      })

      if (signUpError) throw signUpError

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
        toast.success('Account created!')
        return
      }

      toast.success('Account created! Check your email if verification is required.')
      setMode('sign-in')
      setPassword('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Authentication failed. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  if (showServerConfig || !isSupabaseConfigured) {
    return (
      <main className="mobile-client flex min-h-dvh items-center bg-slate-50 px-5 py-10">
        <div className="w-full max-w-sm mx-auto">
          <ServerConfigForm
            onCancel={isSupabaseConfigured ? () => setShowServerConfig(false) : undefined}
            title="Database Setup"
            subtitle="Connect your Supabase project to use Pocket Expenses on this device."
          />
        </div>
      </main>
    )
  }

  const serverHostname = activeConfig ? new URL(activeConfig.url).hostname : ''

  return (
    <main className="mobile-client flex min-h-dvh items-center bg-slate-50 px-6 py-10">
      <div className="mx-auto w-full max-w-sm">
        <div className="mb-6">
          <div className="mb-4 inline-flex rounded-2xl bg-indigo-600 p-3.5 text-white">
            <Wallet size={28} />
          </div>
          <p className="text-xs font-semibold uppercase tracking-widest text-indigo-600">Pocket expenses</p>
          <h1 className="mt-2 text-2xl font-bold">
            {mode === 'sign-in' ? 'Welcome back' : 'Create account'}
          </h1>
          <p className="mt-2 text-sm leading-5 text-slate-500">
            {mode === 'sign-in'
              ? 'Sign in to access your household budget and add expenses.'
              : 'Create a household ledger or join an existing household.'}
          </p>
        </div>

        {mode === 'sign-in' && biometricStatus.hasSavedCredentials && (
          <div className="mb-6">
            <button
              type="button"
              onClick={() => void triggerBiometricSignIn(biometricStatus.savedEmail)}
              disabled={saving || biometricAuthenticating}
              className="w-full flex items-center justify-center gap-3 rounded-2xl bg-indigo-50 border-2 border-indigo-200 py-3.5 px-4 font-semibold text-indigo-700 hover:bg-indigo-100 transition shadow-sm disabled:opacity-50"
            >
              <Fingerprint className="w-5 h-5 text-indigo-600" />
              <span>
                {biometricAuthenticating
                  ? 'Verifying…'
                  : biometricStatus.savedEmail
                    ? `Sign in as ${biometricStatus.savedEmail}`
                    : 'Sign in with Biometrics'}
              </span>
            </button>
            <div className="relative my-4 text-center text-xs text-slate-400 before:absolute before:inset-0 before:top-1/2 before:border-t before:border-slate-200">
              <span className="relative bg-slate-50 px-3">or use password</span>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="email" className="mb-1.5 block text-sm font-medium">Email</label>
            <input
              id="email"
              type="email"
              autoComplete="username"
              autoCapitalize="none"
              spellCheck={false}
              required
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label htmlFor="password" className="block text-sm font-medium">Password</label>
              {mode === 'sign-in' && (
                <button
                  type="button"
                  onClick={handleForgotPassword}
                  disabled={sendingReset}
                  className="text-xs text-indigo-600 hover:text-indigo-700 font-medium disabled:opacity-50"
                >
                  {sendingReset ? 'Sending…' : 'Forgot password?'}
                </button>
              )}
            </div>
            <input
              id="password"
              type="password"
              autoComplete={mode === 'sign-in' ? 'current-password' : 'new-password'}
              required
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm"
            />
          </div>

          {mode === 'sign-in' && biometricStatus.isAvailable && (
            <label className="flex items-center gap-2 pt-1 text-xs text-slate-600 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={enableBiometrics}
                onChange={e => setEnableBiometrics(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
              />
              <span>Remember with Fingerprint / Face Unlock</span>
            </label>
          )}

          {mode === 'sign-up' && (
            <>
              <div>
                <label htmlFor="display-name" className="mb-1.5 block text-sm font-medium">Your name</label>
                <input
                  id="display-name"
                  type="text"
                  required
                  value={displayName}
                  onChange={e => setDisplayName(e.target.value)}
                  placeholder="e.g. Alex"
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm"
                />
              </div>

              <div className="rounded-xl border border-slate-200 p-3 space-y-3 bg-white">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-slate-700">Household</span>
                  <div className="flex gap-1.5">
                    <button
                      type="button"
                      onClick={() => setJoinMode('create')}
                      className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                        joinMode === 'create' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      Create
                    </button>
                    <button
                      type="button"
                      onClick={() => setJoinMode('join')}
                      className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                        joinMode === 'join' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      Join
                    </button>
                  </div>
                </div>

                {joinMode === 'create' ? (
                  <div>
                    <label htmlFor="household-name" className="mb-1 block text-xs font-medium text-slate-600">Household name</label>
                    <input
                      id="household-name"
                      type="text"
                      required
                      value={householdName}
                      onChange={e => setHouseholdName(e.target.value)}
                      placeholder="e.g. Smith Household"
                      className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs"
                    />
                  </div>
                ) : (
                  <div>
                    <label htmlFor="invite-code" className="mb-1 block text-xs font-medium text-slate-600">8-character invite code</label>
                    <input
                      id="invite-code"
                      type="text"
                      required
                      value={inviteCode}
                      onChange={e => setInviteCode(e.target.value.toUpperCase())}
                      placeholder="ABCD2345"
                      className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 font-mono uppercase tracking-widest text-xs"
                    />
                  </div>
                )}
              </div>
            </>
          )}

          {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-xs text-red-700">{error}</p>}

          <button
            type="submit"
            disabled={saving}
            className="w-full rounded-xl bg-indigo-600 px-4 py-3 font-semibold text-white text-sm disabled:opacity-50 transition"
          >
            {saving ? 'Please wait…' : mode === 'sign-in' ? 'Sign in' : 'Create account'}
          </button>
        </form>

        <div className="mt-5 text-center">
          <button
            type="button"
            onClick={() => {
              setMode(mode === 'sign-in' ? 'sign-up' : 'sign-in')
              setError('')
            }}
            className="text-xs font-medium text-indigo-600 hover:text-indigo-700"
          >
            {mode === 'sign-in' ? "Don't have an account? Create one" : 'Already have an account? Sign in'}
          </button>
        </div>

        <div className="mt-8 border-t border-slate-200 pt-5 text-center">
          <div className="flex items-center justify-center gap-1.5 text-xs text-slate-500">
            <Database className="w-3.5 h-3.5 text-indigo-500" />
            <span className="truncate max-w-[200px]" title={activeConfig?.url}>
              {serverHostname}
            </span>
            {activeConfig?.isCustom && (
              <span className="px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 text-[10px] font-medium">
                Custom
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={() => setShowServerConfig(true)}
            className="mt-1 text-xs font-medium text-indigo-600 hover:text-indigo-700"
          >
            Change database server
          </button>
        </div>
      </div>
    </main>
  )
}

