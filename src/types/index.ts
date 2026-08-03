export type CategoryType = 'expense' | 'income' | 'both';
export type Visibility = 'private' | 'household';
export type AccountType = 'bank' | 'cash';
export type IncomeAccountType = 'bank' | 'cash' | 'savings';
export type TransferAccountType = 'bank' | 'cash' | 'savings' | 'gold';

/** Gold you can buy as a recognised coin, or as raw weight at a given carat. */
export type GoldItemType = 'english_lira' | 'rashadi_lira' | 'bullion';

export type Karat = 24 | 22 | 21 | 18 | 14;

export interface GoldPrice {
  id: string;
  price_24k: number;
  price_22k: number;
  price_21k: number;
  price_18k: number;
  price_14k: number;
  /** 'jordan_scrape' for local rates, 'spot_peg' when derived from world spot. */
  source: 'jordan_scrape' | 'spot_peg';
  source_detail: string | null;
  fetched_at: string;
}

/** The gold columns a transfer carries when it moves into or out of gold. */
export interface GoldDetail {
  gold_item_type: GoldItemType;
  /** Coin count for liras, gram weight for bullion. */
  gold_quantity: number;
  gold_karat: Karat;
  /** Gross weight of the item(s). */
  gold_grams: number;
  /** Pure-gold equivalent, which is what holdings are summed in. */
  gold_fine_grams: number;
}

export interface Household {
  id: string;
  name: string;
  invite_code: string;
  created_at: string;
}

export interface Member {
  id: string;
  household_id: string;
  user_id: string;
  name: string;
  role: 'admin' | 'member';
  created_at: string;
}

export interface Category {
  id: string;
  name: string;
  icon: string;
  color: string;
  is_default: boolean;
  category_type: CategoryType;
  /** null for the built-in defaults, which are shared and read-only. */
  household_id: string | null;
  created_at: string;
}

export interface Expense {
  id: string;
  amount: number;
  description: string | null;
  category_id: string | null;
  date: string;
  member_id: string;
  visibility: Visibility;
  account_type: AccountType;
  created_at: string;
  category?: Category;
  member?: Member;
}

export interface ExpenseFormData {
  amount: number;
  description: string;
  category_id: string;
  date: string;
  visibility: Visibility;
  member_id?: string;
  account_type: AccountType;
}

export interface Income {
  id: string;
  amount: number;
  description: string | null;
  category_id: string | null;
  date: string;
  member_id: string;
  visibility: Visibility;
  account_type: IncomeAccountType;
  created_at: string;
  category?: Category;
  member?: Member;
}

export interface IncomeFormData {
  amount: number;
  description: string;
  category_id: string;
  date: string;
  member_id?: string;
  visibility: Visibility;
  account_type: IncomeAccountType;
}

export interface Transfer extends Partial<GoldDetail> {
  id: string;
  amount: number;
  from_account: TransferAccountType;
  to_account: TransferAccountType;
  description: string | null;
  date: string;
  member_id: string;
  created_at: string;
  member?: Member;
}

export interface TransferFormData extends Partial<GoldDetail> {
  amount: number;
  from_account: TransferAccountType;
  to_account: TransferAccountType;
  description: string;
  date: string;
  member_id?: string;
}

export interface CategoryFormData {
  name: string;
  icon: string;
  color: string;
  category_type: CategoryType;
}

export interface DateRange {
  start: Date;
  end: Date;
}

export interface ChartDataPoint {
  name: string;
  value: number;
  color?: string;
}
