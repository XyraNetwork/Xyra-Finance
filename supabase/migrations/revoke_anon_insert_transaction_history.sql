-- Security: only the backend (service role) can INSERT into transaction_history.
-- The frontend uses the Publishable key for SELECT only. This prevents anyone from
-- posting fake withdraw/borrow rows to trigger vault payouts.
-- Run in Supabase: SQL Editor → New query → paste and Run.

DROP POLICY IF EXISTS "transaction_history_anon_insert" ON transaction_history;
DROP POLICY IF EXISTS "transaction_history_publishable_insert" ON transaction_history;

-- No new policy for anon INSERT: anon can only SELECT (existing policy remains).
-- Inserts are done by the backend using the Service Role key (bypasses RLS).

COMMENT ON TABLE transaction_history IS 'Stores transaction history per user wallet. SELECT: anon (publishable key). INSERT: service role only (backend /record-transaction).';
