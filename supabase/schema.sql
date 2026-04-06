-- Household Expense Tracker Schema
-- Run this in your Supabase SQL Editor

-- Categories table
CREATE TABLE categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL UNIQUE,
  icon VARCHAR(50) DEFAULT 'tag',
  color VARCHAR(7) DEFAULT '#6b7280',
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Expenses table
CREATE TABLE expenses (
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

-- Seed default categories
INSERT INTO categories (name, icon, color, is_default) VALUES
  ('Utilities', 'zap', '#eab308', true),
  ('Groceries', 'shopping-cart', '#22c55e', true),
  ('Rent/Mortgage', 'home', '#3b82f6', true),
  ('Entertainment', 'tv', '#a855f7', true),
  ('Transportation', 'car', '#f97316', true),
  ('Healthcare', 'heart-pulse', '#ef4444', true),
  ('Dining Out', 'utensils', '#ec4899', true),
  ('Shopping', 'shopping-bag', '#14b8a6', true),
  ('Other', 'more-horizontal', '#6b7280', true);

-- Enable Row Level Security
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;

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
