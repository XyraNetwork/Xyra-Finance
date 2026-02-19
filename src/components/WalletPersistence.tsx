'use client';

import { useEffect, useRef } from 'react';
import { useWallet } from '@provablehq/aleo-wallet-adaptor-react';
import { Network } from '@provablehq/aleo-types';

const WALLET_CONNECTED_KEY = 'wallet_connected';
const WALLET_NAME_KEY = 'wallet_name';

/**
 * Persists wallet connection to sessionStorage and restores only after navigation.
 * Does NOT auto-connect on first load — user must click Connect.
 * When user has already connected and then changes page, we re-select and reconnect
 * so they are not asked to connect again.
 */
export function WalletPersistence({ children }: { children: React.ReactNode }) {
  const { connected, wallet, selectWallet, connect, connecting } = useWallet();
  const restoreAttemptedRef = useRef(false);

  // Persist when user has connected (so we know to restore only after nav, not on first visit)
  useEffect(() => {
    if (typeof sessionStorage === 'undefined') return;
    if (connected && wallet?.adapter?.name) {
      sessionStorage.setItem(WALLET_CONNECTED_KEY, '1');
      sessionStorage.setItem(WALLET_NAME_KEY, wallet.adapter.name);
      restoreAttemptedRef.current = false;
    }
  }, [connected, wallet?.adapter?.name]);

  // Restore only when user had connected in this tab and then got disconnected (e.g. after route change)
  useEffect(() => {
    if (connected || connecting) return;
    const storedName = typeof sessionStorage !== 'undefined' ? sessionStorage.getItem(WALLET_NAME_KEY) : null;
    const hadSession = typeof sessionStorage !== 'undefined' && sessionStorage.getItem(WALLET_CONNECTED_KEY);
    if (!hadSession || !storedName || restoreAttemptedRef.current) return;
    restoreAttemptedRef.current = true;
    selectWallet(storedName as import('@provablehq/aleo-wallet-standard').WalletName);
    // Reconnect so they stay connected when changing page (no "Connect wallet" prompt)
    const t = setTimeout(() => {
      connect(Network.TESTNET).catch(() => {});
    }, 150);
    return () => clearTimeout(t);
  }, [connected, connecting, selectWallet, connect]);

  return <>{children}</>;
}
