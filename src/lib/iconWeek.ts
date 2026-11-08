/** Alternate each local Monday. UTC is used only for DST-safe calendar-day arithmetic. */
export function weeklyIconIndex(date = new Date()): 0 | 1 {
  const calendarDay = Math.floor(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86400000)
  const week = Math.floor((calendarDay - 4) / 7) // 1970-01-05 was Monday.
  return ((week % 2 + 2) % 2) as 0 | 1
}
export function nextIconChange(date = new Date()): Date {
  const next = new Date(date)
  next.setHours(0, 0, 0, 0)
  next.setDate(next.getDate() + ((8 - next.getDay()) % 7 || 7))
  return next
}
