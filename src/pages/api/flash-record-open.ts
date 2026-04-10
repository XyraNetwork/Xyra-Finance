import type { NextApiRequest, NextApiResponse } from 'next';

type Body = {
  user_address: string;
  strategy_wallet: string;
  asset_id: '0field' | '1field' | '2field';
  principal_micro: number;
  min_profit_micro: number;
  strategy_id: string;
  flash_open_tx_id: string;
  idempotency_key?: string;
};

function getSecret(): string | undefined {
  return process.env.RECORD_TRANSACTION_SECRET?.trim() || undefined;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }
  const backendUrl =
    process.env.NEXT_PUBLIC_BACKEND_URL?.replace(/\/$/, '') ||
    process.env.BACKEND_URL?.replace(/\/$/, '');
  const secret = getSecret();
  if (!backendUrl) return res.status(503).json({ error: 'Backend URL not configured' });
  if (!secret) return res.status(503).json({ error: 'RECORD_TRANSACTION_SECRET is not set' });

  const body = req.body as Body;
  if (!body?.user_address || !body?.strategy_wallet || !body?.flash_open_tx_id) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    const backendRes = await fetch(`${backendUrl}/flash/record-open`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-record-transaction-secret': secret,
      },
      body: JSON.stringify(body),
    });
    const data = await backendRes.json().catch(() => ({}));
    if (!backendRes.ok) return res.status(backendRes.status).json(data?.error ? { error: data.error } : { error: 'Backend error' });
    return res.status(200).json(data);
  } catch (e) {
    console.error('[api/flash-record-open]', e);
    return res.status(500).json({ error: 'Failed to record flash open session' });
  }
}

