import { useCallback, useEffect, useRef, useState } from 'react'
import { App } from '@capacitor/app'
import { useAuth } from '../context/AuthContext'
import Mobile from '../pages/Mobile'
import NativeSignIn from './SignIn'
import ResetPasswordModal from '../components/ResetPasswordModal'
import BiometricLockScreen from '../components/BiometricLockScreen'
import { checkBiometricStatus, type BiometricAvailability } from '../lib/biometrics'

export default function NativeApp() {
  const { session, loading, isPasswordRecovery, setIsPasswordRecovery, signOut } = useAuth()
  const [biometricStatus, setBiometricStatus] = useState<BiometricAvailability | null>(null)
  const [isLocked, setIsLocked] = useState(true)
  const [biometricCheckedUser, setBiometricCheckedUser] = useState<string>()
  const lastPausedRef = useRef<number | null>(null)
  const handleUnlock = useCallback(() => setIsLocked(false), [])
  const handleSignOut = useCallback(() => { setIsLocked(true); void signOut() }, [signOut])

  // Check if biometric lock is configured on this device
  useEffect(() => {
    let isMounted = true
    void checkBiometricStatus().then(status => {
      if (!isMounted) return
      setBiometricStatus(status)
      setBiometricCheckedUser(session?.user.id)
      // If biometrics is NOT enabled or enrolled, don't lock
      if (!status.hasSavedCredentials || (status.authenticatedRecently && status.savedEmail === session?.user.email)) {
        setIsLocked(false)
      }
    })
    return () => {
      isMounted = false
    }
  }, [session])

  // Re-lock when app is resumed after being backgrounded for over 5 seconds
  useEffect(() => {
    const pauseSub = App.addListener('pause', () => {
      lastPausedRef.current = Date.now()
    })

    const resumeSub = App.addListener('resume', () => {
      const pausedAt = lastPausedRef.current
      lastPausedRef.current = null
      if (pausedAt && Date.now() - pausedAt > 5000) {
        if (biometricStatus?.hasSavedCredentials) {
          setIsLocked(true)
        }
      }
    })

    return () => {
      void pauseSub.then(h => h.remove())
      void resumeSub.then(h => h.remove())
    }
  }, [biometricStatus])

  if (loading && !session) {
    return <div role="status" className="flex min-h-dvh items-center justify-center bg-slate-50 dark:bg-slate-950 text-slate-500 dark:text-gray-400">Opening Pocket Expenses…</div>
  }

  // Not signed in -> show sign in
  if (!session) {
    return (
      <>
        <NativeSignIn />
        {isPasswordRecovery && (
          <ResetPasswordModal
            isOpen={isPasswordRecovery}
            onClose={() => setIsPasswordRecovery(false)}
          />
        )}
      </>
    )
  }

  // Wait for the lock policy before displaying any signed-in financial content.
  if (!biometricStatus || biometricCheckedUser !== session.user.id) return <div role="status" className="flex min-h-dvh items-center justify-center bg-slate-50 dark:bg-slate-950 text-slate-500 dark:text-gray-400">Opening Pocket Expenses…</div>

  // Signed in, but biometrics enabled and currently locked -> show Lock Screen
  if (isLocked && biometricStatus?.hasSavedCredentials) {
    return (
      <BiometricLockScreen
        onUnlock={handleUnlock}
        onSignOut={handleSignOut}
        savedEmail={biometricStatus.savedEmail || session.user?.email}
      />
    )
  }

  return (
    <>
      <Mobile
        standalone
        onLock={biometricStatus?.hasSavedCredentials ? () => setIsLocked(true) : undefined}
      />
      {isPasswordRecovery && (
        <ResetPasswordModal
          isOpen={isPasswordRecovery}
          onClose={() => setIsPasswordRecovery(false)}
        />
      )}
    </>
  )
}


