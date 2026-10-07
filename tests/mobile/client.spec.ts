import { test, expect, type Page } from '@playwright/test'

const member = { id: '11111111-1111-4111-8111-111111111111', user_id: '22222222-2222-4222-8222-222222222222', household_id: '33333333-3333-4333-8333-333333333333', name: 'Test member', role: 'admin' }
const category = { id: '44444444-4444-4444-8444-444444444444', name: 'Groceries', category_type: 'expense', is_default: true, color: '#4f46e5', icon: 'ShoppingCart' }
const today = new Date().toLocaleDateString('en-CA')

async function mockSupabase(page: Page) {
  await page.addInitScript(() => {
    localStorage.setItem('expense_tracker_supabase_url', 'https://test-project.supabase.co')
    localStorage.setItem('expense_tracker_supabase_anon_key', 'test-public-key')
  })
  const state = { failSave: false, inserts: [] as Record<string, unknown>[], foreignRequests: [] as string[] }
  const rows: Record<string, unknown>[] = [{ id: '55555555-5555-4555-8555-555555555555', amount: 12.345, description: 'Weekly groceries', category_id: category.id, date: today, member_id: member.id, visibility: 'private', account_type: 'bank', category, member, created_at: `${today}T12:00:00Z` }]
  await page.route('**/*', async route => {
    const request = route.request()
    const url = new URL(request.url())
    if (url.origin === 'http://127.0.0.1:4174') return route.continue()
    const respond = (body: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) })
    if (url.pathname === '/auth/v1/token') {
      const user = { id: member.user_id, email: 'test@example.com', aud: 'authenticated', role: 'authenticated', user_metadata: {} }
      const payload = { sub: user.id, exp: Math.floor(Date.now() / 1000) + 3600, role: 'authenticated' }
      const token = `${Buffer.from('{"alg":"HS256"}').toString('base64url')}.${Buffer.from(JSON.stringify(payload)).toString('base64url')}.test`
      return respond({ access_token: token, refresh_token: 'test-refresh-token', token_type: 'bearer', expires_in: 3600, user })
    }
    if (url.pathname === '/rest/v1/members') return respond([member])
    if (url.pathname === '/rest/v1/categories') return respond([category])
    if (url.pathname === '/rest/v1/income' || url.pathname === '/rest/v1/transfers') return respond([])
    if (url.pathname === '/rest/v1/expenses') {
      if (request.method() === 'POST') {
        if (state.failSave) return respond({ message: 'Simulated save failure', code: 'TEST' }, 500)
        const [payload] = request.postDataJSON()
        state.inserts.push(payload)
        const row = { ...payload, id: '66666666-6666-4666-8666-666666666666', created_at: new Date().toISOString(), member }
        rows.unshift(row)
        return respond(row, 201)
      }
      const visibility = url.searchParams.get('visibility')?.replace('eq.', '')
      const offset = Number(url.searchParams.get('offset') ?? 0)
      const limit = Number(url.searchParams.get('limit') ?? rows.length)
      const filtered = rows.filter(row => !visibility || row.visibility === visibility)
      return respond(filtered.slice(offset, offset + limit))
    }
    state.foreignRequests.push(url.origin + url.pathname)
    return route.abort()
  })
  return state
}

async function signIn(page: Page) {
  await page.goto('/')
  await page.getByLabel('Email', { exact: true }).fill('test@example.com')
  await page.getByLabel('Password', { exact: true }).fill('test-password')
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Dashboard', exact: true })).toBeVisible()
  await page.getByRole('navigation', { name: 'Mobile navigation' }).getByRole('button', { name: 'Expenses', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Overview', exact: true })).toBeVisible()
  await expect(page.getByText('Weekly groceries')).toBeVisible()
}

test('standalone sign-in persists and saves to the existing Supabase schema', async ({ page }) => {
  const state = await mockSupabase(page)
  await signIn(page)
  await expect(page.getByRole('link', { name: 'Open full dashboard' })).toHaveCount(0)
  await page.reload()
  await page.getByRole('navigation', { name: 'Mobile navigation' }).getByRole('button', { name: 'Expenses', exact: true }).click()
  await expect(page.getByText('Weekly groceries')).toBeVisible()
  await page.getByRole('button', { name: 'Add expense', exact: true }).click()
  await page.getByLabel('Amount').fill('0.125')
  await page.getByLabel('Visibility').selectOption('household')
  await page.getByLabel('Account', { exact: true }).selectOption('cash')
  await page.getByLabel('Description').fill('Bus fare')
  await page.getByRole('button', { name: 'Add Expense', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Overview', exact: true })).toBeVisible()
  await expect(page.getByText('Bus fare', { exact: true })).toBeVisible()
  expect(state.inserts).toHaveLength(1)
  expect(state.inserts[0]).toMatchObject({ amount: 0.125, category_id: null, visibility: 'household', account_type: 'cash', member_id: member.id, date: today })
  expect(state.foreignRequests).toEqual([])
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
})

test('failed saves preserve entries and allow a successful retry', async ({ page }) => {
  const state = await mockSupabase(page)
  await signIn(page)
  await page.getByRole('button', { name: 'Add expense', exact: true }).click()
  await page.getByLabel('Amount').fill('2.500')
  await page.getByLabel('Description').fill('Keep this draft')
  state.failSave = true
  await page.getByRole('button', { name: 'Add Expense', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('Your entries are still here')
  await expect(page.getByLabel('Description')).toHaveValue('Keep this draft')
  expect(state.inserts).toHaveLength(0)
  state.failSave = false
  await page.getByRole('button', { name: 'Add Expense', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Overview', exact: true })).toBeVisible()
  await expect(page.getByText('Keep this draft', { exact: true })).toBeVisible()
  expect(state.inserts).toHaveLength(1)
})

test('offline state disables writes and reconnect allows refresh', async ({ page, context }) => {
  await mockSupabase(page)
  await signIn(page)
  await context.setOffline(true)
  await expect(page.getByText('You’re offline.', { exact: false })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Add expense', exact: true })).toBeDisabled()
  await context.setOffline(false)
  await expect(page.getByRole('button', { name: 'Add expense', exact: true })).toBeEnabled()
  await page.getByRole('button', { name: 'Refresh expenses' }).click()
  await expect(page.getByText('Weekly groceries')).toBeVisible()
})

test('reference palette, dashboard quick add, and haptic preference work on mobile', async ({ page }) => {
  await mockSupabase(page)
  await signIn(page)
  const navigation = page.getByRole('navigation', { name: 'Mobile navigation' })
  await navigation.getByRole('button', { name: 'Home', exact: true }).click()
  await expect(page.locator('.pocket-spend-card')).toHaveCSS('background-color', 'rgb(255, 255, 255)')
  await expect(page.locator('.pocket-category-chip').first()).toHaveCSS('background-color', 'rgb(240, 238, 255)')
  await expect(page.getByRole('button', { name: 'Add expense', exact: true })).toHaveCSS('background-color', 'rgb(27, 28, 31)')
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.screenshot({ path: 'artifacts/mobile-home.png' })
  await page.getByRole('button', { name: 'Add expense', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Add expense', exact: true })).toBeVisible()
  await navigation.getByRole('button', { name: 'More', exact: true }).click()
  const haptics = page.getByRole('switch', { name: 'Haptic feedback' })
  await expect(haptics).toBeChecked()
  await haptics.click()
  await expect(haptics).not.toBeChecked()
  await page.reload()
  await page.getByRole('navigation', { name: 'Mobile navigation' }).getByRole('button', { name: 'More', exact: true }).click()
  await expect(page.getByRole('switch', { name: 'Haptic feedback' })).not.toBeChecked()
})

test('uncertain SMS categories require review and failed approvals are kept for retry', async ({ page }) => {
  const state = await mockSupabase(page)
  await page.addInitScript(() => {
    if (!sessionStorage.getItem('sms-test-seeded')) {
      localStorage.setItem('pocket_expenses_pending_transactions', JSON.stringify([{
        id: 'sms-unknown', smsId: 'unknown', sender: 'Bank', merchant: 'UNKNOWN MERCHANT', amount: 12.5,
        currency: 'JOD', date: new Date().toLocaleDateString('en-CA'), type: 'expense',
        rawBody: 'Purchase of JOD 12.500 at UNKNOWN MERCHANT. Available balance JOD 100.',
        categoryGuess: 'Groceries', suggestedCategoryId: '44444444-4444-4444-8444-444444444444',
        isAutoDetected: true, isFinancial: true, confidence: 'high',
      }]))
      sessionStorage.setItem('sms-test-seeded', 'true')
    }
  })
  await signIn(page)
  await page.getByRole('button', { name: 'Review bank transactions' }).click()
  const inbox = page.getByRole('dialog', { name: 'Bank SMS Auto-Tracking' })
  await expect(inbox.getByRole('combobox')).toHaveValue('')
  await expect(inbox.getByText('Auto-detected', { exact: true })).toHaveCount(0)
  await inbox.getByRole('combobox').selectOption(category.id)
  state.failSave = true
  await inbox.getByRole('button', { name: 'Save Expense', exact: true }).click()
  await expect(page.getByText('Failed to save transaction', { exact: true })).toBeVisible()
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('pocket_expenses_processed_sms_ids') || '[]'))).not.toContain('unknown')
  state.failSave = false
  await inbox.getByRole('button', { name: 'Save Expense', exact: true }).click()
  await expect(inbox.getByText('All caught up!', { exact: true })).toBeVisible()
  expect(state.inserts).toHaveLength(1)
  expect(state.inserts[0].category_id).toBe(category.id)
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('pocket_expenses_merchant_categories_v2') || '{}')['unknown merchant'])).toBe(category.id)
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('pocket_expenses_pending_transactions') || '[]'))).toEqual([])
})
