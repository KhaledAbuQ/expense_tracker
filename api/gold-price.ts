import { GOLD_RETAIL_API_URL, GOLD_RETAIL_HEADERS, parseRetailGold } from '../src/lib/goldRetail'

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
    const upstream = await fetch(GOLD_RETAIL_API_URL, { signal: AbortSignal.timeout(10_000), headers: GOLD_RETAIL_HEADERS })
    if (!upstream.ok) throw new Error('Roya feed unavailable')
    const quote = parseRetailGold(await upstream.json())
    response.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=60')
    response.status(200).json(quote)
  } catch {
    response.setHeader('Cache-Control', 'no-store')
    response.status(502).json({ error: 'Could not load Roya local retail gold prices. Please try again.' })
  }
}
