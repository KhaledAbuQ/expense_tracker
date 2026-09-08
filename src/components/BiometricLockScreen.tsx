import { useCallback, useEffect, useState } from 'react'
import { Wallet, Fingerprint, LogOut, ShieldAlert } from 'lucide-react'
import { BiometricAuth } from '../lib/biometrics'

interface BiometricLockScreenProps {
  onUnlock: () => void
  onSignOut: () => void
  savedEmail?: string
}

export default function BiometricLockScreen({
  onUnlock,
  onSignOut,
  savedEmail,
}: BiometricLockScreenProps) {
  const [authenticating, setAuthenticating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const promptUnlock = useCallback(async () => {
    setError(null)
    setAuthenticating(true)
    try {
      const res = await BiometricAuth.authenticate({
        title: 'Unlock Pocket Expenses',
        subtitle: savedEmail ? `Account: ${savedEmail}` : 'Confirm your fingerprint or face',
        cancelText: 'Use Password',
      })

      if (res.success) {
        onUnlock()
      } else if (res.canceled) {
        setError('Unlock canceled. Tap below to retry.')
      } else if (res.error) {
        setError(res.error)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Authentication error')
    } finally {
      setAuthenticating(false)
    }
  }, [onUnlock, savedEmail])

  // Auto-prompt on mount
  useEffect(() => {
    const timer = setTimeout(() => {
      void promptUnlock()
    }, 200)
    return () => clearTimeout(timer)
  }, [promptUnlock])

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-between bg-slate-900 px-6 py-12 text-white">
      <div className="w-full max-w-sm pt-8 text-center">
        <div className="mx-auto mb-5 inline-flex rounded-3xl bg-indigo-600/20 p-5 ring-1 ring-indigo-500/30">
          <Wallet className="h-10 w-10 text-indigo-400" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-white">Pocket Expenses</h1>
        <p className="mt-1 text-xs uppercase tracking-widest text-indigo-400 font-semibold">
          App Locked
        </p>
        <p className="mt-3 text-sm text-slate-400">
          {savedEmail
            ? `Signed in as ${savedEmail}. Authenticate to access your expenses.`
            : 'Authenticate using biometrics to unlock.'}
        </p>
      </div>

      <div className="w-full max-w-sm text-center">
        <button
          type="button"
          onClick={() => void promptUnlock()}
          disabled={authenticating}
          className="group relative mx-auto flex h-24 w-24 items-center justify-center rounded-full bg-indigo-600 text-white shadow-xl shadow-indigo-600/30 transition hover:scale-105 active:scale-95 disabled:opacity-50"
          aria-label="Unlock with fingerprint or face"
        >
          <span className="absolute inset-0 rounded-full animate-ping bg-indigo-500/20" />
          <Fingerprint className="h-12 w-12 text-white transition group-hover:scale-110" />
        </button>

        <p className="mt-6 text-sm font-medium text-slate-300">
          {authenticating ? 'Waiting for biometric sensor…' : 'Tap to scan fingerprint or face'}
        </p>

        {error && (
          <div className="mt-4 flex items-center justify-center gap-2 rounded-xl bg-red-950/60 border border-red-800/60 px-4 py-2.5 text-xs text-red-200">
            <ShieldAlert className="h-4 w-4 shrink-0 text-red-400" />
            <span>{error}</span>
          </div>
        )}
      </div>

      <div className="w-full max-w-sm pb-4 text-center">
        <button
          type="button"
          onClick={onSignOut}
          className="inline-flex items-center gap-2 text-xs font-medium text-slate-400 hover:text-white transition"
        >
          <LogOut className="h-4 w-4" />
          <span>Use password / Sign out</span>
        </button>
      </div>
    </div>
  )
}
