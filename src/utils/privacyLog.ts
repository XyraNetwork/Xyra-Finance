/**
 * Gate console output that may contain private records, balances, or position data.
 * Set NEXT_PUBLIC_DEBUG_PRIVACY=true in .env.local and restart dev to enable.
 */
export const DEBUG_PRIVACY =
  typeof process !== 'undefined' &&
  String(process.env.NEXT_PUBLIC_DEBUG_PRIVACY || '').trim().toLowerCase() === 'true';

export function privacyLog(...args: unknown[]): void {
  if (DEBUG_PRIVACY) console.log(...args);
}

export function privacyWarn(...args: unknown[]): void {
  if (DEBUG_PRIVACY) console.warn(...args);
}
