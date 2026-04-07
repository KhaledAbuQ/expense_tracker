-- Household Expense Tracker Schema
-- Run this in your Supabase SQL Editor

-- Categories table (supports both expense and income categories)
CREATE TABLE categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL UNIQUE,
  icon VARCHAR(50) DEFAULT 'tag',
  color VARCHAR(7) DEFAULT '#6b7280',
  is_default BOOLEAN DEFAULT false,
  category_type VARCHAR(20) DEFAULT 'expense' CHECK (category_type IN ('expense', 'income', 'both')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Expenses table
CREATE TABLE expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  amount DECIMAL(10,2) NOT NULL CHECK (amount > 0),
  description TEXT,
  category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  expense_type VARCHAR(20) DEFAULT 'personal' CHECK (expense_type IN ('personal', 'household')),
  paid_by VARCHAR(20) DEFAULT 'me' CHECK (paid_by IN ('me', 'family')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Income table
CREATE TABLE income (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  amount DECIMAL(10,2) NOT NULL CHECK (amount > 0),
  description TEXT,
  category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for faster queries
CREATE INDEX idx_expenses_date ON expenses(date DESC);
CREATE INDEX idx_expenses_category ON expenses(category_id);
CREATE INDEX idx_expenses_type ON expenses(expense_type);
CREATE INDEX idx_expenses_paid_by ON expenses(paid_by);
CREATE INDEX idx_income_date ON income(date DESC);
CREATE INDEX idx_income_category ON income(category_id);

-- Seed default expense categories
INSERT INTO categories (name, icon, color, is_default, category_type) VALUES
  ('Utilities', 'zap', '#eab308', true, 'expense'),
  ('Groceries', 'shopping-cart', '#22c55e', true, 'expense'),
  ('Rent/Mortgage', 'home', '#3b82f6', true, 'expense'),
  ('Entertainment', 'tv', '#a855f7', true, 'expense'),
  ('Transportation', 'car', '#f97316', true, 'expense'),
  ('Healthcare', 'heart-pulse', '#ef4444', true, 'expense'),
  ('Dining Out', 'utensils', '#ec4899', true, 'expense'),
  ('Shopping', 'shopping-bag', '#14b8a6', true, 'expense'),
  ('Other', 'more-horizontal', '#6b7280', true, 'both');

-- Seed default income categories
INSERT INTO categories (name, icon, color, is_default, category_type) VALUES
  ('Salary', 'briefcase', '#22c55e', true, 'income'),
  ('Freelance', 'laptop', '#3b82f6', true, 'income'),
  ('Investments', 'trending-up', '#eab308', true, 'income'),
  ('Gifts', 'gift', '#ec4899', true, 'income'),
  ('Other Income', 'plus-circle', '#6b7280', true, 'income');

-- Enable Row Level Security
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE income ENABLE ROW LEVEL SECURITY;

-- Allow all operations (no auth required for single household use)
-- WITH CHECK is required for INSERT operations
CREATE POLICY "Allow all categories" ON categories 
  FOR ALL 
  USING (true) 
  WITH CHECK (true);

CREATE POLICY "Allow all expenses" ON expenses 
  FOR ALL 
  USING (true) 
  WITH CHECK (true);

CREATE POLICY "Allow all income" ON income 
  FOR ALL 
  USING (true) 
  WITH CHECK (true);
