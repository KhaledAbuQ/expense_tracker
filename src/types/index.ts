export type CategoryType = 'expense' | 'income' | 'both';
export type ExpenseType = 'personal' | 'household';
export type PaidBy = 'me' | 'family';

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
  expense_type: ExpenseType;
  paid_by: PaidBy;
  created_at: string;
  category?: Category;
}

export interface ExpenseFormData {
  amount: number;
  description: string;
  category_id: string;
  date: string;
  expense_type: ExpenseType;
  paid_by: PaidBy;
}

export interface Income {
  id: string;
  amount: number;
  description: string | null;
  category_id: string | null;
  date: string;
  created_at: string;
  category?: Category;
}

export interface IncomeFormData {
  amount: number;
  description: string;
  category_id: string;
  date: string;
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
