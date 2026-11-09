import { test, expect, type Page } from '@playwright/test'

const member = { id: '11111111-1111-4111-8111-111111111111', user_id: '22222222-2222-4222-8222-222222222222', household_id: '33333333-3333-4333-8333-333333333333', name: 'Test member', role: 'admin' }
const category = { id: '44444444-4444-4444-8444-444444444444', name: 'Groceries', category_type: 'expense', is_default: true, color: '#4f46e5', icon: 'ShoppingCart' }
const today = new Date().toLocaleDateString('en-CA')

async function mockSupabase(page: Page) {
  await page.addInitScript(() => {
    localStorage.setItem('expense_tracker_supabase_url', 'https://test-project.supabase.co')
    localStorage.setItem('expense_tracker_supabase_anon_key', 'test-public-key')
  })
  const state = { failSave: false, failGold: false, inserts: [] as Record<string, unknown>[], foreignRequests: [] as string[] }
  const rows: Record<string, unknown>[] = [{ id: '55555555-5555-4555-8555-555555555555', amount: 12.345, description: 'Weekly groceries', category_id: category.id, date: today, member_id: member.id, visibility: 'private', account_type: 'bank', category, member, created_at: `${today}T12:00:00Z` }]
  await page.route('**/*', async route => {
    const request = route.request()
    const url = new URL(request.url())
    if (url.origin === 'http://127.0.0.1:4174') {
      if (url.pathname === '/api/gold-price' && state.failGold) return route.fulfill({ status: 503, body: 'Unavailable' })
      if (url.pathname === '/api/gold-price') return route.fulfill({ contentType: 'application/json', body: JSON.stringify({
        status: true, data: { gold_prices: [{ id: 2707,
          sell_24k: { price: '96.500' }, sell_21k: { price: '84.100' }, sell_18k: { price: '74.500' }, sell_14k: { price: '0.000' },
          buy_24k: { price: '92.800' }, buy_21k: { price: '80.600' }, buy_18k: { price: '68.500' },
        }] },
      }) })
      return route.continue()
    }
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

test('retail gold and the daily Peep Easter egg preserve the right source and character', async ({ page }) => {
  await mockSupabase(page)
  await page.addInitScript(() => {
    localStorage.setItem('pocket_expenses_welcome_seen', 'yes')
    localStorage.setItem('pocket_expense_gold_spot_jod_v1', JSON.stringify({ price_21k: 1, price_24k: 2, fetched_at: new Date().toISOString() }))
    localStorage.setItem('pocket_expense_gold_history_v1', JSON.stringify([{ timestamp: Date.now() - 86400000, price: 1 }]))
    localStorage.setItem('pocket_expense_gold_retail_jod_v2', JSON.stringify({ source: 'jordan_scrape', quote_basis: 'retail', price_21k: 91.2, price_24k: 104.7, fetched_at: new Date().toISOString() }))
    localStorage.setItem('pocket_expense_gold_retail_history_v2', JSON.stringify([{ timestamp: Date.now() - 86400000, price: 91.2 }]))
  })
  await page.goto('/')
  await page.getByLabel('Email', { exact: true }).fill('test@example.com')
  await page.getByLabel('Password', { exact: true }).fill('test-password')
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  const card = page.getByRole('region', { name: 'Gold retail price in Jordanian dinars' })
  await expect(card).toContainText('84.10')
  await expect(card.getByRole('link', { name: 'You pay · Roya retail' })).toHaveAttribute('href', 'https://royanews.tv/goldprice')
  await expect(card).toContainText('You pay')
  await expect(card).toContainText('before workmanship')
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('pocket_expense_gold_roya_retail_history_v3') ?? '[]'))).toHaveLength(1)
  const peep = page.getByRole('button', { name: 'Daily Peep' })
  const character = await peep.locator('img').getAttribute('src')
  for (let tap = 0; tap < 5; tap++) await peep.click()
  await expect(page.locator('.home-peep-flight')).toHaveCount(0)
  await peep.click()
  await expect(page.locator('.home-peep-flight')).toHaveCount(1)
  await expect(peep).toBeDisabled()
  await expect(page.locator('.home-peep-flight')).toHaveAttribute('src', character!)
  await expect(peep).toBeEnabled({ timeout: 5000 })
  await expect(page.locator('.home-peep-flight')).toHaveCount(0)
  await expect(peep.locator('img')).toHaveAttribute('src', character!)
  await expect(page.locator('.monetra-home-header img[src*="app-icon"]')).toBeVisible()
})

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

async function openThemeHome(page: Page) {
  await mockSupabase(page)
  await page.addInitScript(() => {
    localStorage.setItem('expense_tracker_theme', 'light')
    localStorage.setItem('pocket_expenses_welcome_seen', 'yes')
  })
  await page.goto('/')
  await page.getByLabel('Email', { exact: true }).fill('test@example.com')
  await page.getByLabel('Password', { exact: true }).fill('test-password')
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await expect(page.locator('.monetra-home-header')).toBeVisible()
  return page.locator('.monetra-home-header').getByRole('switch', { name: 'Dark mode' })
}

test('theme thumb follows a held drag and commits once on release', async ({ page }) => {
  const toggle = await openThemeHome(page)
  const thumb = toggle.locator('.day-night-switch__thumb')
  const bounds = (await thumb.boundingBox())!
  const x = bounds.x + bounds.width / 2, y = bounds.y + bounds.height / 2
  await page.mouse.move(x, y)
  await page.mouse.down()
  await page.mouse.move(x - 16, y + 7, { steps: 4 })
  await expect.poll(async () => (await thumb.boundingBox())!.x).toBeLessThan(bounds.x - 10)
  await expect(toggle).toHaveAttribute('aria-checked', 'false')
  await page.mouse.move(x - 44, y + 7, { steps: 4 })
  await page.waitForTimeout(350)
  await expect(toggle).toHaveAttribute('aria-checked', 'false')
  await expect(page.locator('html')).not.toHaveClass(/dark/)
  await page.mouse.up()
  await expect(toggle).toHaveAttribute('aria-checked', 'true')
  await page.waitForTimeout(2800)
  await expect(toggle).toHaveAttribute('aria-checked', 'true')
  await expect(page.locator('.theme-electric-field')).toHaveCount(0)
  // A short drag on the current side snaps back without changing the theme.
  const darkBounds = (await thumb.boundingBox())!
  await page.mouse.move(darkBounds.x + 20, darkBounds.y + 20)
  await page.mouse.down()
  await page.mouse.move(darkBounds.x + 30, darkBounds.y + 20)
  await page.mouse.up()
  await expect(toggle).toHaveAttribute('aria-checked', 'true')
})

test('touch can hold and drag without scrolling or committing before release', async ({ page, context }) => {
  const toggle = await openThemeHome(page)
  const thumb = toggle.locator('.day-night-switch__thumb')
  const bounds = (await thumb.boundingBox())!
  const x = bounds.x + bounds.width / 2, y = bounds.y + bounds.height / 2
  const session = await context.newCDPSession(page)
  await session.send('Emulation.setTouchEmulationEnabled', { enabled: true })
  await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] })
  await page.waitForTimeout(650)
  for (let step = 1; step <= 6; step++) {
    await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x - step * 7, y: y + step * 2 }] })
  }
  await expect.poll(async () => (await thumb.boundingBox())!.x).toBeLessThan(bounds.x - 30)
  await expect(toggle).toHaveAttribute('aria-checked', 'false')
  await session.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] })
  await expect(toggle).toHaveAttribute('aria-checked', 'false')
  await expect.poll(async () => (await thumb.boundingBox())!.x).toBeGreaterThan(bounds.x - 1)
  await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] })
  await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x - 44, y: y + 10 }] })
  await expect(toggle).toHaveAttribute('aria-checked', 'false')
  await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
  await expect(toggle).toHaveAttribute('aria-checked', 'true')
  await page.waitForTimeout(2700)
  await expect(toggle).toHaveAttribute('aria-checked', 'true')
})

test('theme reveal is slower, opaque, and survives rapid changes and reduced motion', async ({ page }) => {
  const toggle = await openThemeHome(page)
  await toggle.click()
  await expect(page.locator('.theme-electric-field')).toHaveCount(1)
  await expect.poll(() => page.evaluate(() => document.getAnimations().filter(animation => animation.effect instanceof KeyframeEffect && animation.effect.pseudoElement === '::view-transition-new(root)').map(animation => animation.effect!.getComputedTiming().duration))).toEqual([2300])
  const style = await page.evaluate(() => {
    const old = getComputedStyle(document.documentElement, '::view-transition-old(root)')
    const next = getComputedStyle(document.documentElement, '::view-transition-new(root)')
    return { oldOpacity: old.opacity, opacity: next.opacity, oldAnimation: old.animationName, animation: next.animationName }
  })
  expect(style).toEqual({ oldOpacity: '1', opacity: '1', oldAnimation: 'none', animation: 'none' })
  await page.waitForTimeout(1600)
  await expect(page.locator('.theme-electric-field')).toHaveCount(1)
  await toggle.click()
  await expect(toggle).toHaveAttribute('aria-checked', 'false')
  await page.waitForTimeout(250)
  await expect(page.locator('.theme-electric-field')).toHaveCount(1)
  await expect(page.locator('html')).toHaveClass(/theme-electric-transition/)
  await expect(page.locator('.theme-electric-field')).toHaveCount(0, { timeout: 4000 })
  await expect(page.locator('html')).not.toHaveClass(/theme-electric-transition/)
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await toggle.focus()
  await page.keyboard.press('Space')
  await expect(toggle).toHaveAttribute('aria-checked', 'true')
  await expect(page.locator('.theme-electric-field')).toHaveCount(0)
  await page.keyboard.press('Enter')
  await expect(toggle).toHaveAttribute('aria-checked', 'false')
})


test('theme still changes when view transitions are unavailable', async ({ page }) => {
  const toggle = await openThemeHome(page)
  await page.evaluate(() => Object.defineProperty(document, 'startViewTransition', { value: undefined, configurable: true }))
  await toggle.click()
  await expect(toggle).toHaveAttribute('aria-checked', 'true')
  await expect(page.locator('html')).toHaveClass(/dark/)
  await expect(page.locator('.theme-electric-field')).toHaveCount(0)
  expect(await page.evaluate(() => localStorage.getItem('expense_tracker_theme'))).toBe('dark')
})


test('failed Roya refresh keeps the saved Roya quote with a visible warning', async ({ page }) => {
  const state = await mockSupabase(page)
  state.failGold = true
  await page.addInitScript(() => {
    localStorage.setItem('pocket_expenses_welcome_seen', 'yes')
    localStorage.setItem('pocket_expense_gold_roya_retail_jod_v3', JSON.stringify({
      id: 'roya-retail-2707', source: 'roya', quote_basis: 'retail', source_detail: 'Saved Roya quote',
      price_24k: 96.5, price_22k: 88.4583, price_21k: 84.1, price_18k: 74.5, price_14k: null,
      fetched_at: new Date(Date.now() - 120000).toISOString(),
    }))
  })
  await page.goto('/')
  await page.getByLabel('Email', { exact: true }).fill('test@example.com')
  await page.getByLabel('Password', { exact: true }).fill('test-password')
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  const card = page.getByRole('region', { name: 'Gold retail price in Jordanian dinars' })
  await expect(card).toContainText('84.10')
  await expect(card).toContainText('Could not refresh · showing saved price')
  state.failGold = false
  await card.getByRole('button', { name: 'Refresh gold price' }).click()
  await expect(card).not.toContainText('Could not refresh · showing saved price')
  await expect(card).toContainText('84.10')
})
