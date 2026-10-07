import { useEffect, useRef, type ReactNode } from 'react'
import { useToasterStore } from 'react-hot-toast'
import { feedback, type FeedbackKind } from '../lib/haptics'

export default function HapticSurface({ children }: { children: ReactNode }) {
  const lastAction = useRef(0)
  const handled = useRef(new Set<string>())
  const { toasts } = useToasterStore()

  useEffect(() => {
    for (const toast of toasts) {
      if (handled.current.has(toast.id) || !toast.visible || (toast.type !== 'success' && toast.type !== 'error')) continue
      handled.current.add(toast.id)
      if (Date.now() - lastAction.current < 15000) feedback(toast.type)
    }
    const liveIds = new Set(toasts.map(toast => toast.id))
    for (const id of handled.current) if (!liveIds.has(id)) handled.current.delete(id)
  }, [toasts])

  return (
    <div className="pocket-native" onClickCapture={event => {
      if (!(event.target instanceof Element)) return
      const control = event.target.closest<HTMLElement>('button, summary, a[href], [role="button"], [role="tab"], [role="switch"], [data-haptic]')
      if (!control || control.closest(':disabled, [aria-disabled="true"], [inert]')) return
      const configuredKind = control.dataset.haptic
      if (configuredKind === 'off') return
      const kind: FeedbackKind = configuredKind === 'impact' ? 'impact'
        : configuredKind === 'navigation' || control.closest('nav, [role="tablist"]') ? 'navigation'
        : control.matches('button[type="submit"], input[type="submit"]') ? 'impact' : 'selection'
      lastAction.current = Date.now()
      feedback(kind)
    }} onChangeCapture={event => {
      const target = event.target as HTMLElement
      if (target.matches('select, input[type="radio"], input[type="checkbox"]')) {
        lastAction.current = Date.now()
        feedback()
      }
    }} onSubmitCapture={() => {
      lastAction.current = Date.now()
      feedback('impact')
    }}>
      {children}
    </div>
  )
}
