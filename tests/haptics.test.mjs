import { build } from 'esbuild'
import assert from 'node:assert/strict'
import { test } from 'node:test'

test('Haptics honor the app preference, skip browsers, and tolerate unavailable native feedback', async () => {
  const state = { native: true, calls: [], fail: false }
  globalThis.__pocketHapticsTest = state
  const storage = new Map()
  const previous = globalThis.localStorage
  globalThis.localStorage = { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value) }
  try {
    const bundle = await build({ entryPoints: ['src/lib/haptics.ts'], bundle: true, platform: 'node', format: 'esm', write: false, plugins: [{
      name: 'native-haptics-fixture', setup(builder) {
        builder.onResolve({ filter: /^@capacitor\/core$/ }, () => ({ path: 'capacitor', namespace: 'fixture' }))
        builder.onLoad({ filter: /.*/, namespace: 'fixture' }, () => ({ contents: `
          export const Capacitor = { isNativePlatform: () => globalThis.__pocketHapticsTest.native, getPlatform: () => globalThis.__pocketHapticsTest.native ? 'android' : 'web' };
          export const registerPlugin = () => ({ feedback: async ({ kind }) => {
            if (globalThis.__pocketHapticsTest.fail) throw new Error('Unavailable');
            globalThis.__pocketHapticsTest.calls.push(kind);
          }});
        ` }))
      },
    }] })
    const { feedback, setHapticsEnabled, getHapticsEnabled } = await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`)
    feedback('success')
    setHapticsEnabled(false)
    assert.equal(getHapticsEnabled(), false)
    feedback('error')
    assert.deepEqual(state.calls, ['success'])
    setHapticsEnabled(true)
    feedback('error')
    feedback('selection')
    feedback('selection')
    assert.deepEqual(state.calls, ['success', 'error', 'selection'])
    state.native = false
    feedback('success')
    assert.equal(state.calls.length, 3)
    state.native = true
    state.fail = true
    feedback('success')
    await new Promise(resolve => setImmediate(resolve))
    assert.equal(state.calls.length, 3)
  } finally {
    delete globalThis.__pocketHapticsTest
    if (previous === undefined) delete globalThis.localStorage
    else globalThis.localStorage = previous
  }
})
