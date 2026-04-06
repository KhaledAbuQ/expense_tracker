export interface Category {
  id: string;
  name: string;
  icon: string;
  color: string;
  is_default: boolean;
  created_at: string;
}

export interface Expense {
  id: string;
  amount: number;
  description: string | null;
  category_id: string | null;
  date: string;
  created_at: string;
  category?: Category;
}

export interface ExpenseFormData {
  amount: number;
  description: string;
  category_id: string;
  date: string;
}

export interface CategoryFormData {
  name: string;
  icon: string;
  color: string;
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
