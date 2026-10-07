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
  isAutoDetected?: boolean
  rawBody: string
  confidence: 'high' | 'medium' | 'low'
  isFinancial: boolean
  accountEnding?: string
  availableBalance?: number
}

// The old cache mixed automatic guesses with explicit corrections.
const LEARNED_MERCHANTS_KEY = 'pocket_expenses_merchant_categories_v2'
const LEARNED_MESSAGES_KEY = 'pocket_expenses_message_categories_v3'

function messageKeys(merchant: string, body: string, type: TransactionType, sender: string): string[] {
  const stableMerchant = normalizeText(merchant.replace(/[\d٠-٩۰-۹]+(?:[.,:/-][\d٠-٩۰-۹]+)*/g, ' '))
  const template = normalizeText(body.replace(/[\d٠-٩۰-۹]+(?:[.,:/-][\d٠-٩۰-۹]+)*/g, ' ').replace(/[*•]+/g, ' '))
  const keys: string[] = []
  if (stableMerchant.length > 2 && !/^(bank|bank transaction|cliq received|cliq transfer|بنك|مصرف)$/.test(stableMerchant) && stableMerchant !== normalizeText(sender)) keys.push(`${type}:merchant:${stableMerchant}`)
  if (template.length > 15) keys.push(`${type}:sender:${normalizeText(sender)}:template:${template}`)
  return keys
}

/** Explicit category choices survive restarts and ignore changing amounts/dates. */
export function rememberSmsCategory(tx: ParsedBankTransaction, categoryId: string, merchant = tx.merchant): void {
  if (!categoryId) return
  try {
    const map = JSON.parse(localStorage.getItem(LEARNED_MESSAGES_KEY) || '{}')
    for (const key of new Set([...messageKeys(tx.merchant, tx.rawBody, tx.type, tx.sender), ...messageKeys(merchant, tx.rawBody, tx.type, tx.sender)])) map[key] = categoryId
    localStorage.setItem(LEARNED_MESSAGES_KEY, JSON.stringify(map))
  } catch { /* Storage may be unavailable. */ }
}

function learnedMessageCategory(merchant: string, body: string, type: TransactionType, sender: string): string | undefined {
  try {
    const map = JSON.parse(localStorage.getItem(LEARNED_MESSAGES_KEY) || '{}')
    return messageKeys(merchant, body, type, sender).map(key => map[key]).find(Boolean)
  } catch { return undefined }
}

function normalizeText(text: string): string {
  return normalizeDigits(text).toLowerCase().normalize('NFKD')
    .replace(/[\u0300-\u036f\u064b-\u065f\u0670\u0640]/g, '')
    .replace(/[أإآٱ]/g, 'ا').replace(/ى/g, 'ي')
    .replace(/[^\p{L}\p{N}]+/gu, ' ').trim().replace(/\s+/g, ' ')
}

function hasTerm(text: string, term: string): boolean {
  const normalized = normalizeText(term)
  return normalized.length > 0 && ` ${normalizeText(text)} `.includes(` ${normalized} `)
}

/**
 * Gets a learned category ID for a specific merchant if previously saved/approved by the user.
 */
export function getLearnedCategory(merchant: string): string | undefined {
  try {
    if (typeof localStorage === 'undefined') return undefined
    const raw = localStorage.getItem(LEARNED_MERCHANTS_KEY)
    if (!raw) return undefined
    const map = JSON.parse(raw)
    const norm = normalizeText(merchant)
    return map[norm]
  } catch {
    return undefined
  }
}

/**
 * Saves a merchant-to-category association when approved or edited by the user.
 */
export function saveLearnedCategory(merchant: string, categoryId: string): void {
  try {
    if (typeof localStorage === 'undefined') return
    const raw = localStorage.getItem(LEARNED_MERCHANTS_KEY)
    const map = raw ? JSON.parse(raw) : {}
    const norm = normalizeText(merchant)
    if (norm.length > 1 && categoryId && !/bank|بنك|مصرف|^cliq (received|transfer)$/.test(norm)) {
      map[norm] = categoryId
      localStorage.setItem(LEARNED_MERCHANTS_KEY, JSON.stringify(map))
    }
  } catch {
    // ignore
  }
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
  /\b(?:declined|unsuccessful|rejected|insufficient\s+funds)\b/i,
  /(?:تم\s*رفض|فشلت\s*العملية|رصيد\s*غير\s*كاف)/i,
]

// Category keywords for intelligent matching across Jordanian & regional banks
export const CATEGORY_RULES: { category: string; keywords: string[]; aliases: string[] }[] = [
  {
    category: 'Groceries',
    aliases: ['grocery', 'groceries', 'supermarket', 'market', 'بقالة', 'تموينات', 'سوبرماركت', 'خضار', 'فواكه'],
    keywords: [
      'carrefour', 'safeway', 'cozmo', 'miles', 'supermarket', 'market', 'hypermarket',
      'grocery', 'bakery', 'kareem', 'sameh', 'sameh mall', 'rawabi', 'c-town', 'metro', 'mart',
      'al-amad', 'farhat', 'al-mukhtar', 'khobz', 'produce', 'butcher', 'meat', 'vegetables', 'fruits',
      'سوبرماركت', 'ماركت', 'بقالة', 'مخبز', 'خضار', 'فواكه', 'لحوم', 'ملحمة', 'كارفور', 'سيفوي', 'سامح', 'سامح مول', 'الروابي', 'سي تاون'
    ],
  },
  {
    category: 'Food & Dining',
    aliases: ['dining out', 'food & dining', 'food', 'dining', 'restaurant', 'restaurants', 'cafe', 'cafes', 'coffee', 'مطعم', 'مطاعم', 'أكل', 'طعام', 'وجبات', 'حلويات', 'كافيه', 'مقهى'],
    keywords: [
      'restaurant', 'cafe', 'coffee', 'mcdonald', 'starbucks', 'burger', 'pizza',
      'shawarma', 'grill', 'sushi', 'diner', 'kfc', 'subway', 'talabat', 'careem food', 'jahez',
      'uncle osaka', 'osaka', 'cheesecake', 'sweets', 'dessert', 'cake', 'bakery',
      'astrolabe', 'costa', 'caribou', 'dimitris', 'espresso', 'buffalo wings', 'firefly',
      'bun meat beef', 'blunder', 'crisp', 'fatatri', 'habiba', 'nafisa', 'anabtawi', 'zalatimo',
      'مطعم', 'كافيه', 'مقهى', 'كوفي', 'شاورما', 'برجر', 'وجبات', 'بيتزا', 'قهوة', 'حلويات', 'حبيبة', 'نفيسة', 'عنبتاوي', 'زلاطيمو', 'طلبات', 'كريم فود'
    ],
  },
  {
    category: 'Transportation',
    aliases: ['transportation', 'transport', 'fuel', 'gas', 'car', 'مواصلات', 'بنزين', 'سيارة', 'وقود', 'محروقات'],
    keywords: [
      'uber', 'careem', 'petrol', 'gas', 'fuel', 'station', 'shell', 'total', 'manaseer',
      'jo petrol', 'jopetrol', 'oil', 'taxi', 'parking', 'garage', 'airline', 'flight', 'transport',
      'airport', 'qia', 'queen alia', 'rj', 'royal jordanian', 'fly jordan', 'car wash', 'automotive',
      'بنزين', 'محطة', 'محروقات', 'المناصير', 'جو بترول', 'توتال', 'شل', 'تاكسي', 'موقف', 'كريم', 'اوبر', 'غسيل سيارات', 'طيران'
    ],
  },
  {
    category: 'Utilities & Bills',
    aliases: ['utilities & bills', 'utilities', 'bills', 'services', 'telecom', 'فواتير', 'خدمات', 'كهرباء', 'مياه', 'اتصالات', 'انترنت'],
    keywords: [
      'orange', 'zain', 'umniah', 'telecom', 'electricity', 'water', 'internet', 'bill',
      'jepco', 'miyahuna', 'fiber', 'efawateercom', 'e-fawateercom', 'nepco', 'wifi', 'mobile',
      'فواتيركم', 'زين', 'اورنج', 'امنية', 'كهرباء', 'مياه', 'مياونا', 'فاتورة', 'فواتير', 'انترنت', 'الياف'
    ],
  },
  {
    category: 'Health & Pharmacy',
    aliases: ['health & pharmacy', 'healthcare', 'health', 'medical', 'pharmacy', 'medicine', 'صحة', 'صيدلية', 'طب', 'علاج', 'مستشفى'],
    keywords: [
      'pharmacy', 'chemist', 'drug', 'hospital', 'clinic', 'medical', 'doctor', 'lab', 'laboratory',
      'medication', 'dental', 'dentist', 'optics', 'rawhi', 'one click', 'dawacom', 'pharmacy one',
      'one pharmacy', 'jordan hospital', 'abdali hospital', 'khalidi', 'istishari', 'medgulf',
      'صيدلية', 'دواكم', 'فارمسي', 'مستشفى', 'عيادة', 'طبيب', 'دكتور', 'مختبر', 'تحاليل', 'دواء', 'علاج', 'نظارات', 'روحي', 'الخالدي', 'العبدلي', 'الاستشاري'
    ],
  },
  {
    category: 'Shopping',
    aliases: ['shopping', 'clothes', 'retail', 'fashion', 'تسوق', 'ملابس', 'أزياء', 'الكترونيات'],
    keywords: [
      'zara', 'h&m', 'amazon', 'aliexpress', 'noon', 'shein', 'pull&bear', 'bershka', 'massimo dutti',
      'mango', 'stradivarius', 'clothing', 'fashion', 'shoes', 'footwear', 'mall', 'city mall',
      'abdali mall', 'mecca mall', 'taj mall', 'galleria', 'barcode', 'store', 'electronics',
      'ikea', 'apple', 'sharaf dg', 'leaders', 'smartbuy', 'dna', 'virgin',
      'مول', 'تاج مول', 'سيتي مول', 'مكة مول', 'العبدلي مول', 'متجر', 'ملابس', 'أزياء', 'أحذية', 'الكترونيات', 'تسوق', 'ايكيا', 'ليدرز', 'سمارت باي'
    ],
  },
  {
    category: 'Entertainment',
    aliases: ['entertainment', 'leisure', 'fun', 'games', 'ترفيه', 'سينما', 'ألعاب'],
    keywords: [
      'cinema', 'prime cinema', 'grand cinemas', 'vox', 'prime', 'netflix', 'spotify', 'youtube',
      'movie', 'theatre', 'gaming', 'playstation', 'steam', 'nintendo', 'game', 'resort', 'park',
      'سينما', 'ترفيه', 'العاب', 'ألعاب', 'افلام', 'مسرح', 'بولينغ'
    ],
  },
  {
    category: 'Rent/Mortgage',
    aliases: ['rent/mortgage', 'rent', 'mortgage', 'housing', 'إيجار', 'ايجار', 'سكن'],
    keywords: [
      'rent', 'mortgage', 'housing', 'lease', 'apartment', 'landlord',
      'إيجار', 'ايجار', 'سكن', 'شقة'
    ],
  },
  {
    category: 'Education',
    aliases: ['education', 'learning', 'school', 'university', 'تعليم', 'دراسة', 'جامعة', 'مدرسة'],
    keywords: [
      'school', 'university', 'college', 'tuition', 'academy', 'nursery', 'kindergarten', 'madrasa',
      'jamiat', 'ju', 'gju', 'psut', 'just', 'german jordanian', 'courses', 'books', 'library',
      'مدرسة', 'جامعة', 'كلية', 'روضة', 'حضانة', 'أقساط', 'دورات', 'كتب', 'مكتبة'
    ],
  },
  {
    category: 'Personal Care',
    aliases: ['personal care', 'beauty', 'care', 'fitness', 'عناية', 'تجميل', 'صالون', 'جيم'],
    keywords: [
      'salon', 'barber', 'spa', 'cosmetics', 'perfume', 'makeup', 'hair', 'beauty', 'nails',
      'gym', 'fitness', 'gold gym', 'vega',
      'صالون', 'حلاقة', 'كوافير', 'سبا', 'تجميل', 'عطور', 'مكياج', 'نادي', 'جيم'
    ],
  },
  {
    category: 'Home & Maintenance',
    aliases: ['home', 'maintenance', 'repairs', 'housing', 'منزل', 'صيانة'],
    keywords: [
      'furniture', 'hardware', 'plumbing', 'paint', 'maintenance', 'homebox', 'home centre', 'ace',
      'cleaning', 'laundry', 'dry clean',
      'صيانة', 'سباكة', 'أثاث', 'تنظيف', 'دراي كلين', 'غسيل'
    ],
  },
  {
    category: 'Salary & Income',
    aliases: ['salary & income', 'salary', 'income', 'deposit', 'transfer', 'freelance', 'راتب', 'دخل', 'إيداع', 'حوالة'],
    keywords: [
      'salary', 'cliq', 'transfer from', 'inward', 'payroll', 'dividend', 'interest', 'deposit',
      'bonus', 'compensation', 'wage', 'freelance',
      'راتب', 'حوالة كليك', 'إيداع', 'وارد', 'دفعة', 'مكافأة', 'ارباح', 'أرباح', 'عمل حر'
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
  // Merchant fields outrank account/from clauses. Keep punctuation in brands
  // such as TALABAT.COM and H&M, and stop before bank metadata.
  const merchantPatterns = [
    /(?:\bat\s+|@\s*)(.+?)(?=\s+(?:on|with|using|card|ref|avl|avail|bal(?:ance)?|date)\b|[.;]\s*(?:available|balance)|$)/iu,
    /(?:لدى|عند)\s+(.+?)(?=\s+(?:بتاريخ|بواسطة|عبر|بطاقة|الرصيد)|$)/u,
    /from\s+(.+?)(?=\s+(?:has\s+been|was|as\s+cliq|via\s+cliq|as\s+transfer|balance|on|using|with)\b|$)/iu,
    /(?:paid\s+to|transferred\s+to|\bto)\s+(.+?)(?=\s+(?:on|via|ref|bal(?:ance)?)\b|$)/iu,
    /(?:من|إلى|الى)\s+(.+?)(?=\s+(?:بتاريخ|بواسطة|عبر|بطاقة|الرصيد|كحوالة)|$)/u,
  ]
  for (const pattern of merchantPatterns) {
    const candidate = text.match(pattern)?.[1]?.trim().replace(/[.,;]+$/, '')
    if (candidate && candidate.length > 2 && candidate.length <= 100 &&
        !/^(?:the\b|your\b|card\b|bank\b|account\b|date\b|ref\b|atm\b|حساب|بطاقة|[\d*])/i.test(candidate)) {
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
 * Matches merchant or SMS text against existing categories and aliases.
 */
export function matchCategory(
  merchant: string,
  rawText: string,
  type: TransactionType,
  categories: Category[] = [],
  sender = ''
): { categoryGuess: string; categoryId?: string; isAutoDetected: boolean } {
  // Only exact names and aliases map to existing categories. A word such as
  // "income" must not make "Other Income" look like the Salary category.
  const compatibleCategories = categories.filter(c =>
    type === 'income'
      ? c.category_type === 'income' || c.category_type === 'both'
      : c.category_type === 'expense' || c.category_type === 'both' || !c.category_type
  )

  const learnedId = learnedMessageCategory(merchant, rawText, type, sender) || getLearnedCategory(merchant)
  if (learnedId) {
    const matchedCategory = compatibleCategories.find(c => c.id === learnedId)
    if (matchedCategory) {
      return {
        categoryGuess: matchedCategory.name,
        categoryId: matchedCategory.id,
        isAutoDetected: true,
      }
    }
  }

  const resolve = (name: string, aliases: string[], detected = true) => {
    const names = [name, ...aliases].map(normalizeText)
    const category = compatibleCategories.find(c => normalizeText(c.name) === normalizeText(name))
      || compatibleCategories.find(c => names.includes(normalizeText(c.name)))
    return { categoryGuess: category?.name || name, categoryId: category?.id, isAutoDetected: detected }
  }
  const fallback = () => resolve(
    type === 'income' ? 'Other Income' : 'Other',
    type === 'income' ? ['general income', 'دخل اخر', 'دخل آخر'] : ['general', 'uncategorized', 'اخرى', 'أخرى', 'عام'],
    false,
  )

  // Credits and CliQ receipts are not salaries unless the SMS actually says so.
  if (type === 'income') {
    if (['salary', 'payroll', 'wage', 'راتب', 'رواتب'].some(term => hasTerm(rawText, term))) {
      return resolve('Salary & Income', ['salary', 'راتب', 'رواتب'])
    }
    if (['freelance', 'عمل حر'].some(term => hasTerm(rawText, term))) {
      return resolve('Freelance', ['freelancing', 'عمل حر'])
    }
    if (['dividend', 'interest', 'ارباح', 'أرباح'].some(term => hasTerm(rawText, term))) {
      return resolve('Investments', ['investment income', 'استثمارات'])
    }
    return fallback()
  }
  if (type !== 'expense') return fallback()

  // Rank merchant evidence before SMS wording. Generic terms carry less weight
  // than merchant brands; "Carrefour City Mall" remains groceries.
  const genericTerms = new Set([
    'market', 'mart', 'bakery', 'meat', 'fruits', 'vegetables', 'gas', 'station', 'total', 'oil', 'rj',
    'bill', 'water', 'mobile', 'lab', 'drug', 'store', 'mall', 'prime', 'park', 'game', 'care',
    'miles', 'kareem', 'metro', 'ju', 'just', 'ace', 'books', 'library', 'housing',
    'city mall', 'abdali mall', 'mecca mall', 'taj mall', 'galleria', 'تاج مول', 'سيتي مول', 'مكة مول', 'العبدلي مول',
    'مول', 'ماركت', 'غسيل', 'محطة', 'مياه',
  ].map(normalizeText))
  const score = (rule: typeof CATEGORY_RULES[number], text: string) => Math.max(0,
    ...rule.keywords.filter(term => hasTerm(text, term)).map(term =>
      genericTerms.has(normalizeText(term)) ? 10 : 100 + normalizeText(term).length,
    ),
  )
  const expenseRules = CATEGORY_RULES.filter(rule => rule.category !== 'Salary & Income')
  const merchantScores = expenseRules.map(rule => ({ rule, score: score(rule, merchant) }))
  // Remove bank metadata before using the body as a fallback signal.
  const context = rawText.split(/available\s*balance|avail\s*bal|balance|الرصيد/i)[0]
    .replace(/\b(?:credit|debit)\s+card\b/gi, 'card')
  const candidates = (merchantScores.some(item => item.score > 0)
    ? merchantScores
    : expenseRules.map(rule => ({ rule, score: score(rule, context) })))
    .filter(item => item.score > 10).sort((a, b) => b.score - a.score)

  const top = candidates[0]
  // Shared keywords (for example housing) are ambiguous, so require review.
  if (top && (!candidates[1] || top.score > candidates[1].score)) {
    return resolve(top.rule.category, top.rule.aliases)
  }

  // Allow an explicit custom category phrase, but never a substring or "Other".
  const custom = compatibleCategories.filter(c => !c.is_default &&
    !['other', 'general', 'uncategorized'].includes(normalizeText(c.name)) &&
    hasTerm(merchant, c.name))
  if (custom.length === 1) {
    return { categoryGuess: custom[0].name, categoryId: custom[0].id, isAutoDetected: true }
  }
  return fallback()
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
  const directionText = lowerBody.replace(/\bcredit\s+card\b/g, 'card')
  const isExpenseKeyword = [...EXPENSE_KEYWORDS_EN, ...EXPENSE_KEYWORDS_AR].some(kw => hasTerm(directionText, kw))
  const isIncomeKeyword = [...INCOME_KEYWORDS_EN, ...INCOME_KEYWORDS_AR].some(kw => hasTerm(directionText, kw))

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
      // A currency amount alone may be an offer or a balance notice.
      type = 'other'
    }
  }

  // 4. Extract Merchant / Party, Date, and Account ending
  const merchant = extractMerchant(body, sender, type)
  const date = extractDate(body, sms.date)
  const accountEnding = extractAccountEnding(body)

  // 5. Category matching
  const { categoryGuess, categoryId, isAutoDetected } = matchCategory(merchant, body, type, categories, sender)

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
    isAutoDetected,
    rawBody: body,
    confidence,
    isFinancial,
    accountEnding,
    availableBalance: financialData?.balance,
  }
}
