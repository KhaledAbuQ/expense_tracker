-- Expense Tracker Database Schema
-- Run this single file in your Supabase SQL Editor to set up the complete database

-- ============================================
-- TABLES
-- ============================================

-- Households table
CREATE TABLE IF NOT EXISTS households (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(150) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Members table (one per authenticated user)
CREATE TABLE IF NOT EXISTS members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name VARCHAR(120) NOT NULL,
  role VARCHAR(20) DEFAULT 'member' CHECK (role IN ('admin', 'member')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id)
);

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
  member_id UUID REFERENCES members(id) ON DELETE CASCADE,
  visibility VARCHAR(20) DEFAULT 'private' CHECK (visibility IN ('private', 'household')),
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
  member_id UUID REFERENCES members(id) ON DELETE CASCADE,
  visibility VARCHAR(20) DEFAULT 'private' CHECK (visibility IN ('private', 'household')),
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
  member_id UUID REFERENCES members(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT different_accounts CHECK (from_account != to_account)
);

-- ============================================
-- MIGRATIONS FOR EXISTING TABLES
-- ============================================

ALTER TABLE IF EXISTS expenses
  ADD COLUMN IF NOT EXISTS member_id UUID;

ALTER TABLE IF EXISTS expenses
  ADD COLUMN IF NOT EXISTS visibility VARCHAR(20) DEFAULT 'private';

ALTER TABLE IF EXISTS income
  ADD COLUMN IF NOT EXISTS member_id UUID;

ALTER TABLE IF EXISTS income
  ADD COLUMN IF NOT EXISTS visibility VARCHAR(20) DEFAULT 'private';

ALTER TABLE IF EXISTS transfers
  ADD COLUMN IF NOT EXISTS member_id UUID;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'expenses' AND column_name = 'member_id'
  ) THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.table_constraints
      WHERE table_name = 'expenses' AND constraint_name = 'expenses_member_id_fkey'
    ) THEN
      ALTER TABLE expenses
        ADD CONSTRAINT expenses_member_id_fkey
        FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE CASCADE;
    END IF;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'income' AND column_name = 'member_id'
  ) THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.table_constraints
      WHERE table_name = 'income' AND constraint_name = 'income_member_id_fkey'
    ) THEN
      ALTER TABLE income
        ADD CONSTRAINT income_member_id_fkey
        FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE CASCADE;
    END IF;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'transfers' AND column_name = 'member_id'
  ) THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.table_constraints
      WHERE table_name = 'transfers' AND constraint_name = 'transfers_member_id_fkey'
    ) THEN
      ALTER TABLE transfers
        ADD CONSTRAINT transfers_member_id_fkey
        FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE CASCADE;
    END IF;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'expenses' AND constraint_name = 'expenses_visibility_check'
  ) THEN
    ALTER TABLE expenses
      ADD CONSTRAINT expenses_visibility_check CHECK (visibility IN ('private', 'household'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'income' AND constraint_name = 'income_visibility_check'
  ) THEN
    ALTER TABLE income
      ADD CONSTRAINT income_visibility_check CHECK (visibility IN ('private', 'household'));
  END IF;
END $$;

-- ============================================
-- INDEXES
-- ============================================

CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(date DESC);
CREATE INDEX IF NOT EXISTS idx_expenses_category ON expenses(category_id);
CREATE INDEX IF NOT EXISTS idx_expenses_member ON expenses(member_id);
CREATE INDEX IF NOT EXISTS idx_expenses_visibility ON expenses(visibility);
CREATE INDEX IF NOT EXISTS idx_expenses_account ON expenses(account_type);
CREATE INDEX IF NOT EXISTS idx_income_date ON income(date DESC);
CREATE INDEX IF NOT EXISTS idx_income_category ON income(category_id);
CREATE INDEX IF NOT EXISTS idx_income_member ON income(member_id);
CREATE INDEX IF NOT EXISTS idx_income_visibility ON income(visibility);
CREATE INDEX IF NOT EXISTS idx_income_account ON income(account_type);
CREATE INDEX IF NOT EXISTS idx_transfers_date ON transfers(date DESC);
CREATE INDEX IF NOT EXISTS idx_transfers_from ON transfers(from_account);
CREATE INDEX IF NOT EXISTS idx_transfers_to ON transfers(to_account);
CREATE INDEX IF NOT EXISTS idx_transfers_member ON transfers(member_id);

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
ALTER TABLE households ENABLE ROW LEVEL SECURITY;
ALTER TABLE members ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE income ENABLE ROW LEVEL SECURITY;
ALTER TABLE transfers ENABLE ROW LEVEL SECURITY;

-- Helper function to get household for a member
CREATE OR REPLACE FUNCTION household_id_for_member(member_uuid UUID)
RETURNS UUID
LANGUAGE SQL
STABLE
AS $$
  SELECT household_id FROM members WHERE id = member_uuid LIMIT 1;
$$;

-- Helper function to check household membership
CREATE OR REPLACE FUNCTION is_household_member(user_uuid UUID, household_uuid UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM members m
    WHERE m.user_id = user_uuid AND m.household_id = household_uuid
  );
$$;

-- Allow all operations on categories (shared across households)
DO $$
BEGIN
  -- Categories policy
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'categories' AND policyname = 'Allow all categories') THEN
    CREATE POLICY "Allow all categories" ON categories FOR ALL USING (true) WITH CHECK (true);
  END IF;

  -- Households policies
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'households' AND policyname = 'Allow household create') THEN
    CREATE POLICY "Allow household create" ON households FOR INSERT
      WITH CHECK (auth.uid() IS NOT NULL);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'households' AND policyname = 'Allow household read') THEN
    CREATE POLICY "Allow household read" ON households FOR SELECT
      USING (is_household_member(auth.uid(), id));
  END IF;

  -- Members policies
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'members' AND policyname = 'Allow members read') THEN
    CREATE POLICY "Allow members read" ON members FOR SELECT
      USING (
        user_id = auth.uid()
        OR is_household_member(auth.uid(), household_id)
      );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'members' AND policyname = 'Allow member create') THEN
    CREATE POLICY "Allow member create" ON members FOR INSERT
      WITH CHECK (user_id = auth.uid());
  END IF;
  
  -- Expenses policies (private + household shared)
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'expenses' AND policyname = 'Allow expense read') THEN
    CREATE POLICY "Allow expense read" ON expenses FOR SELECT
      USING (
        member_id IN (SELECT id FROM members WHERE user_id = auth.uid())
        OR (
          visibility = 'household'
          AND is_household_member(auth.uid(), household_id_for_member(member_id))
        )
      );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'expenses' AND policyname = 'Allow expense write') THEN
    CREATE POLICY "Allow expense write" ON expenses FOR ALL
      USING (
        member_id IN (SELECT id FROM members WHERE user_id = auth.uid())
        OR (
          visibility = 'household'
          AND is_household_member(auth.uid(), household_id_for_member(member_id))
        )
      )
      WITH CHECK (
        member_id IN (SELECT id FROM members WHERE user_id = auth.uid())
        OR (
          visibility = 'household'
          AND is_household_member(auth.uid(), household_id_for_member(member_id))
        )
      );
  END IF;

  -- Income policies (private + household shared)
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'income' AND policyname = 'Allow income read') THEN
    CREATE POLICY "Allow income read" ON income FOR SELECT
      USING (
        member_id IN (SELECT id FROM members WHERE user_id = auth.uid())
        OR (
          visibility = 'household'
          AND is_household_member(auth.uid(), household_id_for_member(member_id))
        )
      );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'income' AND policyname = 'Allow income write') THEN
    CREATE POLICY "Allow income write" ON income FOR ALL
      USING (
        member_id IN (SELECT id FROM members WHERE user_id = auth.uid())
        OR (
          visibility = 'household'
          AND is_household_member(auth.uid(), household_id_for_member(member_id))
        )
      )
      WITH CHECK (
        member_id IN (SELECT id FROM members WHERE user_id = auth.uid())
        OR (
          visibility = 'household'
          AND is_household_member(auth.uid(), household_id_for_member(member_id))
        )
      );
  END IF;

  -- Transfers policies (private only)
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'transfers' AND policyname = 'Allow transfers read') THEN
    CREATE POLICY "Allow transfers read" ON transfers FOR SELECT
      USING (member_id IN (SELECT id FROM members WHERE user_id = auth.uid()));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'transfers' AND policyname = 'Allow transfers write') THEN
    CREATE POLICY "Allow transfers write" ON transfers FOR ALL
      USING (member_id IN (SELECT id FROM members WHERE user_id = auth.uid()))
      WITH CHECK (member_id IN (SELECT id FROM members WHERE user_id = auth.uid()));
  END IF;
END $$;
