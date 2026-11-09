import { build } from 'esbuild'
import { readFile } from 'node:fs/promises'
import assert from 'node:assert/strict'
import { test } from 'node:test'

async function load(path) {
  const result = await build({ entryPoints: [path], bundle: true, platform: 'node', format: 'esm', write: false })
  return import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`)
}
const { parseRetailGold, isRoyaRetailQuote } = await load('src/lib/goldRetail.ts')
const { pricePerGram } = await load('src/lib/gold.ts')
const { default: handler } = await load('api/gold-price.ts')
const checked = new Date('2026-11-09T19:45:00Z')
const fixture = JSON.parse(await readFile(new URL('./fixtures/roya-gold-2026-11-09.json', import.meta.url), 'utf8'))
const feed = () => structuredClone(fixture)

test('Roya latest local bulletin uses shop sales, not buyback or the older bulletin', () => {
  const quote = parseRetailGold(feed(), checked)
  assert.equal(quote.id, 'roya-retail-2707')
  assert.equal(quote.price_21k, 84.1) // buyback is 80.6; earlier bulletin is 83.8
  assert.equal(quote.price_24k, 96.5)
  assert.equal(quote.price_18k, 74.5)
  assert.equal(quote.price_22k, 88.4583)
  assert.equal(quote.quote_basis, 'retail')
  assert.equal(quote.source, 'roya')
  assert.equal(quote.fetched_at, checked.toISOString())
  assert.match(quote.source_detail, /before workmanship/)
  assert.equal(isRoyaRetailQuote(quote), true)
})

test('unpublished 14k stays unavailable rather than zero or a calculated retail quote', () => {
  const payload = feed()
  const quote = parseRetailGold(payload, checked)
  assert.equal(quote.price_14k, null)
  assert.equal(pricePerGram(quote, 14), null)
  delete payload.data.gold_prices[0].sell_14k
  assert.equal(parseRetailGold(payload, checked).price_14k, null)
  payload.data.gold_prices[0].sell_14k = { price: '60.500' }
  assert.equal(parseRetailGold(payload, checked).price_14k, 60.5)
})

test('broken latest bulletins fail instead of substituting older, spot or buyback prices', () => {
  for (const invalid of [null, '<html>Error</html>', { status: true, data: { gold_prices: [] } }, { ...feed(), status: false }]) {
    assert.throws(() => parseRetailGold(invalid, checked))
  }
  for (const price of ['N/A', '-1', '0.000', null, true, '84.1 USD']) {
    const payload = feed()
    payload.data.gold_prices[0].sell_21k.price = price
    assert.throws(() => parseRetailGold(payload, checked))
  }
  const quote = parseRetailGold(feed(), checked)
  assert.equal(isRoyaRetailQuote({ ...quote, source: 'jordan_scrape' }), false)
  assert.equal(isRoyaRetailQuote({ ...quote, source: 'spot_peg' }), false)
  assert.equal(isRoyaRetailQuote({ ...quote, price_14k: 0 }), false)
})

function reply() {
  const state = { status: 200, headers: {}, body: null }
  const response = {
    status(code) { state.status = code; return response },
    setHeader(name, value) { state.headers[name] = value },
    json(body) { state.body = body },
    end() {},
  }
  return { state, response }
}

test('browser endpoint uses the same Roya local feed and fails without a price substitution', async context => {
  const fetch = context.mock.method(globalThis, 'fetch', async () => Response.json(feed()))
  const ok = reply()
  await handler({ method: 'GET' }, ok.response)
  assert.equal(ok.state.status, 200)
  assert.equal(ok.state.body.price_21k, 84.1)
  assert.equal(ok.state.body.price_14k, null)
  assert.equal(fetch.mock.calls[0].arguments[0], 'https://api.royanews.tv/api/v2/gold-prices?type=1')
  assert.equal(fetch.mock.calls[0].arguments[1].headers.platform, 'roya_ar')
  assert.match(ok.state.headers['Cache-Control'], /s-maxage=60/)
  fetch.mock.mockImplementation(async () => new Response('Unavailable', { status: 503 }))
  const failed = reply()
  await handler({ method: 'GET' }, failed.response)
  assert.equal(failed.state.status, 502)
  assert.equal(failed.state.headers['Cache-Control'], 'no-store')
  const post = reply()
  await handler({ method: 'POST' }, post.response)
  assert.equal(post.state.status, 405)
})
