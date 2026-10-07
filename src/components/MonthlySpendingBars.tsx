import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { formatCurrency } from '../lib/utils'

export interface SpendingMonth { key: string; label: string; amount: number }

export default function MonthlySpendingBars({ months, selectedMonth, onSelect }: { months: SpendingMonth[]; selectedMonth: string; onSelect: (month: string) => void }) {
  const [visible, setVisible] = useState(false)
  const [burstMonth, setBurstMonth] = useState<string | null>(null)
  const rapidTaps = useRef({ key: '', times: [] as number[], cooldown: 0 })
  const burstTimer = useRef<ReturnType<typeof setTimeout>>()
  useEffect(() => () => clearTimeout(burstTimer.current), [])
  const selectMonth = (key: string) => {
    onSelect(key)
    const now = performance.now()
    const taps = rapidTaps.current
    taps.times = taps.key === key ? taps.times.filter(time => now - time <= 1500) : []
    taps.key = key
    taps.times.push(now)
    if (taps.times.length < 5 || now < taps.cooldown || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    taps.times = []
    taps.cooldown = now + 3000
    setBurstMonth(key)
    clearTimeout(burstTimer.current)
    burstTimer.current = setTimeout(() => setBurstMonth(null), 1000)
  }
  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      const next = window.requestAnimationFrame(() => setVisible(true))
      pendingFrame = next
    })
    let pendingFrame = frame
    return () => window.cancelAnimationFrame(pendingFrame)
  }, [])
  const maximum = Math.max(...months.map(month => month.amount), 1)
  const height = (amount: number) => amount > 0 ? Math.max(8, amount / maximum * 100) : 2
  const selected = months.find(month => month.key === selectedMonth)
  return <div className="monetra-bars-with-caption"><div className={`monetra-bars animated-spending-bars ${visible ? 'bars-visible' : ''}`} aria-label="Monthly spending">
    {selected && <div className="monetra-value-guide" aria-hidden="true" style={{ bottom: `calc(40px + 154px * ${visible ? height(selected.amount) / 100 : 0})` }}><span>{formatCurrency(selected.amount)}</span></div>}
    {months.map((month, index) => <button type="button" key={month.key} className={`monetra-month ${selectedMonth === month.key ? 'is-selected' : ''} ${burstMonth === month.key ? 'is-bursting' : ''}`} onClick={() => selectMonth(month.key)} aria-pressed={selectedMonth === month.key} aria-label={`${month.label}: ${formatCurrency(month.amount)}`}>
      <span className="monetra-bar-track"><span className="monetra-bar" style={{ height: `${visible ? height(month.amount) : 0}%`, transitionDelay: visible ? `${index * 35}ms` : '0ms', '--bubble-rise': `${height(month.amount) / 100 * 154 + 12}px` } as CSSProperties}>{selectedMonth === month.key && <span className="monetra-bar-bubbles" aria-hidden="true">{Array.from({ length: 8 }, (_, bubble) => <span key={bubble} className="monetra-bar-bubble" style={{ left: `${14 + (bubble * 23) % 72}%`, width: `${2 + bubble % 3}px`, height: `${2 + bubble % 3}px`, animationDelay: `${-bubble * .63}s`, animationDuration: `${2.8 + bubble % 4 * .45}s` }} />)}</span>}<span className="monetra-bar-marker" /></span>{burstMonth === month.key && <span className="monetra-bar-burst" aria-hidden="true" style={{ bottom: `${height(month.amount) / 2}%` }}>{Array.from({ length: 12 }, (_, particle) => {
        const angle = particle / 12 * Math.PI * 2
        return <i key={particle} style={{ '--burst-x': `${Math.cos(angle) * (30 + particle % 3 * 10)}px`, '--burst-y': `${Math.sin(angle) * (35 + particle % 4 * 12)}px`, '--burst-rotate': `${particle * 65}deg` } as CSSProperties} />
      })}</span>}</span><span className="monetra-month-label">{month.label}</span>
    </button>)}
  </div><p className="monetra-bars-caption">Psst... tap gently, these bars are dramatic!</p></div>
}
