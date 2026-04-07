-- Migration: Add Income and Balance tracking features
-- Run this if you already have an existing database

-- Add category_type to categories table
ALTER TABLE categories 
ADD COLUMN IF NOT EXISTS category_type VARCHAR(20) DEFAULT 'expense' 
CHECK (category_type IN ('expense', 'income', 'both'));

-- Update existing categories to be expense type
UPDATE categories SET category_type = 'expense' WHERE category_type IS NULL;

-- Add expense_type and paid_by to expenses table
ALTER TABLE expenses 
ADD COLUMN IF NOT EXISTS expense_type VARCHAR(20) DEFAULT 'personal' 
CHECK (expense_type IN ('personal', 'household'));

ALTER TABLE expenses 
ADD COLUMN IF NOT EXISTS paid_by VARCHAR(20) DEFAULT 'me' 
CHECK (paid_by IN ('me', 'family'));

-- Create income table
CREATE TABLE IF NOT EXISTS income (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  amount DECIMAL(10,2) NOT NULL CHECK (amount > 0),
  description TEXT,
  category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_expenses_type ON expenses(expense_type);
CREATE INDEX IF NOT EXISTS idx_expenses_paid_by ON expenses(paid_by);
CREATE INDEX IF NOT EXISTS idx_income_date ON income(date DESC);
CREATE INDEX IF NOT EXISTS idx_income_category ON income(category_id);

-- Add income categories
INSERT INTO categories (name, icon, color, is_default, category_type) VALUES
  ('Salary', 'briefcase', '#22c55e', true, 'income'),
  ('Freelance', 'laptop', '#3b82f6', true, 'income'),
  ('Investments', 'trending-up', '#eab308', true, 'income'),
  ('Gifts', 'gift', '#ec4899', true, 'income'),
  ('Other Income', 'plus-circle', '#6b7280', true, 'income')
ON CONFLICT (name) DO NOTHING;

-- Update 'Other' category to work for both
UPDATE categories SET category_type = 'both' WHERE name = 'Other';

-- Enable RLS on income table
ALTER TABLE income ENABLE ROW LEVEL SECURITY;

-- Allow all operations on income
CREATE POLICY "Allow all income" ON income 
  FOR ALL 
  USING (true) 
  WITH CHECK (true);
