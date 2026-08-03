// Supabase Edge Function: gold-price
//
// Fetches the current gold price in JOD per gram and records it in the
// gold_prices table. Runs server-side for two reasons: the upstream sources send
// no CORS headers, and no free gold API quotes JOD at all.
//
// Strategy, in order:
//   1. Scrape the Jordan per-karat table (local market rates, already in JOD)
//   2. Fall back to international spot in USD, converted through the fixed peg
// Whichever succeeds first is validated before it is written. If both fail
// nothing is written, so a bad scrape can never overwrite a good price.
//
// Deploy:
//   supabase functions deploy gold-price --project-ref ijycfxuhtnkpnxymbmja
//
// Invoke from the app:
//   supabase.functions.invoke('gold-price')

import { createClient } from 'jsr:@supabase/supabase-js@2'
import {
  parseJordanPage,
  parseSpotResponse,
  pricesFromSpot,
  type KaratPrices,
} from './parse.ts'

const JORDAN_URL = 'https://www.livepriceofgold.com/jordan-gold-price.html'
const SPOT_URL = 'https://api.goldprice.dev/v1/prices?symbol=XAU-USD-SPOT'

// Prices this fresh are reused instead of refetched, so a page full of mounted
// components doesn't hammer the upstream source or bloat the table.
const FRESH_FOR_MS = 10 * 60 * 1000

const REQUEST_TIMEOUT_MS = 12_000

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

async function fetchWithTimeout(url: string): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
  try {
    return await fetch(url, {
      signal: controller.signal,
      headers: {
        // The Jordan page returns a stub to unrecognised clients.
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36',
        'Accept': 'text/html,application/json',
      },
    })
  } finally {
    clearTimeout(timer)
  }
}

interface PriceResult {
  prices: KaratPrices
  source: 'jordan_scrape' | 'spot_peg'
  sourceDetail: string
}

async function fromJordanScrape(): Promise<PriceResult | null> {
  try {
    const response = await fetchWithTimeout(JORDAN_URL)
    if (!response.ok) return null

    const prices = parseJordanPage(await response.text())
    if (!prices) return null

    return { prices, source: 'jordan_scrape', sourceDetail: JORDAN_URL }
  } catch (error) {
    console.error('Jordan scrape failed:', error instanceof Error ? error.message : error)
    return null
  }
}

async function fromSpot(): Promise<PriceResult | null> {
  try {
    const response = await fetchWithTimeout(SPOT_URL)
    if (!response.ok) return null

    const spot = parseSpotResponse(await response.json())
    if (spot === null) return null

    const prices = pricesFromSpot(spot)
    if (!prices) return null

    return {
      prices,
      source: 'spot_peg',
      sourceDetail: `goldprice.dev XAU-USD-SPOT ${spot} USD/ozt via 0.709 JOD/USD peg`,
    }
  } catch (error) {
    console.error('Spot fetch failed:', error instanceof Error ? error.message : error)
    return null
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

  if (!supabaseUrl || !serviceRoleKey) {
    return json({ error: 'Function is missing its Supabase environment variables.' }, 500)
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey)

  const { data: latest } = await supabase
    .from('gold_prices')
    .select('*')
    .order('fetched_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const forceRefresh = new URL(req.url).searchParams.get('force') === 'true'

  if (!forceRefresh && latest) {
    const age = Date.now() - new Date(latest.fetched_at).getTime()
    if (age < FRESH_FOR_MS) {
      return json({ price: latest, cached: true, age_seconds: Math.round(age / 1000) })
    }
  }

  const result = (await fromJordanScrape()) ?? (await fromSpot())

  if (!result) {
    // Both sources are down or changed shape. Hand back the last good price
    // rather than an error, and flag it so the UI can say how old it is.
    if (latest) {
      return json({
        price: latest,
        cached: true,
        stale: true,
        warning: 'Both price sources failed; returning the last recorded price.',
      })
    }
    return json({ error: 'Could not reach any gold price source.' }, 502)
  }

  const { data: inserted, error } = await supabase
    .from('gold_prices')
    .insert({
      ...result.prices,
      source: result.source,
      source_detail: result.sourceDetail,
    })
    .select()
    .single()

  if (error) {
    console.error('Failed to record gold price:', error)
    return json({ error: `Fetched a price but could not record it: ${error.message}` }, 500)
  }

  return json({ price: inserted, cached: false })
})
