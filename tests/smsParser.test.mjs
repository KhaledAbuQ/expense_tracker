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
  parseBankSms
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
})
