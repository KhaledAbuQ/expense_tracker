import { useEffect, useRef, useState } from 'react'
import { Camera, Upload, AlertCircle, RefreshCw, CheckCircle2 } from 'lucide-react'
import jsQR from 'jsqr'
import Modal from './Modal'
import { parseSupabaseQrCode, ParsedSupabaseConfig } from '../lib/qr'

interface QrScannerModalProps {
  isOpen: boolean
  onClose: () => void
  onScanSuccess: (config: ParsedSupabaseConfig) => void
}

export default function QrScannerModal({
  isOpen,
  onClose,
  onScanSuccess,
}: QrScannerModalProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const animationFrameRef = useRef<number | null>(null)

  const [cameraError, setCameraError] = useState('')
  const [parsingError, setParsingError] = useState('')
  const [success, setSuccess] = useState<ParsedSupabaseConfig | null>(null)
  const [scanning, setScanning] = useState(false)

  const stopCamera = () => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current)
      animationFrameRef.current = null
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop())
      streamRef.current = null
    }
    setScanning(false)
  }

  const handleDetectedCode = (codeText: string) => {
    const parsed = parseSupabaseQrCode(codeText)
    if (parsed) {
      stopCamera()
      setSuccess(parsed)
      try {
        if (navigator.vibrate) navigator.vibrate(100)
      } catch {
        // Ignore vibration error
      }
      setTimeout(() => {
        onScanSuccess(parsed)
        onClose()
      }, 600)
    } else {
      setParsingError('Found QR code, but it did not contain valid Supabase connection details.')
      setTimeout(() => setParsingError(''), 4000)
    }
  }

  const startCamera = async () => {
    setCameraError('')
    setParsingError('')
    stopCamera()

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Camera access is not supported on this browser or device.')
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      })

      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        // Required for iOS / Android WebView inline playback
        videoRef.current.setAttribute('playsinline', 'true')
        await videoRef.current.play()
        setScanning(true)
        scanFrame()
      }
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : 'Could not access the camera. Please check camera permissions.'
      setCameraError(message)
    }
  }

  const scanFrame = () => {
    const video = videoRef.current
    const canvas = canvasRef.current

    if (!video || !canvas || video.readyState !== video.HAVE_ENOUGH_DATA) {
      animationFrameRef.current = requestAnimationFrame(scanFrame)
      return
    }

    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    if (!ctx) {
      animationFrameRef.current = requestAnimationFrame(scanFrame)
      return
    }

    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height)

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
    const code = jsQR(imageData.data, imageData.width, imageData.height, {
      inversionAttempts: 'dontInvert',
    })

    if (code && code.data) {
      handleDetectedCode(code.data)
      return
    }

    animationFrameRef.current = requestAnimationFrame(scanFrame)
  }

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setParsingError('')
    const img = new Image()
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = img.width
      canvas.height = img.height
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        setParsingError('Failed to process image.')
        return
      }
      ctx.drawImage(img, 0, 0)
      const imageData = ctx.getImageData(0, 0, img.width, img.height)
      const code = jsQR(imageData.data, imageData.width, imageData.height)

      if (code && code.data) {
        handleDetectedCode(code.data)
      } else {
        setParsingError('No QR code detected in this image. Please try another screenshot or image.')
      }
    }
    img.onerror = () => {
      setParsingError('Could not load image file.')
    }
    img.src = URL.createObjectURL(file)
  }

  useEffect(() => {
    if (isOpen) {
      startCamera()
    } else {
      stopCamera()
      setSuccess(null)
      setCameraError('')
      setParsingError('')
    }
    return () => {
      stopCamera()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen])

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Scan Supabase QR Code">
      <div className="space-y-4">
        <p className="text-xs text-slate-500 dark:text-gray-400">
          Point your camera at the QR code displayed on your desktop web app or another household device.
        </p>

        {success ? (
          <div className="p-6 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-center space-y-2">
            <CheckCircle2 className="w-10 h-10 text-emerald-600 dark:text-emerald-400 mx-auto animate-bounce" />
            <h4 className="font-semibold text-emerald-900 dark:text-emerald-200 text-sm">QR Code Recognized!</h4>
            <p className="text-xs text-emerald-700 dark:text-emerald-300 font-mono break-all">{success.url}</p>
            <p className="text-xs text-emerald-600 dark:text-emerald-400">Connecting database…</p>
          </div>
        ) : (
          <div className="relative overflow-hidden rounded-2xl bg-black aspect-square max-w-[320px] mx-auto flex items-center justify-center">
            <video
              ref={videoRef}
              className={`w-full h-full object-cover ${cameraError ? 'hidden' : ''}`}
            />
            <canvas ref={canvasRef} className="hidden" />

            {/* Viewfinder Target Frame Overlay */}
            {!cameraError && scanning && (
              <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                <div className="w-48 h-48 border-2 border-indigo-400/80 rounded-2xl relative shadow-[0_0_0_9999px_rgba(0,0,0,0.45)]">
                  {/* Glowing scan line */}
                  <div className="absolute inset-x-0 h-0.5 bg-indigo-400 shadow-[0_0_8px_#818cf8] animate-pulse top-1/2 -translate-y-1/2" />
                  <div className="absolute -top-1 -left-1 w-4 h-4 border-t-2 border-l-2 border-indigo-300 rounded-tl" />
                  <div className="absolute -top-1 -right-1 w-4 h-4 border-t-2 border-r-2 border-indigo-300 rounded-tr" />
                  <div className="absolute -bottom-1 -left-1 w-4 h-4 border-b-2 border-l-2 border-indigo-300 rounded-bl" />
                  <div className="absolute -bottom-1 -right-1 w-4 h-4 border-b-2 border-r-2 border-indigo-300 rounded-br" />
                </div>
              </div>
            )}

            {cameraError && (
              <div className="p-6 text-center text-white space-y-3">
                <Camera className="w-10 h-10 text-slate-400 mx-auto" />
                <p className="text-xs text-slate-300">{cameraError}</p>
                <button
                  type="button"
                  onClick={startCamera}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/20 hover:bg-white/30 text-xs font-medium transition"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  Retry Camera
                </button>
              </div>
            )}
          </div>
        )}

        {parsingError && (
          <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 flex items-start gap-2 text-xs text-amber-800 dark:text-amber-200">
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0 text-amber-600 dark:text-amber-400" />
            <p>{parsingError}</p>
          </div>
        )}

        <div className="pt-2 border-t border-slate-100 dark:border-gray-700 flex flex-col gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileUpload}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl border border-slate-200 dark:border-gray-600 hover:bg-slate-50 dark:hover:bg-gray-700 text-slate-700 dark:text-gray-200 text-xs font-semibold transition"
          >
            <Upload className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            Scan from Image or Screenshot
          </button>
          <button
            type="button"
            onClick={onClose}
            className="w-full py-2 text-xs font-medium text-slate-500 dark:text-gray-400 hover:text-slate-700 dark:hover:text-gray-200 transition"
          >
            Cancel
          </button>
        </div>
      </div>
    </Modal>
  )
}
