import { createBrowserClient } from '@supabase/ssr';

/** Publishable key (sb_publishable_...) – use NEXT_PUBLIC_SUPABASE_PUB_KEY or fallback to NEXT_PUBLIC_SUPABASE_ANON_KEY */
function getSupabaseKey(): string | undefined {
  return (
    process.env.NEXT_PUBLIC_SUPABASE_PUB_KEY?.trim() ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim()
  );
}

/**
 * Browser Supabase client. Uses Publishable key (safe to expose).
 * Returns null if env not set (for optional features like transaction history).
 */
export function getSupabaseBrowserClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = getSupabaseKey();
  if (!supabaseUrl || !key) return null;
  return createBrowserClient(supabaseUrl, key);
}

/** Throws if env missing – use when Supabase is required. */
export function createClient() {
  const client = getSupabaseBrowserClient();
  if (!client) {
    throw new Error(
      'NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUB_KEY (or NEXT_PUBLIC_SUPABASE_ANON_KEY) are required.'
    );
  }
  return client;
}
