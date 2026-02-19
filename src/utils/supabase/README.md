# Supabase clients (Next.js)

Two patterns are used in this project:

## 1. SSR clients (Auth + RLS)

- **`server.ts`** – `createClient()` for Server Components and Route Handlers. Uses cookies for Supabase Auth session.
- **`client.ts`** – `createClient()` for client components (browser). Uses the anon key; session is in cookies.
- **`middleware.ts`** (project root) – Refreshes the auth session on each request.

**Env:** `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` (use the **Publishable** key from Supabase → Settings → API).

**Use when:** You add Supabase Auth (login/signup) or need RLS with a logged-in user.

**Example (Server Component):**
```ts
import { createClient } from '@/utils/supabase/server';

export default async function Page() {
  const supabase = await createClient();
  const { data } = await supabase.from('todos').select();
  return <ul>{data?.map(...)}</ul>;
}
```

## 2. API client (transaction history)

- **`@/lib/supabase`** – `getSupabaseClient()` uses the **Publishable key** (`SUPABASE_PUB_KEY`, format `sb_publishable_...`). Low privilege; RLS applies. Used by `/api/transactions` and health. See [Understanding API keys](https://supabase.com/docs/guides/api/api-keys).

**Env:** `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_PUB_KEY` (Publishable key from Supabase → Settings → API). RLS policies in `supabase/schema.sql` allow SELECT and INSERT.

**Example (API route):**
```ts
import { getSupabaseClient } from '@/lib/supabase';

export default async function handler(req, res) {
  const supabase = getSupabaseClient();
  if (!supabase) return res.status(503).json({ error: 'Supabase not configured' });
  const { data } = await supabase.from('transaction_history').select('*').eq('wallet_address', wallet);
  return res.status(200).json(data);
}
```

## Summary

| Client / function        | Where to use       | Env key(s) |
|--------------------------|--------------------|------------|
| `utils/supabase/server`  | Server Components  | URL + **NEXT_PUBLIC_SUPABASE_ANON_KEY** (Publishable) |
| `utils/supabase/client`  | Browser            | URL + **NEXT_PUBLIC_SUPABASE_ANON_KEY** (Publishable) |
| `lib/supabase` → `getSupabaseClient()` | API routes (transactions) | URL + **SUPABASE_PUB_KEY** (Publishable key only) |
