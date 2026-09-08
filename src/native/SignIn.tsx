import { useEffect, useState } from 'react'
import { App } from '@capacitor/app'
import { Wallet } from 'lucide-react'
import { supabase } from '../lib/supabase'

export default function NativeSignIn() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const listener = App.addListener('backButton', () => { void App.exitApp() })
    return () => { void listener.then(handle => handle.remove()) }
  }, [])

  async function signIn(event: React.FormEvent) {
    event.preventDefault()
    setError('')
    setSaving(true)
    try {
      const { error: authError } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
      if (authError) throw authError
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not sign in. Check your connection and try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <main className="mobile-client flex min-h-dvh items-center bg-slate-50 px-6 py-10">
      <div className="mx-auto w-full max-w-sm">
        <div className="mb-8">
          <div className="mb-6 inline-flex rounded-2xl bg-indigo-600 p-4 text-white"><Wallet size={30} /></div>
          <p className="text-xs font-semibold uppercase tracking-widest text-indigo-600">Pocket expenses</p>
          <h1 className="mt-3 text-3xl font-bold">Welcome back</h1>
          <p className="mt-3 text-sm leading-6 text-slate-500">Sign in with your existing household account to see your spending and add expenses.</p>
        </div>
        <form onSubmit={signIn} className="space-y-5">
          <div>
            <label htmlFor="email" className="mb-2 block text-sm font-medium">Email</label>
            <input id="email" type="email" autoComplete="username" autoCapitalize="none" spellCheck={false} required value={email} onChange={e => setEmail(e.target.value)} className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3" />
          </div>
          <div>
            <label htmlFor="password" className="mb-2 block text-sm font-medium">Password</label>
            <input id="password" type="password" autoComplete="current-password" required value={password} onChange={e => setPassword(e.target.value)} className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3" />
          </div>
          {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
          <button type="submit" disabled={saving} className="w-full rounded-xl bg-indigo-600 px-4 py-3 font-semibold text-white disabled:opacity-50">{saving ? 'Signing in…' : 'Sign in'}</button>
        </form>
      </div>
    </main>
  )
}
