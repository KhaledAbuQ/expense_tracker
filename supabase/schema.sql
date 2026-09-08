-- Expense Tracker Database Schema
-- Run this single file in your Supabase SQL Editor to set up the complete database.
-- It is idempotent: safe to re-run on an existing database.

-- ============================================
-- TABLES
-- ============================================

-- Households table
CREATE TABLE IF NOT EXISTS households (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(150) NOT NULL,
  invite_code TEXT,
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
-- is_default TRUE   => built-in default category, readable by everyone, writable by no one
-- user_id SET       => custom category owned by that user (scoped per user)
-- household_id SET  => household context for visibility on shared household expenses
CREATE TABLE IF NOT EXISTS categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  icon VARCHAR(50) DEFAULT 'tag',
  color VARCHAR(7) DEFAULT '#6b7280',
  is_default BOOLEAN DEFAULT false,
  category_type VARCHAR(20) DEFAULT 'expense' CHECK (category_type IN ('expense', 'income', 'both')),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  household_id UUID REFERENCES households(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Expenses table
CREATE TABLE IF NOT EXISTS expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  amount DECIMAL(10,3) NOT NULL CHECK (amount > 0),
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
  amount DECIMAL(10,3) NOT NULL CHECK (amount > 0),
  description TEXT,
  category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  member_id UUID REFERENCES members(id) ON DELETE CASCADE,
  visibility VARCHAR(20) DEFAULT 'private' CHECK (visibility IN ('private', 'household')),
  account_type VARCHAR(20) DEFAULT 'bank' CHECK (account_type IN ('bank', 'cash', 'savings')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Transfers table (moving money between accounts: bank, cash, savings, gold)
--
-- Gold is an account you can move money into and out of. Buying gold is a
-- transfer from bank or cash to 'gold': `amount` is the dinars that actually
-- left the account (including any workmanship premium), while the gold_* columns
-- record what you physically received. Holdings are derived from this ledger --
-- there is no separate balance to keep in sync.
CREATE TABLE IF NOT EXISTS transfers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  amount DECIMAL(10,3) NOT NULL CHECK (amount > 0),
  from_account VARCHAR(20) NOT NULL CHECK (from_account IN ('bank', 'cash', 'savings', 'gold')),
  to_account VARCHAR(20) NOT NULL CHECK (to_account IN ('bank', 'cash', 'savings', 'gold')),
  description TEXT,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  member_id UUID REFERENCES members(id) ON DELETE CASCADE,
  gold_item_type VARCHAR(20) CHECK (gold_item_type IN ('english_lira', 'rashadi_lira', 'bullion')),
  -- Coin count for liras, gram weight for bullion/jewellery.
  gold_quantity DECIMAL(12,4) CHECK (gold_quantity > 0),
  gold_karat SMALLINT CHECK (gold_karat BETWEEN 1 AND 24),
  -- Gross weight of the item(s), and the pure-gold equivalent that gets summed.
  gold_grams DECIMAL(12,4) CHECK (gold_grams > 0),
  gold_fine_grams DECIMAL(12,4) CHECK (gold_fine_grams > 0),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT different_accounts CHECK (from_account != to_account)
);

-- Live gold prices in JOD per gram, one row per successful fetch.
-- This is public market data, not household data: every signed-in user reads the
-- same rows, and only the Edge Function (service role) writes them.
CREATE TABLE IF NOT EXISTS gold_prices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  price_24k DECIMAL(12,4) NOT NULL CHECK (price_24k > 0),
  price_22k DECIMAL(12,4) NOT NULL CHECK (price_22k > 0),
  price_21k DECIMAL(12,4) NOT NULL CHECK (price_21k > 0),
  price_18k DECIMAL(12,4) NOT NULL CHECK (price_18k > 0),
  price_14k DECIMAL(12,4) NOT NULL CHECK (price_14k > 0),
  -- 'jordan_scrape' when local rates were read directly, 'spot_peg' when derived
  -- from international spot through the fixed USD/JOD peg.
  source VARCHAR(30) NOT NULL,
  source_detail TEXT,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- MIGRATIONS FOR EXISTING TABLES
-- ============================================

ALTER TABLE IF EXISTS households
  ADD COLUMN IF NOT EXISTS invite_code TEXT;

ALTER TABLE IF EXISTS categories
  ADD COLUMN IF NOT EXISTS user_id UUID;

ALTER TABLE IF EXISTS categories
  ADD COLUMN IF NOT EXISTS household_id UUID;

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

ALTER TABLE IF EXISTS transfers
  ADD COLUMN IF NOT EXISTS gold_item_type VARCHAR(20);
ALTER TABLE IF EXISTS transfers
  ADD COLUMN IF NOT EXISTS gold_quantity DECIMAL(12,4);
ALTER TABLE IF EXISTS transfers
  ADD COLUMN IF NOT EXISTS gold_karat SMALLINT;
ALTER TABLE IF EXISTS transfers
  ADD COLUMN IF NOT EXISTS gold_grams DECIMAL(12,4);
ALTER TABLE IF EXISTS transfers
  ADD COLUMN IF NOT EXISTS gold_fine_grams DECIMAL(12,4);

-- Widen the account CHECK constraints to admit 'gold'. The original names are
-- whatever Postgres generated, so match on the constraint body instead.
--
-- The `%bank%` test is load-bearing: `different_accounts` is defined as
-- CHECK (from_account <> to_account) and so also mentions both column names.
-- Matching on the column alone would drop it and leave a transfer able to move
-- money from an account to itself.
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT c.conname, pg_get_constraintdef(c.oid) AS def
    FROM pg_constraint c
    WHERE c.conrelid = 'transfers'::regclass
      AND c.contype = 'c'
  LOOP
    IF (r.def ILIKE '%from_account%' OR r.def ILIKE '%to_account%')
       AND r.def ILIKE '%bank%' THEN
      EXECUTE format('ALTER TABLE transfers DROP CONSTRAINT %I', r.conname);
    END IF;
  END LOOP;

  ALTER TABLE transfers
    ADD CONSTRAINT transfers_from_account_check
    CHECK (from_account IN ('bank', 'cash', 'savings', 'gold'));
  ALTER TABLE transfers
    ADD CONSTRAINT transfers_to_account_check
    CHECK (to_account IN ('bank', 'cash', 'savings', 'gold'));
END $$;

-- Re-assert the self-transfer guard in case an older database never had it.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'transfers'::regclass AND conname = 'different_accounts'
  ) THEN
    ALTER TABLE transfers
      ADD CONSTRAINT different_accounts CHECK (from_account != to_account);
  END IF;
END $$;

-- A transfer touching 'gold' must say what the gold actually was; one that
-- doesn't must not carry gold columns.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'transfers'::regclass AND conname = 'transfers_gold_detail_check'
  ) THEN
    ALTER TABLE transfers DROP CONSTRAINT transfers_gold_detail_check;
  END IF;

  ALTER TABLE transfers ADD CONSTRAINT transfers_gold_detail_check CHECK (
    CASE WHEN from_account = 'gold' OR to_account = 'gold'
      THEN gold_item_type IS NOT NULL
           AND gold_quantity IS NOT NULL
           AND gold_karat IS NOT NULL
           AND gold_grams IS NOT NULL
           AND gold_fine_grams IS NOT NULL
           AND gold_fine_grams <= gold_grams
      ELSE gold_item_type IS NULL
           AND gold_quantity IS NULL
           AND gold_karat IS NULL
           AND gold_grams IS NULL
           AND gold_fine_grams IS NULL
    END
  );
END $$;

ALTER TABLE IF EXISTS expenses
  ALTER COLUMN amount TYPE DECIMAL(10,3);

ALTER TABLE IF EXISTS income
  ALTER COLUMN amount TYPE DECIMAL(10,3);

ALTER TABLE IF EXISTS transfers
  ALTER COLUMN amount TYPE DECIMAL(10,3);

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

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'categories' AND constraint_name = 'categories_user_id_fkey'
  ) THEN
    ALTER TABLE categories
      ADD CONSTRAINT categories_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'categories' AND constraint_name = 'categories_household_id_fkey'
  ) THEN
    ALTER TABLE categories
      ADD CONSTRAINT categories_household_id_fkey
      FOREIGN KEY (household_id) REFERENCES households(id) ON DELETE CASCADE;
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
-- HELPER FUNCTIONS
-- ============================================
-- These are SECURITY DEFINER on purpose. They read `members`, and they are used
-- inside the RLS policy for `members` itself. An invoker-rights function would
-- re-enter that policy and recurse (Postgres raises "infinite recursion detected
-- in policy" or blows the stack, depending on the plan). SECURITY DEFINER breaks
-- the cycle. search_path is pinned so the definer context cannot be hijacked.

CREATE OR REPLACE FUNCTION household_id_for_member(member_uuid UUID)
RETURNS UUID
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT household_id FROM members WHERE id = member_uuid LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION is_household_member(user_uuid UUID, household_uuid UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM members m
    WHERE m.user_id = user_uuid AND m.household_id = household_uuid
  );
$$;

CREATE OR REPLACE FUNCTION is_household_admin(user_uuid UUID, household_uuid UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM members m
    WHERE m.user_id = user_uuid
      AND m.household_id = household_uuid
      AND m.role = 'admin'
  );
$$;

-- Generates a short, unambiguous invite code (no O/0/I/1 confusion).
CREATE OR REPLACE FUNCTION generate_invite_code()
RETURNS TEXT
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  alphabet TEXT := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  candidate TEXT;
  i INT;
BEGIN
  LOOP
    candidate := '';
    FOR i IN 1..8 LOOP
      candidate := candidate || substr(alphabet, floor(random() * length(alphabet))::INT + 1, 1);
    END LOOP;
    EXIT WHEN NOT EXISTS (SELECT 1 FROM households h WHERE h.invite_code = candidate);
  END LOOP;
  RETURN candidate;
END;
$$;

-- Backfill invite codes for households created before this column existed.
UPDATE households SET invite_code = generate_invite_code() WHERE invite_code IS NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'households_invite_code_key'
  ) THEN
    ALTER TABLE households ADD CONSTRAINT households_invite_code_key UNIQUE (invite_code);
  END IF;
END $$;

ALTER TABLE households ALTER COLUMN invite_code SET NOT NULL;
ALTER TABLE households ALTER COLUMN invite_code SET DEFAULT NULL;

-- ============================================
-- CATEGORY SCOPING MIGRATION (PER-USER)
-- ============================================
-- Custom categories are owned by a user (per-user scoping).
-- Attribute existing custom categories to whichever user actually used them.

UPDATE categories c
SET user_id = usage.user_id
FROM (
  SELECT DISTINCT ON (t.category_id) t.category_id, m.user_id
  FROM (
    SELECT category_id, member_id FROM expenses WHERE category_id IS NOT NULL
    UNION ALL
    SELECT category_id, member_id FROM income WHERE category_id IS NOT NULL
  ) t
  JOIN members m ON m.id = t.member_id
  ORDER BY t.category_id, m.user_id
) usage
WHERE c.id = usage.category_id
  AND c.is_default = false
  AND c.user_id IS NULL;

-- Any remaining unused custom categories that have a household_id belong to an
-- admin or member of that household.
UPDATE categories c
SET user_id = (
  SELECT m.user_id
  FROM members m
  WHERE m.household_id = c.household_id
  ORDER BY (m.role = 'admin') DESC, m.created_at ASC
  LIMIT 1
)
WHERE c.is_default = false
  AND c.user_id IS NULL
  AND c.household_id IS NOT NULL;

-- If there is exactly one user, attribute any remaining unassigned custom categories.
DO $$
DECLARE
  only_user UUID;
  orphan_count INT;
BEGIN
  IF (SELECT count(*) FROM auth.users) = 1 THEN
    SELECT id INTO only_user FROM auth.users;
    UPDATE categories
    SET user_id = only_user
    WHERE is_default = false AND user_id IS NULL;
  END IF;

  SELECT count(*) INTO orphan_count
  FROM categories WHERE is_default = false AND user_id IS NULL;

  IF orphan_count > 0 THEN
    RAISE NOTICE
      '% custom category/categories could not be attributed to a user and are now hidden. Query: SELECT id, name FROM categories WHERE is_default = false AND user_id IS NULL;',
      orphan_count;
  END IF;
END $$;

-- Drop legacy constraints / indexes
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'categories_name_key') THEN
    ALTER TABLE categories DROP CONSTRAINT categories_name_key;
  END IF;
END $$;

DROP INDEX IF EXISTS categories_household_name_key;
DROP INDEX IF EXISTS categories_default_name_key;

CREATE UNIQUE INDEX IF NOT EXISTS categories_default_name_key
  ON categories (lower(name)) WHERE is_default = true;

CREATE UNIQUE INDEX IF NOT EXISTS categories_user_name_key
  ON categories (user_id, lower(name)) WHERE user_id IS NOT NULL;

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
CREATE INDEX IF NOT EXISTS idx_members_household ON members(household_id);
CREATE INDEX IF NOT EXISTS idx_categories_user ON categories(user_id);
CREATE INDEX IF NOT EXISTS idx_categories_household ON categories(household_id);
CREATE INDEX IF NOT EXISTS idx_gold_prices_fetched ON gold_prices(fetched_at DESC);

-- ============================================
-- DEFAULT CATEGORIES (user_id IS NULL = shared, read-only)
-- ============================================

INSERT INTO categories (name, icon, color, is_default, category_type, user_id, household_id)
SELECT v.name, v.icon, v.color, true, v.category_type, NULL, NULL
FROM (VALUES
  ('Utilities', 'zap', '#eab308', 'expense'),
  ('Groceries', 'shopping-cart', '#22c55e', 'expense'),
  ('Rent/Mortgage', 'home', '#3b82f6', 'expense'),
  ('Entertainment', 'tv', '#a855f7', 'expense'),
  ('Transportation', 'car', '#f97316', 'expense'),
  ('Healthcare', 'heart-pulse', '#ef4444', 'expense'),
  ('Dining Out', 'utensils', '#ec4899', 'expense'),
  ('Shopping', 'shopping-bag', '#14b8a6', 'expense'),
  ('Other', 'more-horizontal', '#6b7280', 'both'),
  ('Salary', 'briefcase', '#22c55e', 'income'),
  ('Freelance', 'laptop', '#3b82f6', 'income'),
  ('Investments', 'trending-up', '#eab308', 'income'),
  ('Gifts', 'gift', '#ec4899', 'income'),
  ('Other Income', 'plus-circle', '#6b7280', 'income')
) AS v(name, icon, color, category_type)
WHERE NOT EXISTS (
  SELECT 1 FROM categories c
  WHERE c.is_default = true AND lower(c.name) = lower(v.name)
);

-- ============================================
-- ONBOARDING RPCs
-- ============================================
-- Household creation and joining go through these instead of direct INSERTs.
-- Reasons:
--   * atomic  -- a failed member insert rolls back the household, so no orphans
--   * role is decided server-side, so a client cannot make itself admin
--   * joining requires a real invite code that the household can rotate

CREATE OR REPLACE FUNCTION create_household_with_member(
  p_household_name TEXT,
  p_display_name TEXT
)
RETURNS members
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  uid UUID := auth.uid();
  new_household households;
  new_member members;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'You must be signed in.' USING ERRCODE = '28000';
  END IF;

  IF coalesce(btrim(p_household_name), '') = '' THEN
    RAISE EXCEPTION 'Household name is required.' USING ERRCODE = '22023';
  END IF;

  IF coalesce(btrim(p_display_name), '') = '' THEN
    RAISE EXCEPTION 'Your name is required.' USING ERRCODE = '22023';
  END IF;

  -- Idempotent: re-running onboarding returns the existing profile.
  SELECT * INTO new_member FROM members WHERE user_id = uid;
  IF FOUND THEN
    RETURN new_member;
  END IF;

  INSERT INTO households (name, invite_code)
  VALUES (btrim(p_household_name), generate_invite_code())
  RETURNING * INTO new_household;

  INSERT INTO members (household_id, user_id, name, role)
  VALUES (new_household.id, uid, btrim(p_display_name), 'admin')
  RETURNING * INTO new_member;

  RETURN new_member;
END;
$$;

CREATE OR REPLACE FUNCTION join_household_with_code(
  p_invite_code TEXT,
  p_display_name TEXT
)
RETURNS members
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  uid UUID := auth.uid();
  normalized TEXT := upper(btrim(coalesce(p_invite_code, '')));
  target_household UUID;
  new_member members;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'You must be signed in.' USING ERRCODE = '28000';
  END IF;

  IF coalesce(btrim(p_display_name), '') = '' THEN
    RAISE EXCEPTION 'Your name is required.' USING ERRCODE = '22023';
  END IF;

  IF normalized = '' THEN
    RAISE EXCEPTION 'An invite code is required.' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO new_member FROM members WHERE user_id = uid;
  IF FOUND THEN
    RETURN new_member;
  END IF;

  SELECT h.id INTO target_household
  FROM households h
  WHERE upper(h.invite_code) = normalized;

  -- Backwards compatibility: invite codes used to be the raw household UUID.
  IF target_household IS NULL THEN
    BEGIN
      SELECT h.id INTO target_household
      FROM households h
      WHERE h.id = normalized::UUID;
    EXCEPTION WHEN invalid_text_representation THEN
      target_household := NULL;
    END;
  END IF;

  IF target_household IS NULL THEN
    RAISE EXCEPTION 'That invite code was not found.' USING ERRCODE = '23503';
  END IF;

  INSERT INTO members (household_id, user_id, name, role)
  VALUES (target_household, uid, btrim(p_display_name), 'member')
  RETURNING * INTO new_member;

  RETURN new_member;
END;
$$;

-- Admins can invalidate an invite code that has been shared too widely.
CREATE OR REPLACE FUNCTION rotate_household_invite()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  uid UUID := auth.uid();
  target_household UUID;
  fresh_code TEXT;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'You must be signed in.' USING ERRCODE = '28000';
  END IF;

  SELECT household_id INTO target_household
  FROM members
  WHERE user_id = uid AND role = 'admin';

  IF target_household IS NULL THEN
    RAISE EXCEPTION 'Only a household admin can rotate the invite code.' USING ERRCODE = '42501';
  END IF;

  fresh_code := generate_invite_code();
  UPDATE households SET invite_code = fresh_code WHERE id = target_household;

  RETURN fresh_code;
END;
$$;

REVOKE ALL ON FUNCTION create_household_with_member(TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION join_household_with_code(TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION rotate_household_invite() FROM PUBLIC;
REVOKE ALL ON FUNCTION generate_invite_code() FROM PUBLIC;

GRANT EXECUTE ON FUNCTION create_household_with_member(TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION join_household_with_code(TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION rotate_household_invite() TO authenticated;

-- ============================================
-- MEMBER UPDATE GUARD
-- ============================================
-- Members may rename themselves. They may not move households, take over another
-- auth user, or promote themselves to admin.

CREATE OR REPLACE FUNCTION members_guard_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.household_id IS DISTINCT FROM OLD.household_id THEN
    RAISE EXCEPTION 'A member cannot be moved between households.' USING ERRCODE = '42501';
  END IF;

  IF NEW.user_id IS DISTINCT FROM OLD.user_id THEN
    RAISE EXCEPTION 'A member cannot be reassigned to another user.' USING ERRCODE = '42501';
  END IF;

  IF NEW.role IS DISTINCT FROM OLD.role
     AND NOT is_household_admin(auth.uid(), OLD.household_id) THEN
    RAISE EXCEPTION 'Only a household admin can change roles.' USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS members_guard_update_trigger ON members;
CREATE TRIGGER members_guard_update_trigger
  BEFORE UPDATE ON members
  FOR EACH ROW EXECUTE FUNCTION members_guard_update();

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE households ENABLE ROW LEVEL SECURITY;
ALTER TABLE members ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE income ENABLE ROW LEVEL SECURITY;
ALTER TABLE transfers ENABLE ROW LEVEL SECURITY;
ALTER TABLE gold_prices ENABLE ROW LEVEL SECURITY;

-- Drop superseded policies so this file can be re-run over an older schema.
DROP POLICY IF EXISTS "Allow all categories" ON categories;
DROP POLICY IF EXISTS "Allow household create" ON households;
DROP POLICY IF EXISTS "Allow member create" ON members;
DROP POLICY IF EXISTS "Allow expense write" ON expenses;
DROP POLICY IF EXISTS "Allow income write" ON income;
DROP POLICY IF EXISTS "Allow transfers write" ON transfers;

DROP POLICY IF EXISTS "Categories are readable by owner household" ON categories;
DROP POLICY IF EXISTS "Categories insert own household" ON categories;
DROP POLICY IF EXISTS "Categories update own household" ON categories;
DROP POLICY IF EXISTS "Categories delete own household" ON categories;
DROP POLICY IF EXISTS "Categories are readable by owner, household members, or defaults" ON categories;
DROP POLICY IF EXISTS "Categories insert own user" ON categories;
DROP POLICY IF EXISTS "Categories update own user" ON categories;
DROP POLICY IF EXISTS "Categories delete own user" ON categories;
DROP POLICY IF EXISTS "Allow household read" ON households;
DROP POLICY IF EXISTS "Allow household rename by admin" ON households;
DROP POLICY IF EXISTS "Allow members read" ON members;
DROP POLICY IF EXISTS "Allow member rename" ON members;
DROP POLICY IF EXISTS "Allow member removal" ON members;
DROP POLICY IF EXISTS "Allow expense read" ON expenses;
DROP POLICY IF EXISTS "Allow expense insert" ON expenses;
DROP POLICY IF EXISTS "Allow expense update" ON expenses;
DROP POLICY IF EXISTS "Allow expense delete" ON expenses;
DROP POLICY IF EXISTS "Allow income read" ON income;
DROP POLICY IF EXISTS "Allow income insert" ON income;
DROP POLICY IF EXISTS "Allow income update" ON income;
DROP POLICY IF EXISTS "Allow income delete" ON income;
DROP POLICY IF EXISTS "Allow transfers read" ON transfers;
DROP POLICY IF EXISTS "Allow transfers insert" ON transfers;
DROP POLICY IF EXISTS "Allow transfers update" ON transfers;
DROP POLICY IF EXISTS "Allow transfers delete" ON transfers;
DROP POLICY IF EXISTS "Gold prices are readable" ON gold_prices;

-- --- Categories -------------------------------------------------------------
-- Built-in defaults (is_default = true) are world-readable and immutable.
-- Custom categories are owned by a user (per-user scoping).
-- Household members can view the category on shared household expenses/income.
-- Only the owning user can insert, update, or delete their custom categories.

CREATE POLICY "Categories are readable by owner, household members, or defaults" ON categories FOR SELECT
  TO authenticated
  USING (
    (user_id IS NULL AND is_default = true)
    OR user_id = auth.uid()
    OR (household_id IS NOT NULL AND is_household_member(auth.uid(), household_id))
  );

CREATE POLICY "Categories insert own user" ON categories FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND is_default = false
  );

CREATE POLICY "Categories update own user" ON categories FOR UPDATE
  TO authenticated
  USING (
    user_id = auth.uid()
    AND is_default = false
  )
  WITH CHECK (
    user_id = auth.uid()
    AND is_default = false
  );

CREATE POLICY "Categories delete own user" ON categories FOR DELETE
  TO authenticated
  USING (
    user_id = auth.uid()
    AND is_default = false
  );

-- --- Households -------------------------------------------------------------
-- Creation happens through create_household_with_member(), so there is no
-- direct INSERT policy.

CREATE POLICY "Allow household read" ON households FOR SELECT
  TO authenticated
  USING (is_household_member(auth.uid(), id));

CREATE POLICY "Allow household rename by admin" ON households FOR UPDATE
  TO authenticated
  USING (is_household_admin(auth.uid(), id))
  WITH CHECK (is_household_admin(auth.uid(), id));

-- --- Members ----------------------------------------------------------------
-- Creation happens through the onboarding RPCs, so there is no INSERT policy;
-- that is what stops a client from picking its own role or joining a household
-- without a valid invite code.

CREATE POLICY "Allow members read" ON members FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR is_household_member(auth.uid(), household_id)
  );

CREATE POLICY "Allow member rename" ON members FOR UPDATE
  TO authenticated
  USING (
    user_id = auth.uid()
    OR is_household_admin(auth.uid(), household_id)
  )
  WITH CHECK (
    user_id = auth.uid()
    OR is_household_admin(auth.uid(), household_id)
  );

CREATE POLICY "Allow member removal" ON members FOR DELETE
  TO authenticated
  USING (
    user_id = auth.uid()
    OR is_household_admin(auth.uid(), household_id)
  );

-- --- Expenses ---------------------------------------------------------------
-- Read: your own rows, plus household-visible rows from housemates.
-- Write: your own rows only. Sharing an expense with the household makes it
-- visible to them, not editable or deletable by them.

CREATE POLICY "Allow expense read" ON expenses FOR SELECT
  TO authenticated
  USING (
    member_id IN (SELECT id FROM members WHERE user_id = auth.uid())
    OR (
      visibility = 'household'
      AND is_household_member(auth.uid(), household_id_for_member(member_id))
    )
  );

CREATE POLICY "Allow expense insert" ON expenses FOR INSERT
  TO authenticated
  WITH CHECK (member_id IN (SELECT id FROM members WHERE user_id = auth.uid()));

CREATE POLICY "Allow expense update" ON expenses FOR UPDATE
  TO authenticated
  USING (member_id IN (SELECT id FROM members WHERE user_id = auth.uid()))
  WITH CHECK (member_id IN (SELECT id FROM members WHERE user_id = auth.uid()));

CREATE POLICY "Allow expense delete" ON expenses FOR DELETE
  TO authenticated
  USING (member_id IN (SELECT id FROM members WHERE user_id = auth.uid()));

-- --- Income -----------------------------------------------------------------

CREATE POLICY "Allow income read" ON income FOR SELECT
  TO authenticated
  USING (
    member_id IN (SELECT id FROM members WHERE user_id = auth.uid())
    OR (
      visibility = 'household'
      AND is_household_member(auth.uid(), household_id_for_member(member_id))
    )
  );

CREATE POLICY "Allow income insert" ON income FOR INSERT
  TO authenticated
  WITH CHECK (member_id IN (SELECT id FROM members WHERE user_id = auth.uid()));

CREATE POLICY "Allow income update" ON income FOR UPDATE
  TO authenticated
  USING (member_id IN (SELECT id FROM members WHERE user_id = auth.uid()))
  WITH CHECK (member_id IN (SELECT id FROM members WHERE user_id = auth.uid()));

CREATE POLICY "Allow income delete" ON income FOR DELETE
  TO authenticated
  USING (member_id IN (SELECT id FROM members WHERE user_id = auth.uid()));

-- --- Transfers (always private) ---------------------------------------------

CREATE POLICY "Allow transfers read" ON transfers FOR SELECT
  TO authenticated
  USING (member_id IN (SELECT id FROM members WHERE user_id = auth.uid()));

CREATE POLICY "Allow transfers insert" ON transfers FOR INSERT
  TO authenticated
  WITH CHECK (member_id IN (SELECT id FROM members WHERE user_id = auth.uid()));

CREATE POLICY "Allow transfers update" ON transfers FOR UPDATE
  TO authenticated
  USING (member_id IN (SELECT id FROM members WHERE user_id = auth.uid()))
  WITH CHECK (member_id IN (SELECT id FROM members WHERE user_id = auth.uid()));

CREATE POLICY "Allow transfers delete" ON transfers FOR DELETE
  TO authenticated
  USING (member_id IN (SELECT id FROM members WHERE user_id = auth.uid()));

-- --- Gold prices (public market data, read-only to clients) -----------------
-- Deliberately no INSERT/UPDATE/DELETE policy: the Edge Function writes with the
-- service role key, which bypasses RLS. A signed-in client can read prices but
-- cannot forge one, which matters because these values price your holdings.

CREATE POLICY "Gold prices are readable" ON gold_prices FOR SELECT
  TO authenticated
  USING (true);
