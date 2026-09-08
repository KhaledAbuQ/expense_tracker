import { Category } from '../types'

export interface RawSms {
  id: string
  address: string
  body: string
  date: number | string
}

export type TransactionType = 'expense' | 'income' | 'other'

export interface ParsedBankTransaction {
  id: string
  smsId: string
  sender: string
  amount: number
  currency: string
  date: string // YYYY-MM-DD
  merchant: string
  type: TransactionType
  categoryGuess: string
  suggestedCategoryId?: string
  rawBody: string
  confidence: 'high' | 'medium' | 'low'
  isFinancial: boolean
  accountEnding?: string
}

// Common Bank & Financial Keywords in English and Arabic
const EXPENSE_KEYWORDS_EN = [
  'purchase', 'spent', 'debited', 'debit', 'paid', 'pos', 'withdrawal', 'withdrawn',
  'card ending', 'card purchase', 'online purchase', 'payment of', 'transaction of',
  'transferred to', 'cliq out', 'sent to', 'pay to', 'payment to', 'atm', 'charge',
]

const EXPENSE_KEYWORDS_AR = [
  'شراء', 'خصم', 'سحب', 'دفع', 'قيد على حسابكم', 'حركة بطاقة', 'حوالة صادر',
  'كليك صادر', 'سحب نقدي', 'مشتريات', 'عملية شراء', 'تسوق', 'سداد', 'مدين'
]

const INCOME_KEYWORDS_EN = [
  'credited', 'credit', 'deposit', 'deposited', 'salary', 'refund', 'refunded',
  'received', 'cliq in', 'transfer from', 'received from', 'inward'
]

const INCOME_KEYWORDS_AR = [
  'إيداع', 'ايداع', 'قيد لحسابكم', 'راتب', 'وارد', 'حوالة وارد', 'استرداد', 'دائن'
]

const IGNORE_PATTERNS = [
  /otp\b/i,
  /one\s*time\s*password/i,
  /verification\s*code/i,
  /رمز\s*التحقق/i,
  /رمز\s*التفعيل/i,
  /رمز\s*الأمان/i,
  /secret\s*code/i,
  /do\s*not\s*share/i,
]

// Category keywords for intelligent matching
const CATEGORY_RULES: { category: string; keywords: string[] }[] = [
  {
    category: 'Groceries',
    keywords: [
      'carrefour', 'safeway', 'cozmo', 'miles', 'supermarket', 'market', 'hypermarket',
      'grocery', 'bakery', 'kareem', 'sameh', 'rawabi', 'c-town', 'metro', 'mart',
      'سوبرماركت', 'ماركت', 'بقالة', 'مخبز', 'خضار', 'كارفور', 'سيفوي', 'سامح مول'
    ],
  },
  {
    category: 'Food & Dining',
    keywords: [
      'restaurant', 'cafe', 'coffee', 'mcdonald', 'starbucks', 'burger', 'pizza',
      'shawarma', 'grill', 'sushi', 'diner', 'kfc', 'subway', 'talabat', 'careem food',
      'مطعم', 'كافيه', 'مقهى', 'شاورما', 'برجر', 'وجبات', 'بيتزا', 'قهوة', 'حلويات', 'طلبات'
    ],
  },
  {
    category: 'Transportation',
    keywords: [
      'uber', 'careem', 'petrol', 'gas', 'fuel', 'station', 'shell', 'total', 'manaseer',
      'jo petrol', 'oil', 'taxi', 'parking', 'garage', 'airline', 'flight', 'transport',
      'بنزين', 'محطة', 'محروقات', 'المناصير', 'جو بترول', 'توتال', 'تاكسي', 'موقف', 'كريم', 'اوبر'
    ],
  },
  {
    category: 'Utilities & Bills',
    keywords: [
      'orange', 'zain', 'umniah', 'telecom', 'electricity', 'water', 'internet', 'bill',
      'jepco', 'miyahuna', 'fiber', 'efawateercom', 'e-fawateercom',
      'فواتيركم', 'زين', 'اورنج', 'امنية', 'كهرباء', 'مياه', 'فاتورة', 'انترنت'
    ],
  },
  {
    category: 'Health & Pharmacy',
    keywords: [
      'pharmacy', 'chemist', 'drug', 'hospital', 'clinic', 'medical', 'doctor', 'lab',
      'medication', 'dental', 'optics', 'rawhi', 'one click',
      'صيدلية', 'مستشفى', 'عيادة', 'طبيب', 'مختبر', 'دواء', 'روحي'
    ],
  },
  {
    category: 'Shopping',
    keywords: [
      'zara', 'h&m', 'amazon', 'aliexpress', 'noon', 'shein', 'clothing', 'fashion',
      'shoes', 'mall', 'store', 'electronics', 'ikea', 'apple', 'sharaf dg',
      'مول', 'متجر', 'ملابس', 'أزياء', 'الكترونيات', 'تسوق', 'ايكيا'
    ],
  },
  {
    category: 'Entertainment',
    keywords: [
      'cinema', 'prime', 'netflix', 'spotify', 'movie', 'theatre', 'gaming', 'playstation',
      'steam', 'game', 'سينما', 'ترفيه', 'العاب'
    ],
  },
]

/**
 * Normalizes Eastern Arabic numerals (٠-٩) to standard ASCII digits (0-9).
 */
export function normalizeDigits(text: string): string {
  const easternDigits = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩']
  return text.replace(/[٠-٩]/g, match => easternDigits.indexOf(match).toString())
}

/**
 * Extracts transaction amount and currency from SMS text.
 */
export function extractAmountAndCurrency(text: string): { amount: number; currency: string } | null {
  const clean = normalizeDigits(text)

  // Patterns for Amounts + Currency:
  // e.g. "JOD 15.500", "15.500 JOD", "JD 15.50", "15.50 JD", "15.50 د.أ", "د.أ 15.50", "15 دينار", "$25.00", "USD 25.00"
  const patterns = [
    // Currency followed by amount: JOD 15.500 or USD 25.00 or SAR 50
    /(?:(?:JOD|JD|USD|EUR|GBP|SAR|AED|KWD|QAR|BHD|EGP)\b|\$|€|£)\s*([0-9]+(?:[.,][0-9]{1,3})?)/i,
    // Arabic currency prefix: د.أ 15.500 or دينار 15.500 or درهم 50 or ريال 20
    /(?:د\.?\s*أ|دينار|ريال|درهم|جنيه)\s*([0-9]+(?:[.,][0-9]{1,3})?)/i,
    // Amount followed by currency: 15.500 JOD or 25.00 USD
    /([0-9]+(?:[.,][0-9]{1,3})?)\s*(?:JOD|JD|USD|EUR|GBP|SAR|AED|KWD|QAR|BHD|EGP)\b/i,
    // Amount followed by Arabic currency: 15.500 د.أ or 15.50 دينار
    /([0-9]+(?:[.,][0-9]{1,3})?)\s*(?:د\.?\s*أ|دينار|ريال|درهم|جنيه)/i,
    // "amount: 15.50" or "amount of 15.50" or "بقيمة 15.50" or "مبلغ 15.50"
    /(?:amount(?:\s*is|\s*of)?|sum\s*of|بقيمة|بمبلغ|مبلغ)\s*:?\s*([0-9]+(?:[.,][0-9]{1,3})?)/i,
  ]

  for (const regex of patterns) {
    const match = clean.match(regex)
    if (match && match[1]) {
      // Normalize number
      const numStr = match[1].replace(/,/g, '')
      const amount = parseFloat(numStr)
      if (!isNaN(amount) && amount > 0) {
        // Detect currency
        let currency = 'JOD' // Default for this app
        if (/USD|\$/i.test(text)) currency = 'USD'
        else if (/EUR|€/i.test(text)) currency = 'EUR'
        else if (/GBP|£/i.test(text)) currency = 'GBP'
        else if (/SAR|ريال/i.test(text)) currency = 'SAR'
        else if (/AED|درهم/i.test(text)) currency = 'AED'
        else if (/EGP|جنيه/i.test(text)) currency = 'EGP'
        else if (/KWD/i.test(text)) currency = 'KWD'
        else if (/JOD|JD|د\.?\s*أ|دينار/i.test(text)) currency = 'JOD'

        return { amount, currency }
      }
    }
  }

  // Fallback: look for general decimal numbers in financial context (e.g. "Debited 25.50")
  const generalMatch = clean.match(/(?:spent|debited|purchase|خصم|شراء|دفعت?)\s*([0-9]+(?:[.,][0-9]{1,3})?)/i)
  if (generalMatch && generalMatch[1]) {
    const amount = parseFloat(generalMatch[1].replace(/,/g, ''))
    if (!isNaN(amount) && amount > 0) {
      return { amount, currency: 'JOD' }
    }
  }

  return null
}

/**
 * Extracts merchant, store, or recipient name from SMS text.
 */
export function extractMerchant(text: string, sender: string): string {
  // Common patterns for merchant names:
  // "at STARBUCKS on 08/09"
  // "لدى STARBUCKS بتاريخ"
  // "من STARBUCKS"
  // "to MOHAMMAD via CliQ"
  // "إلى محمد"
  // "at [Merchant] with card"
  const merchantPatterns = [
    /(?:at|@)\s+([A-Za-z0-9\s&'-]{2,30}?)(?:\s+(?:on|with|using|card|ref|avl|avail|bal|date|\.)|$)/i,
    /(?:لدى|من)\s+([A-Za-z0-9\u0600-\u06FF\s&'-]{2,30}?)(?:\s+(?:بتاريخ|بواسطة|عبر|بطاقة|الرصيد|\.)|$)/i,
    /(?:to|paid\s+to|transferred\s+to)\s+([A-Za-z0-9\s&'-]{2,30}?)(?:\s+(?:on|via|ref|bal|\.)|$)/i,
    /(?:إلى|الى|حوالة\s+إلى)\s+([A-Za-z0-9\u0600-\u06FF\s&'-]{2,30}?)(?:\s+(?:بتاريخ|عبر|رصيد|\.)|$)/i,
    /(?:merchant|store|vendor)\s*:?\s*([A-Za-z0-9\u0600-\u06FF\s&'-]{2,30})/i,
  ]

  for (const regex of merchantPatterns) {
    const match = text.match(regex)
    if (match && match[1]) {
      const candidate = match[1].trim()
      // Skip if it accidentally captured common stopwords or dates
      if (!/^(the|card|bank|account|date|ref|atm)$/i.test(candidate) && candidate.length > 2) {
        return candidate
      }
    }
  }

  // If no merchant found, fall back to sender or a descriptive fallback
  const cleanSender = sender.replace(/[^A-Za-z0-9\u0600-\u06FF]/g, ' ').trim()
  return cleanSender ? cleanSender : 'Bank Transaction'
}

/**
 * Extracts card or account ending (e.g. Card **1234 or Acct XX5678).
 */
export function extractAccountEnding(text: string): string | undefined {
  const match = text.match(/(?:card|acct|account|حساب|بطاقة)[^\d]*([0-9]{4})\b/i)
  return match ? match[1] : undefined
}

/**
 * Extracts transaction date from SMS text, or falls back to SMS timestamp.
 */
export function extractDate(text: string, timestamp: number | string): string {
  // Look for date patterns in SMS body:
  // e.g. 2026-09-08 or 08/09/2026 or 08-09-2026
  const isoMatch = text.match(/\b(20\d{2}[-/](?:0[1-9]|1[0-2])[-/](?:0[1-9]|[12]\d|3[01]))\b/)
  if (isoMatch) {
    return isoMatch[1].replace(/\//g, '-')
  }

  const dmyMatch = text.match(/\b((?:0[1-9]|[12]\d|3[01])[-/](?:0[1-9]|1[0-2])[-/](20\d{2}))\b/)
  if (dmyMatch) {
    const parts = dmyMatch[1].split(/[-/]/)
    return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`
  }

  // Fallback to the SMS received timestamp
  try {
    const dateObj = new Date(typeof timestamp === 'string' ? parseInt(timestamp, 10) || timestamp : timestamp)
    if (!isNaN(dateObj.getTime())) {
      return dateObj.toISOString().split('T')[0]
    }
  } catch {
    // ignore
  }

  return new Date().toISOString().split('T')[0]
}

/**
 * Matches merchant or SMS text against existing categories.
 */
export function matchCategory(
  merchant: string,
  rawText: string,
  categories: Category[] = []
): { categoryGuess: string; categoryId?: string } {
  const combined = `${merchant} ${rawText}`.toLowerCase()

  // First try rules
  for (const rule of CATEGORY_RULES) {
    for (const kw of rule.keywords) {
      if (combined.includes(kw.toLowerCase())) {
        // Find if user already has a category matching this name or type
        const matchingCategory = categories.find(
          c => c.name.toLowerCase().includes(rule.category.toLowerCase()) ||
               rule.category.toLowerCase().includes(c.name.toLowerCase())
        )
        return {
          categoryGuess: rule.category,
          categoryId: matchingCategory?.id,
        }
      }
    }
  }

  // Second try matching directly against user category names
  for (const cat of categories) {
    if (combined.includes(cat.name.toLowerCase())) {
      return {
        categoryGuess: cat.name,
        categoryId: cat.id,
      }
    }
  }

  // Default fallback
  const firstExpenseCategory = categories.find(c => c.category_type === 'expense' || c.category_type === 'both')
  return {
    categoryGuess: firstExpenseCategory?.name || 'General',
    categoryId: firstExpenseCategory?.id,
  }
}

/**
 * Main parser function: parses a raw SMS into a structured bank transaction.
 */
export function parseBankSms(
  sms: RawSms,
  categories: Category[] = []
): ParsedBankTransaction {
  const body = sms.body || ''
  const sender = sms.address || ''

  // 1. Check if it's an OTP or non-financial alert to ignore
  const isOtp = IGNORE_PATTERNS.some(regex => regex.test(body))

  // 2. Extract amount and currency
  const financialData = extractAmountAndCurrency(body)

  // 3. Determine transaction type (expense vs income vs other)
  const lowerBody = body.toLowerCase()
  const isExpenseKeyword = EXPENSE_KEYWORDS_EN.some(kw => lowerBody.includes(kw)) ||
    EXPENSE_KEYWORDS_AR.some(kw => body.includes(kw))
  const isIncomeKeyword = INCOME_KEYWORDS_EN.some(kw => lowerBody.includes(kw)) ||
    INCOME_KEYWORDS_AR.some(kw => body.includes(kw))

  let type: TransactionType = 'other'
  if (!isOtp && financialData) {
    if (isExpenseKeyword) {
      type = 'expense'
    } else if (isIncomeKeyword) {
      type = 'income'
    } else {
      // Default to expense if financial amount is present in a bank-like context
      type = 'expense'
    }
  }

  // 4. Extract Merchant / Description
  const merchant = extractMerchant(body, sender)
  const date = extractDate(body, sms.date)
  const accountEnding = extractAccountEnding(body)

  // 5. Category matching
  const { categoryGuess, categoryId } = matchCategory(merchant, body, categories)

  // 6. Confidence scoring
  let confidence: 'high' | 'medium' | 'low' = 'low'
  if (financialData && !isOtp) {
    if ((isExpenseKeyword || isIncomeKeyword) && merchant !== sender && merchant !== 'Bank Transaction') {
      confidence = 'high'
    } else {
      confidence = 'medium'
    }
  }

  const isFinancial = !isOtp && financialData !== null && type !== 'other'

  return {
    id: `sms-${sms.id || Math.random().toString(36).substring(2, 9)}`,
    smsId: sms.id,
    sender,
    amount: financialData?.amount || 0,
    currency: financialData?.currency || 'JOD',
    date,
    merchant,
    type,
    categoryGuess,
    suggestedCategoryId: categoryId,
    rawBody: body,
    confidence,
    isFinancial,
    accountEnding,
  }
}
