import { GOLD_RETAIL_SOURCE, parseRetailGold } from '../src/lib/goldRetail'

interface Response {
  status: (code: number) => Response
  setHeader: (name: string, value: string) => void
  json: (body: unknown) => void
  end: () => void
}

// Fixed upstream and a short shared cache keep browsers off a CORS-restricted feed.
export default async function handler(request: { method?: string }, response: Response) {
  if (request.method !== 'GET') {
    response.setHeader('Allow', 'GET')
    response.status(405).end()
    return
  }
  try {
    const upstream = await fetch(GOLD_RETAIL_SOURCE, { signal: AbortSignal.timeout(10_000), headers: { Accept: 'text/html' } })
    if (!upstream.ok) throw new Error('Syndicate feed unavailable')
    const quote = parseRetailGold(await upstream.text())
    response.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=300')
    response.status(200).json(quote)
  } catch {
    response.setHeader('Cache-Control', 'no-store')
    response.status(502).json({ error: 'Could not load the syndicate retail gold price. Please try again.' })
  }
}
