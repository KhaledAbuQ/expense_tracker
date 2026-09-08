import { useAuth } from '../context/AuthContext'
import Mobile from '../pages/Mobile'
import NativeSignIn from './SignIn'
import ResetPasswordModal from '../components/ResetPasswordModal'

export default function NativeApp() {
  const { session, loading, isPasswordRecovery, setIsPasswordRecovery } = useAuth()

  if (loading && !session) {
    return <div role="status" className="flex min-h-dvh items-center justify-center bg-slate-50 text-slate-500">Opening Pocket Expenses…</div>
  }

  return (
    <>
      {session ? <Mobile standalone /> : <NativeSignIn />}
      {isPasswordRecovery && (
        <ResetPasswordModal
          isOpen={isPasswordRecovery}
          onClose={() => setIsPasswordRecovery(false)}
        />
      )}
    </>
  )
}


