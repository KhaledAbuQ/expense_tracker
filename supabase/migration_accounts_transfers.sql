-- Migration: Add account types and transfers table
-- Run this in your Supabase SQL Editor if you already have the database set up

-- Add account_type column to expenses table
ALTER TABLE expenses 
ADD COLUMN IF NOT EXISTS account_type VARCHAR(20) DEFAULT 'bank' 
CHECK (account_type IN ('bank', 'cash'));

-- Add account_type column to income table (includes savings for direct deposits)
ALTER TABLE income 
ADD COLUMN IF NOT EXISTS account_type VARCHAR(20) DEFAULT 'bank' 
CHECK (account_type IN ('bank', 'cash', 'savings'));

-- Create transfers table for moving money between accounts
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

-- Add indexes for new columns and table
CREATE INDEX IF NOT EXISTS idx_expenses_account ON expenses(account_type);
CREATE INDEX IF NOT EXISTS idx_income_account ON income(account_type);
CREATE INDEX IF NOT EXISTS idx_transfers_date ON transfers(date DESC);
CREATE INDEX IF NOT EXISTS idx_transfers_from ON transfers(from_account);
CREATE INDEX IF NOT EXISTS idx_transfers_to ON transfers(to_account);

-- Enable RLS on transfers table
ALTER TABLE transfers ENABLE ROW LEVEL SECURITY;

-- Allow all operations on transfers (no auth required for single household use)
CREATE POLICY "Allow all transfers" ON transfers 
  FOR ALL 
  USING (true) 
  WITH CHECK (true);
