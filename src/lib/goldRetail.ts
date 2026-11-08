import type { GoldPrice } from '../types'

export const GOLD_RETAIL_SOURCE = 'https://www.jjsjo.com/'

/** The syndicate's selling column is the customer's purchase price. */
export function parseRetailGold(html: string, checkedAt = new Date()): GoldPrice {
  const text = (value: string) => value.replace(/<[^>]*>/g, ' ').replace(/&nbsp;|&#160;/g, ' ').replace(/\s+/g, ' ').trim()
  const tables = html.match(/<table\b[^>]*>[\s\S]*?<\/table>/gi) ?? []
  const table = tables.find(value => /Selling price\s*\(JOD\)/i.test(text(value)) && /Purchasing Price\s*\(JOD\)/i.test(text(value)))
  if (!table) throw new Error('The syndicate retail price table is unavailable.')
  const headers = [...table.matchAll(/<th\b[^>]*>([\s\S]*?)<\/th>/gi)].map(match => text(match[1]))
  const sellingColumn = headers.findIndex(value => /^Selling price\s*\(JOD\)$/i.test(value))
  if (sellingColumn < 1) throw new Error('The retail selling column could not be identified.')
  const rates = new Map<number, number>()
  for (const row of table.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const cells = [...row[1].matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)].map(match => text(match[1]))
    if (!cells.length) continue
    const karat = /^(24|22|21|18|14)\s*K$/i.exec(cells[0])
    const amount = cells[sellingColumn]
    if (!karat || !amount || !/^\d+(?:\.\d+)?$/.test(amount)) continue
    const value = Number(amount)
    if (Number.isFinite(value) && value > 0) rates.set(Number(karat[1]), value)
  }
  if (![24, 21, 18, 14].every(karat => rates.has(karat)) || !Number.isFinite(checkedAt.getTime())) {
    throw new Error('The syndicate returned incomplete retail gold prices.')
  }
  const price24 = rates.get(24)!
  return {
    id: `jjsjo-retail-${checkedAt.getTime()}`,
    price_24k: price24,
    price_22k: rates.get(22) ?? Number((price24 * 22 / 24).toFixed(4)),
    price_21k: rates.get(21)!,
    price_18k: rates.get(18)!,
    price_14k: rates.get(14)!,
    source: 'jordan_scrape',
    quote_basis: 'retail',
    source_detail: `${GOLD_RETAIL_SOURCE} — shop selling price (you pay), before workmanship. 22k estimated from 24k. Timestamp is when checked, not bulletin publication.`,
    fetched_at: checkedAt.toISOString(),
  }
}
