import { useState } from 'react'
import { Database, Eye, EyeOff, CheckCircle, AlertCircle, RotateCcw, X, ExternalLink, QrCode, ScanLine } from 'lucide-react'
import {
  getActiveSupabaseConfig,
  getEnvConfig,
  saveSupabaseConfig,
  clearSupabaseConfig,
  isValidSupabaseUrl,
} from '../lib/supabase'
import QrScannerModal from './QrScannerModal'
import QrCodeDisplayModal from './QrCodeDisplayModal'
import { ParsedSupabaseConfig } from '../lib/qr'

interface ServerConfigFormProps {
  onCancel?: () => void
  onSaved?: () => void
  title?: string
  subtitle?: string
}

export default function ServerConfigForm({
  onCancel,
  onSaved,
  title = 'Connect your Supabase database',
  subtitle = 'Enter your Supabase project credentials to store and sync your household expenses.',
}: ServerConfigFormProps) {
  const currentConfig = getActiveSupabaseConfig()
  const envConfig = getEnvConfig()

  const [url, setUrl] = useState(currentConfig?.url || '')
  const [anonKey, setAnonKey] = useState(currentConfig?.anonKey || '')
  const [showKey, setShowKey] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [saving, setSaving] = useState(false)
  const [showScanner, setShowScanner] = useState(false)
  const [showQrDisplay, setShowQrDisplay] = useState(false)


  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess('')

    const trimmedUrl = url.trim().replace(/\/+$/, '')
    const trimmedKey = anonKey.trim()

    if (!trimmedUrl) {
      setError('Please enter your Supabase Project URL.')
      return
    }

    if (!isValidSupabaseUrl(trimmedUrl)) {
      setError('Invalid URL. It must begin with https:// (e.g. https://your-project.supabase.co).')
      return
    }

    if (!trimmedKey) {
      setError('Please enter your Supabase Anon / Public Key.')
      return
    }

    setSaving(true)
    try {
      saveSupabaseConfig(trimmedUrl, trimmedKey)
      setSuccess('Configuration saved. Reloading application…')
      setTimeout(() => {
        if (onSaved) {
          onSaved()
        } else {
          window.location.reload()
        }
      }, 400)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save configuration.')
      setSaving(false)
    }
  }

  const handleResetToDefault = () => {
    if (!window.confirm('Reset database connection to the default server?')) return
    clearSupabaseConfig()
    if (onSaved) {
      onSaved()
    } else {
      window.location.reload()
    }
  }

  const handleQrSuccess = (scanned: ParsedSupabaseConfig) => {
    setUrl(scanned.url)
    setAnonKey(scanned.anonKey)
    try {
      saveSupabaseConfig(scanned.url, scanned.anonKey)
      setSuccess('Database connected via QR code! Reloading…')
      setTimeout(() => {
        if (onSaved) onSaved()
        else window.location.reload()
      }, 400)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save scanned credentials.')
    }
  }

  return (
    <div className="w-full max-w-md mx-auto bg-white rounded-2xl shadow-sm border border-slate-200 p-6 sm:p-8">
      <div className="flex items-start justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl">
            <Database className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-900">{title}</h2>
            <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>
          </div>
        </div>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {currentConfig && (
        <div className="mb-5 p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-600 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <div className="truncate">
              <span className="font-semibold text-slate-700">Connected: </span>
              <span className="font-mono text-slate-600">{new URL(currentConfig.url).hostname}</span>
              {currentConfig.isCustom && (
                <span className="ml-2 px-1.5 py-0.5 bg-indigo-100 text-indigo-700 rounded text-[10px] font-medium">
                  Custom
                </span>
              )}
            </div>
            {currentConfig.isCustom && envConfig && (
              <button
                type="button"
                onClick={handleResetToDefault}
                className="inline-flex items-center gap-1 text-indigo-600 hover:text-indigo-700 font-medium shrink-0"
                title="Reset to default build server"
              >
                <RotateCcw className="w-3 h-3" />
                Reset
              </button>
            )}
          </div>
          <button
            type="button"
            onClick={() => setShowQrDisplay(true)}
            className="w-full inline-flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-[11px] font-semibold text-slate-700 transition"
          >
            <QrCode className="w-3.5 h-3.5 text-indigo-600" />
            Show QR Code for Mobile App
          </button>
        </div>
      )}

      {/* QR Code Quick Connect Button */}
      <div className="mb-5">
        <button
          type="button"
          onClick={() => setShowScanner(true)}
          className="w-full inline-flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 active:bg-black text-white font-semibold text-xs shadow-sm transition"
        >
          <ScanLine className="w-4 h-4 text-indigo-400" />
          Scan QR Code from Desktop
        </button>
        <div className="flex items-center gap-3 my-4">
          <div className="flex-1 h-px bg-slate-200" />
          <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">or enter manually</span>
          <div className="flex-1 h-px bg-slate-200" />
        </div>
      </div>

      {error && (
        <div className="mb-5 p-3.5 rounded-xl bg-red-50 border border-red-200 flex items-start gap-2.5 text-sm text-red-700">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0 text-red-500" />
          <p className="break-words">{error}</p>
        </div>
      )}

      {success && (
        <div className="mb-5 p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 flex items-start gap-2.5 text-sm text-emerald-700">
          <CheckCircle className="w-4 h-4 mt-0.5 shrink-0 text-emerald-500" />
          <p>{success}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="supabase-url" className="block text-sm font-medium text-slate-700 mb-1">
            Supabase Project URL
          </label>
          <input
            id="supabase-url"
            type="url"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            required
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://your-project.supabase.co"
            className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-800 placeholder-slate-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none transition"
          />
          <p className="text-[11px] text-slate-400 mt-1">
            From Supabase: Project Settings → API → Project URL
          </p>
        </div>

        <div>
          <label htmlFor="supabase-key" className="block text-sm font-medium text-slate-700 mb-1">
            Supabase Anon / Public Key
          </label>
          <div className="relative">
            <input
              id="supabase-key"
              type={showKey ? 'text' : 'password'}
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              required
              value={anonKey}
              onChange={(e) => setAnonKey(e.target.value)}
              placeholder="eyJhbGciOi..."
              className="w-full rounded-xl border border-slate-200 bg-white pl-3.5 pr-10 py-2.5 text-sm text-slate-800 font-mono placeholder-slate-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none transition"
            />
            <button
              type="button"
              onClick={() => setShowKey(!showKey)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
              title={showKey ? 'Hide key' : 'Show key'}
            >
              {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">
            Only use the public `anon` key. Never enter your secret `service_role` key.
          </p>
        </div>

        <div className="pt-2 flex flex-col gap-2">
          <button
            type="submit"
            disabled={saving}
            className="w-full py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white font-semibold text-sm shadow-sm transition disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Connect Database'}
          </button>

          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="w-full py-2 text-sm font-medium text-slate-600 hover:text-slate-800 transition"
            >
              Back
            </button>
          )}
        </div>
      </form>

      <div className="mt-6 pt-5 border-t border-slate-100">
        <p className="text-xs font-semibold text-slate-700 mb-1.5">First time setting up?</p>
        <ol className="text-[12px] text-slate-500 space-y-1 list-decimal list-inside">
          <li>Create a free account and project at <a href="https://supabase.com" target="_blank" rel="noopener noreferrer" className="text-indigo-600 underline inline-flex items-center gap-0.5">supabase.com <ExternalLink className="w-2.5 h-2.5" /></a>.</li>
          <li>In your Supabase SQL Editor, run the schema script (<code className="font-mono bg-slate-100 px-1 py-0.5 rounded text-[11px]">schema.sql</code>).</li>
          <li>Enable Email authentication in Supabase Auth settings.</li>
        </ol>
      </div>

      {showScanner && (
        <QrScannerModal
          isOpen={showScanner}
          onClose={() => setShowScanner(false)}
          onScanSuccess={handleQrSuccess}
        />
      )}

      {showQrDisplay && (
        <QrCodeDisplayModal
          isOpen={showQrDisplay}
          onClose={() => setShowQrDisplay(false)}
        />
      )}
    </div>
  )
}
