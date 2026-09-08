import assert from 'node:assert/strict'
import { test } from 'node:test'

// Helper testing theme resolution logic
function resolveEffectiveTheme(theme, systemPrefersDark) {
  if (theme === 'system') {
    return systemPrefersDark ? 'dark' : 'light'
  }
  return theme
}

test('resolveEffectiveTheme returns explicit light or dark theme', () => {
  assert.equal(resolveEffectiveTheme('light', true), 'light')
  assert.equal(resolveEffectiveTheme('light', false), 'light')
  assert.equal(resolveEffectiveTheme('dark', true), 'dark')
  assert.equal(resolveEffectiveTheme('dark', false), 'dark')
})

test('resolveEffectiveTheme resolves system theme based on media query preference', () => {
  assert.equal(resolveEffectiveTheme('system', true), 'dark')
  assert.equal(resolveEffectiveTheme('system', false), 'light')
})
