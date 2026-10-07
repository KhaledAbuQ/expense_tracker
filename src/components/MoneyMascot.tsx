import { useEffect, useRef, useState, type CSSProperties } from 'react'
import mascotImage from '../assets/money-mascot.svg'
import { X } from 'lucide-react'
import { MONEY_CELEBRATION_EVENT, replayMoneyCelebration, type MoneyCelebration } from '../lib/moneyCelebration'
import { App } from '@capacitor/app'
import { formatCurrency } from '../lib/utils'

export default function MoneyMascot() {
  const [celebration, setCelebration] = useState<(MoneyCelebration & { id: number }) | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout>>()
  useEffect(() => {
    const receive = (event: Event) => {
      const detail = (event as CustomEvent<MoneyCelebration>).detail
      setCelebration(previous => ({ ...detail, amount: previous?.kind === detail.kind ? previous.amount + detail.amount : detail.amount, id: Date.now() }))
      clearTimeout(timer.current)
      timer.current = setTimeout(() => setCelebration(null), 4500)
    }
    window.addEventListener(MONEY_CELEBRATION_EVENT, receive)
    document.addEventListener('visibilitychange', replayMoneyCelebration)
    const resume = App.addListener('resume', replayMoneyCelebration)
    replayMoneyCelebration()
    return () => { window.removeEventListener(MONEY_CELEBRATION_EVENT, receive); document.removeEventListener('visibilitychange', replayMoneyCelebration); void resume.then(handle => handle.remove()); clearTimeout(timer.current) }
  }, [])
  if (!celebration) return null
  return <aside className="money-mascot" key={celebration.id} aria-label="Money celebration">
    <button type="button" className="money-mascot-dismiss" aria-label="Dismiss celebration" onClick={() => { clearTimeout(timer.current); setCelebration(null) }}><X size={16} /></button>
    <img src={mascotImage} alt="Money mascot celebrating" />
    <div role="status"><strong>{celebration.kind === 'savings' ? 'Savings boosted!' : 'Income received!'}</strong><span>+{formatCurrency(celebration.amount)}</span></div>
    <div className="money-mascot-sparkles" aria-hidden="true">{Array.from({ length: 7 }, (_, index) => <i key={index} style={{ '--spark-index': index } as CSSProperties} />)}</div>
  </aside>
}
