// Shared session cache: screens reuse data, refresh explicitly bypasses it.
const entries = new Map<string, { expires: number; promise: Promise<unknown> }>()
const listeners = new Set<(resource: string) => void>()
const lifetime = 5 * 60 * 1000

export function cachedFinance<T>(key: string, load: () => Promise<T>, force = false): Promise<T> {
  const existing = entries.get(key)
  if (!force && existing && existing.expires > Date.now()) return existing.promise as Promise<T>
  const entry = { expires: Date.now() + lifetime, promise: Promise.resolve().then(load) as Promise<unknown> }
  entries.set(key, entry)
  entry.promise.catch(() => { if (entries.get(key) === entry) entries.delete(key) })
  return entry.promise as Promise<T>
}

export function invalidateFinance(resource: string): void {
  // Transfers affect balances; category edits affect joined transaction labels.
  const affected = resource === 'categories' || resource === 'transfers' ? ['expenses', 'income', 'transfers', resource] : [resource]
  for (const key of entries.keys()) if (affected.some(name => key.startsWith(name + ':'))) entries.delete(key)
  affected.forEach(name => listeners.forEach(listener => listener(name)))
}
export function subscribeFinance(listener: (resource: string) => void): () => void {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}
export function clearFinanceCache(): void { entries.clear() }
