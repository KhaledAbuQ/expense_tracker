export type CategoryType = 'expense' | 'income' | 'both';
export type Visibility = 'private' | 'household';
export type AccountType = 'bank' | 'cash';
export type IncomeAccountType = 'bank' | 'cash' | 'savings';
export type TransferAccountType = 'bank' | 'cash' | 'savings';

export interface Household {
  id: string;
  name: string;
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

export interface Transfer {
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

export interface TransferFormData {
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
