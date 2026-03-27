import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/router';
import type { NextPageWithLayout } from '@/types';
import Layout from '@/layouts/_layout';
import Link from 'next/link';
import { MarketsView } from '@/components/MarketsView';
import DocsPage from '@/pages/docs';
import { useDashboardView } from '@/contexts/DashboardViewContext';
import Button from '@/components/ui/button';
import { InfoTooltip } from '@/components/ui/InfoTooltip';
import { PrivateDataColumnHeader } from '@/components/ui/PrivateDataColumnHeader';
import { PrivateActionButton } from '@/components/ui/PrivateActionButton';
import { AssetBadge } from '@/components/ui/AssetBadge';
import { StatCard } from '@/components/ui/StatCard';
import { StatusChip } from '@/components/ui/StatusChip';
import { useWallet } from '@provablehq/aleo-wallet-adaptor-react';
import { WalletMultiButton } from '@provablehq/aleo-wallet-adaptor-react-ui';
import { Network } from '@provablehq/aleo-types';
import {
  getLendingPoolState,
  getUsdcLendingPoolState,
  lendingDeposit,
  lendingBorrow,
  lendingRepay,
  lendingWithdraw,
  lendingDepositUsdc,
  lendingBorrowUsdc,
  lendingRepayUsdc,
  lendingWithdrawUsdc,
  getSuitableUsdcTokenRecord,
  getPrivateUsdcBalance,
  lendingDepositUsad,
  lendingBorrowUsad,
  lendingRepayUsad,
  lendingWithdrawUsad,
  getSuitableUsadTokenRecord,
  getPrivateUsadBalance,
  lendingAccrueInterest,
  lendingAccrueInterestUsdc,
  lendingAccrueInterestUsad,
  lendingFlashLoan,
  aleoFlashFeeMicro,
  ALEO_FLASH_PREMIUM_BPS,
  debugAllRecords,
  LENDING_POOL_PROGRAM_ID,
  USDC_LENDING_POOL_PROGRAM_ID,
  USAD_LENDING_POOL_PROGRAM_ID,
  getPoolApyFractionsFromChain,
  resolvePoolApyDisplay,
  getAleoPoolUserEffectivePosition,
  getPrivateCreditsBalance,
  getUsadLendingPoolState,
  getAssetPriceForProgram,
  getCrossCollateralBorrowCapsFromChain,
  getCrossCollateralWithdrawCapsFromChain,
  createTestCredits,
  depositTestReal,
  logAleoTxExplorer,
  ALEO_TESTNET_TX_EXPLORER,
  type CrossCollateralChainCaps,
  type CrossCollateralWithdrawCaps,
} from '@/components/aleo/rpc';
import { frontendLogger } from '@/utils/logger';
import { CURRENT_NETWORK } from '@/types';
import { getSupabaseBrowserClient } from '@/utils/supabase/client';

// Frontend app environment: 'dev' or 'prod' (default to dev for non-production NODE_ENV)
const APP_ENV = process.env.NEXT_PUBLIC_APP_ENV;
const isDevAppEnv = APP_ENV ? APP_ENV === 'dev' : process.env.NODE_ENV !== 'production';

/** Rich console output when a pool tx is rejected / failed / dropped (helps debug repay). */
function logPoolTxRejected(
  poolLabel: string,
  status: string,
  txId: string,
  meta?: { action?: string; program?: string }
) {
  logAleoTxExplorer(`${poolLabel} tx ${status}`, txId);
  console.error(`[${poolLabel}] Transaction ${status}`, {
    txId,
    explorerUrl: `${ALEO_TESTNET_TX_EXPLORER}/${txId}`,
    action: meta?.action,
    program: meta?.program,
    hints:
      status.toLowerCase() === 'rejected'
        ? [
            meta?.action === 'borrow'
              ? 'Validator rejected borrow: usually new_borrow_usd > cross-collateral headroom (integer rounding), wrong program id, or stale UI — try Max (chain) or a slightly smaller amount; confirm on-chain asset_price / LTV.'
              : 'Validator rejected: for repay, amount > accrued debt or bad Merkle proofs; for borrow, portfolio assert failed or program mismatch.',
            'Verify NEXT_PUBLIC_* pool id matches deployment; run accrue interest; refresh balances.',
          ]
        : undefined,
  });
}

function txHistoryTypeLabel(type: string): string {
  const t = String(type || '').toLowerCase();
  if (t === 'deposit') return 'Deposit Tx';
  if (t === 'withdraw') return 'Withdraw Tx';
  if (t === 'borrow') return 'Borrow Tx';
  if (t === 'repay') return 'Repay Tx';
  if (t === 'flash_loan') return 'Flash loan Tx';
  return `${t ? t.charAt(0).toUpperCase() + t.slice(1) : 'Program'} Tx`;
}

function txHistoryAssetVaultLabel(asset: string): string {
  const a = String(asset || '').toLowerCase();
  if (a === 'usdcx') return 'USDCx';
  if (a === 'usad' || a === 'usadx') return 'USAD';
  if (a === 'aleo') return 'ALEO';
  return String(asset || 'Asset').toUpperCase();
}

/** Transaction history: program tx + optional vault tx pills in one row */
function TxHistoryTrxPills({
  txId,
  explorerUrl,
  vaultExplorerUrl,
  type,
  asset,
  getProvableExplorerTxUrl,
}: {
  txId: string;
  explorerUrl: string | null;
  vaultExplorerUrl: string | null;
  type: string;
  asset: string;
  getProvableExplorerTxUrl: (id: string) => string;
}) {
  const programHref = (explorerUrl && explorerUrl.trim()) || getProvableExplorerTxUrl(txId);
  const needsVaultPayment = type === 'withdraw' || type === 'borrow' || type === 'flash_loan';
  const vaultAssetLabel = `${txHistoryAssetVaultLabel(asset)} Tx`;
  const firstLabel = txHistoryTypeLabel(type);

  return (
    <div className="flex flex-row flex-wrap items-center gap-2 min-w-0 max-w-[320px]">
      <a
        href={programHref}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1.5 rounded-lg border border-cyan-500/40 bg-cyan-500/[0.07] px-2 py-1 text-[11px] font-semibold tracking-wide text-cyan-700 hover:bg-cyan-500/15 dark:text-cyan-300 dark:border-cyan-400/45 transition-colors"
        title="On-chain program transaction"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 256 256" className="shrink-0 opacity-90" fill="currentColor" aria-hidden>
          <path d="M213.66,82.34l-56-56A8,8,0,0,0,152,24H56A16,16,0,0,0,40,40V216a16,16,0,0,0,16,16H200a16,16,0,0,0,16-16V88A8,8,0,0,0,213.66,82.34ZM160,51.31,188.69,80H160ZM200,216H56V40h88V88a8,8,0,0,0,8,8h48V216Z" />
        </svg>
        {firstLabel}
      </a>
      {vaultExplorerUrl ? (
        <a
          href={vaultExplorerUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/40 bg-emerald-500/[0.07] px-2 py-1 text-[11px] font-semibold tracking-wide text-emerald-700 hover:bg-emerald-500/15 dark:text-emerald-300 dark:border-emerald-400/45 transition-colors"
          title="Vault transfer"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 256 256" className="shrink-0 opacity-90" fill="currentColor" aria-hidden>
            <path d="M128,24A104,104,0,1,0,232,128,104.11,104.11,0,0,0,128,24Zm0,192a88,88,0,1,1,88-88A88.1,88.1,0,0,1,128,216Zm45.66-93.66-56-56a8,8,0,0,0-11.32,0l-24,24a8,8,0,0,0,11.32,11.32L120,132.69l50.34-50.35a8,8,0,0,0,0-11.32Z" />
          </svg>
          {vaultAssetLabel}
        </a>
      ) : needsVaultPayment ? (
        <span
          className="inline-flex items-center gap-1.5 rounded-lg border border-amber-500/35 bg-amber-500/[0.06] px-2 py-1 text-[11px] font-semibold tracking-wide text-amber-800 dark:text-amber-300 dark:border-amber-400/40"
          title="Vault transfer in progress"
        >
          <span className="loading loading-spinner loading-xs text-amber-600" aria-hidden />
          <span className="truncate max-w-[120px]">{vaultAssetLabel}</span>
          <span className="opacity-80 font-normal">Pending</span>
        </span>
      ) : null}
    </div>
  );
}

const DashboardPage: NextPageWithLayout = () => {
  const router = useRouter();
  const { view, setView } = useDashboardView();

  // Sync URL to context when landing on /dashboard?view=markets or /dashboard?view=docs
  useEffect(() => {
    if (router.query.view === 'markets') {
      setView('markets');
    } else if (router.query.view === 'docs') {
      setView('docs');
    } else if (router.query.view === 'flash') {
      // Flash is intentionally hidden right now.
      setView('dashboard');
    } else {
      setView('dashboard');
    }
  }, [router.query.view, setView]);

  const wallet = useWallet() as any;
  const {
    address,
    connected,
    connecting,
    executeTransaction,
    transactionStatus,
    requestRecords,
    requestTransactionHistory,
    decrypt,
  } = wallet;
  const requestTransaction = wallet.requestTransaction;
  const publicKey = address; // Use address as publicKey for compatibility

  // Avoid showing "Connect wallet" immediately after nav from Markets when already connected (adapter may restore state shortly)
  const [allowShowConnectCTA, setAllowShowConnectCTA] = useState(true);
  useEffect(() => {
    if (connected) {
      if (typeof sessionStorage !== 'undefined') sessionStorage.setItem('wallet_connected', '1');
      setAllowShowConnectCTA(true);
      return;
    }
    const hadConnection = typeof sessionStorage !== 'undefined' && sessionStorage.getItem('wallet_connected');
    if (hadConnection) {
      setAllowShowConnectCTA(false);
      const t = setTimeout(() => {
        setAllowShowConnectCTA(true);
        if (typeof sessionStorage !== 'undefined') sessionStorage.removeItem('wallet_connected');
      }, 600);
      return () => clearTimeout(t);
    }
    setAllowShowConnectCTA(true);
  }, [connected]);

  const [amount, setAmount] = useState<number>(0);
  const [testCreditsAmount, setTestCreditsAmount] = useState<number>(0);
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [txId, setTxId] = useState<string | null>(null);
  const [vaultWithdrawTxId, setVaultWithdrawTxId] = useState<string | null>(null);
  const [vaultBorrowTxId, setVaultBorrowTxId] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [showLogsPanel, setShowLogsPanel] = useState<boolean>(false);
  const [logsSummary, setLogsSummary] = useState<any>(null);

  const [totalSupplied, setTotalSupplied] = useState<string | null>(null);
  const [totalBorrowed, setTotalBorrowed] = useState<string | null>(null);
  const [utilizationIndex, setUtilizationIndex] = useState<string | null>(null);
  const [interestIndex, setInterestIndex] = useState<string | null>(null);
  const [liquidityIndex, setLiquidityIndex] = useState<string | null>(null);
  const [borrowIndex, setBorrowIndex] = useState<string | null>(null);
  const [supplyAPY, setSupplyAPY] = useState<number>(0);
  const [borrowAPY, setBorrowAPY] = useState<number>(0);
  const [effectiveUserSupplied, setEffectiveUserSupplied] = useState<number | null>(null);
  const [effectiveUserBorrowed, setEffectiveUserBorrowed] = useState<number | null>(null);
  const [txFinalized, setTxFinalized] = useState<boolean>(false);

  // User position state (from records; effective balance from mappings when available)
  const [userSupplied, setUserSupplied] = useState<string>('0');
  const [userBorrowed, setUserBorrowed] = useState<string>('0');
  const [totalDeposits, setTotalDeposits] = useState<string>('0');
  const [totalWithdrawals, setTotalWithdrawals] = useState<string>('0');
  const [totalBorrows, setTotalBorrows] = useState<string>('0');
  const [totalRepayments, setTotalRepayments] = useState<string>('0');
  const [isFetchingRecords, setIsFetchingRecords] = useState<boolean>(false);
  const [isRefreshingState, setIsRefreshingState] = useState<boolean>(false);
  const [amountError, setAmountError] = useState<string | null>(null);
  const [privateAleoBalance, setPrivateAleoBalance] = useState<number | null>(null);

  // USDC Pool state (program from NEXT_PUBLIC_USDC_LENDING_POOL_PROGRAM_ID or main pool)
  const [totalSuppliedUsdc, setTotalSuppliedUsdc] = useState<string | null>(null);
  const [totalBorrowedUsdc, setTotalBorrowedUsdc] = useState<string | null>(null);
  const [utilizationIndexUsdc, setUtilizationIndexUsdc] = useState<string | null>(null);
  const [liquidityIndexUsdc, setLiquidityIndexUsdc] = useState<string | null>(null);
  const [borrowIndexUsdc, setBorrowIndexUsdc] = useState<string | null>(null);
  const [supplyAPYUsdc, setSupplyAPYUsdc] = useState<number>(0);
  const [borrowAPYUsdc, setBorrowAPYUsdc] = useState<number>(0);
  const [userSuppliedUsdc, setUserSuppliedUsdc] = useState<string>('0');
  const [userBorrowedUsdc, setUserBorrowedUsdc] = useState<string>('0');
  const [effectiveUserSuppliedUsdc, setEffectiveUserSuppliedUsdc] = useState<number | null>(null);
  const [effectiveUserBorrowedUsdc, setEffectiveUserBorrowedUsdc] = useState<number | null>(null);
  const [totalDepositsUsdc, setTotalDepositsUsdc] = useState<string>('0');
  const [totalWithdrawalsUsdc, setTotalWithdrawalsUsdc] = useState<string>('0');
  const [totalBorrowsUsdc, setTotalBorrowsUsdc] = useState<string>('0');
  const [totalRepaymentsUsdc, setTotalRepaymentsUsdc] = useState<string>('0');
  const [isRefreshingUsdcState, setIsRefreshingUsdcState] = useState<boolean>(false);
  const [amountUsdc, setAmountUsdc] = useState<number>(0);
  const [modalAmountInput, setModalAmountInput] = useState<string>('');
  const [amountErrorUsdc, setAmountErrorUsdc] = useState<string | null>(null);
  const [privateUsdcBalance, setPrivateUsdcBalance] = useState<number | null>(null);

  // USAD Pool state
  const [totalSuppliedUsad, setTotalSuppliedUsad] = useState<string | null>(null);
  const [totalBorrowedUsad, setTotalBorrowedUsad] = useState<string | null>(null);
  const [utilizationIndexUsad, setUtilizationIndexUsad] = useState<string | null>(null);
  const [liquidityIndexUsad, setLiquidityIndexUsad] = useState<string | null>(null);
  const [borrowIndexUsad, setBorrowIndexUsad] = useState<string | null>(null);
  const [supplyAPYUsad, setSupplyAPYUsad] = useState<number>(0);
  const [borrowAPYUsad, setBorrowAPYUsad] = useState<number>(0);
  const [userSuppliedUsad, setUserSuppliedUsad] = useState<string>('0');
  const [userBorrowedUsad, setUserBorrowedUsad] = useState<string>('0');
  const [effectiveUserSuppliedUsad, setEffectiveUserSuppliedUsad] = useState<number | null>(null);
  const [effectiveUserBorrowedUsad, setEffectiveUserBorrowedUsad] = useState<number | null>(null);
  const [totalDepositsUsad, setTotalDepositsUsad] = useState<string>('0');
  const [totalWithdrawalsUsad, setTotalWithdrawalsUsad] = useState<string>('0');
  const [totalBorrowsUsad, setTotalBorrowsUsad] = useState<string>('0');
  const [totalRepaymentsUsad, setTotalRepaymentsUsad] = useState<string>('0');
  const [isRefreshingUsadState, setIsRefreshingUsadState] = useState<boolean>(false);
  const [amountUsad, setAmountUsad] = useState<number>(0);
  const [amountErrorUsad, setAmountErrorUsad] = useState<string | null>(null);
  const [privateUsadBalance, setPrivateUsadBalance] = useState<number | null>(null);
  const [assetPriceAleo, setAssetPriceAleo] = useState<number | null>(null); // PRICE_SCALE (1e6)
  const [assetPriceUsdc, setAssetPriceUsdc] = useState<number | null>(null); // PRICE_SCALE (1e6)
  const [assetPriceUsad, setAssetPriceUsad] = useState<number | null>(null); // PRICE_SCALE (1e6)
  /** Matches `finalize_borrow` integer math; when set, borrow limits use this instead of float portfolio. */
  const [chainBorrowCaps, setChainBorrowCaps] = useState<CrossCollateralChainCaps | null>(null);

  /** Matches `finalize_withdraw` integer math; when set, withdraw caps use this instead of float portfolio. */
  const [chainWithdrawCaps, setChainWithdrawCaps] = useState<CrossCollateralWithdrawCaps | null>(null);

  // Action modal (Aave-style: withdraw/deposit/borrow/repay with overview + tx status)
  const [actionModalOpen, setActionModalOpen] = useState(false);
  const [actionModalMode, setActionModalMode] = useState<'withdraw' | 'deposit' | 'borrow' | 'repay'>('withdraw');
  const [actionModalAsset, setActionModalAsset] = useState<'aleo' | 'usdc' | 'usad'>('aleo');
  const [actionModalSubmitted, setActionModalSubmitted] = useState(false);
  const [expandedAsset, setExpandedAsset] = useState<'aleo' | 'usdc' | 'usad' | null>('aleo');
  const [activeManageTab, setActiveManageTab] = useState<'Supply' | 'Withdraw' | 'Borrow' | 'Repay'>('Supply');
  const [manageAmountInput, setManageAmountInput] = useState('');
  const [inlineTxContext, setInlineTxContext] = useState<{
    tab: 'Supply' | 'Withdraw' | 'Borrow' | 'Repay';
    asset: 'aleo' | 'usdc' | 'usad';
  } | null>(null);

  // Track if we've already triggered a one-time records permission request for this connection
  const [walletPermissionsInitialized, setWalletPermissionsInitialized] = useState<boolean>(false);

  // Flash loan (ALEO pool only) — separate tab
  const [flashAmountInput, setFlashAmountInput] = useState('');
  const [flashLoading, setFlashLoading] = useState(false);
  const [flashStatusMessage, setFlashStatusMessage] = useState('');
  const [flashTxId, setFlashTxId] = useState<string | null>(null);
  const [flashVaultTxId, setFlashVaultTxId] = useState<string | null>(null);
  // Track if we've already loaded the user's position once after wallet connect
  const [userPositionInitialized, setUserPositionInitialized] = useState<boolean>(false);

  // Transaction history from Supabase (by wallet address)
  type TxHistoryRow = {
    id: string;
    tx_id: string;
    type: string;
    asset: string;
    amount: number;
    explorer_url: string | null;
    vault_tx_id: string | null;
    vault_explorer_url: string | null;
    created_at: string;
  };
  const [txHistory, setTxHistory] = useState<TxHistoryRow[]>([]);
  const [txHistoryLoading, setTxHistoryLoading] = useState(false);
  const [txHistoryPage, setTxHistoryPage] = useState(1);

  // Helper to extract a ciphertext string from a generic record object.
  const extractCiphertext = (record: any): string | null => {
    if (!record || typeof record !== 'object') return null;
    for (const key of Object.keys(record)) {
      const lower = key.toLowerCase();
      if (lower.includes('cipher')) {
        const val = (record as any)[key];
        if (typeof val === 'string' && val.trim().length > 0) {
          return val;
        }
      }
    }
    if ((record as any).data && typeof (record as any).data === 'object') {
      return extractCiphertext((record as any).data);
    }
    return null;
  };

  // Helper to parse numeric u64-style fields (e.g. "10u64", "10u64.private") from decrypted text.
  const extractU64FromText = (label: string, text: string): number => {
    if (!text) return 0;
    // Some pools may emit counters as `u64` or `u128`; normalize both.
    const regex = new RegExp(`${label}\\s*[:=]\\s*([0-9_]+)u(?:64|128)`, 'i');
    const match = text.match(regex);
    if (!match || !match[1]) return 0;
    const cleaned = match[1].replace(/_/g, '');
    const n = Number(cleaned);
    return Number.isNaN(n) ? 0 : n;
  };

  // Parse field-style values (e.g. "0field") from decrypted Leo record text.
  const extractFieldFromText = (label: string, text: string): string | null => {
    if (!text) return null;
    // `asset_id` may be printed as `2field` or sometimes `2u8` / `2u64` depending on how
    // the record was generated. Normalize all numeric variants to `<n>field` so the
    // existing filters (`assetId !== '2field'`) keep working.
    const regex = new RegExp(`${label}\\s*[:=]\\s*([0-9_]+)(field|u8|u64|u128)?`, 'i');
    const match = text.match(regex);
    if (!match || !match[1]) return null;
    const n = match[1].replace(/_/g, '');
    // Always normalize suffix to `field` for comparisons used throughout the UI.
    return `${n}field`;
  };

  // Background record fetching function (non-blocking) - memoized with useCallback
  const fetchRecordsInBackground = useCallback(async (programId: string = LENDING_POOL_PROGRAM_ID) => {
    if (!connected || !requestRecords || !publicKey) {
      console.log('📋 fetchRecordsInBackground: Skipping - wallet not connected or requestRecords not available');
      return;
    }

    // Don't fetch if already fetching
    if (isFetchingRecords) {
      console.log('📋 fetchRecordsInBackground: Already fetching, skipping duplicate request');
      return;
    }

    setIsFetchingRecords(true);
    console.log(`📋 fetchRecordsInBackground: Starting background fetch for ${programId}...`);

    try {
      // Step 1: Fetch encrypted records for this user from lending_pool_v8.aleo.
      // We use includePlaintext=false so we explicitly decrypt via decrypt().
      const records = await requestRecords(programId, false);
      console.log(
        `📋 fetchRecordsInBackground: Fetched ${records?.length || 0} records for ${programId}`,
        records,
      );

      if (!records || !Array.isArray(records) || records.length === 0) {
        console.log('📋 fetchRecordsInBackground: No records found yet (may need more time to index)');
        // Reset user position to zero when no records
        setUserSupplied('0');
        setUserBorrowed('0');
        setTotalDeposits('0');
        setTotalWithdrawals('0');
        setTotalBorrows('0');
        setTotalRepayments('0');
        return;
      }

      if (!decrypt) {
        console.warn('📋 fetchRecordsInBackground: decrypt() not available on wallet, cannot compute user position from records.');
        return;
      }

      // Step 2: Decrypt each record's ciphertext and accumulate totals.
      let totalDepositsAccum = 0;
      let totalWithdrawalsAccum = 0;
      let totalBorrowsAccum = 0;
      let totalRepaymentsAccum = 0;

      for (let i = 0; i < records.length; i++) {
        const rec = records[i];
        console.log(`📋 Decrypting record [${i}]`, rec);

        const cipher = extractCiphertext(rec);
        if (!cipher) {
          console.warn(`📋 Record [${i}] has no ciphertext field, skipping.`);
          continue;
        }

        try {
          const decryptedText = await decrypt(cipher);
          console.log(`📋 Decrypted record [${i}] text:`, decryptedText);

          // In v2, one program emits UserActivity for all assets.
          // Filter to ALEO records only for this fetch path.
          const assetId = extractFieldFromText('asset_id', decryptedText);
          if (assetId !== '0field') continue;

          // Try to parse totals directly from decrypted Leo record text.
          totalDepositsAccum += extractU64FromText('total_deposits', decryptedText);
          totalWithdrawalsAccum += extractU64FromText('total_withdrawals', decryptedText);
          totalBorrowsAccum += extractU64FromText('total_borrows', decryptedText);
          totalRepaymentsAccum += extractU64FromText('total_repayments', decryptedText);
        } catch (e: any) {
          console.warn(`📋 Failed to decrypt record [${i}]:`, e?.message || e);
        }
      }

      const netSupplied = Math.max(0, totalDepositsAccum - totalWithdrawalsAccum);
      const netBorrowed = Math.max(0, totalBorrowsAccum - totalRepaymentsAccum);

      // Update state for UI
      setTotalDeposits(String(totalDepositsAccum));
      setTotalWithdrawals(String(totalWithdrawalsAccum));
      setTotalBorrows(String(totalBorrowsAccum));
      setTotalRepayments(String(totalRepaymentsAccum));
      setUserSupplied(String(netSupplied));
      setUserBorrowed(String(netBorrowed));

      console.log('📋 fetchRecordsInBackground: User position updated from decrypted records', {
        totalDepositsAccum,
        totalWithdrawalsAccum,
        totalBorrowsAccum,
        totalRepaymentsAccum,
        netSupplied,
        netBorrowed,
      });
    } catch (error: any) {
      // Silently handle errors in background fetch (don't spam user)
      console.warn('📋 fetchRecordsInBackground: Error fetching records (non-critical):', error?.message);
    } finally {
      setIsFetchingRecords(false);
      console.log('📋 fetchRecordsInBackground: Background fetch completed');
    }
  }, [connected, requestRecords, publicKey, decrypt, isFetchingRecords]);

  // Fetch user position for USDC pool (lending_pool_usdce_v85.aleo) — same UserActivity record shape.
  const fetchRecordsInBackgroundUsdc = useCallback(async () => {
    if (!connected || !requestRecords || !publicKey) return;
    if (isFetchingRecords) return;
    setIsFetchingRecords(true);
    try {
      const records = await requestRecords(USDC_LENDING_POOL_PROGRAM_ID, false);
      if (!records || !Array.isArray(records) || records.length === 0) {
        setUserSuppliedUsdc('0');
        setUserBorrowedUsdc('0');
        setTotalDepositsUsdc('0');
        setTotalWithdrawalsUsdc('0');
        setTotalBorrowsUsdc('0');
        setTotalRepaymentsUsdc('0');
        return;
      }
      if (!decrypt) return;
      let totalDepositsAccum = 0;
      let totalWithdrawalsAccum = 0;
      let totalBorrowsAccum = 0;
      let totalRepaymentsAccum = 0;
      for (let i = 0; i < records.length; i++) {
        const rec = records[i];
        const cipher = extractCiphertext(rec);
        if (!cipher) continue;
        try {
          const decryptedText = await decrypt(cipher);
          const assetId = extractFieldFromText('asset_id', decryptedText);
          if (assetId !== '1field') continue;
          totalDepositsAccum += extractU64FromText('total_deposits', decryptedText);
          totalWithdrawalsAccum += extractU64FromText('total_withdrawals', decryptedText);
          totalBorrowsAccum += extractU64FromText('total_borrows', decryptedText);
          totalRepaymentsAccum += extractU64FromText('total_repayments', decryptedText);
        } catch {
          // skip
        }
      }
      const netSupplied = Math.max(0, totalDepositsAccum - totalWithdrawalsAccum);
      const netBorrowed = Math.max(0, totalBorrowsAccum - totalRepaymentsAccum);
      setTotalDepositsUsdc(String(totalDepositsAccum));
      setTotalWithdrawalsUsdc(String(totalWithdrawalsAccum));
      setTotalBorrowsUsdc(String(totalBorrowsAccum));
      setTotalRepaymentsUsdc(String(totalRepaymentsAccum));
      setUserSuppliedUsdc(String(netSupplied));
      setUserBorrowedUsdc(String(netBorrowed));
    } catch (error: any) {
      console.warn('fetchRecordsInBackgroundUsdc:', error?.message);
    } finally {
      setIsFetchingRecords(false);
    }
  }, [connected, requestRecords, publicKey, decrypt, isFetchingRecords]);

  // Fetch user position for USAD pool (lending_pool_usad_v17.aleo) — same UserActivity record shape.
  const fetchRecordsInBackgroundUsad = useCallback(async () => {
    if (!connected || !requestRecords || !publicKey) return;
    if (isFetchingRecords) return;
    setIsFetchingRecords(true);
    try {
      const records = await requestRecords(USAD_LENDING_POOL_PROGRAM_ID, false);
      if (!records || !Array.isArray(records) || records.length === 0) {
        setUserSuppliedUsad('0');
        setUserBorrowedUsad('0');
        setTotalDepositsUsad('0');
        setTotalWithdrawalsUsad('0');
        setTotalBorrowsUsad('0');
        setTotalRepaymentsUsad('0');
        return;
      }
      if (!decrypt) return;
      const seenAssetIds = new Map<string, number>();
      let loggedSamples = 0;

      let totalDepositsAccum = 0;
      let totalWithdrawalsAccum = 0;
      let totalBorrowsAccum = 0;
      let totalRepaymentsAccum = 0;
      for (let i = 0; i < records.length; i++) {
        const rec = records[i];
        const cipher = extractCiphertext(rec);
        if (!cipher) continue;
        try {
          const decryptedText = await decrypt(cipher);
          const assetId = extractFieldFromText('asset_id', decryptedText);
          if (assetId) seenAssetIds.set(assetId, (seenAssetIds.get(assetId) ?? 0) + 1);
          if (loggedSamples < 3) {
            // Avoid logging huge decrypted text; just show prefix + parsed asset_id.
            const sampleDeposits = extractU64FromText('total_deposits', decryptedText);
            const sampleWithdrawals = extractU64FromText('total_withdrawals', decryptedText);
            const sampleBorrows = extractU64FromText('total_borrows', decryptedText);
            const sampleRepayments = extractU64FromText('total_repayments', decryptedText);
            console.log('[USAD records debug] sample', {
              i,
              assetId,
              textPrefix: String(decryptedText).slice(0, 120),
              parsedTotals: {
                total_deposits: sampleDeposits,
                total_withdrawals: sampleWithdrawals,
                total_borrows: sampleBorrows,
                total_repayments: sampleRepayments,
              },
            });
            loggedSamples++;
          }
          if (assetId !== '2field') continue;
          totalDepositsAccum += extractU64FromText('total_deposits', decryptedText);
          totalWithdrawalsAccum += extractU64FromText('total_withdrawals', decryptedText);
          totalBorrowsAccum += extractU64FromText('total_borrows', decryptedText);
          totalRepaymentsAccum += extractU64FromText('total_repayments', decryptedText);
        } catch {
          // skip
        }
      }
      const netSupplied = Math.max(0, totalDepositsAccum - totalWithdrawalsAccum);
      const netBorrowed = Math.max(0, totalBorrowsAccum - totalRepaymentsAccum);
      console.log('[USAD records debug] assetId distribution', Object.fromEntries(seenAssetIds.entries()));
      console.log('[USAD records debug] computed nets', {
        total_deposits: totalDepositsAccum,
        total_withdrawals: totalWithdrawalsAccum,
        total_borrows: totalBorrowsAccum,
        total_repayments: totalRepaymentsAccum,
        netSupplied,
        netBorrowed,
      });
      setTotalDepositsUsad(String(totalDepositsAccum));
      setTotalWithdrawalsUsad(String(totalWithdrawalsAccum));
      setTotalBorrowsUsad(String(totalBorrowsAccum));
      setTotalRepaymentsUsad(String(totalRepaymentsAccum));
      setUserSuppliedUsad(String(netSupplied));
      setUserBorrowedUsad(String(netBorrowed));
    } catch (error: any) {
      console.warn('fetchRecordsInBackgroundUsad:', error?.message);
    } finally {
      setIsFetchingRecords(false);
    }
  }, [connected, requestRecords, publicKey, decrypt, isFetchingRecords]);

  // Fetch all user records (both credits.aleo and lending_pool_v8.aleo)
  const fetchAllUserRecords = useCallback(async () => {
    if (!connected || !requestRecords || !publicKey) {
      console.log('📋 fetchAllUserRecords: Skipping - wallet not connected');
      return;
    }

    if (isFetchingRecords) {
      console.log('📋 fetchAllUserRecords: Already fetching, skipping');
      return;
    }

    setIsFetchingRecords(true);
    console.log('📋 fetchAllUserRecords: Fetching all user records on refresh...');

    try {
      // Fetch credits.aleo records
      try {
        const creditsRecords = await requestRecords('credits.aleo', false);
        console.log(`📋 fetchAllUserRecords: Fetched ${creditsRecords?.length || 0} credits.aleo records`);
      } catch (error: any) {
        console.warn('📋 fetchAllUserRecords: Error fetching credits.aleo records:', error?.message);
      }

      // Fetch lending_pool_v8.aleo records and update user position
      await fetchRecordsInBackground(LENDING_POOL_PROGRAM_ID);
      
      console.log('📋 fetchAllUserRecords: All records fetched successfully');
    } catch (error: any) {
      console.warn('📋 fetchAllUserRecords: Error fetching records:', error?.message);
    } finally {
      setIsFetchingRecords(false);
    }
  }, [connected, requestRecords, publicKey, fetchRecordsInBackground, isFetchingRecords]);

  // Format scaled indices (SCALE = 1_000_000 in the Leo program) as human-friendly decimals.
  const formatScaled = (value: string | null, decimals = 6) => {
    if (!value) return '0';
    const n = Number(value);
    if (Number.isNaN(n)) return value;
    return (n / 1_000_000).toFixed(decimals);
  };

  // Format micro-ALEO (u64 from program) as ALEO with given decimals (default 2).
  const formatAleoAmount = (micro: number | string | null, decimals = 2) => {
    if (micro == null) return (0).toFixed(decimals);
    const n = typeof micro === 'string' ? Number(micro) : micro;
    if (!Number.isFinite(n)) return (0).toFixed(decimals);
    return (n / 1_000_000).toFixed(decimals);
  };

  const isExplorerHash = (id: string | null) => !!id && id.length >= 61;

  const getErrorMessage = (e: unknown): string => {
    if (e == null) return 'Unknown error';
    const err = e as Record<string, unknown>;
    const msg =
      typeof err?.message === 'string'
        ? err.message
        : typeof (err?.data as any)?.message === 'string'
          ? (err.data as { message: string }).message
          : typeof err?.reason === 'string'
            ? err.reason
            : typeof err?.error === 'string'
              ? err.error
              : typeof err?.toString === 'function'
                ? err.toString()
                : String(e);
    return msg || 'Unknown error';
  };

  const fetchVaultBalancesHuman = async (): Promise<{ aleo: number; usdcx: number; usad: number } | null> => {
    try {
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL;
      if (!backendUrl) return null;
      const resp = await fetch(`${backendUrl}/vault-balances`);
      if (!resp.ok) return null;
      const data = await resp.json();
      const aleo = Number(data?.human?.aleo ?? 0);
      const usdcx = Number(data?.human?.usdcx ?? 0);
      const usad = Number(data?.human?.usad ?? 0);
      return {
        aleo: Number.isFinite(aleo) ? aleo : 0,
        usdcx: Number.isFinite(usdcx) ? usdcx : 0,
        usad: Number.isFinite(usad) ? usad : 0,
      };
    } catch {
      return null;
    }
  };

  const openActionModal = (
    mode: 'withdraw' | 'deposit' | 'borrow' | 'repay',
    asset: 'aleo' | 'usdc' | 'usad',
    prefilledAmount?: number
  ) => {
    setActionModalMode(mode);
    setActionModalAsset(asset);
    setActionModalSubmitted(false);
    setStatusMessage('');
    setAmountError(null);
    setAmountErrorUsdc(null);
    setAmountErrorUsad(null);
    setTxId(null);
    setTxFinalized(false);
    setVaultWithdrawTxId(null);
    setVaultBorrowTxId(null);
    if (prefilledAmount != null) {
      setModalAmountInput(String(prefilledAmount));
      if (asset === 'usdc') setAmountUsdc(prefilledAmount);
      else if (asset === 'usad') setAmountUsad(prefilledAmount);
      else setAmount(prefilledAmount);
    } else {
      setModalAmountInput('');
    }
    setActionModalOpen(true);
  };

  const closeActionModal = () => {
    setActionModalOpen(false);
    setActionModalSubmitted(false);
  };

  // Derived user metrics for interest display (Aleo pool)
  const INDEX_SCALE_ALEO = 1_000_000_000_000;
  const numericTotalDeposits = Number(totalDeposits) || 0;
  const numericTotalWithdrawals = Number(totalWithdrawals) || 0;
  const numericTotalBorrows = Number(totalBorrows) || 0;
  const numericTotalRepayments = Number(totalRepayments) || 0;
  const principalSupplied = Math.max(0, numericTotalDeposits - numericTotalWithdrawals);
  const principalBorrowed = Math.max(0, numericTotalBorrows - numericTotalRepayments);
  const effectiveSuppliedVal =
    effectiveUserSupplied != null ? effectiveUserSupplied : Number(userSupplied) || 0;
  const effectiveBorrowedVal =
    effectiveUserBorrowed != null ? effectiveUserBorrowed : Number(userBorrowed) || 0;
  const liNum = liquidityIndex != null ? Number(liquidityIndex) : null;
  const biNum = borrowIndex != null ? Number(borrowIndex) : null;
  const liFactor =
    liNum != null && Number.isFinite(liNum) && liNum > 0
      ? liNum / INDEX_SCALE_ALEO
      : 1;
  const biFactor =
    biNum != null && Number.isFinite(biNum) && biNum > 0
      ? biNum / INDEX_SCALE_ALEO
      : 1;
  // Approximate interest using indices (can show fractional ALEO even before whole-token accrual),
  // falling back to effective-minus-principal if indices are unavailable.
  const interestEarnedAleo =
    principalSupplied > 0 && liFactor > 1
      ? Math.max(0, principalSupplied * (liFactor - 1))
      : Math.max(0, effectiveSuppliedVal - principalSupplied);
  const interestOwedAleo =
    principalBorrowed > 0 && biFactor > 1
      ? Math.max(0, principalBorrowed * (biFactor - 1))
      : Math.max(0, effectiveBorrowedVal - principalBorrowed);

  // Derived user metrics for interest display (USDC pool)
  const INDEX_SCALE_USDC = 1_000_000_000_000;
  const USDC_SCALE = 1_000_000;
  const numericTotalDepositsUsdc = Number(totalDepositsUsdc) || 0;
  const numericTotalWithdrawalsUsdc = Number(totalWithdrawalsUsdc) || 0;
  const numericTotalBorrowsUsdc = Number(totalBorrowsUsdc) || 0;
  const numericTotalRepaymentsUsdc = Number(totalRepaymentsUsdc) || 0;
  const principalSuppliedUsdc = Math.max(0, numericTotalDepositsUsdc - numericTotalWithdrawalsUsdc);
  const principalBorrowedUsdc = Math.max(0, numericTotalBorrowsUsdc - numericTotalRepaymentsUsdc);
  const effectiveSuppliedUsdcVal =
    effectiveUserSuppliedUsdc != null ? effectiveUserSuppliedUsdc : Number(userSuppliedUsdc) || 0;
  const effectiveBorrowedUsdcVal =
    effectiveUserBorrowedUsdc != null ? effectiveUserBorrowedUsdc : Number(userBorrowedUsdc) || 0;
  const liUsdcNum = liquidityIndexUsdc != null ? Number(liquidityIndexUsdc) : null;
  const biUsdcNum = borrowIndexUsdc != null ? Number(borrowIndexUsdc) : null;
  const liUsdcFactor =
    liUsdcNum != null && Number.isFinite(liUsdcNum) && liUsdcNum > 0
      ? liUsdcNum / INDEX_SCALE_USDC
      : 1;
  const biUsdcFactor =
    biUsdcNum != null && Number.isFinite(biUsdcNum) && biUsdcNum > 0
      ? biUsdcNum / INDEX_SCALE_USDC
      : 1;
  const interestEarnedUsdcMicro =
    principalSuppliedUsdc > 0 && liUsdcFactor > 1
      ? Math.max(0, principalSuppliedUsdc * (liUsdcFactor - 1))
      : Math.max(0, effectiveSuppliedUsdcVal - principalSuppliedUsdc);
  const interestOwedUsdcMicro =
    principalBorrowedUsdc > 0 && biUsdcFactor > 1
      ? Math.max(0, principalBorrowedUsdc * (biUsdcFactor - 1))
      : Math.max(0, effectiveBorrowedUsdcVal - principalBorrowedUsdc);
  const interestEarnedUsdc =
    interestEarnedUsdcMicro > 0 ? interestEarnedUsdcMicro / USDC_SCALE : 0;
  const interestOwedUsdc =
    interestOwedUsdcMicro > 0 ? interestOwedUsdcMicro / USDC_SCALE : 0;

  // Per-asset tooltips: supply = interest earned, borrow = interest owed (real calculated values)
  const tooltipInterestEarnedAleo = `Interest earned (ALEO): ${formatAleoAmount(interestEarnedAleo, 6)}`;
  const tooltipInterestEarnedUsdc = `Interest earned (USDC): ${interestEarnedUsdc.toFixed(6)} USDC`;
  const tooltipInterestOwedAleo = `Interest owed (ALEO): ${formatAleoAmount(interestOwedAleo, 6)}`;
  const tooltipInterestOwedUsdc = `Interest owed (USDC): ${interestOwedUsdc.toFixed(6)} USDC`;

  const getExplorerTxUrl = (id: string) => {
    let base = 'https://explorer.aleo.org/transaction';

    if (CURRENT_NETWORK === Network.TESTNET) {
      base = 'https://testnet.explorer.aleo.org/transaction';
    }

    // If you later switch to MainnetBeta explicitly, you can add a branch here.
    return `${base}/${id}`;
  };

  const getProvableExplorerTxUrl = (id: string) =>
    `https://testnet.explorer.provable.com/transaction/${id}`;

  const [txHistoryError, setTxHistoryError] = useState<string | null>(null);

  const fetchTransactionHistory = useCallback(async () => {
    if (!address?.trim()) return;
    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      setTxHistoryError('Supabase not configured. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUB_KEY to .env');
      setTxHistory([]);
      return;
    }
    setTxHistoryLoading(true);
    setTxHistoryError(null);
    try {
      const { data, error } = await supabase
        .from('transaction_history')
        .select('id, wallet_address, tx_id, type, asset, amount, program_id, explorer_url, vault_tx_id, vault_explorer_url, created_at')
        .eq('wallet_address', address)
        .order('created_at', { ascending: false })
        .limit(100);
      if (error) {
        setTxHistoryError(error.message);
        setTxHistory([]);
        return;
      }
      setTxHistory(Array.isArray(data) ? data : []);
    } catch (e: any) {
      console.warn('Failed to fetch transaction history:', e);
      setTxHistoryError(e?.message || 'Network error');
      setTxHistory([]);
    } finally {
      setTxHistoryLoading(false);
    }
  }, [address]);

  const saveTransactionToSupabase = async (
    walletAddress: string,
    txId: string,
    type: 'deposit' | 'withdraw' | 'borrow' | 'repay' | 'flash_loan',
    asset: 'aleo' | 'usdc' | 'usad',
    amount: number,
    programId?: string,
    _vaultTxId?: string | null,
  ) => {
    try {
      const res = await fetch('/api/record-transaction', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          wallet_address: walletAddress,
          tx_id: txId,
          type,
          asset: asset === 'usdc' ? 'usdcx' : asset,
          amount,
          program_id: programId ?? null,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: res.statusText }));
        console.warn('Save transaction failed:', err?.error || res.statusText);
        return;
      }
      await fetchTransactionHistory();
    } catch (e) {
      console.warn('Failed to save transaction:', e);
    }
  };

  /** Replicates `finalize_borrow` caps from chain mappings (same program id for unified v3). */
  const refreshChainBorrowCaps = useCallback(async () => {
    if (!publicKey) {
      setChainBorrowCaps(null);
      return;
    }
    try {
      const caps = await getCrossCollateralBorrowCapsFromChain(LENDING_POOL_PROGRAM_ID, publicKey);
      setChainBorrowCaps(caps);
    } catch {
      setChainBorrowCaps(null);
    }
  }, [publicKey]);

  /** Replicates `finalize_withdraw` caps from chain mappings (cross-asset withdraw). */
  const refreshChainWithdrawCaps = useCallback(async () => {
    if (!publicKey) {
      setChainWithdrawCaps(null);
      return;
    }
    try {
      const caps = await getCrossCollateralWithdrawCapsFromChain(LENDING_POOL_PROGRAM_ID, publicKey);
      setChainWithdrawCaps(caps);
    } catch {
      setChainWithdrawCaps(null);
    }
  }, [publicKey]);

  const refreshPoolState = async (includeUserPosition: boolean = false) => {
    try {
      setIsRefreshingState(true);
      const state = await getLendingPoolState();
      const onChainPrice = await getAssetPriceForProgram(LENDING_POOL_PROGRAM_ID, '0field');
      setAssetPriceAleo(onChainPrice);
      setTotalSupplied(state.totalSupplied ?? '0');
      setTotalBorrowed(state.totalBorrowed ?? '0');
      setUtilizationIndex(state.utilizationIndex ?? '0');
      setInterestIndex(state.interestIndex ?? '0');
      setLiquidityIndex(state.liquidityIndex ?? null);
      setBorrowIndex(state.borrowIndex ?? null);
      const ts = Number(state.totalSupplied ?? 0) || 0;
      const tb = Number(state.totalBorrowed ?? 0) || 0;
      const chainApyAleo = await getPoolApyFractionsFromChain(LENDING_POOL_PROGRAM_ID, '0field');
      const { supplyAPY: sApy, borrowAPY: bApy } = resolvePoolApyDisplay(ts, tb, chainApyAleo);
      setSupplyAPY(sApy);
      setBorrowAPY(bApy);

      if (includeUserPosition && publicKey) {
        try {
          await fetchRecordsInBackground(LENDING_POOL_PROGRAM_ID);
          const effective = await getAleoPoolUserEffectivePosition(LENDING_POOL_PROGRAM_ID, publicKey, '0field');
          if (effective) {
            setEffectiveUserSupplied(effective.effectiveSupplyBalance);
            setEffectiveUserBorrowed(effective.effectiveBorrowDebt);
          } else {
            setEffectiveUserSupplied(null);
            setEffectiveUserBorrowed(null);
          }
          if (requestRecords) {
            getPrivateCreditsBalance(requestRecords, decrypt).then(setPrivateAleoBalance).catch(() => setPrivateAleoBalance(null));
          }
          await refreshChainBorrowCaps();
          await refreshChainWithdrawCaps();
        } catch (error) {
          console.warn('Failed to refresh user position from records:', error);
          setUserSupplied('0');
          setUserBorrowed('0');
          setTotalDeposits('0');
          setTotalWithdrawals('0');
          setTotalBorrows('0');
          setTotalRepayments('0');
          setEffectiveUserSupplied(null);
          setEffectiveUserBorrowed(null);
          setChainBorrowCaps(null);
          setChainWithdrawCaps(null);
        }
      } else {
        setUserSupplied('0');
        setUserBorrowed('0');
        setTotalDeposits('0');
        setTotalWithdrawals('0');
        setTotalBorrows('0');
        setTotalRepayments('0');
        setEffectiveUserSupplied(null);
        setEffectiveUserBorrowed(null);
        setPrivateAleoBalance(null);
        setChainBorrowCaps(null);
        setChainWithdrawCaps(null);
      }
    } catch (e) {
      console.error('Failed to fetch pool state', e);
      setStatusMessage('Failed to fetch pool state. Check console for details.');
    }
    finally {
      setIsRefreshingState(false);
    }
  };

  const refreshUsdcPoolState = async (includeUserPosition: boolean = false) => {
    try {
      setIsRefreshingUsdcState(true);
      const state = await getUsdcLendingPoolState();
      const onChainPrice = await getAssetPriceForProgram(USDC_LENDING_POOL_PROGRAM_ID, '1field');
      setAssetPriceUsdc(onChainPrice);
      setTotalSuppliedUsdc(state.totalSupplied ?? '0');
      setTotalBorrowedUsdc(state.totalBorrowed ?? '0');
      setUtilizationIndexUsdc(state.utilizationIndex ?? '0');
      setLiquidityIndexUsdc(state.liquidityIndex ?? null);
      setBorrowIndexUsdc(state.borrowIndex ?? null);
      const ts = Number(state.totalSupplied ?? 0) || 0;
      const tb = Number(state.totalBorrowed ?? 0) || 0;
      const chainApyUsdc = await getPoolApyFractionsFromChain(USDC_LENDING_POOL_PROGRAM_ID, '1field');
      const { supplyAPY: sApy, borrowAPY: bApy } = resolvePoolApyDisplay(ts, tb, chainApyUsdc);
      setSupplyAPYUsdc(sApy);
      setBorrowAPYUsdc(bApy);
      if (includeUserPosition && requestRecords && publicKey) {
        try {
          await fetchRecordsInBackgroundUsdc();
          const effective = await getAleoPoolUserEffectivePosition(USDC_LENDING_POOL_PROGRAM_ID, publicKey, '1field');
          if (effective) {
            setEffectiveUserSuppliedUsdc(effective.effectiveSupplyBalance);
            setEffectiveUserBorrowedUsdc(effective.effectiveBorrowDebt);
          } else {
            setEffectiveUserSuppliedUsdc(null);
            setEffectiveUserBorrowedUsdc(null);
          }
          getPrivateUsdcBalance(requestRecords, decrypt).then(setPrivateUsdcBalance).catch(() => setPrivateUsdcBalance(null));
          await refreshChainBorrowCaps();
          await refreshChainWithdrawCaps();
        } catch (error) {
          console.warn('Failed to refresh USDC user position:', error);
          setUserSuppliedUsdc('0');
          setUserBorrowedUsdc('0');
          setTotalDepositsUsdc('0');
          setTotalWithdrawalsUsdc('0');
          setTotalBorrowsUsdc('0');
          setTotalRepaymentsUsdc('0');
          setEffectiveUserSuppliedUsdc(null);
          setEffectiveUserBorrowedUsdc(null);
          setPrivateUsdcBalance(null);
          setChainBorrowCaps(null);
          setChainWithdrawCaps(null);
        }
      } else {
        setEffectiveUserSuppliedUsdc(null);
        setEffectiveUserBorrowedUsdc(null);
        setPrivateUsdcBalance(null);
        setChainBorrowCaps(null);
        setChainWithdrawCaps(null);
      }
    } catch (e) {
      console.error('Failed to fetch USDC pool state', e);
    } finally {
      setIsRefreshingUsdcState(false);
    }
  };

  const refreshUsadPoolState = async (includeUserPosition: boolean = false) => {
    try {
      setIsRefreshingUsadState(true);
      const state = await getUsadLendingPoolState();
      const onChainPrice = await getAssetPriceForProgram(USAD_LENDING_POOL_PROGRAM_ID, '2field');
      setAssetPriceUsad(onChainPrice);
      setTotalSuppliedUsad(state.totalSupplied ?? '0');
      setTotalBorrowedUsad(state.totalBorrowed ?? '0');
      setUtilizationIndexUsad(state.utilizationIndex ?? '0');
      setLiquidityIndexUsad(state.liquidityIndex ?? null);
      setBorrowIndexUsad(state.borrowIndex ?? null);
      const ts = Number(state.totalSupplied ?? 0) || 0;
      const tb = Number(state.totalBorrowed ?? 0) || 0;
      const chainApyUsad = await getPoolApyFractionsFromChain(USAD_LENDING_POOL_PROGRAM_ID, '2field');
      const { supplyAPY: sApy, borrowAPY: bApy } = resolvePoolApyDisplay(ts, tb, chainApyUsad);
      setSupplyAPYUsad(sApy);
      setBorrowAPYUsad(bApy);

      if (includeUserPosition && requestRecords && publicKey) {
        try {
          await fetchRecordsInBackgroundUsad();
          const effective = await getAleoPoolUserEffectivePosition(USAD_LENDING_POOL_PROGRAM_ID, publicKey, '2field');
          if (effective) {
            setEffectiveUserSuppliedUsad(effective.effectiveSupplyBalance);
            setEffectiveUserBorrowedUsad(effective.effectiveBorrowDebt);
          } else {
            setEffectiveUserSuppliedUsad(null);
            setEffectiveUserBorrowedUsad(null);
          }

          const privUsad = await getPrivateUsadBalance(requestRecords, decrypt);
          setPrivateUsadBalance(privUsad);
          console.log('[USAD refresh debug]', {
            effectiveSupply_usad: effective?.effectiveSupplyBalance ?? null,
            effectiveBorrow_usad: effective?.effectiveBorrowDebt ?? null,
            privateBalance_usad: privUsad,
          });
          await refreshChainBorrowCaps();
          await refreshChainWithdrawCaps();
        } catch (error) {
          console.warn('Failed to refresh USAD user position:', error);
          setUserSuppliedUsad('0');
          setUserBorrowedUsad('0');
          setTotalDepositsUsad('0');
          setTotalWithdrawalsUsad('0');
          setTotalBorrowsUsad('0');
          setTotalRepaymentsUsad('0');
          setEffectiveUserSuppliedUsad(null);
          setEffectiveUserBorrowedUsad(null);
          setPrivateUsadBalance(null);
          setChainBorrowCaps(null);
          setChainWithdrawCaps(null);
        }
      } else {
        setEffectiveUserSuppliedUsad(null);
        setEffectiveUserBorrowedUsad(null);
        setPrivateUsadBalance(null);
        setChainBorrowCaps(null);
        setChainWithdrawCaps(null);
      }
    } catch (e) {
      console.error('Failed to fetch USAD pool state', e);
    } finally {
      setIsRefreshingUsadState(false);
    }
  };

  // One-time pool state fetch on page load/refresh and when wallet connects.
  // This DOES NOT touch private records / requestRecords to avoid extra wallet prompts.
  useEffect(() => {
    refreshPoolState(false);
    refreshUsdcPoolState(false);
    refreshUsadPoolState(false);
  }, [publicKey, connected]);

  // When wallet connects, trigger a ONE-TIME broad records request to get permissions up front.
  // This will show the wallet permission popup once per connection, then we rely on manual refresh.
  useEffect(() => {
    if (!connected || !publicKey || !requestRecords) {
      // Reset flag on disconnect so next connection can re-initialize
      if (!connected && walletPermissionsInitialized) {
        setWalletPermissionsInitialized(false);
      }
      if (!connected && userPositionInitialized) {
        setUserPositionInitialized(false);
      }
      return;
    }

    if (walletPermissionsInitialized) return;

    (async () => {
      try {
        console.log('🔐 Initializing wallet record permissions (one-time request)...');
        // Some wallets do not allow an empty program string. Instead, request for
        // the specific programs this dApp cares about so the user sees at most
        // one prompt per program.
        try {
          await requestRecords(LENDING_POOL_PROGRAM_ID, false);
          console.log(`✅ Wallet record permissions initialized for ${LENDING_POOL_PROGRAM_ID}`);
        } catch (e: any) {
          console.warn(
            `⚠️ Failed to pre-initialize permissions for ${LENDING_POOL_PROGRAM_ID}:`,
            e?.message,
          );
        }
        try {
          await requestRecords(USDC_LENDING_POOL_PROGRAM_ID, false);
          console.log(`✅ Wallet record permissions initialized for ${USDC_LENDING_POOL_PROGRAM_ID}`);
        } catch (e: any) {
          console.warn(`⚠️ Failed to pre-initialize permissions for ${USDC_LENDING_POOL_PROGRAM_ID}:`, e?.message);
        }
        try {
          await requestRecords(USAD_LENDING_POOL_PROGRAM_ID, false);
          console.log(`✅ Wallet record permissions initialized for ${USAD_LENDING_POOL_PROGRAM_ID}`);
        } catch (e: any) {
          console.warn(`⚠️ Failed to pre-initialize permissions for ${USAD_LENDING_POOL_PROGRAM_ID}:`, e?.message);
        }
        try {
          await requestRecords('credits.aleo', false);
          console.log('✅ Wallet record permissions initialized for credits.aleo');
        } catch (e: any) {
          console.warn('⚠️ Failed to pre-initialize permissions for credits.aleo:', e?.message);
        }
      } finally {
        setWalletPermissionsInitialized(true);
      }
    })();
  }, [connected, publicKey, requestRecords, walletPermissionsInitialized, userPositionInitialized]);

  // After wallet is connected and permissions are initialized, load the user's
  // position once automatically (Your Position / Activity Totals).
  useEffect(() => {
    if (!connected || !publicKey || !requestRecords) {
      return;
    }
    if (!walletPermissionsInitialized) {
      // Wait until we've done the initial record-permission request
      return;
    }
    if (userPositionInitialized) {
      return;
    }

    (async () => {
      try {
        await refreshPoolState(true);
        await refreshUsdcPoolState(true);
        await refreshUsadPoolState(true);
      } finally {
        setUserPositionInitialized(true);
      }
    })();
  }, [connected, publicKey, requestRecords, walletPermissionsInitialized, userPositionInitialized]);

  // Load transaction history from Supabase when wallet address is available
  useEffect(() => {
    if (address?.trim()) {
      fetchTransactionHistory();
    } else {
      setTxHistory([]);
    }
  }, [address, fetchTransactionHistory]);

  // Auto-refresh transaction history every 1 min (e.g. to show vault_tx_id when backend completes)
  useEffect(() => {
    if (!address?.trim()) return;
    const interval = setInterval(() => fetchTransactionHistory(), 60_000);
    return () => clearInterval(interval);
  }, [address, fetchTransactionHistory]);

  const inlineTxClearTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // After inline panel tx finalizes: clear inputs + overview (brief delay so explorer link can show)
  useEffect(() => {
    if (!txFinalized || loading || !inlineTxContext) return;
    if (inlineTxClearTimerRef.current) clearTimeout(inlineTxClearTimerRef.current);
    inlineTxClearTimerRef.current = setTimeout(() => {
      inlineTxClearTimerRef.current = null;
      setManageAmountInput('');
      setInlineTxContext(null);
      setModalAmountInput('');
      setAmount(0);
      setAmountUsdc(0);
      setAmountUsad(0);
      setTxId(null);
      setTxFinalized(false);
      setStatusMessage('');
      setActionModalSubmitted(false);
    }, 1800);
    return () => {
      if (inlineTxClearTimerRef.current) clearTimeout(inlineTxClearTimerRef.current);
    };
  }, [txFinalized, loading, inlineTxContext]);

  const handleAction = async (
    action: 'deposit' | 'borrow' | 'repay' | 'withdraw',
    amountOverride?: number,
  ) => {
    if (!connected) {
      const error = 'Please connect your wallet first.';
      setStatusMessage(error);
      console.error('❌ VALIDATION FAILED: Wallet not connected');
      console.log('========================================\n');
      return;
    }
    
    if (!publicKey) {
      const error = 'Public key not available. Please reconnect your wallet.';
      setStatusMessage(error);
      console.error('❌ VALIDATION FAILED: Public key not available');
      console.log('========================================\n');
      return;
    }

    const amountToUse = typeof amountOverride === 'number' ? amountOverride : amount;
    
    try {
      setLoading(true);
      setStatusMessage(`Executing ${action}...`);
      setAmountError(null);
      
      if (amountToUse <= 0) {
        throw new Error('Amount must be greater than zero.');
      }

      // Vault liquidity check (borrow/withdraw payouts come from backend vault).
      // Keep existing portfolio/on-chain checks; this is an additional safety gate.
      if (action === 'borrow' || action === 'withdraw') {
        const vault = await fetchVaultBalancesHuman();
        if (vault && amountToUse > (vault.aleo ?? 0)) {
          const max = Math.max(0, vault.aleo ?? 0);
          const msg = `Insufficient vault liquidity. You can ${action} at most ${max.toFixed(2)} ALEO right now (vault wallet balance).`;
          setAmountError(msg);
          setStatusMessage(msg);
          setLoading(false);
          return;
        }
      }

      // First check for deposit/repay: private Aleo balance must be at least the input amount
      if (action === 'deposit' || action === 'repay') {
        let balance = privateAleoBalance;
        if (balance === null && requestRecords) {
          balance = await getPrivateCreditsBalance(requestRecords, decrypt);
          setPrivateAleoBalance(balance);
        }
        if (amountToUse > (balance ?? 0)) {
          const msg = `Insufficient private Aleo. Your balance: ${(Math.floor((balance ?? 0) * 100) / 100).toFixed(2)} credits.`;
          setAmountError(msg);
          setStatusMessage(msg);
          setLoading(false);
          return;
        }
      }

      // Frontend limit checks (Aleo pool):
      // Program and mappings use micro-ALEO (u64). Convert to ALEO (credits) for comparisons with `amount`.
      const netSuppliedMicro = effectiveUserSupplied ?? (Number(userSupplied) || 0);
      const netBorrowedMicro = effectiveUserBorrowed ?? (Number(userBorrowed) || 0);
      const poolSuppliedMicro = Number(totalSupplied) || 0;
      const poolBorrowedMicro = Number(totalBorrowed) || 0;

      const netSupplied = netSuppliedMicro / 1_000_000; // ALEO
      const netBorrowed = netBorrowedMicro / 1_000_000; // ALEO
      const availableLiquidity = Math.max(
        0,
        (poolSuppliedMicro - poolBorrowedMicro) / 1_000_000,
      ); // ALEO
      // When pool state is not loaded (totalSupplied 0), allow withdraw up to user position; program will enforce liquidity
      const poolStateLoaded = poolSuppliedMicro > 0 || poolBorrowedMicro > 0;
      // LTV-safe withdraw limit: w <= C - D/0.75
      const maxWithdrawByLtv = Math.max(0, netSupplied - netBorrowed / 0.75);
      const maxWithdrawable = poolStateLoaded
        ? Math.min(netSupplied, availableLiquidity, maxWithdrawByLtv)
        : Math.min(netSupplied, maxWithdrawByLtv);

      // Withdraw can be satisfied cross-asset on-chain; use the chain-derived cap when available.
      const chainCapWithdrawAleoHuman = chainWithdrawCaps
        ? Number(chainWithdrawCaps.maxWithdrawMicroAleo) / 1_000_000
        : null;
      // If chain caps aren't available, use the same cross-asset withdraw budget
      // used by the modal/MAX button (`availableWithdrawAleo`) rather than same-asset supply.
      const effectiveMaxWithdraw = chainCapWithdrawAleoHuman ?? availableWithdrawAleo;

      if (action === 'withdraw' && amountToUse > effectiveMaxWithdraw) {
        const msg = `You can withdraw at most ${effectiveMaxWithdraw.toFixed(
          4,
        )} ALEO (frontend estimate from on-chain caps). Final limit is enforced on-chain by cross-collateral portfolio checks.`;
        setAmountError(msg);
        setStatusMessage(msg);
        setLoading(false);
        return;
      }

      // Repay supports cross-asset debt reduction on-chain.
      // Program clamps the USD repayment to total debt, so we only restrict by user balance above.

      if (action === 'borrow' && amountToUse > availableBorrowAleo) {
        const msg = `Borrow amount exceeds your available borrow (${availableBorrowAleo.toFixed(
          4,
        )} ALEO, frontend estimate). Final limit is enforced on-chain by cross-collateral portfolio checks.`;
        setAmountError(msg);
        setStatusMessage(msg);
        setLoading(false);
        return;
      }

      setActionModalSubmitted(true);
      let tx: string;
      const startTime = Date.now();

      // v7: Contract reads user data from mappings automatically - only amount needed
      console.log(`🔄 Executing ${action} transaction...`);
      switch (action) {
        case 'deposit':
          console.log('💰 DEPOSIT: Starting deposit transaction (executeTransaction)...');
          tx = await lendingDeposit(
            executeTransaction,
            amountToUse,
            publicKey || undefined,
            requestRecords,
            decrypt,
          );
          console.log('💰 DEPOSIT: Transaction submitted successfully:', tx);
          break;
        case 'borrow':
          console.log('📥 BORROW: Starting borrow transaction (executeTransaction)...');
          setVaultBorrowTxId(null);
          tx = await lendingBorrow(executeTransaction, amountToUse);
          console.log('📥 BORROW: Transaction submitted successfully:', tx);
          break;
        case 'repay':
          console.log('💳 REPAY: Starting repay_with_credits transaction (executeTransaction)...');
          tx = await lendingRepay(
            executeTransaction,
            amountToUse,
            publicKey || undefined,
            requestRecords,
            decrypt,
          );
          console.log('💳 REPAY: Transaction submitted successfully:', tx);
          break;
        case 'withdraw':
          console.log('💸 WITHDRAW: Starting withdraw transaction (executeTransaction)...');
          setVaultWithdrawTxId(null);
          tx = await lendingWithdraw(executeTransaction, amountToUse);
          console.log('💸 WITHDRAW: Transaction submitted successfully:', tx);
          break;
        default:
          throw new Error(`Unknown action: ${action}`);
      }

      // If wallet action was cancelled, upstream helper returns sentinel value.
      if (tx === '__CANCELLED__') {
        console.log(`💡 ${action.toUpperCase()} transaction was cancelled by user (no error).`);
        setStatusMessage('Transaction cancelled by user.');
        if (!isDevAppEnv) {
          setTimeout(() => setStatusMessage(''), 2500);
        }
        setLoading(false);
        console.log('========================================\n');
        return;
      }

      const transactionTime = Date.now() - startTime;
      console.log(`⏱️ Transaction submitted in ${transactionTime}ms`);

      setTxId(null);
      setTxFinalized(false);
      setStatusMessage('Transaction submitted. Waiting for finalization…');
      
      console.log('📤 Transaction ID:', tx);
      console.log('⏳ Starting finalization polling...');

      // Poll for transaction finalization; then save to Supabase (withdraw/borrow). Backend watcher performs vault transfer.
      let finalized = false;
      let txFailed = false;
      let finalTxId = tx; // use final on-chain id (at1...) for explorer and Supabase, not the initial shield id
      const maxAttempts = 45;
      const delayMs = 2000;

      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        console.log(`🔄 Polling transaction status (attempt ${attempt}/${maxAttempts})...`);
        await new Promise((resolve) => setTimeout(resolve, delayMs));

        if (transactionStatus) {
          try {
            const statusResult = await transactionStatus(tx);
            console.log(`📊 Transaction status (attempt ${attempt}):`, statusResult);

            const statusText =
              typeof statusResult === 'string'
                ? statusResult
                : (statusResult as any)?.status ?? '';
            const statusLower = (statusText || '').toLowerCase();

            if (statusLower === 'finalized' || statusLower === 'accepted') {
              finalized = true;
              console.log('✅ Transaction finalized!', statusResult);
              const resolvedId =
                (typeof statusResult === 'object' && (statusResult as any).transactionId) || tx;
              finalTxId = resolvedId;
              setTxId(isExplorerHash(resolvedId) ? resolvedId : null);
              break;
            }
            if (statusLower === 'rejected' || statusLower === 'failed' || statusLower === 'dropped') {
              txFailed = true;
              logPoolTxRejected('ALEO pool', statusLower, tx, {
                action,
                program: LENDING_POOL_PROGRAM_ID,
              });
              setStatusMessage(`Transaction ${statusLower}. Vault transfer was not requested.`);
              setLoading(false);
              console.log('========================================\n');
              return;
            }
            setStatusMessage(`Transaction ${statusText || 'pending'}... (attempt ${attempt}/${maxAttempts})`);
          } catch (e) {
            console.warn(`⚠️ Failed to check transaction status (attempt ${attempt}):`, e);
          }
        } else {
          if (attempt === maxAttempts) {
            finalized = true;
            console.log('⏰ Max attempts reached, assuming finalized');
          }
        }
      }

      if (txFailed) {
        setLoading(false);
        console.log('========================================\n');
        return;
      }
      if (!finalized) {
        setStatusMessage(
          'Transaction not finalized in time. Please check the explorer. Backend will process vault transfer once it is finalized.'
        );
        setLoading(false);
        console.log('========================================\n');
        return;
      }

      setTxFinalized(true);
      console.log('✅ Transaction finalized successfully!');

      if (action === 'deposit' || action === 'repay') {
        if (publicKey) {
          saveTransactionToSupabase(
            publicKey,
            finalTxId,
            action,
            'aleo',
            amountToUse,
            LENDING_POOL_PROGRAM_ID
          )
            .then(() => fetchTransactionHistory())
            .catch(() => {});
        }
      }

      // After finalization: save one record (vault_tx_id null). Backend watcher picks it up and performs vault transfer; no frontend call.
      if (action === 'withdraw' || action === 'borrow') {
        if (publicKey) {
          await saveTransactionToSupabase(
            publicKey,
            finalTxId,
            action,
            'aleo',
            amountToUse,
            LENDING_POOL_PROGRAM_ID,
            null
          ).catch(() => {});
          fetchTransactionHistory();
        }
      }

      setAmount(0);
      console.log('📋 Refreshing pool and user position after transaction finalization...');
      try {
        await refreshPoolState(true);
        if (action === 'withdraw' || action === 'borrow') {
          setStatusMessage('Transaction finalized! Vault transfer will be done in 1–5 min — check status in Transaction History.');
        } else {
          setStatusMessage('Transaction finalized! Pool and position have been refreshed.');
        }
        if (!isDevAppEnv) setTimeout(() => setStatusMessage(''), 5000);
      } catch (refreshError) {
        console.warn('⚠️ Failed to refresh pool state after transaction:', refreshError);
        setStatusMessage('Transaction finalized, but automatic refresh failed. Please click Refresh to update.');
      }
      console.log('✅ Transaction flow completed successfully');
      console.log('========================================\n');
    } catch (e: any) {
      const displayMsg = getErrorMessage(e);
      if (process.env.NODE_ENV === 'development') {
        console.warn(`[${action}]`, displayMsg, e);
      }
      
      // Detect wallet cancellation/rejection
      const errorMsg = displayMsg.toLowerCase();
      const isCancelled = errorMsg.includes('cancel') || errorMsg.includes('reject') || errorMsg.includes('denied') || errorMsg.includes('user rejected');
      
      if (isCancelled) {
        setStatusMessage('Transaction cancelled by user.');
        if (!isDevAppEnv) {
          setTimeout(() => setStatusMessage(''), 2500);
        }
      } else {
        setStatusMessage(displayMsg);
        const isLiquidityOrLimit =
          errorMsg.includes('withdraw at most') ||
          errorMsg.includes('available pool liquidity') ||
          errorMsg.includes('free for withdrawal') ||
          errorMsg.includes('exceeds available') ||
          errorMsg.includes('insufficient liquidity');
        if (isLiquidityOrLimit) setAmountError(displayMsg);
      }
    } finally {
      setLoading(false);
      console.log(`🏁 ${action.toUpperCase()} flow ended (loading set to false)`);
    }
  };

  /** ALEO pool: flash_loan_with_credits — uncollateralized; capped by pool liquidity only. */
  const handleFlashLoan = async () => {
    if (!connected || !publicKey || !executeTransaction || !requestRecords) {
      setFlashStatusMessage('Please connect your wallet.');
      return;
    }
    if (isRefreshingState) {
      setFlashStatusMessage('Wait for pool data to finish loading, then try again.');
      return;
    }
    const principal = Number(flashAmountInput);
    if (!Number.isFinite(principal) || principal <= 0) {
      setFlashStatusMessage('Enter a valid principal amount.');
      return;
    }
    const poolSuppliedMicro = Number(totalSupplied) || 0;
    const poolBorrowedMicro = Number(totalBorrowed) || 0;
    /** On-chain liquidity (micro); must not skip check when both totals are 0 — that means 0 available. */
    const availableLiquidityMicro = Math.max(0, poolSuppliedMicro - poolBorrowedMicro);
    const principalMicro = Math.round(principal * 1_000_000);
    if (principalMicro > availableLiquidityMicro) {
      setFlashStatusMessage(
        `Principal exceeds pool liquidity (${(availableLiquidityMicro / 1_000_000).toFixed(6)} ALEO available).`,
      );
      return;
    }
    const feeMicro = aleoFlashFeeMicro(principalMicro);
    const totalMicro = principalMicro + feeMicro;
    let balance = privateAleoBalance;
    if (balance === null && requestRecords) {
      balance = await getPrivateCreditsBalance(requestRecords, decrypt);
      setPrivateAleoBalance(balance);
    }
    if (totalMicro / 1_000_000 > (balance ?? 0) + 1e-9) {
      setFlashStatusMessage(
        `Need one private credits record covering principal + fee (${(totalMicro / 1_000_000).toFixed(6)} ALEO).`,
      );
      return;
    }

    try {
      setFlashLoading(true);
      setFlashStatusMessage('Submitting flash loan…');
      setFlashVaultTxId(null);
      setFlashTxId(null);
      const tx = await lendingFlashLoan(executeTransaction, principal, publicKey, requestRecords, decrypt);
      if (tx === '__CANCELLED__') {
        setFlashStatusMessage('Transaction cancelled by user.');
        setFlashLoading(false);
        return;
      }
      let finalTxId = tx;
      let finalized = false;
      let txFailed = false;
      const maxAttempts = 45;
      const delayMs = 2000;
      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
        if (transactionStatus) {
          try {
            const statusResult = await transactionStatus(tx);
            const statusText =
              typeof statusResult === 'string'
                ? statusResult
                : (statusResult as { status?: string })?.status ?? '';
            const statusLower = (statusText || '').toLowerCase();
            if (statusLower === 'finalized' || statusLower === 'accepted') {
              finalized = true;
              const resolvedId =
                (typeof statusResult === 'object' && (statusResult as { transactionId?: string }).transactionId) ||
                tx;
              finalTxId = resolvedId;
              setFlashTxId(isExplorerHash(resolvedId) ? resolvedId : null);
              break;
            }
            if (statusLower === 'rejected' || statusLower === 'failed' || statusLower === 'dropped') {
              txFailed = true;
              logPoolTxRejected('ALEO pool', statusLower, tx, {
                action: 'flash_loan',
                program: LENDING_POOL_PROGRAM_ID,
              });
              setFlashStatusMessage(`Transaction ${statusLower}.`);
              setFlashLoading(false);
              return;
            }
            setFlashStatusMessage(`Transaction ${statusText || 'pending'}… (${attempt}/${maxAttempts})`);
          } catch (e) {
            console.warn('Flash loan status poll:', e);
          }
        }
      }
      if (txFailed) {
        setFlashLoading(false);
        return;
      }
      if (!finalized) {
        setFlashStatusMessage('Transaction not finalized in time. Check the explorer.');
        setFlashLoading(false);
        return;
      }
      await saveTransactionToSupabase(
        publicKey,
        finalTxId,
        'flash_loan',
        'aleo',
        principal,
        LENDING_POOL_PROGRAM_ID,
        null,
      ).catch(() => {});
      fetchTransactionHistory();
      setFlashAmountInput('');
      setFlashStatusMessage(
        'Flash loan finalized! Vault will send principal in 1–5 min — check Transaction History.',
      );
      try {
        await refreshPoolState(true);
      } catch {
        setFlashStatusMessage((s) => s + ' (Refresh pool manually.)');
      }
    } catch (e: unknown) {
      setFlashStatusMessage(getErrorMessage(e));
    } finally {
      setFlashLoading(false);
    }
  };

  const handleActionUsdc = async (
    action: 'deposit' | 'borrow' | 'repay' | 'withdraw',
    amountOverride?: number,
  ) => {
    if (!connected || !publicKey || !executeTransaction || !requestRecords) {
      setStatusMessage('Please connect your wallet.');
      return;
    }
    try {
      setLoading(true);
      setStatusMessage(`Executing USDC ${action}...`);
      setAmountErrorUsdc(null);
      const amountToUse = typeof amountOverride === 'number' ? amountOverride : amountUsdc;
      if (amountToUse <= 0) {
        throw new Error('Amount must be greater than zero.');
      }

      // Vault liquidity check (USDCx withdrawals/borrows are paid by backend vault).
      if (action === 'borrow' || action === 'withdraw') {
        const vault = await fetchVaultBalancesHuman();
        if (vault && amountToUse > (vault.usdcx ?? 0)) {
          const max = Math.max(0, vault.usdcx ?? 0);
          const msg = `Insufficient vault liquidity. You can ${action} at most ${max.toFixed(2)} USDCx right now (vault wallet balance).`;
          setAmountErrorUsdc(msg);
          setStatusMessage(msg);
          setLoading(false);
          return;
        }
      }
      const amountMicro = Math.round(amountToUse * 1_000_000);
      const USDC_SCALE = 1_000_000;
      const netSuppliedMicro = (effectiveUserSuppliedUsdc ?? Number(userSuppliedUsdc)) || 0;
      const netBorrowedMicro = (effectiveUserBorrowedUsdc ?? Number(userBorrowedUsdc)) || 0;
      const poolSuppliedMicro = Number(totalSuppliedUsdc) || 0;
      const poolBorrowedMicro = Number(totalBorrowedUsdc) || 0;
      const netSuppliedHuman = netSuppliedMicro / USDC_SCALE;
      const netBorrowedHuman = netBorrowedMicro / USDC_SCALE;
      const maxRepayHuman = netBorrowedHuman;
      const availableLiquidityHuman = Math.max(0, (poolSuppliedMicro - poolBorrowedMicro) / USDC_SCALE);
      const poolStateLoadedUsdc = poolSuppliedMicro > 0 || poolBorrowedMicro > 0;
      // Withdraw: w <= min(supply, liquidity, C - D/LTV)
      const maxWithdrawUsdcByLtv = Math.max(0, netSuppliedHuman - netBorrowedHuman / 0.85);
      const maxWithdrawHuman = poolStateLoadedUsdc
        ? Math.min(netSuppliedHuman, availableLiquidityHuman, maxWithdrawUsdcByLtv)
        : Math.min(netSuppliedHuman, maxWithdrawUsdcByLtv);
      // Withdraw can be satisfied cross-asset on-chain; use the chain-derived cap when available.
      const chainCapWithdrawUsdcHuman = chainWithdrawCaps
        ? Number(chainWithdrawCaps.maxWithdrawMicroUsdcx) / 1_000_000
        : null;
      const effectiveMaxWithdrawUsdc = chainCapWithdrawUsdcHuman ?? availableWithdrawUsdc;

      if (action === 'withdraw' && amountToUse > effectiveMaxWithdrawUsdc) {
        const msg = `You can withdraw at most ${effectiveMaxWithdrawUsdc.toFixed(
          4,
        )} USDCx (frontend estimate from on-chain caps). Final limit is enforced on-chain by cross-collateral portfolio checks.`;
        setAmountErrorUsdc(msg);
        setStatusMessage(msg);
        setLoading(false);
        return;
      }
      // Repay supports cross-asset debt reduction on-chain.
      // Program clamps the USD repayment to total debt, so we only restrict by user balance above.
      if (action === 'borrow' && amountToUse > availableBorrowUsdc) {
        const msg = `Borrow exceeds your available borrow (${availableBorrowUsdc.toFixed(2)} USDCx, frontend estimate). Final limit is enforced on-chain by cross-collateral portfolio checks.`;
        setAmountErrorUsdc(msg);
        setStatusMessage(msg);
        setLoading(false);
        return;
      }
      if (action === 'deposit' || action === 'repay') {
        let balance = privateUsdcBalance;
        if (balance === null && requestRecords) {
          balance = await getPrivateUsdcBalance(requestRecords, decrypt);
          setPrivateUsdcBalance(balance);
        }
        if (amountToUse > (balance ?? 0)) {
          const msg = `Insufficient private USDC. Your balance: ${(Math.floor((balance ?? 0) * 100) / 100).toFixed(2)} USDC.`;
          setAmountErrorUsdc(msg);
          setStatusMessage(msg);
          setLoading(false);
          return;
        }
      }
      setActionModalSubmitted(true);
      let tx: string;
      switch (action) {
        case 'deposit': {
          let tokenRecord = await getSuitableUsdcTokenRecord(requestRecords, amountMicro, publicKey, decrypt);
          if (!tokenRecord) {
            console.warn('[USDC Deposit] No suitable USDCx record. See [getSuitableUsdcTokenRecord] logs above for details.');
            setAmountErrorUsdc(
              'No single USDCx record covers this amount (one private Token record must hold the full deposit). If your balance is split across multiple records, send USDCx to yourself to consolidate, or reduce the amount. Check console (F12) for details.',
            );
            setStatusMessage('No USDCx record with sufficient balance.');
            setLoading(false);
            return;
          }
          if (!tokenRecord.plaintext && decrypt) {
            const cipher = tokenRecord.recordCiphertext ?? tokenRecord.record_ciphertext ?? tokenRecord.ciphertext;
            if (typeof cipher === 'string') {
              try {
                const plain = await decrypt(cipher);
                if (plain) tokenRecord = { ...tokenRecord, plaintext: plain };
              } catch (e) {
                console.warn('[USDC Deposit] Decrypt failed, using ciphertext:', e);
              }
            }
          }
          tx = await lendingDepositUsdc(executeTransaction, amountToUse, tokenRecord);
          break;
        }
        case 'repay': {
          console.log('[Dashboard][USDC repay] pre-submit context', {
            amountToUse,
            amountMicro,
            netBorrowedMicro,
            effectiveUserBorrowedUsdc: effectiveUserBorrowedUsdc ?? null,
            userBorrowedUsdc,
            poolProgramResolved: USDC_LENDING_POOL_PROGRAM_ID,
            envNEXT_PUBLIC_USDC_LENDING_POOL_PROGRAM_ID:
              process.env.NEXT_PUBLIC_USDC_LENDING_POOL_PROGRAM_ID ?? '(unset)',
          });
          let tokenRecord = await getSuitableUsdcTokenRecord(requestRecords, amountMicro, publicKey, decrypt);
          if (!tokenRecord) {
            console.warn('[USDC Repay] No suitable USDCx record. See [getSuitableUsdcTokenRecord] logs above for details.');
            setAmountErrorUsdc(
              'No single USDCx record covers this repay amount. Consolidate private balance into one record or reduce the amount. See console (F12).',
            );
            setStatusMessage('No USDCx record with sufficient balance.');
            setLoading(false);
            return;
          }
          if (!tokenRecord.plaintext && decrypt) {
            const cipher = tokenRecord.recordCiphertext ?? tokenRecord.record_ciphertext ?? tokenRecord.ciphertext;
            if (typeof cipher === 'string') {
              try {
                const plain = await decrypt(cipher);
                if (plain) tokenRecord = { ...tokenRecord, plaintext: plain };
              } catch (e) {
                console.warn('[USDC Repay] Decrypt failed, using ciphertext:', e);
              }
            }
          }
          tx = await lendingRepayUsdc(executeTransaction, amountToUse, tokenRecord);
          break;
        }
        case 'withdraw': {
          tx = await lendingWithdrawUsdc(executeTransaction, amountToUse);
          break;
        }
        case 'borrow': {
          tx = await lendingBorrowUsdc(executeTransaction, amountToUse);
          break;
        }
        default:
          throw new Error(`Unknown action: ${action}`);
      }
      if (tx === '__CANCELLED__') {
        setStatusMessage('Transaction cancelled by user.');
        if (!isDevAppEnv) setTimeout(() => setStatusMessage(''), 2500);
        setLoading(false);
        return;
      }
      setTxId(null);
      setTxFinalized(false);
      setStatusMessage('Transaction submitted. Waiting for finalization…');
      let finalized = false;
      let txFailed = false;
      let finalTxId = tx;
      for (let attempt = 1; attempt <= 45; attempt++) {
        await new Promise((r) => setTimeout(r, 2000));
        if (transactionStatus) {
          try {
            const statusResult = await transactionStatus(tx);
            const statusText = typeof statusResult === 'string' ? statusResult : (statusResult as any)?.status ?? '';
            const statusLower = (statusText || '').toLowerCase();
            if (statusLower === 'finalized' || statusLower === 'accepted') {
              finalized = true;
              finalTxId = (typeof statusResult === 'object' && (statusResult as any).transactionId) || tx;
              setTxId(isExplorerHash(finalTxId) ? finalTxId : null);
              break;
            }
            if (statusLower === 'rejected' || statusLower === 'failed' || statusLower === 'dropped') {
              txFailed = true;
              logPoolTxRejected('USDC pool', statusLower, tx, {
                action,
                program: USDC_LENDING_POOL_PROGRAM_ID,
              });
              setStatusMessage(`Transaction ${statusLower}. Vault transfer was not requested.`);
              setLoading(false);
              return;
            }
          } catch {
            // continue polling
          }
        }
      }
      if (txFailed) {
        setLoading(false);
        return;
      }
      if (!finalized) {
        setStatusMessage('Transaction not finalized in time. Please check the explorer. Backend will process vault transfer once it is finalized.');
        setLoading(false);
        return;
      }
      setTxFinalized(true);
      if (action === 'deposit' || action === 'repay') {
        if (publicKey) {
          saveTransactionToSupabase(
            publicKey,
            finalTxId,
            action,
            'usdc',
            amountToUse,
            USDC_LENDING_POOL_PROGRAM_ID
          )
            .then(() => fetchTransactionHistory())
            .catch(() => {});
        }
      }
      // Backend watcher picks up the row and performs vault transfer; no frontend call.
      if (action === 'withdraw' || action === 'borrow') {
        if (publicKey) {
          await saveTransactionToSupabase(publicKey, finalTxId, action, 'usdc', amountToUse, USDC_LENDING_POOL_PROGRAM_ID, null).catch(() => {});
          fetchTransactionHistory();
        }
      }
      setAmountUsdc(0);
      try {
        await refreshUsdcPoolState(true);
        setStatusMessage('Transaction finalized! Pool refreshed.');
        if (!isDevAppEnv) setTimeout(() => setStatusMessage(''), 2500);
      } catch {
        setStatusMessage('Transaction finalized. Click Refresh to update pool.');
      }
    } catch (e: any) {
      const displayMsg = getErrorMessage(e);
      setStatusMessage(displayMsg);
      const errorLower = displayMsg.toLowerCase();
      const isLiquidityOrLimit =
        errorLower.includes('withdraw at most') ||
        errorLower.includes('available pool liquidity') ||
        errorLower.includes('free for withdrawal') ||
        errorLower.includes('exceeds available') ||
        errorLower.includes('insufficient liquidity');
      if (isLiquidityOrLimit) setAmountErrorUsdc(displayMsg);
    } finally {
      setLoading(false);
    }
  };

  const handleActionUsad = async (
    action: 'deposit' | 'borrow' | 'repay' | 'withdraw',
    amountOverride?: number,
  ) => {
    if (!connected || !publicKey || !executeTransaction || !requestRecords) {
      setStatusMessage('Please connect your wallet.');
      return;
    }
    try {
      setLoading(true);
      setStatusMessage(`Executing USAD ${action}...`);
      setAmountErrorUsad(null);
      const amountToUse = typeof amountOverride === 'number' ? amountOverride : amountUsad;
      if (amountToUse <= 0) {
        throw new Error('Amount must be greater than zero.');
      }

      // Vault liquidity check (USAD withdrawals/borrows are paid by backend vault).
      if (action === 'borrow' || action === 'withdraw') {
        const vault = await fetchVaultBalancesHuman();
        if (vault && amountToUse > (vault.usad ?? 0)) {
          const max = Math.max(0, vault.usad ?? 0);
          const msg = `Insufficient vault liquidity. You can ${action} at most ${max.toFixed(2)} USAD right now (vault wallet balance).`;
          setAmountErrorUsad(msg);
          setStatusMessage(msg);
          setLoading(false);
          return;
        }
      }

      const amountMicro = Math.round(amountToUse * 1_000_000);
      const USAD_SCALE = 1_000_000;
      const netSuppliedMicro = (effectiveUserSuppliedUsad ?? Number(userSuppliedUsad)) || 0;
      const netBorrowedMicro = (effectiveUserBorrowedUsad ?? Number(userBorrowedUsad)) || 0;
      const poolSuppliedMicro = Number(totalSuppliedUsad) || 0;
      const poolBorrowedMicro = Number(totalBorrowedUsad) || 0;

      const netSuppliedHuman = netSuppliedMicro / USAD_SCALE;
      const netBorrowedHuman = netBorrowedMicro / USAD_SCALE;
      const maxRepayHuman = netBorrowedHuman;
      const availableLiquidityHuman = Math.max(0, (poolSuppliedMicro - poolBorrowedMicro) / USAD_SCALE);
      const poolStateLoadedUsad = poolSuppliedMicro > 0 || poolBorrowedMicro > 0;
      const maxWithdrawUsadByLtv = Math.max(0, netSuppliedHuman - netBorrowedHuman / 0.85);
      const maxWithdrawHuman = poolStateLoadedUsad
        ? Math.min(netSuppliedHuman, availableLiquidityHuman, maxWithdrawUsadByLtv)
        : Math.min(netSuppliedHuman, maxWithdrawUsadByLtv);

      // Withdraw can be satisfied cross-asset on-chain; use the chain-derived cap when available.
      const chainCapWithdrawUsadHuman = chainWithdrawCaps
        ? Number(chainWithdrawCaps.maxWithdrawMicroUsad) / 1_000_000
        : null;
      const effectiveMaxWithdrawUsad = chainCapWithdrawUsadHuman ?? availableWithdrawUsad;

      if (action === 'withdraw' && amountToUse > effectiveMaxWithdrawUsad) {
        const msg = `You can withdraw at most ${effectiveMaxWithdrawUsad.toFixed(
          4,
        )} USAD (frontend estimate from on-chain caps). Final limit is enforced on-chain by cross-collateral portfolio checks.`;
        setAmountErrorUsad(msg);
        setStatusMessage(msg);
        setLoading(false);
        return;
      }
      // Repay supports cross-asset debt reduction on-chain.
      // Program clamps the USD repayment to total debt, so we only restrict by user balance above.
      if (action === 'borrow' && amountToUse > availableBorrowUsad) {
        const msg = `Borrow exceeds your available borrow (${availableBorrowUsad.toFixed(2)} USAD, frontend estimate). Final limit is enforced on-chain by cross-collateral portfolio checks.`;
        setAmountErrorUsad(msg);
        setStatusMessage(msg);
        setLoading(false);
        return;
      }

      if (action === 'deposit' || action === 'repay') {
        let balance = privateUsadBalance;
        if (balance === null && requestRecords) {
          balance = await getPrivateUsadBalance(requestRecords, decrypt);
          setPrivateUsadBalance(balance);
        }
        if (amountToUse > (balance ?? 0)) {
          const msg = `Insufficient private USAD. Your balance: ${(Math.floor((balance ?? 0) * 100) / 100).toFixed(2)} USAD.`;
          setAmountErrorUsad(msg);
          setStatusMessage(msg);
          setLoading(false);
          return;
        }
      }

      setActionModalSubmitted(true);
      let tx: string;

      switch (action) {
        case 'deposit': {
          let tokenRecord = await getSuitableUsadTokenRecord(requestRecords, amountMicro, publicKey, decrypt);
          if (!tokenRecord) {
            setAmountErrorUsad(
              'No single USAD record covers this amount (one private Token record must hold the full deposit). Consolidate balance or reduce the amount. See console (F12).',
            );
            setStatusMessage('No USAD record with sufficient balance.');
            setLoading(false);
            return;
          }
          if (!tokenRecord.plaintext && decrypt) {
            const cipher = tokenRecord.recordCiphertext ?? tokenRecord.record_ciphertext ?? tokenRecord.ciphertext;
            if (typeof cipher === 'string') {
              try {
                const plain = await decrypt(cipher);
                if (plain) tokenRecord = { ...tokenRecord, plaintext: plain };
              } catch (e) {
                console.warn('[USAD Deposit] Decrypt failed, using ciphertext:', e);
              }
            }
          }
          tx = await lendingDepositUsad(executeTransaction, amountToUse, tokenRecord, undefined, publicKey);
          break;
        }

        case 'repay': {
          console.log('[Dashboard][USAD repay] pre-submit context', {
            amountUsad,
            amountMicro,
            netBorrowedMicro,
            effectiveUserBorrowedUsad: effectiveUserBorrowedUsad ?? null,
            userBorrowedUsad,
            poolProgramResolved: USAD_LENDING_POOL_PROGRAM_ID,
            envNEXT_PUBLIC_USAD_LENDING_POOL_PROGRAM_ID:
              process.env.NEXT_PUBLIC_USAD_LENDING_POOL_PROGRAM_ID ?? '(unset)',
          });
          let tokenRecord = await getSuitableUsadTokenRecord(requestRecords, amountMicro, publicKey, decrypt);
          if (!tokenRecord) {
            setAmountErrorUsad(
              'No single USAD record covers this repay amount. Consolidate private balance or reduce the amount. See console (F12).',
            );
            setStatusMessage('No USAD record with sufficient balance.');
            setLoading(false);
            return;
          }
          if (!tokenRecord.plaintext && decrypt) {
            const cipher = tokenRecord.recordCiphertext ?? tokenRecord.record_ciphertext ?? tokenRecord.ciphertext;
            if (typeof cipher === 'string') {
              try {
                const plain = await decrypt(cipher);
                if (plain) tokenRecord = { ...tokenRecord, plaintext: plain };
              } catch (e) {
                console.warn('[USAD Repay] Decrypt failed, using ciphertext:', e);
              }
            }
          }
          tx = await lendingRepayUsad(executeTransaction, amountToUse, tokenRecord, undefined, publicKey);
          break;
        }

        case 'withdraw': {
          tx = await lendingWithdrawUsad(executeTransaction, amountToUse);
          break;
        }

        case 'borrow': {
          tx = await lendingBorrowUsad(executeTransaction, amountToUse);
          break;
        }

        default:
          throw new Error(`Unknown action: ${action}`);
      }

      if (tx === '__CANCELLED__') {
        setStatusMessage('Transaction cancelled by user.');
        if (!isDevAppEnv) setTimeout(() => setStatusMessage(''), 2500);
        setLoading(false);
        return;
      }

      setTxId(null);
      setTxFinalized(false);
      setStatusMessage('Transaction submitted. Waiting for finalization…');

      let finalized = false;
      let txFailed = false;
      let finalTxId = tx;

      for (let attempt = 1; attempt <= 45; attempt++) {
        await new Promise((r) => setTimeout(r, 2000));
        if (transactionStatus) {
          try {
            const statusResult = await transactionStatus(tx);
            const statusText = typeof statusResult === 'string' ? statusResult : (statusResult as any)?.status ?? '';
            const statusLower = (statusText || '').toLowerCase();

            if (statusLower === 'finalized' || statusLower === 'accepted') {
              finalized = true;
              finalTxId = (typeof statusResult === 'object' && (statusResult as any).transactionId) || tx;
              setTxId(isExplorerHash(finalTxId) ? finalTxId : null);
              break;
            }
            if (statusLower === 'rejected' || statusLower === 'failed' || statusLower === 'dropped') {
              txFailed = true;
              logPoolTxRejected('USAD pool', statusLower, tx, {
                action,
                program: USAD_LENDING_POOL_PROGRAM_ID,
              });
              setStatusMessage(`Transaction ${statusLower}. Vault transfer was not requested.`);
              setLoading(false);
              return;
            }
          } catch {
            // continue polling
          }
        }
      }

      if (txFailed) {
        setLoading(false);
        return;
      }

      if (!finalized) {
        setStatusMessage('Transaction not finalized in time. Please check the explorer. Backend will process vault transfer once it is finalized.');
        setLoading(false);
        return;
      }

      setTxFinalized(true);

      if (action === 'deposit' || action === 'repay') {
        if (publicKey) {
          saveTransactionToSupabase(publicKey, finalTxId, action, 'usad', amountToUse, USAD_LENDING_POOL_PROGRAM_ID)
            .then(() => fetchTransactionHistory())
            .catch(() => {});
        }
      }

      // Backend watcher picks up the row and performs vault transfer; no frontend call.
      if (action === 'withdraw' || action === 'borrow') {
        if (publicKey) {
          await saveTransactionToSupabase(publicKey, finalTxId, action, 'usad', amountToUse, USAD_LENDING_POOL_PROGRAM_ID, null).catch(() => {});
          fetchTransactionHistory();
        }
      }

      setAmountUsad(0);
      try {
        await refreshUsadPoolState(true);
        setStatusMessage('Transaction finalized! Pool refreshed.');
        if (!isDevAppEnv) setTimeout(() => setStatusMessage(''), 2500);
      } catch {
        setStatusMessage('Transaction finalized. Click Refresh to update pool.');
      }
    } catch (e: any) {
      const displayMsg = getErrorMessage(e);
      setStatusMessage(displayMsg);
      const errorLower = displayMsg.toLowerCase();
      const isLiquidityOrLimit =
        errorLower.includes('withdraw at most') ||
        errorLower.includes('available pool liquidity') ||
        errorLower.includes('free for withdrawal') ||
        errorLower.includes('exceeds available') ||
        errorLower.includes('insufficient liquidity');
      if (isLiquidityOrLimit) setAmountErrorUsad(displayMsg);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTestCredits = async () => {
    if (!connected || !publicKey || !requestTransaction) {
      setStatusMessage('Please connect your wallet first.');
      return;
    }

    if (testCreditsAmount <= 0) {
      setStatusMessage('Amount must be greater than zero.');
      return;
    }

    try {
      setLoading(true);
      setStatusMessage(`Creating ${testCreditsAmount} test credits...`);

      const tx = await createTestCredits(requestTransaction, publicKey, testCreditsAmount);
      
      setTxId(null);
      setTxFinalized(false);
      setStatusMessage('Test credits creation submitted. Waiting for finalization…');

      // Poll for transaction finalization using wallet's transactionStatus
      let finalized = false;
      const maxAttempts = 30; // 30 attempts
      const delayMs = 2000; // 2 seconds between attempts

      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
        
        if (transactionStatus) {
          try {
            const status = await transactionStatus(tx);
            console.log(`🧪 Create Test Credits: Poll attempt ${attempt}/${maxAttempts}, status:`, status);
            
            if (status && (status.status === 'Finalized' || (status as any).finalized)) {
              finalized = true;
              const resolvedId = (typeof status === 'object' && (status as any).transactionId) || tx;
              setTxId(isExplorerHash(resolvedId) ? resolvedId : null);
              setTxFinalized(true);
              setStatusMessage(`✅ Test credits created successfully! You should now have a Credits record with ${testCreditsAmount} credits (${testCreditsAmount * 1_000_000} microcredits) in your wallet.`);
              
              // Fetch records in background to update UI
              fetchRecordsInBackground();
              break;
            }
          } catch (statusError: any) {
            console.warn(`🧪 Create Test Credits: Status check failed (attempt ${attempt}):`, statusError?.message);
          }
        }
      }

      if (!finalized) {
        setStatusMessage(
          'Test credits creation submitted but not finalized within the expected time. The Credits record will appear in your wallet once the transaction is finalized.'
        );
      }
    } catch (e: any) {
      console.error('❌ ERROR in CREATE TEST CREDITS:', e);

      const errorMsg = String(e?.message || e || '').toLowerCase();
      const isCancelled =
        errorMsg.includes('cancel') ||
        errorMsg.includes('reject') ||
        errorMsg.includes('denied') ||
        errorMsg.includes('user rejected');

      if (isCancelled) {
        setStatusMessage('Transaction cancelled by user.');
        if (!isDevAppEnv) {
          setTimeout(() => setStatusMessage(''), 2500);
        }
      } else {
        setStatusMessage(e?.message || 'Failed to create test credits. Check console for details.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleDepositTestReal = async () => {
    if (!connected || !publicKey || !requestTransaction || !requestRecords) {
      setStatusMessage('Please connect your wallet first and ensure record access is granted.');
      return;
    }

    if (amount <= 0) {
      setStatusMessage('Amount must be greater than zero.');
      return;
    }

    try {
      setLoading(true);
      setStatusMessage(`Testing deposit with ${amount} credits...`);

      const tx = await depositTestReal(requestTransaction, publicKey, amount, requestRecords);
      
      setTxId(null);
      setTxFinalized(false);
      setStatusMessage('Deposit test submitted. Waiting for finalization…');

      // Poll for transaction finalization using wallet's transactionStatus
      let finalized = false;
      const maxAttempts = 30; // 30 attempts
      const delayMs = 2000; // 2 seconds between attempts

      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
        
        if (transactionStatus) {
          try {
            const status = await transactionStatus(tx);
            console.log(`🧪 Deposit Test Real: Poll attempt ${attempt}/${maxAttempts}, status:`, status);
            
            if (status && (status.status === 'Finalized' || (status as any).finalized)) {
              finalized = true;
              const resolvedId = (typeof status === 'object' && (status as any).transactionId) || tx;
              setTxId(isExplorerHash(resolvedId) ? resolvedId : null);
              setTxFinalized(true);
              setStatusMessage(`✅ Deposit test completed successfully! The test validates that real Aleo credits records work correctly. If this succeeded, your Credits record format is correct.`);
              
              // Fetch records in background to update UI
              fetchRecordsInBackground();
              break;
            }
          } catch (statusError: any) {
            console.warn(`🧪 Deposit Test Real: Status check failed (attempt ${attempt}):`, statusError?.message);
          }
        }
      }

      if (!finalized) {
        setStatusMessage(
          'Deposit test submitted but not finalized within the expected time. The transaction may still be processing.'
        );
      }
    } catch (e: any) {
      console.error('❌ ERROR in DEPOSIT TEST REAL:', e);

      const errorMsg = String(e?.message || e || '').toLowerCase();
      const isCancelled =
        errorMsg.includes('cancel') ||
        errorMsg.includes('reject') ||
        errorMsg.includes('denied') ||
        errorMsg.includes('user rejected');

      if (isCancelled) {
        setStatusMessage('Transaction cancelled by user.');
        if (!isDevAppEnv) {
          setTimeout(() => setStatusMessage(''), 2500);
        }
      } else {
        setStatusMessage(e?.message || 'Failed to run deposit test. Check console for details.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleAccrueInterest = async () => {
    if (!connected || !executeTransaction) {
      setStatusMessage('Please connect your wallet first.');
      return;
    }

    try {
      setLoading(true);
      setStatusMessage('Accruing interest...');

      const tx = await lendingAccrueInterest(executeTransaction);

      setTxId(null);
      setTxFinalized(false);
      setStatusMessage('Interest accrual submitted. Waiting for finalization…');

      // Poll for transaction finalization using wallet's transactionStatus
      let finalized = false;
      const maxAttempts = 30; // 30 attempts
      const delayMs = 2000; // 2 seconds between attempts

      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
        
        try {
          const statusResult = await transactionStatus(tx);
          console.log(`📊 Accrue interest status (attempt ${attempt}):`, statusResult);

          const statusText =
            typeof statusResult === 'string'
              ? statusResult
              : (statusResult as any)?.status ?? '';
          const statusLower = (statusText || '').toLowerCase();

          if (statusLower === 'finalized' || statusLower === 'accepted') {
            finalized = true;
            const resolvedId =
              (typeof statusResult === 'object' && (statusResult as any).transactionId) || tx;
            setTxId(isExplorerHash(resolvedId) ? resolvedId : null);
            setTxFinalized(true);
            // Fetch records in background after interest accrual finalizes
            if (requestRecords && publicKey) {
              console.log('📋 Interest accrual finalized - fetching records in background...');
              fetchRecordsInBackground(LENDING_POOL_PROGRAM_ID);
            }
            break;
          }
          setStatusMessage(
            `Interest accrual ${statusText || 'pending'}... (attempt ${attempt}/${maxAttempts})`,
          );
        } catch (e) {
          // If transactionStatus fails, continue polling; assume finalized at max wait.
          console.warn('Failed to check transaction status:', e);
          if (attempt === maxAttempts) {
            finalized = true;
          }
        }
      }

      if (finalized) {
        setTxFinalized(true);
        // Refresh pool + user data once interest accrual is finalized
        try {
          console.log('📋 Interest accrual finalized - refreshing pool and user position...');
          await refreshPoolState(true);
          setStatusMessage('Interest accrued and finalized! Pool and position have been refreshed.');
          if (!isDevAppEnv) {
            setTimeout(() => setStatusMessage(''), 2500);
          }
        } catch (refreshError) {
          console.warn('⚠️ Failed to refresh after interest accrual:', refreshError);
          setStatusMessage(
            'Interest accrued and finalized, but automatic refresh failed. Please click Refresh.',
          );
        }
      } else {
        setStatusMessage(
          'Interest accrual submitted but not finalized within the expected time. It may still be processing. Pool state will update once finalized.'
        );
      }
    } catch (e: any) {
      console.error('Accrue interest error:', e);
      
      // Detect wallet cancellation/rejection
      const errorMsg = String(e?.message || e || '').toLowerCase();
      const isCancelled = errorMsg.includes('cancel') || errorMsg.includes('reject') || errorMsg.includes('denied') || errorMsg.includes('user rejected');
      
      if (isCancelled) {
        setStatusMessage('Transaction cancelled by user.');
        if (!isDevAppEnv) {
          setTimeout(() => setStatusMessage(''), 2500);
        }
      } else {
        setStatusMessage(e?.message || 'Failed to accrue interest. Check console for details.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleAccrueInterestUsdc = async () => {
    if (!connected || !executeTransaction) {
      setStatusMessage('Please connect your wallet first.');
      return;
    }

    try {
      setLoading(true);
      setStatusMessage('Accruing USDC interest...');

      const tx = await lendingAccrueInterestUsdc(executeTransaction);

      setTxId(null);
      setTxFinalized(false);
      setStatusMessage('USDC interest accrual submitted. Waiting for finalization…');

      let finalized = false;
      const maxAttempts = 30;
      const delayMs = 2000;

      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
        if (transactionStatus) {
          try {
            const statusResult = await transactionStatus(tx);
            const statusText =
              typeof statusResult === 'string'
                ? statusResult
                : (statusResult as any)?.status ?? '';
            const statusLower = (statusText || '').toLowerCase();
            if (statusLower === 'finalized' || statusLower === 'accepted') {
              finalized = true;
              const resolvedId = (typeof statusResult === 'object' && (statusResult as any).transactionId) || tx;
              setTxId(isExplorerHash(resolvedId) ? resolvedId : null);
              setTxFinalized(true);
              break;
            }
          } catch {
            // continue polling
          }
        }
      }

      if (!finalized) {
        setStatusMessage('USDC interest accrual submitted but not finalized in time. Please check the explorer.');
      } else {
        try {
          await refreshUsdcPoolState(true);
          setStatusMessage('USDC interest accrued and finalized! Pool state refreshed.');
          if (!isDevAppEnv) setTimeout(() => setStatusMessage(''), 2500);
        } catch {
          setStatusMessage('USDC interest accrued successfully. Click Refresh to update pool.');
        }
      }
    } catch (e: any) {
      setStatusMessage(e?.message || 'USDC accrue interest failed.');
    } finally {
      setLoading(false);
    }
  };

  // Catch wallet cancellation errors globally and show a toast instead of crashing the app
  useEffect(() => {
    const isWalletCancelMessage = (msg: string | undefined | null) => {
      const lower = String(msg || '').toLowerCase();
      return (
        lower.includes('operation was cancelled by the user') ||
        lower.includes('operation was canceled by the user') ||
        lower.includes('operation cancelled by user') ||
        lower.includes('transaction cancelled by user') ||
        lower.includes('transaction canceled by user')
      );
    };

    const showCancelToast = () => {
      setStatusMessage('Transaction cancelled by user.');
      if (!isDevAppEnv) {
        setTimeout(() => setStatusMessage(''), 2500);
      }
    };

    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      const reason: any = event.reason;
      const msg = reason?.message || reason;

      if (isWalletCancelMessage(msg)) {
        // Prevent Next.js runtime error overlay
        event.preventDefault();
        showCancelToast();
      }
    };

    const handleWindowError = (event: ErrorEvent) => {
      const msg = event.message || event.error?.message;
      if (isWalletCancelMessage(msg)) {
        // Prevent default error handling (overlay) and just show toast
        event.preventDefault();
        showCancelToast();
      }
    };

    window.addEventListener('unhandledrejection', handleUnhandledRejection);
    window.addEventListener('error', handleWindowError);
    return () => {
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
      window.removeEventListener('error', handleWindowError);
    };
  }, [isDevAppEnv]);

  // Display values for merged Aave-style view (human units)
  const supplyBalanceAleo = ((effectiveUserSupplied ?? Number(userSupplied)) || 0) / 1_000_000;
  const supplyBalanceUsdc = ((effectiveUserSuppliedUsdc ?? Number(userSuppliedUsdc)) || 0) / 1_000_000;
  const supplyBalanceUsad = ((effectiveUserSuppliedUsad ?? Number(userSuppliedUsad)) || 0) / 1_000_000;
  const borrowDebtAleo = ((effectiveUserBorrowed ?? Number(userBorrowed)) || 0) / 1_000_000;
  const borrowDebtUsdc = ((effectiveUserBorrowedUsdc ?? Number(userBorrowedUsdc)) || 0) / 1_000_000;
  const borrowDebtUsad = ((effectiveUserBorrowedUsad ?? Number(userBorrowedUsad)) || 0) / 1_000_000;
  const totalSupplyBalance = supplyBalanceAleo + supplyBalanceUsdc + supplyBalanceUsad; // mixed units for count only
  const totalBorrowDebt = borrowDebtAleo + borrowDebtUsdc + borrowDebtUsad;
  // V2 cross-collateral portfolio estimates (UI-only; contract is source of truth).
  const ALEO_PRICE_USD =
    assetPriceAleo != null
      ? assetPriceAleo / 1_000_000
      : Number(process.env.NEXT_PUBLIC_ALEO_PRICE_USD ?? 1);
  const USDCX_PRICE_USD =
    assetPriceUsdc != null
      ? assetPriceUsdc / 1_000_000
      : Number(process.env.NEXT_PUBLIC_USDCX_PRICE_USD ?? 1);
  const USAD_PRICE_USD =
    assetPriceUsad != null
      ? assetPriceUsad / 1_000_000
      : Number(process.env.NEXT_PUBLIC_USAD_PRICE_USD ?? 1);
  const ALEO_PRICE_SOURCE = assetPriceAleo != null ? 'on-chain' : 'env';
  const USDCX_PRICE_SOURCE = assetPriceUsdc != null ? 'on-chain' : 'env';
  const USAD_PRICE_SOURCE = assetPriceUsad != null ? 'on-chain' : 'env';
  const LTV_ALEO = 0.75;
  const LTV_USDCX = 0.85;
  const LTV_USAD = 0.85;
  const collateralUsdAleo = supplyBalanceAleo * ALEO_PRICE_USD;
  const collateralUsdUsdc = supplyBalanceUsdc * USDCX_PRICE_USD;
  const collateralUsdUsad = supplyBalanceUsad * USAD_PRICE_USD;
  const totalCollateralUsd = collateralUsdAleo + collateralUsdUsdc + collateralUsdUsad;
  const weightedCollateralUsd =
    collateralUsdAleo * LTV_ALEO +
    collateralUsdUsdc * LTV_USDCX +
    collateralUsdUsad * LTV_USAD;
  const debtUsdAleo = borrowDebtAleo * ALEO_PRICE_USD;
  const debtUsdUsdc = borrowDebtUsdc * USDCX_PRICE_USD;
  const debtUsdUsad = borrowDebtUsad * USAD_PRICE_USD;
  const totalDebtUsd = debtUsdAleo + debtUsdUsdc + debtUsdUsad;
  // Prefer exact `finalize_borrow` headroom from chain mappings when available (avoids float vs u64 drift).
  const borrowableUsd =
    chainBorrowCaps != null
      ? Math.max(0, Number(chainBorrowCaps.headroomUsd) / 1_000_000)
      : Math.max(0, weightedCollateralUsd - totalDebtUsd);
  // Prefer chain-derived collateral/debt (same as finalize_borrow) so HF updates when records lag.
  const totalDebtUsdForHf =
    chainBorrowCaps != null
      ? Math.max(0, Number(chainBorrowCaps.totalDebtUsd) / 1_000_000)
      : totalDebtUsd;
  const weightedCollateralUsdForHf =
    chainBorrowCaps != null
      ? Math.max(0, Number(chainBorrowCaps.totalCollateralUsd) / 1_000_000)
      : weightedCollateralUsd;
  const healthFactor =
    totalDebtUsdForHf > 1e-9
      ? weightedCollateralUsdForHf / totalDebtUsdForHf
      : null;

  // Suggested "repay max" per selected repay asset.
  // Repay is cross-asset; when chain-derived totals are unavailable, fall back to the UI's
  // own totalDebtUsd (computed from per-asset effective debt + prices).
  const portfolioDebtUsdForRepay =
    chainBorrowCaps != null
      ? Math.max(0, Number(chainBorrowCaps.totalDebtUsd) / 1_000_000)
      : Math.max(0, totalDebtUsd);

  const repaySuggestedAleoHuman =
    ALEO_PRICE_USD > 0 ? portfolioDebtUsdForRepay / ALEO_PRICE_USD : 0;
  const repaySuggestedUsdcHuman =
    USDCX_PRICE_USD > 0 ? portfolioDebtUsdForRepay / USDCX_PRICE_USD : 0;
  const repaySuggestedUsadHuman =
    USAD_PRICE_USD > 0 ? portfolioDebtUsdForRepay / USAD_PRICE_USD : 0;

  const hasAnyDebt = borrowDebtAleo > 0 || borrowDebtUsdc > 0 || borrowDebtUsad > 0;

  // Simple loading flags for balances
  const walletBalancesLoading = connected && !userPositionInitialized;
  const dashboardDataReady =
    connected &&
    !walletBalancesLoading &&
    !isRefreshingState &&
    !isRefreshingUsdcState &&
    !isRefreshingUsadState &&
    totalSupplied !== null &&
    totalBorrowed !== null &&
    totalSuppliedUsdc !== null &&
    totalBorrowedUsdc !== null &&
    totalSuppliedUsad !== null &&
    totalBorrowedUsad !== null;
  const availableAleo = Math.max(
    0,
    ((Number(totalSupplied) || 0) - (Number(totalBorrowed) || 0)) / 1_000_000,
  );
  const availableUsdc = Math.max(
    0,
    ((Number(totalSuppliedUsdc) || 0) - (Number(totalBorrowedUsdc) || 0)) / 1_000_000,
  );
  const availableUsad = Math.max(
    0,
    ((Number(totalSuppliedUsad) || 0) - (Number(totalBorrowedUsad) || 0)) / 1_000_000,
  );

  // Borrow availability is based on global portfolio USD headroom.
  // Program no longer hard-blocks by per-asset pool liquidity.
  const maxBorrowAleoByPortfolio = ALEO_PRICE_USD > 0 ? borrowableUsd / ALEO_PRICE_USD : 0;
  const maxBorrowUsdcByPortfolio = USDCX_PRICE_USD > 0 ? borrowableUsd / USDCX_PRICE_USD : 0;
  const maxBorrowUsadByPortfolio = USAD_PRICE_USD > 0 ? borrowableUsd / USAD_PRICE_USD : 0;
  const availableBorrowAleo = chainBorrowCaps
    ? Math.max(0, Number(chainBorrowCaps.maxBorrowMicroAleo) / 1_000_000)
    : Math.max(0, maxBorrowAleoByPortfolio);
  const availableBorrowUsdc = chainBorrowCaps
    ? Math.max(0, Number(chainBorrowCaps.maxBorrowMicroUsdcx) / 1_000_000)
    : Math.max(0, maxBorrowUsdcByPortfolio);
  const availableBorrowUsad = chainBorrowCaps
    ? Math.max(0, Number(chainBorrowCaps.maxBorrowMicroUsad) / 1_000_000)
    : Math.max(0, maxBorrowUsadByPortfolio);
  const availableBorrowAleoUsd = availableBorrowAleo * ALEO_PRICE_USD;
  const availableBorrowUsdcUsd = availableBorrowUsdc * USDCX_PRICE_USD;
  const availableBorrowUsadUsd = availableBorrowUsad * USAD_PRICE_USD;

  // Withdraw availability is constrained by BOTH:
  // - User balance (cannot withdraw more than supplied)
  // - Pool liquidity (availableAleo/availableUsdc)
  // - Frontend estimate of collateral safety after withdrawal
  //   D <= 0.75 * (C - w)  =>  w <= C - D/0.75
  const maxWithdrawAleoByLtv = Math.max(0, supplyBalanceAleo - borrowDebtAleo / 0.75);
  const maxWithdrawUsdcByLtv = Math.max(0, supplyBalanceUsdc - borrowDebtUsdc / 0.75);
  const maxWithdrawUsadByLtv = Math.max(0, supplyBalanceUsad - borrowDebtUsad / 0.75);

  // Cross-asset fallback when chain withdraw caps aren't available.
  // `finalize_withdraw` caps `withdraw_usd` by total *raw* supply USD (sum of positions × prices),
  // not LTV-weighted collateral — so with zero debt the max withdraw USD ≈ totalCollateralUsd,
  // not borrowable (weightedCollateralUsd - totalDebtUsd). Using borrow headroom here made
  // withdraw MAX match "Borrowable (USD)" incorrectly.
  const withdrawUsdFallback =
    !hasAnyDebt || totalDebtUsd < 1e-9
      ? Math.max(0, totalCollateralUsd)
      : Math.max(0, weightedCollateralUsd - totalDebtUsd);
  // Cross-asset withdraw caps must come from the chain (mirrors `finalize_withdraw`).
  const availableWithdrawAleo = chainWithdrawCaps
    ? Math.max(0, Number(chainWithdrawCaps.maxWithdrawMicroAleo) / 1_000_000)
    : ALEO_PRICE_USD > 0 ? withdrawUsdFallback / ALEO_PRICE_USD : 0;
  const availableWithdrawUsdc = chainWithdrawCaps
    ? Math.max(0, Number(chainWithdrawCaps.maxWithdrawMicroUsdcx) / 1_000_000)
    : USDCX_PRICE_USD > 0 ? withdrawUsdFallback / USDCX_PRICE_USD : 0;
  const availableWithdrawUsad = chainWithdrawCaps
    ? Math.max(0, Number(chainWithdrawCaps.maxWithdrawMicroUsad) / 1_000_000)
    : USAD_PRICE_USD > 0 ? withdrawUsdFallback / USAD_PRICE_USD : 0;

  const availableWithdrawAleoUsd = availableWithdrawAleo * ALEO_PRICE_USD;
  const availableWithdrawUsdcUsd = availableWithdrawUsdc * USDCX_PRICE_USD;
  const availableWithdrawUsadUsd = availableWithdrawUsad * USAD_PRICE_USD;

  // Cross-asset UX: shared USD budget for withdraw hints. Per-asset caps should represent the same
  // max withdraw_usd; use max() so integer rounding does not under-report vs min().
  const portfolioWithdrawUsd =
    chainWithdrawCaps != null
      ? Math.max(availableWithdrawAleoUsd, availableWithdrawUsdcUsd, availableWithdrawUsadUsd)
      : withdrawUsdFallback;

  const modalAmount = (() => {
    const n = Number(modalAmountInput);
    return Number.isNaN(n) ? 0 : n;
  })();

  const actionModalTitle =
    actionModalMode === 'withdraw'
      ? `Withdraw ${
          actionModalAsset === 'aleo' ? 'ALEO' : actionModalAsset === 'usdc' ? 'USDCx' : 'USAD'
        }`
      : actionModalMode === 'deposit'
        ? `Deposit ${
            actionModalAsset === 'aleo' ? 'ALEO' : actionModalAsset === 'usdc' ? 'USDCx' : 'USAD'
          }`
        : actionModalMode === 'borrow'
          ? `Borrow ${
              actionModalAsset === 'aleo' ? 'ALEO' : actionModalAsset === 'usdc' ? 'USDCx' : 'USAD'
            }`
          : `Repay ${
              actionModalAsset === 'aleo' ? 'ALEO' : actionModalAsset === 'usdc' ? 'USDCx' : 'USAD'
            }`;

  const supplyBalanceModal =
    actionModalAsset === 'aleo' ? supplyBalanceAleo : actionModalAsset === 'usdc' ? supplyBalanceUsdc : supplyBalanceUsad;
  const debtBalanceModal =
    actionModalAsset === 'aleo' ? borrowDebtAleo : actionModalAsset === 'usdc' ? borrowDebtUsdc : borrowDebtUsad;
  const privateBalanceModal =
    actionModalAsset === 'aleo'
      ? (privateAleoBalance ?? 0)
      : actionModalAsset === 'usdc'
        ? (privateUsdcBalance ?? 0)
        : (privateUsadBalance ?? 0);
  const modalBorrowPortfolioMax =
    actionModalAsset === 'aleo'
      ? maxBorrowAleoByPortfolio
      : actionModalAsset === 'usdc'
        ? maxBorrowUsdcByPortfolio
        : maxBorrowUsadByPortfolio;

  // Repay is cross-asset. In the repay modal we show portfolio debt expressed in the
  // currently selected repay asset, and clamp MAX by the user's private balance.
  const repaySuggestedModalHuman =
    actionModalAsset === 'aleo'
      ? repaySuggestedAleoHuman
      : actionModalAsset === 'usdc'
        ? repaySuggestedUsdcHuman
        : repaySuggestedUsadHuman;

  const selectedRepayPriceUsd =
    actionModalAsset === 'aleo'
      ? ALEO_PRICE_USD
      : actionModalAsset === 'usdc'
        ? USDCX_PRICE_USD
        : USAD_PRICE_USD;

  const repayPaymentUsd = selectedRepayPriceUsd > 0 ? modalAmount * selectedRepayPriceUsd : 0;
  // Use portfolio debt USD for cross-asset repay budgeting (prefer chain exact totals).
  const repayBudgetUsd = Math.min(portfolioDebtUsdForRepay, repayPaymentUsd);
  const remainingDebtUsdAfterRepay = Math.max(0, portfolioDebtUsdForRepay - repayBudgetUsd);
  const remainingDebtSelectedAssetAfterRepay =
    selectedRepayPriceUsd > 0 ? remainingDebtUsdAfterRepay / selectedRepayPriceUsd : 0;
  // Max amount constraints per action type (used to disable action button)
  const modalMaxAmount =
    actionModalMode === 'deposit'
      ? privateBalanceModal
      : actionModalMode === 'withdraw'
        ? actionModalAsset === 'aleo'
          ? availableWithdrawAleo
          : actionModalAsset === 'usdc'
            ? availableWithdrawUsdc
            : availableWithdrawUsad
        : actionModalMode === 'repay'
          ? Math.min(privateBalanceModal, repaySuggestedModalHuman)
        : actionModalMode === 'borrow'
          ? modalBorrowPortfolioMax
          : debtBalanceModal;

  const remainingSupply = actionModalMode === 'withdraw'
    ? Math.max(0, modalMaxAmount - modalAmount)
    : actionModalMode === 'deposit'
      ? supplyBalanceModal + modalAmount
      : actionModalMode === 'borrow'
        ? debtBalanceModal + modalAmount
        : actionModalMode === 'repay'
          ? remainingDebtSelectedAssetAfterRepay
          : Math.max(0, debtBalanceModal - modalAmount);

  // Estimated post-action portfolio for modal preview (V2 cross-collateral UX).
  const postSupplyAleo =
    actionModalMode === 'withdraw' && actionModalAsset === 'aleo'
      ? Math.max(0, supplyBalanceAleo - modalAmount)
      : actionModalMode === 'deposit' && actionModalAsset === 'aleo'
        ? supplyBalanceAleo + modalAmount
        : supplyBalanceAleo;
  const postSupplyUsdc =
    actionModalMode === 'withdraw' && actionModalAsset === 'usdc'
      ? Math.max(0, supplyBalanceUsdc - modalAmount)
      : actionModalMode === 'deposit' && actionModalAsset === 'usdc'
        ? supplyBalanceUsdc + modalAmount
        : supplyBalanceUsdc;
  const postSupplyUsad =
    actionModalMode === 'withdraw' && actionModalAsset === 'usad'
      ? Math.max(0, supplyBalanceUsad - modalAmount)
      : actionModalMode === 'deposit' && actionModalAsset === 'usad'
        ? supplyBalanceUsad + modalAmount
        : supplyBalanceUsad;

  // Repay preview is cross-asset. Allocate repayBudgetUsd across debts in the same
  // deterministic order as the program: ALEO -> USDCx -> USAD.
  const repayPayAleoUsd = actionModalMode === 'repay' ? Math.min(repayBudgetUsd, debtUsdAleo) : 0;
  const repayPayUsdcUsd = actionModalMode === 'repay'
    ? Math.min(repayBudgetUsd - repayPayAleoUsd, debtUsdUsdc)
    : 0;
  const repayPayUsadUsd = actionModalMode === 'repay'
    ? Math.max(0, repayBudgetUsd - repayPayAleoUsd - repayPayUsdcUsd)
    : 0;

  const repayPayAleoAsset =
    ALEO_PRICE_USD > 0 ? repayPayAleoUsd / ALEO_PRICE_USD : 0;
  const repayPayUsdcAsset =
    USDCX_PRICE_USD > 0 ? repayPayUsdcUsd / USDCX_PRICE_USD : 0;
  const repayPayUsadAsset =
    USAD_PRICE_USD > 0 ? repayPayUsadUsd / USAD_PRICE_USD : 0;

  const postDebtAleo =
    actionModalMode === 'repay'
      ? Math.max(0, borrowDebtAleo - repayPayAleoAsset)
      : actionModalMode === 'borrow' && actionModalAsset === 'aleo'
        ? borrowDebtAleo + modalAmount
        : borrowDebtAleo;
  const postDebtUsdc =
    actionModalMode === 'repay'
      ? Math.max(0, borrowDebtUsdc - repayPayUsdcAsset)
      : actionModalMode === 'borrow' && actionModalAsset === 'usdc'
        ? borrowDebtUsdc + modalAmount
        : borrowDebtUsdc;
  const postDebtUsad =
    actionModalMode === 'repay'
      ? Math.max(0, borrowDebtUsad - repayPayUsadAsset)
      : actionModalMode === 'borrow' && actionModalAsset === 'usad'
        ? borrowDebtUsad + modalAmount
        : borrowDebtUsad;

  const postWeightedCollateralUsd =
    postSupplyAleo * ALEO_PRICE_USD * LTV_ALEO +
    postSupplyUsdc * USDCX_PRICE_USD * LTV_USDCX +
    postSupplyUsad * USAD_PRICE_USD * LTV_USAD;
  const postTotalDebtUsd =
    actionModalMode === 'repay'
      ? remainingDebtUsdAfterRepay
      : postDebtAleo * ALEO_PRICE_USD +
        postDebtUsdc * USDCX_PRICE_USD +
        postDebtUsad * USAD_PRICE_USD;
  const postHealthFactor = postTotalDebtUsd > 0 ? postWeightedCollateralUsd / postTotalDebtUsd : null;

  type ManageTab = 'Supply' | 'Withdraw' | 'Borrow' | 'Repay';
  type AssetKey = 'aleo' | 'usdc' | 'usad';

  const computeInlinePreview = (tab: ManageTab, assetKey: AssetKey, amountHuman: number) => {
    const amt = Number.isFinite(amountHuman) ? Math.max(0, amountHuman) : 0;

    const assetSymbol = assetKey === 'aleo' ? 'ALEO' : assetKey === 'usdc' ? 'USDCx' : 'USAD';
    const selectedPriceUsd = assetKey === 'aleo' ? ALEO_PRICE_USD : assetKey === 'usdc' ? USDCX_PRICE_USD : USAD_PRICE_USD;

    // Withdraw uses a shared USD budget across output-asset rows (UX matches the modal's "~$" behavior).
    const modalMaxWithdraw = selectedPriceUsd > 0 ? portfolioWithdrawUsd / selectedPriceUsd : 0;
    const selectedDebt = assetKey === 'aleo' ? borrowDebtAleo : assetKey === 'usdc' ? borrowDebtUsdc : borrowDebtUsad;
    const selectedSupply =
      assetKey === 'aleo' ? supplyBalanceAleo : assetKey === 'usdc' ? supplyBalanceUsdc : supplyBalanceUsad;

    // Repay preview is cross-asset. Allocate repayBudgetUsd across debts in the deterministic order:
    // ALEO -> USDCx -> USAD (same as modal).
    const repayPaymentUsd = selectedPriceUsd > 0 ? amt * selectedPriceUsd : 0;
    const repayBudgetUsd = Math.min(portfolioDebtUsdForRepay, repayPaymentUsd);
    const remainingDebtUsdAfterRepay = Math.max(0, portfolioDebtUsdForRepay - repayBudgetUsd);
    const remainingDebtSelectedAssetAfterRepay =
      selectedPriceUsd > 0 ? remainingDebtUsdAfterRepay / selectedPriceUsd : 0;

    const repayPayAleoUsd = tab === 'Repay' ? Math.min(repayBudgetUsd, debtUsdAleo) : 0;
    const repayPayUsdcUsd = tab === 'Repay' ? Math.min(repayBudgetUsd - repayPayAleoUsd, debtUsdUsdc) : 0;
    const repayPayUsadUsd = tab === 'Repay' ? Math.max(0, repayBudgetUsd - repayPayAleoUsd - repayPayUsdcUsd) : 0;

    const repayPayAleoAsset = ALEO_PRICE_USD > 0 ? repayPayAleoUsd / ALEO_PRICE_USD : 0;
    const repayPayUsdcAsset = USDCX_PRICE_USD > 0 ? repayPayUsdcUsd / USDCX_PRICE_USD : 0;
    const repayPayUsadAsset = USAD_PRICE_USD > 0 ? repayPayUsadUsd / USAD_PRICE_USD : 0;

    // Post-action supply (only changes for Supply/Withdraw in this UI preview).
    const postSupplyAleo =
      tab === 'Withdraw' && assetKey === 'aleo'
        ? Math.max(0, supplyBalanceAleo - amt)
        : tab === 'Supply' && assetKey === 'aleo'
          ? supplyBalanceAleo + amt
          : supplyBalanceAleo;
    const postSupplyUsdc =
      tab === 'Withdraw' && assetKey === 'usdc'
        ? Math.max(0, supplyBalanceUsdc - amt)
        : tab === 'Supply' && assetKey === 'usdc'
          ? supplyBalanceUsdc + amt
          : supplyBalanceUsdc;
    const postSupplyUsad =
      tab === 'Withdraw' && assetKey === 'usad'
        ? Math.max(0, supplyBalanceUsad - amt)
        : tab === 'Supply' && assetKey === 'usad'
          ? supplyBalanceUsad + amt
          : supplyBalanceUsad;

    // Post-action debt (changes for Borrow/Repay in this UI preview).
    const postDebtAleo =
      tab === 'Repay'
        ? Math.max(0, borrowDebtAleo - repayPayAleoAsset)
        : tab === 'Borrow' && assetKey === 'aleo'
          ? borrowDebtAleo + amt
          : borrowDebtAleo;
    const postDebtUsdc =
      tab === 'Repay'
        ? Math.max(0, borrowDebtUsdc - repayPayUsdcAsset)
        : tab === 'Borrow' && assetKey === 'usdc'
          ? borrowDebtUsdc + amt
          : borrowDebtUsdc;
    const postDebtUsad =
      tab === 'Repay'
        ? Math.max(0, borrowDebtUsad - repayPayUsadAsset)
        : tab === 'Borrow' && assetKey === 'usad'
          ? borrowDebtUsad + amt
          : borrowDebtUsad;

    const postWeightedCollateralUsd =
      postSupplyAleo * ALEO_PRICE_USD * LTV_ALEO +
      postSupplyUsdc * USDCX_PRICE_USD * LTV_USDCX +
      postSupplyUsad * USAD_PRICE_USD * LTV_USAD;

    const postTotalDebtUsd =
      tab === 'Repay'
        ? remainingDebtUsdAfterRepay
        : postDebtAleo * ALEO_PRICE_USD + postDebtUsdc * USDCX_PRICE_USD + postDebtUsad * USAD_PRICE_USD;

    const postHealthFactor = postTotalDebtUsd > 0 ? postWeightedCollateralUsd / postTotalDebtUsd : null;

    const remainingAfter =
      tab === 'Supply'
        ? selectedSupply + amt
        : tab === 'Withdraw'
          ? Math.max(0, modalMaxWithdraw - amt)
          : tab === 'Borrow'
            ? selectedDebt + amt
            : remainingDebtSelectedAssetAfterRepay;

    const remainingAfterLabel =
      tab === 'Withdraw'
        ? 'Remaining withdrawable'
        : tab === 'Supply'
          ? 'Supply after'
          : tab === 'Borrow'
            ? 'Debt after'
            : 'Remaining debt';

    return {
      assetSymbol,
      remainingAfter,
      remainingAfterLabel,
      postWeightedCollateralUsd,
      postTotalDebtUsd,
      postHealthFactor,
    };
  };

  const getInlineMaxAmount = (tab: ManageTab, assetKey: AssetKey): number => {
    switch (tab) {
      case 'Supply':
        return assetKey === 'aleo'
          ? (privateAleoBalance ?? 0)
          : assetKey === 'usdc'
            ? (privateUsdcBalance ?? 0)
            : (privateUsadBalance ?? 0);
      case 'Withdraw':
        return assetKey === 'aleo'
          ? ALEO_PRICE_USD > 0
            ? portfolioWithdrawUsd / ALEO_PRICE_USD
            : 0
          : assetKey === 'usdc'
            ? USDCX_PRICE_USD > 0
              ? portfolioWithdrawUsd / USDCX_PRICE_USD
              : 0
            : USAD_PRICE_USD > 0
              ? portfolioWithdrawUsd / USAD_PRICE_USD
              : 0;
      case 'Borrow':
        return assetKey === 'aleo'
          ? ALEO_PRICE_USD > 0
            ? borrowableUsd / ALEO_PRICE_USD
            : 0
          : assetKey === 'usdc'
            ? USDCX_PRICE_USD > 0
              ? borrowableUsd / USDCX_PRICE_USD
              : 0
            : USAD_PRICE_USD > 0
              ? borrowableUsd / USAD_PRICE_USD
              : 0;
      case 'Repay': {
        const priv =
          assetKey === 'aleo'
            ? (privateAleoBalance ?? 0)
            : assetKey === 'usdc'
              ? (privateUsdcBalance ?? 0)
              : (privateUsadBalance ?? 0);
        const suggested =
          assetKey === 'aleo' ? repaySuggestedAleoHuman : assetKey === 'usdc' ? repaySuggestedUsdcHuman : repaySuggestedUsadHuman;
        return Math.min(priv, suggested);
      }
      default:
        return 0;
    }
  };

  const resolveInlineMaxAmount = async (tab: ManageTab, assetKey: AssetKey): Promise<number> => {
    // Supply: MAX depends on private balance, which might still be null (USDC/USAD need record scan).
    if (tab === 'Supply') {
      if (assetKey === 'aleo') {
        let bal = privateAleoBalance;
        if (bal == null && requestRecords) {
          try {
            bal = await getPrivateCreditsBalance(requestRecords, decrypt);
            setPrivateAleoBalance(bal);
          } catch {}
        }
        return bal ?? 0;
      }
      if (assetKey === 'usdc') {
        let bal = privateUsdcBalance;
        if (bal == null && requestRecords) {
          try {
            bal = await getPrivateUsdcBalance(requestRecords, decrypt);
            setPrivateUsdcBalance(bal);
          } catch {}
        }
        return bal ?? 0;
      }
      // usad
      let bal = privateUsadBalance;
      if (bal == null && requestRecords) {
        try {
          bal = await getPrivateUsadBalance(requestRecords, decrypt);
          setPrivateUsadBalance(bal);
        } catch {}
      }
      return bal ?? 0;
    }
    if (tab === 'Borrow') return getInlineMaxAmount(tab, assetKey);
    if (tab === 'Withdraw') return getInlineMaxAmount(tab, assetKey);

    // Repay: MAX depends on private token balance (USDC/USAD may still be null until fetched).
    if (tab === 'Repay') {
      const suggested =
        assetKey === 'aleo' ? repaySuggestedAleoHuman : assetKey === 'usdc' ? repaySuggestedUsdcHuman : repaySuggestedUsadHuman;

      if (assetKey === 'aleo') {
        let bal = privateAleoBalance;
        if (bal == null && requestRecords) {
          try {
            bal = await getPrivateCreditsBalance(requestRecords, decrypt);
            setPrivateAleoBalance(bal);
          } catch {}
        }
        return Math.min(bal ?? 0, suggested);
      }

      if (assetKey === 'usdc') {
        let bal = privateUsdcBalance;
        if (bal == null && requestRecords) {
          try {
            bal = await getPrivateUsdcBalance(requestRecords, decrypt);
            setPrivateUsdcBalance(bal);
          } catch {}
        }
        // If balance is still unknown, fall back to suggested so UI doesn't show 0.
        return bal == null ? suggested : Math.min(bal, suggested);
      }

      // usad
      let bal = privateUsadBalance;
      if (bal == null && requestRecords) {
        try {
          bal = await getPrivateUsadBalance(requestRecords, decrypt);
          setPrivateUsadBalance(bal);
        } catch {}
      }
      return bal == null ? suggested : Math.min(bal, suggested);
    }

    return getInlineMaxAmount(tab, assetKey);
  };

  useEffect(() => {
    if (!connected) return;
    console.log('[Portfolio pricing] resolved prices', {
      aleo: { usd: ALEO_PRICE_USD, source: ALEO_PRICE_SOURCE, raw: assetPriceAleo },
      usdcx: { usd: USDCX_PRICE_USD, source: USDCX_PRICE_SOURCE, raw: assetPriceUsdc },
      usad: { usd: USAD_PRICE_USD, source: USAD_PRICE_SOURCE, raw: assetPriceUsad },
    });
  }, [
    connected,
    ALEO_PRICE_USD,
    USDCX_PRICE_USD,
    USAD_PRICE_USD,
    ALEO_PRICE_SOURCE,
    USDCX_PRICE_SOURCE,
    USAD_PRICE_SOURCE,
    assetPriceAleo,
    assetPriceUsdc,
    assetPriceUsad,
  ]);

  useEffect(() => {
    if (!connected) return;
    console.log('[Portfolio estimate] collateral and weighted collateral', {
      totalCollateralUsd,
      weightedCollateralUsd,
      breakdown: {
        aleo: {
          supply: supplyBalanceAleo,
          priceUsd: ALEO_PRICE_USD,
          collateralUsd: collateralUsdAleo,
          ltv: LTV_ALEO,
          weightedUsd: collateralUsdAleo * LTV_ALEO,
        },
        usdcx: {
          supply: supplyBalanceUsdc,
          priceUsd: USDCX_PRICE_USD,
          collateralUsd: collateralUsdUsdc,
          ltv: LTV_USDCX,
          weightedUsd: collateralUsdUsdc * LTV_USDCX,
        },
        usad: {
          supply: supplyBalanceUsad,
          priceUsd: USAD_PRICE_USD,
          collateralUsd: collateralUsdUsad,
          ltv: LTV_USAD,
          weightedUsd: collateralUsdUsad * LTV_USAD,
        },
      },
    });
  }, [
    connected,
    totalCollateralUsd,
    weightedCollateralUsd,
    supplyBalanceAleo,
    supplyBalanceUsdc,
    supplyBalanceUsad,
    ALEO_PRICE_USD,
    USDCX_PRICE_USD,
    USAD_PRICE_USD,
    collateralUsdAleo,
    collateralUsdUsdc,
    collateralUsdUsad,
  ]);

  if (view === 'flash') {
    // Flash page intentionally hidden.
    return null;
  }

  if (view === 'markets') {
    return <MarketsView />;
  }

  if (view === 'docs') {
    // Reuse the docs page content inside the dashboard layout so wallet state is shared
    return <DocsPage />;
  }

  return (
    <div className="flex justify-center pt-16 sm:pt-20">
      {/* Aave-style action modal (withdraw/deposit/borrow/repay) */}
      {actionModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={(e) => {
            const canClose = !actionModalSubmitted || (!loading && txFinalized);
            if (e.target === e.currentTarget && canClose) closeActionModal();
          }}
        >
          <div className="bg-base-200 rounded-xl shadow-xl w-full max-w-md border border-base-300" onClick={(e) => e.stopPropagation()}>
            <div className="p-4 border-b border-base-300 flex items-center justify-between">
              <h2 className="text-xl font-bold">{actionModalTitle}</h2>
              {(!actionModalSubmitted || (!loading && txFinalized)) ? (
                <button type="button" className="btn btn-ghost btn-sm btn-circle" onClick={closeActionModal} aria-label="Close">×</button>
              ) : null}
            </div>
            <div className="p-4 space-y-4">
              {!actionModalSubmitted ? (
                <>
                  <div>
                    <label className="label">
                      <span className="label-text">Amount</span>
                    </label>
                    <div className="flex items-center gap-2 rounded-lg bg-base-300/50 p-2">
                      <input
                        type="number"
                        min={0}
                        step="any"
                        value={modalAmountInput}
                        onChange={(e) => {
                          const val = e.target.value;
                          setModalAmountInput(val);
                          const n = Number(val);
                          if (!Number.isNaN(n)) {
                          if (actionModalAsset === 'usdc') {
                            setAmountUsdc(n);
                          } else if (actionModalAsset === 'usad') {
                            setAmountUsad(n);
                          } else {
                            setAmount(n);
                          }
                          }
                        }}
                        placeholder="0.00"
                        className="input input-bordered flex-1 bg-transparent border-0 focus:outline-none"
                      />
                      <span className="font-medium">
                        {actionModalAsset === 'aleo'
                          ? 'ALEO'
                          : actionModalAsset === 'usdc'
                            ? 'USDCx'
                            : 'USAD'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between mt-1 text-sm text-base-content/70">
                      <span>
                      {actionModalMode === 'withdraw'
                        ? 'Withdrawable '
                        : actionModalMode === 'deposit'
                          ? 'Wallet balance '
                          : actionModalMode === 'borrow'
                            ? 'Portfolio borrow max '
                            : 'Debt '}
                      {actionModalMode === 'withdraw'
                        ? modalMaxAmount.toFixed(2)
                        : actionModalMode === 'deposit'
                          ? privateBalanceModal.toFixed(2)
                          : actionModalMode === 'borrow'
                            ? modalBorrowPortfolioMax.toFixed(2)
                            : actionModalMode === 'repay'
                              ? repaySuggestedModalHuman.toFixed(2)
                              : debtBalanceModal.toFixed(2)}
                        {' '}
                        <button
                          type="button"
                          className="link link-primary text-xs"
                          onClick={() => {
                            const maxVal =
                              actionModalMode === 'withdraw'
                                ? actionModalAsset === 'aleo'
                                  ? availableWithdrawAleo
                                  : actionModalAsset === 'usdc'
                                    ? availableWithdrawUsdc
                                    : availableWithdrawUsad
                                : actionModalMode === 'deposit'
                                  ? privateBalanceModal
                                  : actionModalMode === 'repay'
                                    ? Math.min(privateBalanceModal, repaySuggestedModalHuman)
                                  : actionModalMode === 'borrow'
                                    ? modalBorrowPortfolioMax
                                    : debtBalanceModal;
                            setModalAmountInput(String(maxVal));
                            if (actionModalAsset === 'usdc') {
                              setAmountUsdc(maxVal);
                            } else if (actionModalAsset === 'usad') {
                              setAmountUsad(maxVal);
                            } else {
                              setAmount(maxVal);
                            }
                          }}
                        >
                          MAX
                        </button>
                      </span>
                    </div>
                  </div>
                  <div className="rounded-lg bg-base-300/30 p-3 space-y-2">
                    <div className="font-medium text-sm">Transaction overview</div>
                    <div className="flex justify-between text-sm">
                      <span className="text-base-content/70">
                        {actionModalMode === 'withdraw'
                          ? 'Remaining withdrawable'
                          : actionModalMode === 'deposit'
                            ? 'Supply after'
                            : actionModalMode === 'borrow'
                              ? 'Debt after'
                              : 'Remaining debt'}
                      </span>
                      <span>
                        {remainingSupply.toFixed(2)}{' '}
                        {actionModalAsset === 'aleo'
                          ? 'ALEO'
                          : actionModalAsset === 'usdc'
                            ? 'USDCx'
                            : 'USAD'}
                      </span>
                    </div>
                    {(actionModalMode === 'borrow' || actionModalMode === 'withdraw' || actionModalMode === 'deposit' || actionModalMode === 'repay') ? (
                      <>
                        <div className="flex justify-between text-sm">
                          <span className="text-base-content/70">Est. weighted collateral (USD)</span>
                          <span>${postWeightedCollateralUsd.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-base-content/70">Est. total debt (USD)</span>
                          <span>${postTotalDebtUsd.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-base-content/70">Est. health factor</span>
                          <span className={postHealthFactor != null && postHealthFactor < 1 ? 'text-error font-medium' : 'font-medium'}>
                            {postHealthFactor == null ? 'Infinity' : postHealthFactor.toFixed(2)}
                          </span>
                        </div>
                        {postHealthFactor != null && postHealthFactor < 1 ? (
                          <div className="rounded-md bg-error/15 border border-error/30 px-2 py-1 text-xs text-error">
                            Estimated health factor is below 1.0. This action is likely to fail on-chain due to cross-collateral safety checks.
                          </div>
                        ) : null}
                      </>
                    ) : null}
                  </div>
                  {(actionModalAsset === 'aleo'
                    ? amountError
                    : actionModalAsset === 'usdc'
                      ? amountErrorUsdc
                      : amountErrorUsad) ? (
                    <div className="rounded-lg bg-error/15 border border-error/30 px-4 py-3 text-error text-sm">
                      {actionModalAsset === 'aleo'
                        ? amountError
                        : actionModalAsset === 'usdc'
                          ? amountErrorUsdc
                          : amountErrorUsad}
                    </div>
                  ) : statusMessage ? (
                    <div
                      className={`rounded-lg px-4 py-3 text-sm ${
                        statusMessage.includes('at most') ||
                        statusMessage.includes('liquidity') ||
                        statusMessage.includes('Failed') ||
                        statusMessage.includes('Insufficient') ||
                        statusMessage.includes('free for withdrawal')
                          ? 'bg-error/15 border border-error/30 text-error'
                          : 'text-base-content/70'
                      }`}
                    >
                      {statusMessage}
                    </div>
                  ) : null}
                  <button
                    type="button"
                    className="btn btn-primary w-full"
                    disabled={
                      loading ||
                      !modalAmount ||
                      modalAmount <= 0 ||
                      modalAmount > modalMaxAmount
                    }
                    onClick={async () => {
                      if (actionModalAsset === 'usdc') {
                        await handleActionUsdc(actionModalMode);
                      } else if (actionModalAsset === 'usad') {
                        await handleActionUsad(actionModalMode);
                      } else {
                        await handleAction(actionModalMode);
                      }
                    }}
                  >
                    {loading ? <span className="loading loading-spinner loading-sm" /> : null}
                    {!modalAmount || modalAmount <= 0
                      ? 'Enter an amount'
                      : modalAmount > modalMaxAmount
                        ? 'Amount too high'
                        : actionModalTitle}
                  </button>
                </>
              ) : (
                <div className="space-y-4">
                  {loading || (txId && !txFinalized) ? (
                    <div className="flex flex-col items-center justify-center py-8 gap-3">
                      <span className="loading loading-spinner loading-lg" />
                      {txFinalized && txId && (actionModalMode === 'withdraw' || actionModalMode === 'borrow') ? (
                        <>
                          <p className="text-sm font-medium text-base-content">Program transaction confirmed.</p>
                          <p className="text-sm text-base-content/70">Initiating vault transfer…</p>
                        </>
                      ) : (
                        <p className="text-sm text-base-content/70">Processing…</p>
                      )}
                      {statusMessage ? (
                        <div className={`rounded-lg px-4 py-3 mt-2 max-w-sm w-full text-center text-sm ${statusMessage.includes('at most') || statusMessage.includes('liquidity') || statusMessage.includes('Failed') || statusMessage.includes('Insufficient') || statusMessage.includes('free for withdrawal') ? 'bg-error/15 text-error' : 'text-base-content/70'}`}>
                          {statusMessage}
                        </div>
                      ) : null}
                    </div>
                  ) : (
                    <>
                      {statusMessage && !txFinalized ? (
                        <div
                          className={`rounded-lg px-4 py-3 text-sm text-center w-full ${
                            statusMessage.includes('at most') ||
                            statusMessage.includes('liquidity') ||
                            statusMessage.includes('Failed') ||
                            statusMessage.includes('Insufficient') ||
                            statusMessage.includes('free for withdrawal')
                              ? 'bg-error/15 border border-error/30 text-error'
                              : 'text-base-content/70'
                          }`}
                        >
                          {statusMessage}
                        </div>
                      ) : null}
                      {txFinalized && txId ? (
                        <a
                          href={getProvableExplorerTxUrl(txId)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="link link-primary text-base font-medium block text-center py-2"
                        >
                          View in explorer
                        </a>
                      ) : null}
                      {txFinalized ? (
                        <p className="text-sm text-base-content/70 text-center">
                          {actionModalMode === 'withdraw' || actionModalMode === 'borrow'
                            ? 'Transaction finalized! Vault transfer will be done in 1–5 min — check status in Transaction History.'
                            : 'Transaction finalized.'}
                        </p>
                      ) : null}
                      {txFinalized && (actionModalMode === 'withdraw' || actionModalMode === 'borrow') && (vaultWithdrawTxId || vaultBorrowTxId) ? (
                        <a
                          href={getProvableExplorerTxUrl(vaultWithdrawTxId || vaultBorrowTxId!)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="link link-primary text-base font-medium block text-center py-2"
                        >
                          View vault transfer in explorer
                        </a>
                      ) : null}
                      <button type="button" className="btn btn-primary w-full mt-2" onClick={closeActionModal}>
                        Close
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="space-y-6 w-full max-w-6xl px-4">
        {/* Brief loading when wallet state may be restoring after nav (e.g. from Markets) */}
        {!connected && (connecting || !allowShowConnectCTA) && (
          <div className="rounded-xl bg-base-200 border border-base-300 flex flex-col items-center justify-center py-16 px-6">
            <span className="loading loading-spinner loading-lg text-primary" />
            <p className="text-sm text-base-content/70 mt-3">Loading wallet…</p>
          </div>
        )}
        {/* Aave-style: connect wallet CTA when not connected */}
        {!connected && !connecting && allowShowConnectCTA && (
          <div className="rounded-xl bg-base-200 border border-base-300 flex flex-col items-center justify-center py-16 px-6 text-center">
            <div className="w-24 h-24 rounded-full bg-base-300 flex items-center justify-center mb-4 text-4xl opacity-80" aria-hidden>
              👻
            </div>
            <h2 className="text-xl font-bold mb-2">Please, connect your wallet</h2>
            <p className="text-base-content/70 text-sm max-w-md mb-6">
              Connect your wallet to see your supplies, borrowings, and open positions.
            </p>
            <div className="wallet-button-wrapper">
              <WalletMultiButton className="!bg-gradient-to-r !from-primary !to-secondary !border-0 !text-primary-content !font-semibold !px-6 !py-3 !rounded-lg !min-h-0 !h-auto" />
            </div>
          </div>
        )}

        {/* Aave-style merged view when connected */}
        {connected && (
          <div className="space-y-4">
            {!dashboardDataReady && (
              <div className="w-full max-w-[1340px] mx-auto space-y-8 animate-pulse">
                <div className="flex justify-between items-center text-white/80">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-white/20 border border-white/20" />
                    <div className="h-6 w-40 rounded-lg bg-white/15" />
                  </div>
                  <div className="h-10 w-36 rounded-xl bg-white/10 border border-white/15" />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  {[0, 1, 2, 3].map((i) => (
                    <div
                      key={i}
                      className="bg-white rounded-2xl p-6 shadow-lg shadow-black/5 border border-slate-100"
                    >
                      <div className="h-3 w-28 bg-slate-200 rounded mb-3" />
                      <div className="h-9 w-32 bg-slate-200/90 rounded mb-2 mt-3" />
                      <div className="h-3 w-full max-w-[180px] bg-slate-100 rounded" />
                    </div>
                  ))}
                </div>
                <div className="bg-white rounded-[24px] shadow-2xl overflow-hidden border border-white">
                  <div className="bg-slate-50/80 border-b border-slate-100 px-8 py-5">
                    <div className="grid grid-cols-[2fr_1.5fr_1.5fr_1.5fr_1fr] gap-4 items-center">
                      {[0, 1, 2, 3, 4].map((c) => (
                        <div key={c} className="h-3 bg-slate-200/90 rounded" />
                      ))}
                    </div>
                  </div>
                  {[0, 1, 2].map((row) => (
                    <div key={row} className="border-b border-slate-100 px-8 py-5">
                      <div className="grid grid-cols-[2fr_1.5fr_1.5fr_1.5fr_1fr] gap-4 items-center">
                        <div className="h-10 w-36 rounded-full bg-slate-100" />
                        <div className="h-5 w-20 bg-slate-100 rounded mx-auto" />
                        <div className="h-8 w-24 bg-slate-100 rounded mx-auto" />
                        <div className="h-8 w-24 bg-slate-100 rounded mx-auto" />
                        <div className="h-9 w-24 bg-slate-100 rounded-xl ml-auto" />
                      </div>
                    </div>
                  ))}
                  <div className="bg-slate-50 border-t border-slate-100 px-8 py-4 flex justify-between">
                    <div className="h-3 w-48 bg-slate-200/80 rounded" />
                    <div className="h-3 w-32 bg-slate-200/80 rounded" />
                  </div>
                </div>
              </div>
            )}
            {dashboardDataReady && (
              <>
                <div className="w-full max-w-[1340px] mx-auto space-y-8">
                  <header className="flex justify-end items-center text-white">
                    <button
                      type="button"
                      onClick={() => {
                        refreshPoolState(true);
                        refreshUsdcPoolState(true);
                        refreshUsadPoolState(true);
                      }}
                      disabled={loading || isRefreshingState || isRefreshingUsdcState || isRefreshingUsadState}
                      className="bg-white/10 hover:bg-white/20 transition-colors px-4 py-2 rounded-xl text-sm font-medium backdrop-blur-sm border border-white/20 flex items-center gap-2 disabled:opacity-60"
                    >
                      <span className="w-2 h-2 rounded-full bg-emerald-400" />
                      {isRefreshingState || isRefreshingUsdcState || isRefreshingUsadState ? 'Refreshing...' : 'Refresh'}
                    </button>
                  </header>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    <div className="bg-white rounded-2xl p-6 shadow-lg shadow-black/5">
                      <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-1">Total Collateral (USD)</h2>
                      <div className="text-[32px] leading-none font-bold font-mono mb-2 mt-3 text-slate-900">${totalCollateralUsd.toFixed(2)}</div>
                      <p className="text-sm text-slate-500 leading-snug">All supplied assets valued on-chain.</p>
                    </div>
                    <div className="bg-white rounded-2xl p-6 shadow-lg shadow-black/5">
                      <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-1">Borrowable (USD)</h2>
                      <div className="text-[32px] leading-none font-bold font-mono mb-2 mt-3 text-amber-500">${borrowableUsd.toFixed(2)}</div>
                      <p className="text-sm text-slate-500 leading-snug">Cross-asset cap before health drops below threshold.</p>
                    </div>
                    <div className="bg-white rounded-2xl p-6 shadow-lg shadow-black/5">
                      <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-1">Total Debt (USD)</h2>
                      <div className="text-[32px] leading-none font-bold font-mono mb-2 mt-3 text-amber-500">${totalDebtUsd.toFixed(2)}</div>
                      <p className="text-sm text-slate-500 leading-snug">Borrowed value across ALEO, USDCx, and USAD.</p>
                    </div>
                    <div className="bg-white rounded-2xl p-6 shadow-lg shadow-black/5">
                      <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-1">Health Factor</h2>
                      <div className={`text-[32px] leading-none font-bold font-mono mb-2 mt-3 ${healthFactor != null && healthFactor < 1 ? 'text-red-500' : 'text-emerald-500'}`}>
                        {healthFactor == null ? '∞' : healthFactor.toFixed(2)}
                      </div>
                      <p className="text-sm text-slate-500 leading-snug">
                        {healthFactor == null
                          ? 'No debt.'
                          : healthFactor < 1
                            ? 'Repay or add collateral.'
                            : 'Healthy position.'}
                      </p>
                    </div>
                  </div>

                  <div className="bg-white rounded-[24px] shadow-2xl overflow-hidden border border-white">
                    <div className="bg-slate-50/80 border-b border-slate-100 px-8 py-5">
                      <div className="grid grid-cols-[2fr_1.5fr_1.5fr_1.5fr_1fr] gap-4 items-center text-xs font-bold text-slate-400 uppercase tracking-wider">
                        <div>Asset</div>
                        <div>Wallet Balance</div>
                        <div>Supplied</div>
                        <div>Borrowed</div>
                        <div className="text-right">Manage Position</div>
                      </div>
                    </div>

                    {[
                      { id: 'aleo' as const, label: 'ALEO', wallet: privateAleoBalance ?? 0, supplied: supplyBalanceAleo, borrowed: borrowDebtAleo, sApy: supplyAPY, bApy: borrowAPY },
                      { id: 'usdc' as const, label: 'USDCx', wallet: privateUsdcBalance ?? 0, supplied: supplyBalanceUsdc, borrowed: borrowDebtUsdc, sApy: supplyAPYUsdc, bApy: borrowAPYUsdc },
                      { id: 'usad' as const, label: 'USAD', wallet: privateUsadBalance ?? 0, supplied: supplyBalanceUsad, borrowed: borrowDebtUsad, sApy: supplyAPYUsad, bApy: borrowAPYUsad },
                    ].map((asset) => (
                      <div key={asset.id} className="border-b border-slate-100">
                        <div
                          className={`grid grid-cols-[2fr_1.5fr_1.5fr_1.5fr_1fr] gap-4 items-center px-8 py-5 cursor-pointer ${expandedAsset === asset.id ? 'bg-slate-50' : 'hover:bg-slate-50'}`}
                          onClick={() => {
                            const nextExpanded = expandedAsset === asset.id ? null : asset.id;
                            setExpandedAsset(nextExpanded);
                            if (nextExpanded) {
                              setActiveManageTab('Supply');
                              setManageAmountInput('');
                            }
                          }}
                        >
                          <div><AssetBadge asset={asset.label as 'ALEO' | 'USDCx' | 'USAD'} compact /></div>
                          <div className="font-mono text-slate-700 text-[15px]">{asset.wallet.toFixed(2)}</div>
                          <div className="font-mono text-slate-700 text-[15px]">
                            {asset.supplied.toFixed(2)}
                            <div className="text-xs text-slate-400 font-sans">APY: {(asset.sApy * 100).toFixed(2)}%</div>
                          </div>
                          <div className="font-mono text-slate-700 text-[15px]">
                            {asset.borrowed.toFixed(2)}
                            <div className="text-xs text-slate-400 font-sans">APY: {(asset.bApy * 100).toFixed(2)}%</div>
                          </div>
                          <div className="flex justify-end">
                            <button className="flex items-center gap-2 border border-slate-200 text-slate-600 hover:border-indigo-500 hover:text-indigo-600 bg-white px-4 py-2 rounded-xl text-sm font-semibold transition-colors">
                              {expandedAsset === asset.id ? 'Close' : 'Manage'}
                            </button>
                          </div>
                        </div>

                        {expandedAsset === asset.id && (
                          <div className="bg-slate-50/50 border-t border-slate-200 px-8 py-8">
                            <div className="max-w-4xl mx-auto grid grid-cols-1 lg:grid-cols-[1.5fr_1fr] gap-10">
                              <div>
                                <div className="flex gap-1 mb-6 bg-slate-200/50 p-1 rounded-xl w-fit">
                                  {(['Supply', 'Withdraw', 'Borrow', 'Repay'] as const).map((tab) => (
                                    <button
                                      key={tab}
                                      onClick={() => {
                                        setActiveManageTab(tab);
                                        setManageAmountInput('');
                                      }}
                                      className={`px-5 py-2 rounded-lg text-sm transition-all ${activeManageTab === tab ? 'bg-white text-slate-900 font-semibold shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
                                    >
                                      {tab}
                                    </button>
                                  ))}
                                </div>
                                <div className="flex justify-between items-end mb-3">
                                  <label className="text-sm font-semibold text-slate-700">Amount to {activeManageTab}</label>
                                  <div className="text-xs text-slate-500">
                                    {activeManageTab === 'Supply' ? (
                                      <>
                                        Wallet Balance:{' '}
                                        <span className="font-mono text-slate-800 font-medium">
                                          {asset.wallet.toFixed(2)} {asset.label}
                                        </span>
                                      </>
                                    ) : activeManageTab === 'Borrow' ? (
                                      <>
                                        Available Borrowable (USD):{' '}
                                        <span className="font-mono text-slate-800 font-medium">${borrowableUsd.toFixed(2)}</span>
                                      </>
                                    ) : activeManageTab === 'Withdraw' ? (
                                      <>
                                        Available Withdrawable (USD):{' '}
                                        <span className="font-mono text-slate-800 font-medium">${portfolioWithdrawUsd.toFixed(2)}</span>
                                      </>
                                    ) : (
                                      <>
                                        Total Debt (USD):{' '}
                                        <span className="font-mono text-slate-800 font-medium">${portfolioDebtUsdForRepay.toFixed(2)}</span>
                                      </>
                                    )}
                                  </div>
                                </div>
                                <div className="relative flex items-center bg-white border border-slate-200 rounded-2xl overflow-hidden focus-within:border-indigo-500 focus-within:ring-4 focus-within:ring-indigo-500/10 transition-all shadow-sm">
                                  <input
                                    type="text"
                                    placeholder="0.00"
                                    value={manageAmountInput}
                                    onChange={(e) => setManageAmountInput(e.target.value)}
                                    className="w-full text-3xl font-mono text-slate-800 py-6 pl-6 pr-32 outline-none bg-transparent placeholder-slate-300"
                                  />
                                  <div className="absolute right-4 flex items-center gap-2">
                                    <button
                                      onClick={async () => {
                                        const maxVal = await resolveInlineMaxAmount(activeManageTab, asset.id);
                                        setManageAmountInput(maxVal.toFixed(2));
                                      }}
                                      type="button"
                                      className="text-xs font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-lg transition-colors uppercase tracking-wide"
                                    >
                                      Max
                                    </button>
                                    <span className="font-semibold text-slate-700">{asset.label}</span>
                                  </div>
                                </div>
                                <div className="flex gap-2 mt-4">
                                  {[25, 50, 75, 100].map((pct) => (
                                    <button
                                      key={pct}
                                      type="button"
                                      onClick={() => {
                                        (async () => {
                                          const inlineMax = await resolveInlineMaxAmount(activeManageTab, asset.id);
                                          setManageAmountInput(((inlineMax * pct) / 100).toFixed(2));
                                        })();
                                      }}
                                      className="flex-1 py-1.5 text-xs font-medium text-slate-500 border border-slate-200 rounded-lg hover:bg-slate-100 transition-colors"
                                    >
                                      {pct}%
                                    </button>
                                  ))}
                                </div>
                                <button
                                  onClick={async () => {
                                    const raw = Number(manageAmountInput);
                                    const inlineMax = getInlineMaxAmount(activeManageTab, asset.id);
                                    const amountToUse =
                                      Number.isFinite(raw) && raw > 0
                                        ? Math.min(raw, inlineMax)
                                        : 0;
                                    if (!amountToUse) return;

                                    // Ensure the underlying transaction handlers record the correct amount
                                    // (they use `amount` / `amountUsdc` / `amountUsad` state, not `manageAmountInput`).
                                    setModalAmountInput(String(amountToUse));
                                    if (asset.id === 'usdc') setAmountUsdc(amountToUse);
                                    else if (asset.id === 'usad') setAmountUsad(amountToUse);
                                    else setAmount(amountToUse);

                                    setInlineTxContext({ tab: activeManageTab, asset: asset.id });

                                    const txAction =
                                      activeManageTab === 'Supply'
                                        ? 'deposit'
                                        : activeManageTab === 'Withdraw'
                                          ? 'withdraw'
                                          : activeManageTab === 'Borrow'
                                            ? 'borrow'
                                            : 'repay';

                                    if (asset.id === 'aleo') {
                                      await handleAction(txAction as any, amountToUse);
                                    } else if (asset.id === 'usdc') {
                                      await handleActionUsdc(txAction as any, amountToUse);
                                    } else {
                                      await handleActionUsad(txAction as any, amountToUse);
                                    }
                                  }}
                                  disabled={(() => {
                                    const raw = Number(manageAmountInput);
                                    const inlineMax = getInlineMaxAmount(activeManageTab, asset.id);
                                    // allow tiny epsilon over max to account for float rounding
                                    const EPS = 1e-6;
                                    return (
                                      loading ||
                                      !Number.isFinite(raw) ||
                                      raw <= 0 ||
                                      raw - inlineMax > EPS
                                    );
                                  })()}
                                  className="w-full mt-4 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-4 rounded-2xl shadow-lg shadow-indigo-500/30 transition-all text-lg disabled:opacity-60 disabled:cursor-not-allowed"
                                >
                                  {activeManageTab} {asset.label}
                                </button>
                              </div>

                              <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm">
                                <h3 className="text-sm font-semibold text-slate-800 mb-5">Transaction Overview</h3>
                                {(() => {
                                  const amountNum = Number(manageAmountInput);
                                  const preview = computeInlinePreview(activeManageTab, asset.id, amountNum);
                                  const isThisInline =
                                    inlineTxContext?.tab === activeManageTab && inlineTxContext?.asset === asset.id;

                                  return (
                                    <div className="space-y-3 text-sm">
                                      <div className="space-y-1">
                                        <div className="text-slate-500">{preview.remainingAfterLabel}</div>
                                        <div className="font-mono text-slate-800">
                                          {preview.remainingAfter.toFixed(2)} {preview.assetSymbol}
                                        </div>
                                      </div>
                                      <div className="space-y-1">
                                        <div className="text-slate-500">Est. weighted collateral (USD)</div>
                                        <div className="font-mono text-slate-800">${preview.postWeightedCollateralUsd.toFixed(2)}</div>
                                      </div>
                                      <div className="space-y-1">
                                        <div className="text-slate-500">Est. total debt (USD)</div>
                                        <div className="font-mono text-slate-800">${preview.postTotalDebtUsd.toFixed(2)}</div>
                                      </div>

                                      {isThisInline && loading ? (
                                        <div className="mt-2 text-xs text-slate-500 flex items-center gap-2">
                                          <span className="loading loading-spinner loading-xs" />
                                          <span>{statusMessage || 'Processing...'}</span>
                                        </div>
                                      ) : null}

                                      {isThisInline && txFinalized && txId ? (
                                        <a
                                          href={getProvableExplorerTxUrl(txId)}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="link link-primary text-xs block mt-3"
                                        >
                                          View in explorer
                                        </a>
                                      ) : null}
                                    </div>
                                  );
                                })()}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}

                    <div className="bg-slate-50 border-t border-slate-100 px-8 py-4 flex items-center text-xs text-slate-500">
                      <span>Showing 3 supported assets on Aleo</span>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* Transaction history (Supabase – fetched by wallet address) */}
        {connected && (
        <div className="rounded-xl bg-base-200 p-6 border border-base-300 mb-8 pb-2">
          <div className="flex items-center justify-between gap-4 mb-2">
            <h2 className="text-xl font-semibold text-base-content">Transaction history</h2>
            <Button variant="ghost" size="small" onClick={fetchTransactionHistory} disabled={txHistoryLoading || !address}>
              {txHistoryLoading ? 'Loading…' : 'Refresh'}
            </Button>
          </div>
          {txHistoryError ? (
            <div className="rounded-lg bg-warning/10 border border-warning/30 p-4 text-sm text-warning">
              <p className="font-medium">Could not load transaction history</p>
              <p className="mt-1">{txHistoryError}</p>
              <p className="mt-2 text-base-content/70">
                Ensure you ran <code className="text-xs bg-base-300 px-1 rounded">supabase/schema.sql</code> in Supabase SQL Editor and that{' '}
                <code className="text-xs bg-base-300 px-1 rounded">.env</code> has NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUB_KEY (Publishable key).
              </p>
            </div>
          ) : txHistoryLoading && txHistory.length === 0 ? (
            <p className="text-base-content/70">Loading transactions…</p>
          ) : txHistory.length === 0 ? (
            <p className="text-base-content/70">
              No transactions yet. Deposit, withdraw, borrow, or repay to see history here.
            </p>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="table table-zebra w-full">
                  <thead>
                    <tr>
                      <th className="text-base-content/70 font-medium">Date</th>
                      <th className="text-base-content/70 font-medium">Type</th>
                      <th className="text-base-content/70 font-medium">Asset</th>
                      <th className="text-base-content/70 font-medium">Amount</th>
                      <th className="text-base-content/70 font-medium min-w-[220px]">Transaction</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(() => {
                      const pageSize = 10;
                      const totalPages = Math.max(1, Math.ceil(txHistory.length / pageSize));
                      const currentPage = Math.min(txHistoryPage, totalPages);
                      const startIndex = (currentPage - 1) * pageSize;
                      const pageItems = txHistory.slice(startIndex, startIndex + pageSize);
                      return pageItems.map((row) => (
                        <tr key={row.id}>
                          <td className="text-base-content/90">
                            {new Date(row.created_at).toLocaleString()}
                          </td>
                          <td className="capitalize">{row.type}</td>
                          <td>
                            {row.asset === 'usdcx' ? (
                              <AssetBadge asset="USDCx" compact />
                            ) : row.asset === 'usad' || row.asset === 'usadx' ? (
                              <AssetBadge asset="USAD" compact />
                            ) : row.asset === 'aleo' ? (
                              <AssetBadge asset="ALEO" compact />
                            ) : (
                              String(row.asset).toUpperCase()
                            )}
                          </td>
                          <td>
                            {Number(row.amount).toLocaleString(undefined, {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 6,
                            })}
                          </td>
                          <td className="align-middle">
                            <TxHistoryTrxPills
                              txId={row.tx_id}
                              explorerUrl={row.explorer_url}
                              vaultExplorerUrl={row.vault_explorer_url}
                              type={row.type}
                              asset={row.asset}
                              getProvableExplorerTxUrl={getProvableExplorerTxUrl}
                            />
                          </td>
                        </tr>
                      ));
                    })()}
                  </tbody>
                </table>
              </div>
              {txHistory.length > 10 && (
                <div className="flex items-center justify-between mt-3 text-xs text-base-content/70">
                  {(() => {
                    const pageSize = 10;
                    const totalPages = Math.max(1, Math.ceil(txHistory.length / pageSize));
                    const currentPage = Math.min(txHistoryPage, totalPages);
                    const startIndex = (currentPage - 1) * pageSize;
                    const endIndex = Math.min(startIndex + pageSize, txHistory.length);
                    return (
                      <>
                        <span>
                          Showing {startIndex + 1}–{endIndex} of {txHistory.length} transactions
                        </span>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost"
                            size="small"
                            disabled={currentPage === 1}
                            onClick={() => setTxHistoryPage((p) => Math.max(1, p - 1))}
                          >
                            Previous
                          </Button>
                          <span>
                            Page {currentPage} of {totalPages}
                          </span>
                          <Button
                            variant="ghost"
                            size="small"
                            disabled={currentPage === totalPages}
                            onClick={() =>
                              setTxHistoryPage((p) => Math.min(totalPages, p + 1))
                            }
                          >
                            Next
                          </Button>
                        </div>
                      </>
                    );
                  })()}
                </div>
              )}
            </>
          )}
        </div>
        )}

      </div>

      {isDevAppEnv && (
        <div className="rounded-xl bg-base-200 p-6 space-y-4 border-2 border-info">
          <h2 className="text-xl font-semibold">📊 Frontend Diagnostics & Logs</h2>
          <p className="text-sm opacity-70">
            View, analyze, and export all frontend logs and record diagnostics
          </p>

          <div className="flex flex-wrap gap-2">
            <Button
              onClick={() => {
                const summary = frontendLogger.getSummary();
                setLogsSummary(summary);
                setShowLogsPanel(true);
              }}
              variant="ghost"
              size="small"
            >
              📋 View Summary
            </Button>
            <Button
              onClick={() => frontendLogger.downloadLogsAsFile('text')}
              variant="ghost"
              size="small"
            >
              💾 Download Logs (TXT)
            </Button>
            <Button
              onClick={() => frontendLogger.downloadRecordDiagnosticsAsFile('json')}
              variant="ghost"
              size="small"
            >
              📦 Download Records (JSON)
            </Button>
            <Button
              onClick={() => frontendLogger.downloadAllAsFile('json')}
              variant="ghost"
              size="small"
            >
              📁 Download All (JSON)
            </Button>
            <Button
              onClick={() => {
                if (requestRecords && publicKey) {
                  debugAllRecords(requestRecords, publicKey).then((results) => {
                    console.log('Diagnostic results:', results);
                    setStatusMessage('✅ Diagnostic complete. Check console for details.');
                  });
                } else {
                  setStatusMessage('❌ Wallet not connected');
                }
              }}
              variant="ghost"
              size="small"
              disabled={!connected}
            >
              🔍 Run Diagnosis
            </Button>
            <Button
              onClick={() => {
                frontendLogger.clearLogs();
                frontendLogger.clearRecordDiagnostics();
                setLogsSummary(null);
                setStatusMessage('✅ Logs cleared');
              }}
              variant="ghost"
              size="small"
            >
              🗑️ Clear Logs
            </Button>
          </div>

          {showLogsPanel && logsSummary && (
            <div className="bg-base-300 p-4 rounded-lg space-y-2 max-h-96 overflow-y-auto">
              <h3 className="font-semibold">📊 Session Summary</h3>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <span className="opacity-70">Total Logs:</span>
                  <p className="font-semibold">{logsSummary.totalLogs}</p>
                </div>
                <div>
                  <span className="opacity-70">Errors:</span>
                  <p className="font-semibold text-error">{logsSummary.errors}</p>
                </div>
                <div>
                  <span className="opacity-70">Warnings:</span>
                  <p className="font-semibold text-warning">{logsSummary.warnings}</p>
                </div>
                <div>
                  <span className="opacity-70">Regular Logs:</span>
                  <p className="font-semibold">{logsSummary.logs}</p>
                </div>
                <div>
                  <span className="opacity-70">Diagnostics:</span>
                  <p className="font-semibold">{logsSummary.totalDiagnostics}</p>
                </div>
                <div>
                  <span className="opacity-70">Duration:</span>
                  <p className="font-semibold">
                    {(logsSummary.sessionDuration / 1000).toFixed(1)}s
                  </p>
                </div>
              </div>
              <p className="text-xs opacity-70 pt-2">
                💡 Download logs to share with developers for debugging
              </p>
            </div>
          )}
        </div>
      )}

      {/* Status + last transaction details */}
      {isDevAppEnv ? (
        <>
          {statusMessage && (
            <div
              className={`alert ${
                statusMessage.includes('error') || statusMessage.includes('Failed')
                  ? 'alert-error'
                  : 'alert-info'
              }`}
            >
              <span>{statusMessage}</span>
            </div>
          )}

          {txId && (
            <div className="rounded-xl bg-base-200 p-4 max-w-xl">
              <h3 className="font-semibold mb-2">
                Last Transaction ID
                {txFinalized && (
                  <span className="ml-2 badge badge-success badge-sm">Finalized</span>
                )}
              </h3>
              <pre className="text-xs whitespace-pre-wrap break-all bg-base-300 p-2 rounded">
                {txId}
              </pre>
              {txFinalized && isExplorerHash(txId) ? (
                <a
                  href={getProvableExplorerTxUrl(txId)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="link link-primary text-sm mt-2 inline-block"
                >
                  View on Provable Explorer →
                </a>
              ) : txFinalized ? (
                <p className="text-xs opacity-70 mt-2">
                  Transaction finalized. This ID comes from Leo Wallet and may not be a full on-chain
                  transaction hash. You can track it in the wallet activity view.
                </p>
              ) : (
                <p className="text-xs opacity-70 mt-2">
                  Waiting for transaction to finalize... The explorer link will appear once confirmed.
                </p>
              )}
            </div>
          )}

          {vaultWithdrawTxId && (
            <div className="rounded-xl bg-base-200 p-4 max-w-xl border-l-4 border-success">
              <h3 className="font-semibold mb-2">Vault transfer (credits to your wallet)</h3>
              <p className="text-xs opacity-80 mb-2">
                Backend sent ALEO from the pool vault to your wallet. Transaction:
              </p>
              <pre className="text-xs whitespace-pre-wrap break-all bg-base-300 p-2 rounded mb-2">
                {vaultWithdrawTxId}
              </pre>
              <a
                href={getProvableExplorerTxUrl(vaultWithdrawTxId)}
                target="_blank"
                rel="noopener noreferrer"
                className="link link-primary text-sm inline-block"
              >
                View on Provable Explorer →
              </a>
            </div>
          )}

          {vaultBorrowTxId && (
            <div className="rounded-xl bg-base-200 p-4 max-w-xl border-l-4 border-info">
              <h3 className="font-semibold mb-2">Vault borrow (credits to your wallet)</h3>
              <p className="text-xs opacity-80 mb-2">
                Backend sent borrowed ALEO from the pool vault to your wallet. Transaction:
              </p>
              <pre className="text-xs whitespace-pre-wrap break-all bg-base-300 p-2 rounded mb-2">
                {vaultBorrowTxId}
              </pre>
              <a
                href={getProvableExplorerTxUrl(vaultBorrowTxId)}
                target="_blank"
                rel="noopener noreferrer"
                className="link link-primary text-sm inline-block"
              >
                View on Provable Explorer →
              </a>
            </div>
          )}
        </>
      ) : (
        <>
          {/* Simple loading overlay for prod */}
          {loading && (
            <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40">
              <div className="rounded-xl bg-base-200 px-6 py-4 flex flex-col items-center gap-2 shadow-lg">
                <span className="loading loading-spinner loading-md" />
                <p className="text-sm opacity-80">Processing transaction...</p>
              </div>
            </div>
          )}

          {/* Minimal toast-style status message for prod (bottom-right) */}
          {statusMessage && !loading && (
            <div className="fixed bottom-4 right-4 z-40 rounded-lg bg-base-200 px-4 py-2 shadow-lg text-sm">
              {statusMessage}
            </div>
          )}
        </>
      )}
    </div>
  );
};

DashboardPage.getLayout = (page) => <Layout>{page}</Layout>;

export default DashboardPage;

