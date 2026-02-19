import type { NextApiRequest, NextApiResponse } from 'next';
import { getSupabaseClient } from '@/lib/supabase';

/**
 * GET /api/transactions/health
 * Verifies Supabase is configured (Publishable key) and the transaction_history table exists.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const supabase = getSupabaseClient();
  if (!supabase) {
    return res.status(503).json({
      ok: false,
      error: 'Supabase not configured',
      hint: 'Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_PUB_KEY (Publishable key) in .env',
    });
  }

  try {
    const { data, error } = await supabase
      .from('transaction_history')
      .select('id')
      .limit(1);

    if (error) {
      console.error('[transactions/health] Supabase error:', error);
      return res.status(500).json({
        ok: false,
        error: error.message,
        hint: error.code === '42P01' ? 'Run supabase/schema.sql in Supabase SQL Editor to create the table.' : undefined,
      });
    }

    return res.status(200).json({ ok: true, message: 'Supabase connected and transaction_history table exists.' });
  } catch (e: any) {
    console.error('[transactions/health] Exception:', e);
    return res.status(500).json({ ok: false, error: e?.message || 'Unknown error' });
  }
}
