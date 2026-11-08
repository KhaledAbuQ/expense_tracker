import { useEffect, useState } from 'react'
import classic from '../assets/app-icon.png'
import celebration from '../assets/app-icon-alt.png'
import { nextIconChange, weeklyIconIndex } from '../lib/iconWeek'

export default function WeeklyAppIcon({ alt = '', className = '' }: { alt?: string; className?: string }) {
  const [index, setIndex] = useState(weeklyIconIndex)
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>
    const refresh = () => {
      clearTimeout(timer)
      setIndex(weeklyIconIndex())
      timer = setTimeout(refresh, Math.max(1000, nextIconChange().getTime() - Date.now()))
    }
    refresh()
    document.addEventListener('visibilitychange', refresh)
    return () => { clearTimeout(timer); document.removeEventListener('visibilitychange', refresh) }
  }, [])
  return <img src={index ? celebration : classic} alt={alt} className={className} />
}
