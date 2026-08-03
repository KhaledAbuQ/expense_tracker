import { GoldItemType, GoldPrice, Karat, Transfer } from '../types'

/**
 * Purity by carat, as a fraction of 24k.
 *
 * 24k is 1.0 rather than 0.999 on purpose. The price source derives its
 * per-carat rates as exactly `24k x karat/24` -- its 21k quote is 0.875 of its
 * 24k quote to the digit -- so treating 24k as 0.999 here would value holdings
 * on a slightly different basis than the prices being applied to them. "Fine
 * grams" throughout this app therefore means 24k-equivalent grams.
 */
export const KARAT_PURITY: Record<Karat, number> = {
  24: 1,
  22: 22 / 24,
  21: 21 / 24,
  18: 18 / 24,
  14: 14 / 24,
}

export const KARAT_OPTIONS: Karat[] = [24, 22, 21, 18, 14]

interface CoinSpec {
  label: string
  /** Gross weight of one coin, in grams. */
  grams: number
  karat: Karat
}

/**
 * Coin specifications as traded in Jordan.
 *
 * English lira is 8 g and Rashadi is 7 g, both at 21k -- the carat gold is
 * bought and sold at locally. These are the working figures Jordanian dealers
 * quote, which differ slightly from the original mint standards (a British
 * sovereign is struck at 7.98805 g / 22k). The local convention is what the
 * money actually changes hands on, so it is what the app uses.
 */
export const COIN_SPECS: Record<Exclude<GoldItemType, 'bullion'>, CoinSpec> = {
  english_lira: { label: 'English lira', grams: 8, karat: 21 },
  rashadi_lira: { label: 'Rashadi lira', grams: 7, karat: 21 },
}

export const GOLD_ITEM_LABELS: Record<GoldItemType, string> = {
  english_lira: COIN_SPECS.english_lira.label,
  rashadi_lira: COIN_SPECS.rashadi_lira.label,
  bullion: 'Other (by weight and carat)',
}

/** Pure-gold content of a gross weight at a given carat. */
export function fineGrams(grams: number, karat: Karat): number {
  return grams * KARAT_PURITY[karat]
}

export interface GoldItemMeasurement {
  grams: number
  fine_grams: number
  karat: Karat
}

/**
 * Resolve an item choice into weights.
 *
 * For coins, `quantity` is a count and the weight comes from the minted spec.
 * For bullion, `quantity` is already a gram weight and the carat is the user's.
 */
export function measureGoldItem(
  itemType: GoldItemType,
  quantity: number,
  bullionKarat: Karat
): GoldItemMeasurement | null {
  if (!Number.isFinite(quantity) || quantity <= 0) return null

  if (itemType === 'bullion') {
    return {
      grams: quantity,
      fine_grams: fineGrams(quantity, bullionKarat),
      karat: bullionKarat,
    }
  }

  const spec = COIN_SPECS[itemType]
  const grams = spec.grams * quantity
  return { grams, fine_grams: fineGrams(grams, spec.karat), karat: spec.karat }
}

/** Price per gram for a given carat, from a fetched price row. */
export function pricePerGram(price: GoldPrice, karat: Karat): number {
  switch (karat) {
    case 24: return Number(price.price_24k)
    case 22: return Number(price.price_22k)
    case 21: return Number(price.price_21k)
    case 18: return Number(price.price_18k)
    case 14: return Number(price.price_14k)
  }
}

/**
 * Market value of a quantity of pure gold.
 *
 * Holdings are tracked in fine grams, so they are always valued at the 24k rate
 * regardless of what carat the metal was bought as. Valuing 21k jewellery at the
 * 21k per-gram rate and then multiplying by its gross weight gives the same
 * answer; going through fine grams just avoids storing a carat per holding.
 */
export function valueOfFineGrams(fine: number, price: GoldPrice | null): number {
  if (!price || !Number.isFinite(fine)) return 0
  return fine * Number(price.price_24k)
}

/**
 * Net gold held, in fine grams, derived from the transfer ledger.
 *
 * Transfers into 'gold' add, transfers out subtract. There is no stored balance
 * to drift out of sync -- the same approach the savings balance already uses.
 */
export function calculateGoldFineGrams(transfers: Transfer[]): number {
  return transfers.reduce((total, transfer) => {
    const fine = Number(transfer.gold_fine_grams ?? 0)
    if (!Number.isFinite(fine) || fine <= 0) return total

    if (transfer.to_account === 'gold') return total + fine
    if (transfer.from_account === 'gold') return total - fine
    return total
  }, 0)
}

export interface GoldHolding {
  itemType: GoldItemType
  karat: Karat
  /** Number of coins. Zero for bullion, which is tracked by weight alone. */
  count: number
  grams: number
  fineGrams: number
}

/**
 * Break holdings down by what you actually own, not just a single total.
 *
 * Grouped by item type and carat, so three English liras and 12 g of 18k
 * bullion stay distinguishable. Rows that net out to nothing (bought then sold)
 * are dropped. Signs follow the ledger: into 'gold' adds, out of it subtracts.
 */
export function summarizeGoldHoldings(transfers: Transfer[]): GoldHolding[] {
  const groups = new Map<string, GoldHolding>()

  for (const transfer of transfers) {
    const itemType = transfer.gold_item_type
    const karat = transfer.gold_karat as Karat | undefined
    const grams = Number(transfer.gold_grams ?? 0)
    const fine = Number(transfer.gold_fine_grams ?? 0)

    if (!itemType || !karat || !Number.isFinite(grams) || grams <= 0) continue

    const direction =
      transfer.to_account === 'gold' ? 1 : transfer.from_account === 'gold' ? -1 : 0
    if (direction === 0) continue

    const key = `${itemType}:${karat}`
    const existing = groups.get(key) ?? { itemType, karat, count: 0, grams: 0, fineGrams: 0 }

    existing.grams += direction * grams
    existing.fineGrams += direction * fine
    if (itemType !== 'bullion') {
      existing.count += direction * Number(transfer.gold_quantity ?? 0)
    }

    groups.set(key, existing)
  }

  return Array.from(groups.values())
    .filter(holding => holding.grams > 0.0001)
    .sort((a, b) => b.fineGrams - a.fineGrams)
}

/** Human label for a holding row, e.g. "English lira (21k)" or "Bullion 18k". */
export function describeHolding(holding: GoldHolding): string {
  if (holding.itemType === 'bullion') return `Gold ${holding.karat}k`
  return `${GOLD_ITEM_LABELS[holding.itemType]} (${holding.karat}k)`
}

/** How many gold items are currently held, for a rough "3 pieces" style summary. */
export function countGoldItems(transfers: Transfer[]): number {
  return transfers.reduce((count, transfer) => {
    if (transfer.gold_item_type === 'bullion') return count
    const quantity = Number(transfer.gold_quantity ?? 0)
    if (!Number.isFinite(quantity) || quantity <= 0) return count

    if (transfer.to_account === 'gold') return count + quantity
    if (transfer.from_account === 'gold') return count - quantity
    return count
  }, 0)
}

export function formatGrams(grams: number): string {
  return `${grams.toFixed(2)} g`
}

/** Prices older than this are shown with a warning rather than silently trusted. */
export const PRICE_STALE_AFTER_MS = 24 * 60 * 60 * 1000

export function isPriceStale(price: GoldPrice | null): boolean {
  if (!price) return true
  return Date.now() - new Date(price.fetched_at).getTime() > PRICE_STALE_AFTER_MS
}
