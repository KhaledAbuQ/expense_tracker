import type { GoldPrice } from '../types'

export const GOLD_RETAIL_SOURCE = 'https://royanews.tv/goldprice'
// This is the latest local bulletin endpoint used by Roya's public gold page.
// type=1 is Jordanian shop prices, not the international spot feed.
export const GOLD_RETAIL_API_URL = 'https://api.royanews.tv/api/v2/gold-prices?type=1'
export const GOLD_RETAIL_HEADERS = { Accept: 'application/json', platform: 'roya_ar' }

function positivePrice(value: unknown): number | null {
  if (typeof value !== 'number' && typeof value !== 'string') return null
  if (typeof value === 'string' && !/^\d+(?:\.\d+)?$/.test(value.trim())) return null
  const price = Number(value)
  return Number.isFinite(price) && price > 0 ? price : null
}

export function isRoyaRetailQuote(value: unknown): value is GoldPrice {
  if (!value || typeof value !== 'object') return false
  const quote = value as GoldPrice
  return quote.source === 'roya' && quote.quote_basis === 'retail'
    && Number.isFinite(Date.parse(quote.fetched_at))
    && [quote.price_24k, quote.price_22k, quote.price_21k, quote.price_18k].every(price => typeof price === 'number' && positivePrice(price) !== null)
    && (quote.price_14k === null || typeof quote.price_14k === 'number' && positivePrice(quote.price_14k) !== null)
}

/** Roya labels shop sales as sell_: this is what the customer pays. */
export function parseRetailGold(payload: unknown, checkedAt = new Date()): GoldPrice {
  const data = payload as { status?: boolean; data?: { gold_prices?: Record<string, unknown>[] } } | null
  const rows = data?.data?.gold_prices
  if (data?.status !== true || !Array.isArray(rows) || !rows.length || !Number.isFinite(checkedAt.getTime())) {
    throw new Error('Roya local retail gold prices are unavailable.')
  }
  // Like the public page, use the first (latest) bulletin. Never fall back to
  // an older row when the latest one is incomplete or to buy_ (shop buyback).
  const row = rows[0]
  if (!row || typeof row !== 'object') throw new Error('Roya returned an invalid gold bulletin.')
  const rate = (karat: number) => positivePrice((row[`sell_${karat}k`] as { price?: unknown } | null)?.price)
  const price24 = rate(24), price21 = rate(21), price18 = rate(18)
  if (price24 === null || price21 === null || price18 === null) throw new Error('Roya returned incomplete local retail gold prices.')
  return {
    id: `roya-retail-${typeof row.id === 'number' ? row.id : checkedAt.getTime()}`,
    price_24k: price24,
    price_22k: Number((price24 * 22 / 24).toFixed(4)),
    price_21k: price21,
    price_18k: price18,
    // Roya currently returns 0.000 for an unavailable 14k quote.
    price_14k: rate(14),
    source: 'roya',
    quote_basis: 'retail',
    source_detail: `${GOLD_RETAIL_SOURCE} — local shop selling price (you pay), before workmanship. 22k estimated from 24k; unavailable 14k is not estimated. Timestamp is when checked, not bulletin publication.`,
    fetched_at: checkedAt.toISOString(),
  }
}
