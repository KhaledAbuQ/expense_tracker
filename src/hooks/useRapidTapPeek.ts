import { useCallback, useEffect, useRef } from 'react'

export const RAPID_TAP_PEEK_EVENT = 'pocket-rapid-tap-peek'

/** Five taps in a short burst reveal the character; normal selections stay quiet. */
export function useRapidTapPeek() {
  const taps = useRef<number[]>([])
  const cooldownUntil = useRef(0)
  const timer = useRef<ReturnType<typeof setTimeout>>()
  useEffect(() => () => clearTimeout(timer.current), [])
  return useCallback((delay = 0) => {
    const now = performance.now()
    if (now < cooldownUntil.current) return
    taps.current = [...taps.current.filter(time => now - time <= 1500), now]
    if (taps.current.length < 5) return
    taps.current = []
    cooldownUntil.current = now + 9000
    const reveal = () => window.dispatchEvent(new Event(RAPID_TAP_PEEK_EVENT))
    if (delay > 0) timer.current = setTimeout(reveal, delay)
    else reveal()
  }, [])
}
