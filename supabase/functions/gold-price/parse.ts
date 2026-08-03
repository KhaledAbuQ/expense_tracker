// Price extraction, kept separate from the network and database code so it can
// be unit-tested against saved copies of the real pages.

export type Karat = 24 | 22 | 21 | 18 | 14

export interface KaratPrices {
  price_24k: number
  price_22k: number
  price_21k: number
  price_18k: number
  price_14k: number
}

/** Jordanian dinars per US dollar. Pegged by the Central Bank of Jordan since 1995. */
export const JOD_PER_USD = 0.709

/** Grams in a troy ounce, the unit international spot is quoted in. */
export const GRAMS_PER_TROY_OUNCE = 31.1034768

/**
 * Purity by karat, as a fraction of 24k.
 *
 * 24k is 1.0 so that the spot-derived fallback lands on the same basis the
 * scraped page uses: its per-karat quotes are exactly `24k x karat/24`.
 */
export const KARAT_PURITY: Record<Karat, number> = {
  24: 1,
  22: 22 / 24,
  21: 21 / 24,
  18: 18 / 24,
  14: 14 / 24,
}

/**
 * A scraped page is only trustworthy if the numbers hang together. Gold has
 * traded between roughly 30 and 200 JOD/gram over the last two decades; anything
 * outside that is a parse error or a broken page, not a price move. We also
 * require the karats to descend, which catches column misalignment.
 */
export function isPlausible(prices: KaratPrices): boolean {
  const { price_24k, price_22k, price_21k, price_18k, price_14k } = prices
  const all = [price_24k, price_22k, price_21k, price_18k, price_14k]

  if (all.some(p => !Number.isFinite(p) || p <= 0)) return false
  if (price_24k < 30 || price_24k > 400) return false
  if (!(price_24k > price_22k && price_22k > price_21k && price_21k > price_18k && price_18k > price_14k)) {
    return false
  }

  // Each karat should sit near its purity ratio against 24k. A 10% band absorbs
  // per-karat local premiums without accepting nonsense.
  const ratios: Array<[number, number]> = [
    [price_22k, KARAT_PURITY[22] / KARAT_PURITY[24]],
    [price_21k, KARAT_PURITY[21] / KARAT_PURITY[24]],
    [price_18k, KARAT_PURITY[18] / KARAT_PURITY[24]],
    [price_14k, KARAT_PURITY[14] / KARAT_PURITY[24]],
  ]
  return ratios.every(([price, ratio]) => {
    const expected = price_24k * ratio
    return Math.abs(price - expected) / expected < 0.1
  })
}

function toNumber(raw: string): number {
  return Number(raw.replace(/,/g, '').trim())
}

/**
 * Pull per-gram JOD prices out of the Jordan page on livepriceofgold.com.
 *
 * Rather than matching the markup, every tag is collapsed to a `|` delimiter
 * first, turning the row into:
 *   |1 GRAM GOLD 24K|92.46|92.97|92.30|-0.31|
 * We then take the first numeric field after a "GRAM <n>K" label. That survives
 * the label being wrapped in a <span>, cells gaining classes, and similar
 * restyling -- all of which would break a markup-shaped regex. The explicit GRAM
 * anchor keeps the OUNCE, KILOGRAM and TOLA rows from matching.
 */
export function parseJordanPage(html: string): KaratPrices | null {
  const text = html
    .replace(/<[^>]+>/g, '|')
    .replace(/&nbsp;/gi, ' ')
    .replace(/[ \t\r\n]+/g, ' ')
    .replace(/(\s*\|\s*)+/g, '|')

  const found: Partial<Record<Karat, number>> = {}

  for (const karat of [24, 22, 21, 18, 14] as Karat[]) {
    const pattern = new RegExp(
      `GRAM(?:\\s+GOLD)?\\s+${karat}K\\s*\\|\\s*([0-9][0-9,]*\\.?[0-9]*)`,
      'i'
    )
    const match = text.match(pattern)
    if (!match) return null

    const value = toNumber(match[1])
    if (!Number.isFinite(value) || value <= 0) return null
    found[karat] = value
  }

  const prices: KaratPrices = {
    price_24k: found[24]!,
    price_22k: found[22]!,
    price_21k: found[21]!,
    price_18k: found[18]!,
    price_14k: found[14]!,
  }

  return isPlausible(prices) ? prices : null
}

/**
 * Derive per-gram JOD prices from an international spot quote in USD per troy
 * ounce. Used when the Jordan page is unreachable or unparseable.
 */
export function pricesFromSpot(usdPerTroyOunce: number): KaratPrices | null {
  if (!Number.isFinite(usdPerTroyOunce) || usdPerTroyOunce <= 0) return null

  const jodPerGramPure = (usdPerTroyOunce * JOD_PER_USD) / GRAMS_PER_TROY_OUNCE
  const at = (karat: Karat) => Number((jodPerGramPure * KARAT_PURITY[karat]).toFixed(4))

  const prices: KaratPrices = {
    price_24k: at(24),
    price_22k: at(22),
    price_21k: at(21),
    price_18k: at(18),
    price_14k: at(14),
  }

  return isPlausible(prices) ? prices : null
}

/** Extract the spot price from the goldprice.dev response shape. */
export function parseSpotResponse(body: unknown): number | null {
  const symbols = (body as { symbols?: Array<{ price?: unknown }> })?.symbols
  if (!Array.isArray(symbols) || symbols.length === 0) return null
  const price = Number(symbols[0]?.price)
  return Number.isFinite(price) && price > 0 ? price : null
}
