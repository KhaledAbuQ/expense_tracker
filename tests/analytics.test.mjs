import { build } from 'esbuild'
import assert from 'node:assert/strict'
import { test } from 'node:test'
const load = async path => {
  const result = await build({ entryPoints: [path], bundle: true, platform: 'node', format: 'esm', write: false })
  return import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`)
}
const { analyticsRange, previousRange, aggregateCashFlow, withinRange, percentChange } = await load('src/lib/analytics.ts')
const { fetchAllRows } = await load('src/lib/pagination.ts')
const date = value => new Date(`${value}T00:00:00`)
const range = (start, end) => ({ start: date(start), end: date(end) })
test('presets include complete starting months and stop today', () => {
  assert.deepEqual(analyticsRange('3-months', undefined, date('2026-01-08')), range('2025-11-01', '2026-01-08'))
  assert.deepEqual(analyticsRange('last-month', undefined, date('2024-03-08')), range('2024-02-01', '2024-02-29'))
  assert.deepEqual(analyticsRange('all', '2022-05-03', date('2026-01-08')), range('2022-05-03', '2026-01-08'))
})
test('comparison uses equal calendar days across DST and leap days', () => {
  assert.deepEqual(previousRange(range('2024-03-01', '2024-03-12')), range('2024-02-18', '2024-02-29'))
})
test('inclusive filtering, empty buckets and cross-year monthly aggregation reconcile', () => {
  const period = range('2025-12-30', '2026-02-02')
  const expenses = [{ date: '2025-12-29', amount: 999 }, { date: '2025-12-30', amount: '2.125' }, { date: '2026-02-02', amount: 3 }, { date: '2026-02-03', amount: 999 }]
  assert.equal(withinRange(expenses, period).length, 2)
  for (const interval of ['day', 'week', 'month']) {
    const rows = aggregateCashFlow(expenses, [{ date: '2026-02-02', amount: 10 }], period, interval)
    assert.equal(rows.reduce((sum, row) => sum + row.expenses, 0), 5.125)
    assert.equal(rows.reduce((sum, row) => sum + row.net, 0), 4.875)
  }
  const months = aggregateCashFlow(expenses, [], period, 'month')
  assert.equal(months.length, 3)
  assert.equal(months[1].expenses, 0)
  assert.equal(aggregateCashFlow([], [], range('2026-01-01', '2026-01-03'), 'day').length, 3)
})
test('zero comparison baseline does not manufacture a percentage', () => {
  assert.equal(percentChange(10, 0), 'No prior spending')
  assert.equal(percentChange(0, 0), 'No change')
  assert.equal(percentChange(50, 100), '-50.0%')
})
test('pagination exceeds 1000 rows and handles lower server caps', async () => {
  const source = Array.from({ length: 1203 }, (_, i) => i)
  const rows = await fetchAllRows(async (from, to) => ({ data: source.slice(from, Math.min(to + 1, from + 200)), error: null }))
  assert.deepEqual(rows, source)
  await assert.rejects(fetchAllRows(async () => ({ data: null, error: new Error('failed') })), /failed/)
})

test('monthly cumulative spending fills gaps and stops at today and shorter month ends', async () => {
  const { cumulativeMonthlySpending } = await load('src/lib/analytics.ts')
  const rows = cumulativeMonthlySpending([
    { date: '2024-03-01', amount: 10 },
    { date: '2024-03-03', amount: '2.125' },
    { date: '2024-03-04', amount: 999 },
    { date: '2024-02-01', amount: 5 },
    { date: '2024-02-29', amount: 7 },
    { date: '2023-02-01', amount: 999 },
  ], '2024-02', date('2024-03-03'))
  assert.equal(rows.length, 31)
  assert.deepEqual(rows.slice(0, 3).map(row => row.current), [10, 10, 12.125])
  assert.equal(rows[3].current, null)
  assert.equal(rows[28].comparison, 12)
  assert.equal(rows[29].comparison, null)
  const empty = cumulativeMonthlySpending([], '2025-12', date('2026-02-02'))
  assert.equal(empty[0].current, 0)
  assert.equal(empty[30].current, null)
  assert.equal(empty[30].comparison, 0)
})
