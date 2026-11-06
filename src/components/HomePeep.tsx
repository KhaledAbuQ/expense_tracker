import { useEffect, useState } from 'react'
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

  return <img className="home-peep" src={characterUrls[character]} alt="" width={32} height={32} draggable={false} />
}
