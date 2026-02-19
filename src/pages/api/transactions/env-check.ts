import type { NextApiRequest, NextApiResponse } from 'next';
import path from 'path';

/**
 * GET /api/transactions/env-check
 * Shows whether Supabase env vars are visible to the API (no values are returned).
 * Open in browser to debug "Supabase not configured" issues.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    require('dotenv').config({ path: path.resolve(process.cwd(), '.env') });
  } catch {
    // ignore
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const pubKey = process.env.SUPABASE_PUB_KEY;

  res.status(200).json({
    ok: !!(url?.trim() && pubKey?.trim()),
    env: {
      NEXT_PUBLIC_SUPABASE_URL: !!url?.trim(),
      SUPABASE_PUB_KEY: !!pubKey?.trim(),
    },
    cwd: process.cwd(),
    hint: !url?.trim() || !pubKey?.trim()
      ? 'Put .env in the project root (same folder as package.json) with NEXT_PUBLIC_SUPABASE_URL and SUPABASE_PUB_KEY. Restart the dev server (yarn dev or npm run dev) after changing .env.'
      : undefined,
  });
}
