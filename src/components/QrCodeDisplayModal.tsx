import { useEffect, useState } from 'react'
import { Copy, Check, Download } from 'lucide-react'
import toast from 'react-hot-toast'
import Modal from './Modal'
import { generateSupabaseQrPayload, generateQrDataUrl } from '../lib/qr'
import { getActiveSupabaseConfig } from '../lib/supabase'

interface QrCodeDisplayModalProps {
  isOpen: boolean
  onClose: () => void
}

export default function QrCodeDisplayModal({ isOpen, onClose }: QrCodeDisplayModalProps) {
  const activeConfig = getActiveSupabaseConfig()
  const [qrDataUrl, setQrDataUrl] = useState<string>('')
  const [copied, setCopied] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!isOpen || !activeConfig) return

    let isMounted = true
    setLoading(true)

    const payload = generateSupabaseQrPayload(activeConfig.url, activeConfig.anonKey)
    generateQrDataUrl(payload)
      .then((url) => {
        if (isMounted) {
          setQrDataUrl(url)
          setLoading(false)
        }
      })
      .catch((err) => {
        console.error('Failed to generate QR code', err)
        if (isMounted) setLoading(false)
      })

    return () => {
      isMounted = false
    }
  }, [isOpen, activeConfig])

  const handleCopyPayload = async () => {
    if (!activeConfig) return
    const payload = generateSupabaseQrPayload(activeConfig.url, activeConfig.anonKey)
    try {
      await navigator.clipboard.writeText(payload)
      setCopied(true)
      toast.success('Connection credentials copied')
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error('Failed to copy to clipboard')
    }
  }

  const handleDownload = () => {
    if (!qrDataUrl) return
    const a = document.createElement('a')
    a.href = qrDataUrl
    a.download = `pocket-expenses-qr-${new URL(activeConfig?.url || 'https://localhost').hostname}.png`
    a.click()
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Connect Mobile App">
      <div className="space-y-4 text-center">
        <p className="text-xs text-slate-500 text-left">
          Scan this QR code from the Pocket Expenses mobile app to connect to this database instantly without typing.
        </p>

        <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl inline-block mx-auto shadow-inner">
          {loading ? (
            <div className="w-[260px] h-[260px] flex items-center justify-center text-slate-400 text-xs">
              Generating QR code…
            </div>
          ) : qrDataUrl ? (
            <img
              src={qrDataUrl}
              alt="Database Connection QR Code"
              className="w-[260px] h-[260px] rounded-xl mx-auto"
            />
          ) : (
            <div className="w-[260px] h-[260px] flex items-center justify-center text-red-500 text-xs">
              Could not generate QR code
            </div>
          )}
        </div>

        {activeConfig && (
          <div className="p-2.5 rounded-xl bg-slate-100 text-[11px] font-mono text-slate-600 truncate max-w-xs mx-auto">
            {new URL(activeConfig.url).hostname}
          </div>
        )}

        <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100">
          <button
            type="button"
            onClick={handleCopyPayload}
            className="inline-flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl border border-slate-200 hover:bg-slate-50 text-xs font-semibold text-slate-700 transition"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
            {copied ? 'Copied' : 'Copy Credentials'}
          </button>
          <button
            type="button"
            onClick={handleDownload}
            disabled={!qrDataUrl}
            className="inline-flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl border border-slate-200 hover:bg-slate-50 text-xs font-semibold text-slate-700 transition disabled:opacity-50"
          >
            <Download className="w-3.5 h-3.5" />
            Save QR Image
          </button>
        </div>
      </div>
    </Modal>
  )
}
