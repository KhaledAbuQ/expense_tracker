import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import { addDays, format, startOfDay } from 'date-fns'

const characterUrls = import.meta.glob<string>('../assets/peep/*.png', {
  eager: true,
  import: 'default',
  query: '?url',
})
const characters = Object.keys(characterUrls).sort()
const storageKey = 'pocket_home_peep'

function dailyCharacter() {
  const day = format(new Date(), 'yyyy-MM-dd')
  // Use the date as a fallback when storage is unavailable.
  const dayIndex = Date.parse(day) / 86_400_000
  const fallback = characters[((dayIndex % characters.length) + characters.length) % characters.length]

  try {
    const saved = JSON.parse(localStorage.getItem(storageKey) ?? 'null')
    if (saved?.day === day && characters.includes(saved.character)) return saved.character as string

    const choices = characters.filter(character => character !== saved?.character)
    const character = choices[Math.floor(Math.random() * choices.length)]
    localStorage.setItem(storageKey, JSON.stringify({ day, character }))
    return character
  } catch {
    return fallback
  }
}

export default function HomePeep() {
  const [character, setCharacter] = useState(dailyCharacter)
  const [flight, setFlight] = useState<{ x: number; y: number; dx: number; dy: number; source: string } | null>(null)
  const taps = useRef<number[]>([])
  const returnTimer = useRef<ReturnType<typeof setTimeout>>()
  useEffect(() => () => clearTimeout(returnTimer.current), [])

  useEffect(() => {
    let timer: number
    const refresh = () => {
      window.clearTimeout(timer)
      setCharacter(dailyCharacter())
      const midnight = startOfDay(addDays(new Date(), 1)).getTime()
      timer = window.setTimeout(refresh, midnight - Date.now())
    }
    refresh()
    document.addEventListener('visibilitychange', refresh)
    return () => {
      window.clearTimeout(timer)
      document.removeEventListener('visibilitychange', refresh)
    }
  }, [])

  return <>
    <button type="button" className="home-peep-button" aria-label="Daily Peep" disabled={flight !== null} onClick={event => {
      event.stopPropagation()
      const now = performance.now()
      taps.current = [...taps.current.filter(tap => now - tap <= 1600), now]
      if (taps.current.length < 6) return
      taps.current = []
      const rect = event.currentTarget.querySelector('img')!.getBoundingClientRect()
      const direction = rect.left > innerWidth / 2 ? -1 : 1
      setFlight({ x: rect.left, y: rect.top, dx: direction * (innerWidth + 100), dy: -rect.top - 180, source: characterUrls[character] })
      returnTimer.current = setTimeout(() => setFlight(null), 3800)
    }}>
      <img className="home-peep" style={{ visibility: flight ? 'hidden' : undefined }} src={characterUrls[character]} alt="" width={32} height={32} draggable={false} />
    </button>
    {flight && createPortal(<img className="home-peep-flight" src={flight.source} alt="" aria-hidden="true" width={32} height={32} draggable={false} style={{
      left: flight.x, top: flight.y, '--peep-flight-x': `${flight.dx}px`, '--peep-flight-y': `${flight.dy}px`,
    } as CSSProperties} />, document.body)}
  </>
}
