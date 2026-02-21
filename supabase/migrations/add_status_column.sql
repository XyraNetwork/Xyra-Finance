-- Add status column if missing (for vault watcher and API claim logic).
-- Run in Supabase: SQL Editor → New query → paste and Run.

ALTER TABLE transaction_history ADD COLUMN IF NOT EXISTS status TEXT;
COMMENT ON COLUMN transaction_history.status IS 'vault_processing (claimed), vault_pending (retry), completed (vault done).';
