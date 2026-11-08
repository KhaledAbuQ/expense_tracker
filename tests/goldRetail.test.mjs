import { build } from 'esbuild'
import assert from 'node:assert/strict'
import { test } from 'node:test'

async function load(path) {
  const result = await build({ entryPoints: [path], bundle: true, platform: 'node', format: 'esm', write: false })
  return import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`)
}
const { parseRetailGold } = await load('src/lib/goldRetail.ts')
const { default: handler } = await load('api/gold-price.ts')
const checked = new Date('2026-11-09T08:00:00Z')
const rows = [[24, 104.7, 100.7], [21, 91.2, 87.1], [18, 80.8, 74.5], [14, 66.4, 58.2]]
const table = (swap = false) => `<table><thead><tr><th>Standard</th><th>${swap ? 'Purchasing Price' : 'Selling price'} (JOD)</th><th>${swap ? 'Selling price' : 'Purchasing Price'} (JOD)</th></tr></thead><tbody>${rows.map(([karat, sell, buy]) => `<tr><td>${karat} K</td><td>${swap ? buy : sell}</td><td>${swap ? sell : buy}</td></tr>`).join('')}</tbody></table>`

test('customer purchase quotes use shop selling rates, including when columns move', () => {
  for (const swap of [false, true]) {
    const quote = parseRetailGold(table(swap), checked)
    assert.equal(quote.price_21k, 91.2)
    assert.equal(quote.price_24k, 104.7)
    assert.equal(quote.price_18k, 80.8)
    assert.equal(quote.price_14k, 66.4)
    assert.equal(quote.price_22k, 95.975)
    assert.equal(quote.quote_basis, 'retail')
    assert.equal(quote.source, 'jordan_scrape')
    assert.equal(quote.fetched_at, checked.toISOString())
    assert.match(quote.source_detail, /before workmanship/)
  }
})

test('broken or incomplete feeds fail rather than presenting spot or buyback prices as retail', () => {
  for (const html of ['<html>Error</html>', table().replace('91.2', 'N/A'), table().replace('104.7', '-1'), table().replace('JOD', 'USD'), table().replace('14 K', 'Unknown')]) {
    assert.throws(() => parseRetailGold(html, checked))
  }
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

test('browser endpoint serves a validated retail quote and handles feed failure', async context => {
  const fetch = context.mock.method(globalThis, 'fetch', async () => new Response(table()))
  const ok = reply()
  await handler({ method: 'GET' }, ok.response)
  assert.equal(ok.state.status, 200)
  assert.equal(ok.state.body.price_21k, 91.2)
  assert.equal(fetch.mock.calls[0].arguments[0], 'https://www.jjsjo.com/')
  assert.match(ok.state.headers['Cache-Control'], /s-maxage=300/)
  fetch.mock.mockImplementation(async () => new Response('Unavailable', { status: 503 }))
  const failed = reply()
  await handler({ method: 'GET' }, failed.response)
  assert.equal(failed.state.status, 502)
  assert.equal(failed.state.headers['Cache-Control'], 'no-store')
  const post = reply()
  await handler({ method: 'POST' }, post.response)
  assert.equal(post.state.status, 405)
})
