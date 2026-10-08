import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import peekImage from '../assets/character-top-looking-around.svg'
import { RAPID_TAP_PEEK_EVENT } from '../hooks/useRapidTapPeek'

export default function RapidTapPeek() {
  const [visible, setVisible] = useState(false)
  const cooldownUntil = useRef(0)
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined
    const reveal = () => {
      const now = performance.now()
      if (now < cooldownUntil.current || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
      cooldownUntil.current = now + 9000
      setVisible(true)
      // The supplied SVG peeks and retreats during its six-second animation.
      timer = setTimeout(() => setVisible(false), 6000)
    }
    window.addEventListener(RAPID_TAP_PEEK_EVENT, reveal)
    return () => { window.removeEventListener(RAPID_TAP_PEEK_EVENT, reveal); clearTimeout(timer) }
  }, [])
  if (!visible) return null
  return createPortal(<div className="rapid-tap-peek" aria-hidden="true"><img src={peekImage} alt="" draggable={false} /></div>, document.body)
}
