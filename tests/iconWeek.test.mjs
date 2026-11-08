import { build } from 'esbuild'
import assert from 'node:assert/strict'
import { test } from 'node:test'
const result = await build({ entryPoints: ['src/lib/iconWeek.ts'], bundle: true, platform: 'node', format: 'esm', write: false })
const { weeklyIconIndex, nextIconChange } = await import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`)
test('icons alternate on local Mondays and remain the same all week', () => {
  const week = weeklyIconIndex(new Date(2026, 10, 9))
  for (let day = 9; day <= 15; day++) assert.equal(weeklyIconIndex(new Date(2026, 10, day, 23)), week)
  assert.notEqual(weeklyIconIndex(new Date(2026, 10, 8, 23, 59)), week)
  assert.notEqual(weeklyIconIndex(new Date(2026, 10, 16)), week)
  const next = nextIconChange(new Date(2026, 10, 8, 23, 59))
  assert.equal(next.getDate(), 9)
  assert.equal(next.getDay(), 1)
  assert.equal(next.getHours(), 0)
  assert.equal(nextIconChange(new Date(2026, 10, 9)).getDate(), 16)
})
