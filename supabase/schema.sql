-- =============================================================================
-- Transaction history table for Aave-Aleo frontend
-- Run this in Supabase: SQL Editor → New query → paste and Run
-- =============================================================================

-- Table: store one row per user transaction (deposit, withdraw, borrow, repay)
CREATE TABLE IF NOT EXISTS transaction_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_address TEXT NOT NULL,
  tx_id TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('deposit', 'withdraw', 'borrow', 'repay')),
  asset TEXT NOT NULL CHECK (asset IN ('aleo', 'usdc')),
  amount NUMERIC(20, 6) NOT NULL,
  program_id TEXT,
  explorer_url TEXT,
  vault_tx_id TEXT,
  vault_explorer_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- If table already exists, add vault columns (run once)
ALTER TABLE transaction_history ADD COLUMN IF NOT EXISTS vault_tx_id TEXT;
ALTER TABLE transaction_history ADD COLUMN IF NOT EXISTS vault_explorer_url TEXT;

-- Index: fetch transactions by user wallet (used by GET /api/transactions?wallet=...)
CREATE INDEX IF NOT EXISTS idx_transaction_history_wallet_address
  ON transaction_history (wallet_address);

-- Index: order by created_at when fetching by wallet
CREATE INDEX IF NOT EXISTS idx_transaction_history_wallet_created_at
  ON transaction_history (wallet_address, created_at DESC);

-- Row Level Security: required for the Publishable key (sb_publishable_...).
-- Requests using the Publishable key run as Postgres role "anon"; these policies allow SELECT and INSERT.
ALTER TABLE transaction_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "transaction_history_anon_select" ON transaction_history;
DROP POLICY IF EXISTS "transaction_history_publishable_select" ON transaction_history;
CREATE POLICY "transaction_history_publishable_select"
  ON transaction_history FOR SELECT TO anon
  USING (true);

DROP POLICY IF EXISTS "transaction_history_anon_insert" ON transaction_history;
DROP POLICY IF EXISTS "transaction_history_publishable_insert" ON transaction_history;
CREATE POLICY "transaction_history_publishable_insert"
  ON transaction_history FOR INSERT TO anon
  WITH CHECK (true);

COMMENT ON TABLE transaction_history IS 'Stores transaction history per user wallet for deposit, withdraw, borrow, repay (ALEO and USDC). Fetched by wallet_address in the app.';
