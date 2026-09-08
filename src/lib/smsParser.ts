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
  availableBalance?: number
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
      'uncle osaka', 'osaka', 'cheesecake', 'sweets', 'dessert',
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
  {
    category: 'Salary & Income',
    keywords: [
      'salary', 'cliq', 'transfer from', 'inward', 'payroll', 'dividend', 'interest',
      'راتب', 'حوالة كليك', 'إيداع', 'دفعة', 'مكافأة'
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
 * Extracts available balance if present in the message.
 */
export function extractAvailableBalance(text: string): { balance: number; currency: string } | null {
  const clean = normalizeDigits(text)
  const balanceRegex = /(?:available\s*balance|avail\s*bal|balance|الرصيد\s*المتاح|الرصيد)[\s:]*(?:(?:JOD|JD|USD|EUR|GBP|SAR|AED|KWD|QAR|BHD|EGP)|\$|€|£|د\.?\s*أ|دينار)?\s*([0-9]+(?:[.,][0-9]{1,3})?)\s*(?:(?:JOD|JD|USD|EUR|GBP|SAR|AED|KWD|QAR|BHD|EGP)|\$|€|£|د\.?\s*أ|دينار)?/i
  const match = clean.match(balanceRegex)
  if (match && match[1]) {
    const val = parseFloat(match[1].replace(/,/g, ''))
    if (!isNaN(val)) {
      return { balance: val, currency: 'JOD' }
    }
  }
  return null
}

/**
 * Extracts transaction amount and currency from SMS text.
 * Strips the balance clause first so balance amounts are never mistakenly parsed.
 */
export function extractAmountAndCurrency(text: string): { amount: number; currency: string; balance?: number } | null {
  const clean = normalizeDigits(text)

  // 1. Check and separate the balance portion
  const balanceInfo = extractAvailableBalance(clean)
  const balanceRegex = /(?:available\s*balance|avail\s*bal|balance|الرصيد\s*المتاح|الرصيد)[\s:].*$/i
  const balanceIndex = clean.search(balanceRegex)
  
  // Isolate the text before the balance clause to prevent picking up balance amount
  const textWithoutBalance = balanceIndex !== -1 ? clean.substring(0, balanceIndex) : clean

  // Patterns for Amounts + Currency in transaction context:
  // e.g. "JOD6.200", "JOD 15.500", "30.000 JOD", "4.000 JOD", "15.50 د.أ", "د.أ 15.50", "15 دينار", "$25.00"
  const patterns = [
    // Explicit transaction prefix: "A purchase transaction of 4.000 JOD" or "amount of 15.50" or "بقيمة 15.50"
    /(?:purchase(?:\s*transaction)?\s*of|payment\s*of|transaction\s*of|sum\s*of|amount(?:\s*is|\s*of)?|بقيمة|بمبلغ|مبلغ)\s*:?\s*(?:(?:JOD|JD|USD|EUR|GBP|SAR|AED|KWD|QAR|BHD|EGP)|\$|€|£|د\.?\s*أ|دينار)?\s*([0-9]+(?:[.,][0-9]{1,3})?)\s*(?:(?:JOD|JD|USD|EUR|GBP|SAR|AED|KWD|QAR|BHD|EGP)|\$|€|£|د\.?\s*أ|دينار)?/i,
    // Currency followed directly or with space by amount: JOD6.200 or JOD 15.500 or $25.00
    /(?:(?:JOD|JD|USD|EUR|GBP|SAR|AED|KWD|QAR|BHD|EGP)|\$|€|£)\s*([0-9]+(?:[.,][0-9]{1,3})?)/i,
    // Arabic currency prefix: د.أ 15.500 or دينار 15.500 or درهم 50 or ريال 20
    /(?:د\.?\s*أ|دينار|ريال|درهم|جنيه)\s*([0-9]+(?:[.,][0-9]{1,3})?)/i,
    // Amount followed directly or with space by currency: 30.000 JOD or 4.000 JOD or 25.00USD
    /([0-9]+(?:[.,][0-9]{1,3})?)\s*(?:(?:JOD|JD|USD|EUR|GBP|SAR|AED|KWD|QAR|BHD|EGP)|\$|€|£)/i,
    // Amount followed by Arabic currency: 15.500 د.أ or 15.50 دينار
    /([0-9]+(?:[.,][0-9]{1,3})?)\s*(?:د\.?\s*أ|دينار|ريال|درهم|جنيه)/i,
    // Amount followed by "has been credited" / "has been debited"
    /([0-9]+(?:[.,][0-9]{1,3})?)\s*(?:has\s+been\s+credited|has\s+been\s+debited|credited|debited)/i,
  ]

  for (const regex of patterns) {
    const match = textWithoutBalance.match(regex)
    if (match && match[1]) {
      const numStr = match[1].replace(/,/g, '')
      const amount = parseFloat(numStr)
      if (!isNaN(amount) && amount > 0) {
        let currency = 'JOD' // Default for this app
        if (/USD|\$/i.test(text)) currency = 'USD'
        else if (/EUR|€/i.test(text)) currency = 'EUR'
        else if (/GBP|£/i.test(text)) currency = 'GBP'
        else if (/SAR|ريال/i.test(text)) currency = 'SAR'
        else if (/AED|درهم/i.test(text)) currency = 'AED'
        else if (/EGP|جنيه/i.test(text)) currency = 'EGP'
        else if (/KWD/i.test(text)) currency = 'KWD'
        else if (/JOD|JD|د\.?\s*أ|دينار/i.test(text)) currency = 'JOD'

        return {
          amount,
          currency,
          balance: balanceInfo?.balance,
        }
      }
    }
  }

  // Fallback on general text without balance
  const fallbackMatch = textWithoutBalance.match(/(?:spent|debited|purchase|credited|خصم|شراء|قيد|دفعت?)\s*([0-9]+(?:[.,][0-9]{1,3})?)/i)
  if (fallbackMatch && fallbackMatch[1]) {
    const amount = parseFloat(fallbackMatch[1].replace(/,/g, ''))
    if (!isNaN(amount) && amount > 0) {
      return {
        amount,
        currency: 'JOD',
        balance: balanceInfo?.balance,
      }
    }
  }

  return null
}

/**
 * Extracts merchant, store, or party name from SMS text.
 */
export function extractMerchant(text: string, sender: string, type: TransactionType = 'expense'): string {
  // 1. "from [MERCHANT] has been debited" / "from [PARTY] as CliQ transfer"
  const fromPatterns = [
    /from\s+([A-Za-z0-9\s&'-]{2,35}?)(?:\s+(?:has\s+been|was|as\s+CliQ|via\s+CliQ|as\s+transfer|Balance\b|on\b|using|with)|$)/i,
    /(?:لدى|من)\s+([A-Za-z0-9\u0600-\u06FF\s&'-]{2,35}?)(?:\s+(?:بتاريخ|بواسطة|عبر|بطاقة|الرصيد|كحوالة|\.)|$)/i,
  ]

  for (const regex of fromPatterns) {
    const match = text.match(regex)
    if (match && match[1]) {
      const candidate = match[1].trim()
      if (!/^(the|card|bank|account|date|ref|atm|your\s+card|your\s+account)$/i.test(candidate) && candidate.length > 2) {
        return candidate
      }
    }
  }

  // 2. "at [MERCHANT] on [DATE]"
  const atMatch = text.match(/(?:at|@)\s+([A-Za-z0-9\s&'-]{2,35}?)(?:\s+(?:on|with|using|card|ref|avl|avail|bal|date|\.)|$)/i)
  if (atMatch && atMatch[1]) {
    const candidate = atMatch[1].trim()
    if (!/^(the|card|bank|account|date|ref|atm)$/i.test(candidate) && candidate.length > 2) {
      return candidate
    }
  }

  // 3. "to [RECIPIENT] on [DATE]" / "paid to [RECIPIENT]"
  const toMatch = text.match(/(?:paid\s+to|transferred\s+to|to)\s+([A-Za-z0-9\s&'-]{2,35}?)(?:\s+(?:on|via|ref|bal|\.)|$)/i)
  if (toMatch && toMatch[1]) {
    const candidate = toMatch[1].trim()
    if (!/^(the|card|bank|account|your\s+account|your\s+card|date|ref|atm)$/i.test(candidate) && candidate.length > 2) {
      return candidate
    }
  }

  // 4. Check for CliQ transfer indication
  if (/cliq/i.test(text)) {
    return type === 'income' ? 'CliQ Received' : 'CliQ Transfer'
  }

  // 5. If credited to account without specific merchant
  if (type === 'income') {
    if (/salary|payroll|راتب/i.test(text)) return 'Salary Deposit'
    if (/refund|استرداد/i.test(text)) return 'Refund'
    return 'Bank Deposit'
  }

  // Fallback to sender or general title
  const cleanSender = sender.replace(/[^A-Za-z0-9\u0600-\u06FF]/g, ' ').trim()
  return cleanSender ? cleanSender : 'Bank Transaction'
}

/**
 * Extracts card or account ending (e.g. XXXX5061, Card ending 1234, to 0145*500).
 */
export function extractAccountEnding(text: string): string | undefined {
  // e.g. 0145*500from or *500
  const starMatch = text.match(/\*([0-9]{3,4})/i)
  if (starMatch) return starMatch[1]

  // e.g. card XXXX5061 or card 5061
  const cardMatch = text.match(/(?:card|بطاقة)[^\d]*([0-9]{4})\b/i) || text.match(/(?:XXXX|\*{3,4})([0-9]{4})\b/i)
  if (cardMatch) return cardMatch[1]

  // e.g. account ending 1234
  const acctMatch = text.match(/(?:acct|account|حساب)[^\d]*([0-9]{3,4})\b/i)
  if (acctMatch) return acctMatch[1]

  return undefined
}

/**
 * Extracts transaction date from SMS text, supporting:
 * - DD-MM-YYYY (e.g. 06-09-2026)
 * - DD/MM/YYYY (e.g. 06/09/2026)
 * - YYYY-MM-DD (e.g. 2026-09-06)
 * - DD/MM (e.g. 08/09 or 08/09 01:22)
 * Falls back to SMS timestamp if no date is in the SMS text.
 */
export function extractDate(text: string, timestamp: number | string): string {
  // 1. ISO format: 2026-09-08 or 2026/09/08
  const isoMatch = text.match(/\b(20\d{2}[-/](?:0[1-9]|1[0-2])[-/](?:0[1-9]|[12]\d|3[01]))\b/)
  if (isoMatch) {
    return isoMatch[1].replace(/\//g, '-')
  }

  // 2. DD-MM-YYYY or DD/MM/YYYY: 06-09-2026 or 06/09/2026
  const dmyMatch = text.match(/\b((?:0[1-9]|[12]\d|3[01])[-/](?:0[1-9]|1[0-2])[-/](20\d{2}))\b/)
  if (dmyMatch) {
    const parts = dmyMatch[1].split(/[-/]/)
    return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`
  }

  // 3. DD/MM with optional time: 08/09 01:22
  const dmMatch = text.match(/\b((?:0[1-9]|[12]\d|3[01])[-/](0[1-9]|1[0-2]))(?:\s+[0-2]?\d:[0-5]\d)?\b/)
  if (dmMatch) {
    const parts = dmMatch[1].split(/[-/]/)
    const year = new Date().getFullYear()
    return `${year}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`
  }

  // 4. Fallback to the SMS received timestamp
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
  type: TransactionType,
  categories: Category[] = []
): { categoryGuess: string; categoryId?: string } {
  const combined = `${merchant} ${rawText}`.toLowerCase()

  // First try rules matching the transaction type
  for (const rule of CATEGORY_RULES) {
    for (const kw of rule.keywords) {
      if (combined.includes(kw.toLowerCase())) {
        const matchingCategory = categories.find(
          c => (type === 'income' ? c.category_type === 'income' || c.category_type === 'both' : c.category_type !== 'income') &&
               (c.name.toLowerCase().includes(rule.category.toLowerCase()) || rule.category.toLowerCase().includes(c.name.toLowerCase()))
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
    if ((type === 'income' ? cat.category_type !== 'expense' : cat.category_type !== 'income') &&
        combined.includes(cat.name.toLowerCase())) {
      return {
        categoryGuess: cat.name,
        categoryId: cat.id,
      }
    }
  }

  // Default fallback
  const fallbackCategory = categories.find(c =>
    type === 'income' ? c.category_type === 'income' || c.category_type === 'both' : c.category_type === 'expense' || c.category_type === 'both'
  )

  return {
    categoryGuess: fallbackCategory?.name || (type === 'income' ? 'Income' : 'General'),
    categoryId: fallbackCategory?.id,
  }
}

/**
 * Main parser function: parses a raw SMS into a structured bank transaction (expense or income).
 */
export function parseBankSms(
  sms: RawSms,
  categories: Category[] = []
): ParsedBankTransaction {
  const body = sms.body || ''
  const sender = sms.address || ''

  // 1. Check if it's an OTP or non-financial alert to ignore
  const isOtp = IGNORE_PATTERNS.some(regex => regex.test(body))

  // 2. Extract amount, currency and balance
  const financialData = extractAmountAndCurrency(body)

  // 3. Determine transaction type (expense vs income vs other)
  const lowerBody = body.toLowerCase()
  const isExpenseKeyword = EXPENSE_KEYWORDS_EN.some(kw => lowerBody.includes(kw)) ||
    EXPENSE_KEYWORDS_AR.some(kw => body.includes(kw))
  const isIncomeKeyword = INCOME_KEYWORDS_EN.some(kw => lowerBody.includes(kw)) ||
    INCOME_KEYWORDS_AR.some(kw => body.includes(kw))

  let type: TransactionType = 'other'
  if (!isOtp && financialData) {
    if (isIncomeKeyword && !isExpenseKeyword) {
      type = 'income'
    } else if (isExpenseKeyword && !isIncomeKeyword) {
      type = 'expense'
    } else if (isIncomeKeyword) {
      // e.g. "credited"
      type = 'income'
    } else {
      // Default to expense if financial amount is present
      type = 'expense'
    }
  }

  // 4. Extract Merchant / Party, Date, and Account ending
  const merchant = extractMerchant(body, sender, type)
  const date = extractDate(body, sms.date)
  const accountEnding = extractAccountEnding(body)

  // 5. Category matching
  const { categoryGuess, categoryId } = matchCategory(merchant, body, type, categories)

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
    availableBalance: financialData?.balance,
  }
}
