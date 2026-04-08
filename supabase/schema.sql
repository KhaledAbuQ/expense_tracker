-- Expense Tracker Database Schema
-- Run this single file in your Supabase SQL Editor to set up the complete database

-- ============================================
-- TABLES
-- ============================================

-- Categories table (supports both expense and income categories)
CREATE TABLE IF NOT EXISTS categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL UNIQUE,
  icon VARCHAR(50) DEFAULT 'tag',
  color VARCHAR(7) DEFAULT '#6b7280',
  is_default BOOLEAN DEFAULT false,
  category_type VARCHAR(20) DEFAULT 'expense' CHECK (category_type IN ('expense', 'income', 'both')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Expenses table
CREATE TABLE IF NOT EXISTS expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  amount DECIMAL(10,2) NOT NULL CHECK (amount > 0),
  description TEXT,
  category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  expense_type VARCHAR(20) DEFAULT 'personal' CHECK (expense_type IN ('personal', 'household')),
  paid_by VARCHAR(20) DEFAULT 'me' CHECK (paid_by IN ('me', 'family')),
  account_type VARCHAR(20) DEFAULT 'bank' CHECK (account_type IN ('bank', 'cash')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Income table (account_type includes 'savings' for direct deposits to savings)
CREATE TABLE IF NOT EXISTS income (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  amount DECIMAL(10,2) NOT NULL CHECK (amount > 0),
  description TEXT,
  category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  account_type VARCHAR(20) DEFAULT 'bank' CHECK (account_type IN ('bank', 'cash', 'savings')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Transfers table (for moving money between accounts: bank, cash, savings)
CREATE TABLE IF NOT EXISTS transfers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  amount DECIMAL(10,2) NOT NULL CHECK (amount > 0),
  from_account VARCHAR(20) NOT NULL CHECK (from_account IN ('bank', 'cash', 'savings')),
  to_account VARCHAR(20) NOT NULL CHECK (to_account IN ('bank', 'cash', 'savings')),
  description TEXT,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT different_accounts CHECK (from_account != to_account)
);

-- ============================================
-- INDEXES
-- ============================================

CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(date DESC);
CREATE INDEX IF NOT EXISTS idx_expenses_category ON expenses(category_id);
CREATE INDEX IF NOT EXISTS idx_expenses_type ON expenses(expense_type);
CREATE INDEX IF NOT EXISTS idx_expenses_paid_by ON expenses(paid_by);
CREATE INDEX IF NOT EXISTS idx_expenses_account ON expenses(account_type);
CREATE INDEX IF NOT EXISTS idx_income_date ON income(date DESC);
CREATE INDEX IF NOT EXISTS idx_income_category ON income(category_id);
CREATE INDEX IF NOT EXISTS idx_income_account ON income(account_type);
CREATE INDEX IF NOT EXISTS idx_transfers_date ON transfers(date DESC);
CREATE INDEX IF NOT EXISTS idx_transfers_from ON transfers(from_account);
CREATE INDEX IF NOT EXISTS idx_transfers_to ON transfers(to_account);

-- ============================================
-- DEFAULT CATEGORIES
-- ============================================

-- Expense categories
INSERT INTO categories (name, icon, color, is_default, category_type) VALUES
  ('Utilities', 'zap', '#eab308', true, 'expense'),
  ('Groceries', 'shopping-cart', '#22c55e', true, 'expense'),
  ('Rent/Mortgage', 'home', '#3b82f6', true, 'expense'),
  ('Entertainment', 'tv', '#a855f7', true, 'expense'),
  ('Transportation', 'car', '#f97316', true, 'expense'),
  ('Healthcare', 'heart-pulse', '#ef4444', true, 'expense'),
  ('Dining Out', 'utensils', '#ec4899', true, 'expense'),
  ('Shopping', 'shopping-bag', '#14b8a6', true, 'expense'),
  ('Other', 'more-horizontal', '#6b7280', true, 'both')
ON CONFLICT (name) DO NOTHING;

-- Income categories
INSERT INTO categories (name, icon, color, is_default, category_type) VALUES
  ('Salary', 'briefcase', '#22c55e', true, 'income'),
  ('Freelance', 'laptop', '#3b82f6', true, 'income'),
  ('Investments', 'trending-up', '#eab308', true, 'income'),
  ('Gifts', 'gift', '#ec4899', true, 'income'),
  ('Other Income', 'plus-circle', '#6b7280', true, 'income')
ON CONFLICT (name) DO NOTHING;

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

-- Enable RLS on all tables
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE income ENABLE ROW LEVEL SECURITY;
ALTER TABLE transfers ENABLE ROW LEVEL SECURITY;

-- Allow all operations (no auth required for single household use)
DO $$
BEGIN
  -- Categories policy
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'categories' AND policyname = 'Allow all categories') THEN
    CREATE POLICY "Allow all categories" ON categories FOR ALL USING (true) WITH CHECK (true);
  END IF;
  
  -- Expenses policy
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'expenses' AND policyname = 'Allow all expenses') THEN
    CREATE POLICY "Allow all expenses" ON expenses FOR ALL USING (true) WITH CHECK (true);
  END IF;
  
  -- Income policy
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'income' AND policyname = 'Allow all income') THEN
    CREATE POLICY "Allow all income" ON income FOR ALL USING (true) WITH CHECK (true);
  END IF;
  
  -- Transfers policy
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'transfers' AND policyname = 'Allow all transfers') THEN
    CREATE POLICY "Allow all transfers" ON transfers FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;
