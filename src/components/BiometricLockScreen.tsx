import { useCallback, useEffect, useRef, useState } from 'react'
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
  const inFlight = useRef(false)
  const autoPrompted = useRef(false)

  const promptUnlock = useCallback(async () => {
    if (inFlight.current) return
    inFlight.current = true
    setError(null)
    setAuthenticating(true)
    try {
      const res = await BiometricAuth.authenticate({
        title: 'Unlock Pocket Expenses',
        subtitle: savedEmail ? `Account: ${savedEmail}` : 'Confirm your fingerprint or face',
        cancelText: 'Use Password',
        confirmationRequired: false,
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
      inFlight.current = false
      setAuthenticating(false)
    }
  }, [onUnlock, savedEmail])

  // Auto-prompt on mount
  useEffect(() => {
    if (autoPrompted.current) return
    const timer = setTimeout(() => {
      autoPrompted.current = true
      void promptUnlock()
    }, 100)
    return () => clearTimeout(timer)
  }, [promptUnlock])

  return (
    <main className="mobile-client biometric-lock-screen fixed inset-0 z-50 flex items-center justify-center px-5 py-8">
      <section className="biometric-lock-card w-full max-w-sm text-center">
        <div className="biometric-lock-brand">
          <div className="biometric-lock-wallet"><Wallet size={32} /></div>
          <p>Pocket Expenses</p>
        </div>
        <div className="biometric-lock-status"><span><span aria-hidden="true">●</span> App locked</span></div>
        <p className="biometric-lock-account">
          {savedEmail
            ? <>Signed in as <strong>{savedEmail}</strong>. Authenticate to access your expenses.</>
            : 'Authenticate using biometrics to unlock.'}
        </p>

        <div className="biometric-lock-action">
        <button
          type="button"
          onClick={() => void promptUnlock()}
          disabled={authenticating}
          className="biometric-lock-scan group relative mx-auto flex h-24 w-24 items-center justify-center rounded-full transition hover:scale-105 active:scale-95 disabled:opacity-50"
          aria-label="Unlock with fingerprint or face"
        >
          <span className="biometric-lock-pulse absolute inset-0 rounded-full" />
          <Fingerprint className="relative h-11 w-11 transition group-hover:scale-110" />
        </button>

        <p className="mt-5 text-sm font-medium">
          {authenticating ? 'Look at your phone or touch the fingerprint sensor…' : 'Tap to scan fingerprint or face'}
        </p>
        </div>

        {error && (
          <div className="biometric-lock-error mt-5 flex items-center justify-center gap-2 rounded-2xl border px-4 py-3 text-xs">
            <ShieldAlert className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="biometric-lock-footer">
        <button
          type="button"
          onClick={onSignOut}
          className="inline-flex items-center gap-2 text-xs font-medium transition"
        >
          <LogOut className="h-4 w-4" />
          <span>Use password / Sign out</span>
        </button>
        </div>
      </section>
    </main>
  )
}
