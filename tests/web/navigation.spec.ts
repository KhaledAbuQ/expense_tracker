import { test, expect } from '@playwright/test'

for (const mode of ['supported', 'unavailable', 'reduced-motion'] as const) {
  test(`website tabs navigate with view transitions ${mode}`, async ({ page }) => {
    await page.emulateMedia({ reducedMotion: mode === 'reduced-motion' ? 'reduce' : 'no-preference' })
    await page.addInitScript(({ mode }) => {
      localStorage.setItem('expense_tracker_supabase_url', 'https://test-project.supabase.co')
      localStorage.setItem('expense_tracker_supabase_anon_key', 'test-public-key')
      if (mode === 'unavailable') {
        Object.defineProperty(document, 'startViewTransition', { value: undefined })
      }
    }, { mode })
    const member = {
      id: '11111111-1111-4111-8111-111111111111',
      user_id: '22222222-2222-4222-8222-222222222222',
      household_id: '33333333-3333-4333-8333-333333333333',
      name: 'Test member', role: 'admin',
    }
    await page.route('**/*', route => {
      const url = new URL(route.request().url())
      if (url.origin === 'http://127.0.0.1:4175') return route.continue()
      if (url.origin !== 'https://test-project.supabase.co') return route.abort()
      let body: unknown = []
      if (url.pathname === '/auth/v1/token') {
        const user = { id: member.user_id, email: 'test@example.com', aud: 'authenticated', role: 'authenticated', user_metadata: {} }
        const payload = { sub: user.id, exp: Math.floor(Date.now() / 1000) + 3600, role: 'authenticated' }
        const token = `${Buffer.from('{"alg":"HS256"}').toString('base64url')}.${Buffer.from(JSON.stringify(payload)).toString('base64url')}.test`
        body = { access_token: token, refresh_token: 'test-refresh-token', token_type: 'bearer', expires_in: 3600, user }
      } else if (url.pathname === '/rest/v1/members') {
        body = [member]
      }
      return route.fulfill({ contentType: 'application/json', body: JSON.stringify(body) })
    })
    await page.goto('/', { waitUntil: 'domcontentloaded' })
    if (mode === 'supported') {
      expect(await page.evaluate(() => typeof document.startViewTransition)).toBe('function')
    }
    await page.getByLabel('Email', { exact: true }).fill('test@example.com')
    await page.getByLabel('Password', { exact: true }).fill('test-password')
    await page.getByRole('button', { name: 'Sign in', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Dashboard', exact: true })).toBeVisible()

    for (const [name, path] of [
      ['Income', '/income'], ['Expenses', '/expenses'], ['Transfers', '/transfers'],
      ['Savings', '/savings'], ['Members', '/members'], ['Categories', '/categories'],
      ['Dashboard', '/'],
    ]) {
      const link = page.locator('aside').getByRole('link', { name, exact: true })
      await link.click()
      await expect(page).toHaveURL(`http://127.0.0.1:4175${path}`)
      await expect(link).toHaveAttribute('aria-current', 'page')
      await expect(page.locator('main').getByRole('heading', {
        name: name === 'Members' ? 'Household Members' : name, exact: true,
      })).toBeVisible()
    }
    await page.goBack()
    await expect(page).toHaveURL(/\/categories$/)
    await page.goForward()
    await expect(page.getByRole('heading', { name: 'Dashboard', exact: true })).toBeVisible()
  })
}
