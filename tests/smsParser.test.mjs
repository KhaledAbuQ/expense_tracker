import { build } from 'esbuild'
import assert from 'node:assert/strict'
import { test } from 'node:test'

const load = async path => {
  const result = await build({ entryPoints: [path], bundle: true, platform: 'node', format: 'esm', write: false })
  return import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`)
}

const {
  extractAmountAndCurrency,
  extractMerchant,
  extractDate,
  normalizeDigits,
  parseBankSms,
  matchCategory,
  saveLearnedCategory
} = await load('src/lib/smsParser.ts')

test('SMS Parser - Arabic digits normalization', () => {
  assert.equal(normalizeDigits('١٢٣.٤٥'), '123.45')
  assert.equal(normalizeDigits('المبلغ: ٥٠.٠٠ دينار'), 'المبلغ: 50.00 دينار')
})

test('SMS Parser - User Example 1: CliQ credited JOD6.200 with balance', () => {
  const sampleSms = {
    id: 'user-1',
    address: 'Bank',
    body: 'JOD6.200 has been credited to 0145*500from KHALED ISSA SABRI ABU QUTISH as CliQ transfer Balance 923.186JOD',
    date: Date.now()
  }

  const parsed = parseBankSms(sampleSms)
  assert.equal(parsed.isFinancial, true)
  assert.equal(parsed.amount, 6.2)
  assert.equal(parsed.currency, 'JOD')
  assert.equal(parsed.type, 'income')
  assert.equal(parsed.merchant, 'KHALED ISSA SABRI ABU QUTISH')
  assert.equal(parsed.availableBalance, 923.186)
  assert.equal(parsed.accountEnding, '500')
})

test('SMS Parser - User Example 2: Account credited 30.000 JOD with DD/MM date and time', () => {
  const sampleSms = {
    id: 'user-2',
    address: 'Bank',
    body: '30.000 JOD has been credited to your account on 08/09 01:22. Available balance 47.744 JOD.',
    date: Date.now()
  }

  const parsed = parseBankSms(sampleSms)
  assert.equal(parsed.isFinancial, true)
  assert.equal(parsed.amount, 30.0)
  assert.equal(parsed.currency, 'JOD')
  assert.equal(parsed.type, 'income')
  assert.equal(parsed.date, '2026-09-08')
  assert.equal(parsed.availableBalance, 47.744)
})

test('SMS Parser - User Example 3: Purchase debited 4.000 JOD UNCLE OSAKA with card XXXX5061 on 06-09-2026', () => {
  const sampleSms = {
    id: 'user-3',
    address: 'Bank',
    body: 'A purchase transaction of 4.000 JOD from UNCLE OSAKA ALRABIEH has been debited from your card XXXX5061 on 06-09-2026. Available balance 17.744 JOD.',
    date: Date.now()
  }

  const parsed = parseBankSms(sampleSms, [
    { id: 'cat-dining', name: 'Food & Dining', icon: 'Utensils', color: '#f59e0b', is_default: true, category_type: 'expense', created_at: '' }
  ])

  assert.equal(parsed.isFinancial, true)
  assert.equal(parsed.amount, 4.0)
  assert.equal(parsed.currency, 'JOD')
  assert.equal(parsed.type, 'expense')
  assert.equal(parsed.merchant, 'UNCLE OSAKA ALRABIEH')
  assert.equal(parsed.date, '2026-09-06')
  assert.equal(parsed.accountEnding, '5061')
  assert.equal(parsed.availableBalance, 17.744)
  assert.equal(parsed.suggestedCategoryId, 'cat-dining')
})

test('SMS Parser - English Bank SMS (Jordan / Etihad / Arab Bank)', () => {
  const sampleSms = {
    id: '101',
    address: 'EtihadBank',
    body: 'Purchase of JOD 14.500 at STARBUCKS with card ending 1234 on 08/09/2026. Avail Bal: JOD 230.120',
    date: Date.now()
  }

  const parsed = parseBankSms(sampleSms, [
    { id: 'cat-1', name: 'Food & Dining', icon: 'Utensils', color: '#f59e0b', is_default: true, category_type: 'expense', created_at: '' }
  ])

  assert.equal(parsed.isFinancial, true)
  assert.equal(parsed.amount, 14.5)
  assert.equal(parsed.currency, 'JOD')
  assert.equal(parsed.type, 'expense')
  assert.equal(parsed.merchant.toUpperCase(), 'STARBUCKS')
  assert.equal(parsed.suggestedCategoryId, 'cat-1')
  assert.equal(parsed.accountEnding, '1234')
  assert.equal(parsed.availableBalance, 230.12)
})

test('SMS Parser - Arabic Bank SMS (Arab Bank / Housing Bank / CliQ)', () => {
  const sampleSms = {
    id: '102',
    address: 'ArabBank',
    body: 'تمت عملية شراء بقيمة 45.000 د.أ لدى كارفور بواسطة بطاقة تنتهي بـ 5678 بتاريخ 2026-09-08. الرصيد 120.00 د.أ',
    date: Date.now()
  }

  const parsed = parseBankSms(sampleSms, [
    { id: 'cat-groc', name: 'Groceries', icon: 'ShoppingBag', color: '#10b981', is_default: true, category_type: 'expense', created_at: '' }
  ])

  assert.equal(parsed.isFinancial, true)
  assert.equal(parsed.amount, 45)
  assert.equal(parsed.currency, 'JOD')
  assert.equal(parsed.type, 'expense')
  assert.equal(parsed.suggestedCategoryId, 'cat-groc')
  assert.equal(parsed.accountEnding, '5678')
})

test('SMS Parser - Fuel / Gas station transaction', () => {
  const sampleSms = {
    id: '103',
    address: 'JKB',
    body: 'Purchase of JD 20.000 at MANASEER GAS STATION with card 4321',
    date: Date.now()
  }

  const parsed = parseBankSms(sampleSms, [
    { id: 'cat-trans', name: 'Transportation', icon: 'Car', color: '#3b82f6', is_default: true, category_type: 'expense', created_at: '' }
  ])

  assert.equal(parsed.amount, 20)
  assert.equal(parsed.currency, 'JOD')
  assert.equal(parsed.suggestedCategoryId, 'cat-trans')
})

test('SMS Parser - Ignores OTP security codes', () => {
  const sampleSms = {
    id: '104',
    address: 'BankAlEtihad',
    body: 'Your OTP is 829104. Do not share this code with anyone. Amount JOD 15.00',
    date: Date.now()
  }

  const parsed = parseBankSms(sampleSms)
  assert.equal(parsed.isFinancial, false)
})

test('SMS Parser - Income / Credit transfer', () => {
  const sampleSms = {
    id: '105',
    address: 'Bank',
    body: 'Salary credited JOD 1,200.00 to account ending 9999',
    date: Date.now()
  }

  const parsed = parseBankSms(sampleSms)
  assert.equal(parsed.type, 'income')
  assert.equal(parsed.amount, 1200)
  assert.equal(parsed.categoryGuess, 'Salary & Income')
})

test('SMS Parser - Category Detection for Uncle Osaka (Food & Dining)', () => {
  const sampleSms = {
    id: 'cat-test-1',
    address: 'Bank',
    body: 'A purchase transaction of 4.000 JOD from UNCLE OSAKA ALRABIEH has been debited from your card XXXX5061 on 06-09-2026. Available balance 17.744 JOD.',
    date: Date.now()
  }

  const parsed = parseBankSms(sampleSms)
  assert.equal(parsed.categoryGuess, 'Food & Dining')
})

test('SMS Parser - Category Detection for Carrefour & Supermarkets (Groceries)', () => {
  const sampleSms = {
    id: 'cat-test-2',
    address: 'Bank',
    body: 'Purchase of 35.50 JOD at CARREFOUR CITY MALL with card 1234',
    date: Date.now()
  }

  const parsed = parseBankSms(sampleSms)
  assert.equal(parsed.categoryGuess, 'Groceries')
})

test('SMS Parser - Category Detection for Fuel & Stations (Transportation)', () => {
  const sampleSms = {
    id: 'cat-test-3',
    address: 'Bank',
    body: 'تمت عملية شراء بقيمة 20.00 د.أ لدى محطة المناصير بتاريخ اليوم',
    date: Date.now()
  }

  const parsed = parseBankSms(sampleSms)
  assert.equal(parsed.categoryGuess, 'Transportation')
})

test('SMS Parser - Category Detection for Bills & Telecom (Utilities & Bills)', () => {
  const sampleSms = {
    id: 'cat-test-4',
    address: 'Bank',
    body: 'Payment of 25.00 JOD to ZAIN FIBER via eFawateercom on 08/09/2026',
    date: Date.now()
  }

  const parsed = parseBankSms(sampleSms)
  assert.equal(parsed.categoryGuess, 'Utilities & Bills')
})

test('SMS Parser - Category Detection for Pharmacy (Health & Pharmacy)', () => {
  const sampleSms = {
    id: 'cat-test-5',
    address: 'Bank',
    body: 'Purchase of 12.300 JOD at PHARMACY ONE on 08-09-2026',
    date: Date.now()
  }

  const parsed = parseBankSms(sampleSms)
  assert.equal(parsed.categoryGuess, 'Health & Pharmacy')
})

test('SMS Parser - Maps to custom user category using alias', () => {
  const sampleSms = {
    id: 'cat-test-6',
    address: 'Bank',
    body: 'Purchase of 15.000 JOD at STARBUCKS on 08-09-2026',
    date: Date.now()
  }

  // User category is named "Restaurants" instead of "Food & Dining"
  const userCategories = [
    { id: 'cat-rest', name: 'Restaurants', icon: 'Utensils', color: '#f59e0b', is_default: false, category_type: 'expense', created_at: '' }
  ]

  const parsed = parseBankSms(sampleSms, userCategories)
  assert.equal(parsed.suggestedCategoryId, 'cat-rest')
})

const category = (id, name, type = 'expense') => ({ id, name, category_type: type, is_default: true, icon: 'tag', color: '#5267f5', created_at: '' })
const householdCategories = [
  category('grocery', 'Groceries'), category('dining', 'Dining Out'),
  category('health', 'Healthcare'), category('shopping', 'Shopping'),
  category('transport', 'Transportation'), category('utilities', 'Utilities'),
  category('salary', 'Salary', 'income'), category('freelance', 'Freelance', 'income'),
  category('other-income', 'Other Income', 'income'), category('other', 'Other'),
]
const purchase = merchant => parseBankSms({ id: merchant, address: 'Bank', date: Date.UTC(2026, 9, 5), body: `Purchase of JOD 12.500 at ${merchant} on 05/10/2026. Available balance JOD 150.000.` }, householdCategories)

test('Unknown merchants do not inherit Healthcare from available balance or the first category', () => {
  const parsed = purchase('UNKNOWN MERCHANT')
  assert.equal(parsed.suggestedCategoryId, 'other')
  assert.equal(parsed.isAutoDetected, false)
  const unmatched = matchCategory('UNKNOWN MERCHANT', 'Purchase JOD 12.500. Available balance JOD 150', 'expense', householdCategories.filter(c => c.id !== 'other'))
  assert.equal(unmatched.categoryId, undefined)
  assert.equal(unmatched.isAutoDetected, false)
})

test('Merchant brands outrank mall location and overlapping generic words', () => {
  assert.equal(purchase('CARREFOUR CITY MALL').suggestedCategoryId, 'grocery')
  assert.equal(purchase('PHARMACY ONE CITY MALL').suggestedCategoryId, 'health')
  assert.equal(purchase('METRO RESTAURANT').suggestedCategoryId, 'dining')
  assert.equal(purchase('CAREEM FOOD').suggestedCategoryId, 'dining')
  assert.equal(purchase('JUST COFFEE').suggestedCategoryId, 'dining')
})

test('Brand punctuation and Arabic merchant text survive extraction', () => {
  assert.equal(purchase('TALABAT.COM').merchant, 'TALABAT.COM')
  assert.equal(purchase('H&M').suggestedCategoryId, 'shopping')
  const parsed = parseBankSms({ id: 'arabic', address: 'Bank', date: Date.UTC(2026, 9, 5), body: 'تمت عملية شراء بقيمة ١٢.٥٠٠ دينار لدى صيدلية روحي بتاريخ 2026-10-05. الرصيد المتاح 150 دينار' }, householdCategories)
  assert.equal(parsed.merchant, 'صيدلية روحي')
  assert.equal(parsed.suggestedCategoryId, 'health')
})

test('Credit-card purchases remain expenses, while unknown CliQ receipts are not salary', () => {
  const debit = parseBankSms({ id: 'credit-card', address: 'Bank', date: Date.UTC(2026, 9, 5), body: 'Purchase of JOD 10.500 at STARBUCKS using your credit card. Available balance JOD 100.' }, householdCategories)
  assert.equal(debit.type, 'expense')
  assert.equal(debit.suggestedCategoryId, 'dining')
  const receipt = parseBankSms({ id: 'cliq-in', address: 'Bank', date: Date.UTC(2026, 9, 5), body: 'JOD 10.500 credited from AHMED as CliQ transfer. Balance JOD 100.' }, householdCategories)
  assert.equal(receipt.type, 'income')
  assert.equal(receipt.suggestedCategoryId, 'other-income')
  assert.equal(receipt.isAutoDetected, false)
})

test('Category mapping is independent of category ordering and does not use partial aliases', () => {
  const first = matchCategory('STARBUCKS', 'Purchase JOD 10', 'expense', householdCategories)
  const reversed = matchCategory('STARBUCKS', 'Purchase JOD 10', 'expense', [...householdCategories].reverse())
  assert.equal(first.categoryId, reversed.categoryId)
  const salary = matchCategory('Salary Deposit', 'Salary credited JOD 100', 'income', [category('other-income', 'Other Income', 'income')])
  assert.equal(salary.categoryId, undefined)
})

test('Declined payments and promotional prices are not recorded as transactions', () => {
  const sms = { id: 'ignored', address: 'Bank', date: Date.UTC(2026, 9, 5) }
  assert.equal(parseBankSms({ ...sms, body: 'Purchase of JOD 20 at CARREFOUR was declined due to insufficient funds.' }, householdCategories).isFinancial, false)
  assert.equal(parseBankSms({ ...sms, body: 'Enjoy our restaurant offer for only JOD 20 today.' }, householdCategories).isFinancial, false)
})

test('Explicit merchant corrections override rules, but legacy automatic guesses are not reused', () => {
  const storage = new Map()
  const previous = globalThis.localStorage
  globalThis.localStorage = { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value) }
  try {
    storage.set('pocket_expenses_merchant_categories', JSON.stringify({ starbucks: 'grocery' }))
    assert.equal(purchase('STARBUCKS').suggestedCategoryId, 'dining')
    saveLearnedCategory('STARBUCKS-AMMAN', 'grocery')
    assert.equal(purchase('Starbucks Amman').suggestedCategoryId, 'grocery')
    const missing = matchCategory('Starbucks Amman', 'Purchase JOD 10', 'expense', householdCategories.filter(c => c.id !== 'grocery'))
    assert.equal(missing.categoryId, 'dining')
  } finally {
    if (previous === undefined) delete globalThis.localStorage
    else globalThis.localStorage = previous
  }
})

