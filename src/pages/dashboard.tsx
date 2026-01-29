import { useEffect, useState, useCallback } from 'react';
import type { NextPageWithLayout } from '@/types';
import Layout from '@/layouts/_layout';
import Button from '@/components/ui/button';
import { useWallet } from '@provablehq/aleo-wallet-adaptor-react';
import { Network } from '@provablehq/aleo-types';
import {
  getLendingPoolState,
  lendingDeposit,
  lendingBorrow,
  lendingRepay,
  lendingWithdraw,
  lendingAccrueInterest,
  debugAllRecords,
  LENDING_POOL_PROGRAM_ID,
} from '@/components/aleo/rpc';
import { frontendLogger } from '@/utils/logger';
import { CURRENT_NETWORK } from '@/types';

// Frontend app environment: 'dev' or 'prod' (default to dev for non-production NODE_ENV)
const APP_ENV = process.env.NEXT_PUBLIC_APP_ENV;
const isDevAppEnv = APP_ENV ? APP_ENV === 'dev' : process.env.NODE_ENV !== 'production';

const DashboardPage: NextPageWithLayout = () => {
  const {
    address,
    connected,
    executeTransaction,
    transactionStatus,
    requestRecords,
    requestTransactionHistory,
    decrypt,
  } = useWallet();
  const publicKey = address; // Use address as publicKey for compatibility

  const [amount, setAmount] = useState<number>(0);
  const [deltaIndex, setDeltaIndex] = useState<number>(0);
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [txId, setTxId] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [showLogsPanel, setShowLogsPanel] = useState<boolean>(false);
  const [logsSummary, setLogsSummary] = useState<any>(null);

  const [totalSupplied, setTotalSupplied] = useState<string | null>(null);
  const [totalBorrowed, setTotalBorrowed] = useState<string | null>(null);
  const [utilizationIndex, setUtilizationIndex] = useState<string | null>(null);
  const [interestIndex, setInterestIndex] = useState<string | null>(null);
  const [txFinalized, setTxFinalized] = useState<boolean>(false);
  
  // User position state
  const [userSupplied, setUserSupplied] = useState<string>('0');
  const [userBorrowed, setUserBorrowed] = useState<string>('0');
  const [totalDeposits, setTotalDeposits] = useState<string>('0');
  const [totalWithdrawals, setTotalWithdrawals] = useState<string>('0');
  const [totalBorrows, setTotalBorrows] = useState<string>('0');
  const [totalRepayments, setTotalRepayments] = useState<string>('0');
  const [isFetchingRecords, setIsFetchingRecords] = useState<boolean>(false);
  const [isRefreshingState, setIsRefreshingState] = useState<boolean>(false);
  const [amountError, setAmountError] = useState<string | null>(null);
  
  // Track if we've already triggered a one-time records permission request for this connection
  const [walletPermissionsInitialized, setWalletPermissionsInitialized] = useState<boolean>(false);
  // Track if we've already loaded the user's position once after wallet connect
  const [userPositionInitialized, setUserPositionInitialized] = useState<boolean>(false);

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
    const regex = new RegExp(`${label}\\s*[:=]\\s*([0-9_]+)u64`, 'i');
    const match = text.match(regex);
    if (!match || !match[1]) return 0;
    const cleaned = match[1].replace(/_/g, '');
    const n = Number(cleaned);
    return Number.isNaN(n) ? 0 : n;
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

  const isExplorerHash = (id: string | null) => !!id && id.length >= 61;

  const getExplorerTxUrl = (id: string) => {
    let base = 'https://explorer.aleo.org/transaction';

    if (CURRENT_NETWORK === Network.TESTNET) {
      base = 'https://testnet.explorer.aleo.org/transaction';
    }

    // If you later switch to MainnetBeta explicitly, you can add a branch here.
    return `${base}/${id}`;
  };

  const refreshPoolState = async (includeUserPosition: boolean = false) => {
    try {
      setIsRefreshingState(true);
      const state = await getLendingPoolState();
      setTotalSupplied(state.totalSupplied ?? '0');
      setTotalBorrowed(state.totalBorrowed ?? '0');
      setUtilizationIndex(state.utilizationIndex ?? '0');
      setInterestIndex(state.interestIndex ?? '0');
      
      // Optionally refresh user position if wallet is connected.
      // This now reuses the decrypt+records path in fetchRecordsInBackground.
      if (includeUserPosition && requestRecords && publicKey) {
        try {
          await fetchRecordsInBackground(LENDING_POOL_PROGRAM_ID);
        } catch (error) {
          console.warn('Failed to refresh user position from records:', error);
          setUserSupplied('0');
          setUserBorrowed('0');
          setTotalDeposits('0');
          setTotalWithdrawals('0');
          setTotalBorrows('0');
          setTotalRepayments('0');
        }
      } else {
        setUserSupplied('0');
        setUserBorrowed('0');
        setTotalDeposits('0');
        setTotalWithdrawals('0');
        setTotalBorrows('0');
        setTotalRepayments('0');
      }
    } catch (e) {
      console.error('Failed to fetch pool state', e);
      setStatusMessage('Failed to fetch pool state. Check console for details.');
    }
    finally {
      setIsRefreshingState(false);
    }
  };

  // One-time pool state fetch on page load/refresh and when wallet connects.
  // This DOES NOT touch private records / requestRecords to avoid extra wallet prompts.
  useEffect(() => {
    refreshPoolState(false);
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
      } finally {
        // Mark as initialized so we don't refetch repeatedly
        setUserPositionInitialized(true);
      }
    })();
  }, [connected, publicKey, requestRecords, walletPermissionsInitialized, userPositionInitialized]);

  const handleAction = async (action: 'deposit' | 'borrow' | 'repay' | 'withdraw') => {
    console.log('========================================');
    console.log(`🚀 BUTTON CLICKED: ${action.toUpperCase()}`);
    console.log('========================================');
    console.log('📊 Initial State:', {
      action,
      amount,
      connected,
      hasPublicKey: !!publicKey,
      publicKey: publicKey?.substring(0, 20) + '...',
      hasTransactionStatus: !!transactionStatus,
      loading,
    });
    
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
    
    try {
      console.log('✅ All validations passed');
      setLoading(true);
      setStatusMessage(`Executing ${action}...`);
      setAmountError(null);
      
      if (amount <= 0) {
        throw new Error('Amount must be greater than zero.');
      }

      // Frontend limit checks based on current pool and user data
      const netSupplied = Number(userSupplied) || 0;
      const netBorrowed = Number(userBorrowed) || 0;
      const poolSupplied = Number(totalSupplied) || 0;
      const poolBorrowed = Number(totalBorrowed) || 0;
      const availableLiquidity = Math.max(0, poolSupplied - poolBorrowed);

      if (action === 'withdraw' && amount > netSupplied) {
        const msg = `You can withdraw at most ${netSupplied} from your current position.`;
        setAmountError(msg);
        console.warn(msg);
        setLoading(false);
        return;
      }

      if (action === 'repay' && amount > netBorrowed) {
        const msg = `You need to repay at most ${netBorrowed} to fully clear your debt.`;
        setAmountError(msg);
        console.warn(msg);
        setLoading(false);
        return;
      }

      if (action === 'borrow' && amount > availableLiquidity) {
        const msg = `Borrow amount exceeds available pool liquidity (${availableLiquidity}). Please reduce the amount.`;
        setAmountError(msg);
        console.warn(msg);
        setLoading(false);
        return;
      }
      
      console.log(`📝 Calling ${action} function with:`, { amount });

      let tx: string;
      const startTime = Date.now();

      // v7: Contract reads user data from mappings automatically - only amount needed
      console.log(`🔄 Executing ${action} transaction...`);
      switch (action) {
        case 'deposit':
          console.log('💰 DEPOSIT: Starting deposit transaction (executeTransaction)...');
          tx = await lendingDeposit(executeTransaction, amount);
          console.log('💰 DEPOSIT: Transaction submitted successfully:', tx);
          break;
        case 'borrow':
          console.log('📥 BORROW: Starting borrow transaction (executeTransaction)...');
          tx = await lendingBorrow(executeTransaction, amount);
          console.log('📥 BORROW: Transaction submitted successfully:', tx);
          break;
        case 'repay':
          console.log('💳 REPAY: Starting repay transaction (executeTransaction)...');
          tx = await lendingRepay(executeTransaction, amount);
          console.log('💳 REPAY: Transaction submitted successfully:', tx);
          break;
        case 'withdraw':
          console.log('💸 WITHDRAW: Starting withdraw transaction (executeTransaction)...');
          tx = await lendingWithdraw(executeTransaction, amount);
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

      setTxId(tx);
      setTxFinalized(false);
      setStatusMessage(`Transaction submitted: ${tx.substring(0, 20)}... Waiting for finalization...`);
      
      console.log('📤 Transaction ID:', tx);
      console.log('⏳ Starting finalization polling...');

      // Poll for transaction finalization using wallet's transactionStatus
      let finalized = false;
      const maxAttempts = 30; // 30 attempts
      const delayMs = 2000; // 2 seconds between attempts

      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        console.log(`🔄 Polling transaction status (attempt ${attempt}/${maxAttempts})...`);
        await new Promise((resolve) => setTimeout(resolve, delayMs));
        
        if (transactionStatus) {
          try {
            const statusResult = await transactionStatus(tx);
            console.log(`📊 Transaction status (attempt ${attempt}):`, statusResult);

            // Normalize status: adapter may return a string or an object with `.status`
            const statusText =
              typeof statusResult === 'string'
                ? statusResult
                : (statusResult as any)?.status ?? '';
            const statusLower = (statusText || '').toLowerCase();

            if (statusLower === 'finalized' || statusLower === 'accepted') {
              finalized = true;
              console.log('✅ Transaction finalized!', statusResult);

              // If wallet returned a final on-chain tx id, prefer that for display
              const finalId =
                (typeof statusResult === 'object' && (statusResult as any).transactionId) || tx;
              setTxId(finalId);
              break;
            }
            setStatusMessage(`Transaction ${statusText || 'pending'}... (attempt ${attempt}/${maxAttempts})`);
          } catch (e) {
            // If transactionStatus fails, continue polling
            console.warn(`⚠️ Failed to check transaction status (attempt ${attempt}):`, e);
          }
        } else {
          console.warn(`⚠️ transactionStatus function not available (attempt ${attempt})`);
          // Fallback: just wait and assume it will finalize
          if (attempt === maxAttempts) {
            finalized = true; // Assume finalized after max wait time
            console.log('⏰ Max attempts reached, assuming finalized');
          }
        }
      }

      if (finalized) {
        setTxFinalized(true);
        console.log('✅ Transaction finalized successfully!');
        // Clear amount input after successful transaction
        setAmount(0);
        // Refresh full pool + user position state once after transaction finalizes
        console.log('📋 Refreshing pool and user position after transaction finalization...');
        try {
          await refreshPoolState(true);
          setStatusMessage('Transaction finalized! Pool and position have been refreshed.');
          // Auto-hide toast shortly after successful refresh in production
          if (!isDevAppEnv) {
            setTimeout(() => setStatusMessage(''), 2500);
          }
        } catch (refreshError) {
          console.warn('⚠️ Failed to refresh pool state after transaction:', refreshError);
          setStatusMessage(
            'Transaction finalized, but automatic refresh failed. Please click Refresh to update.',
          );
        }
        console.log('✅ Transaction flow completed successfully');
      } else {
        console.warn('⚠️ Transaction not finalized within expected time');
        setStatusMessage(
          'Transaction submitted but not finalized within the expected time. It may still be processing. Pool state will update once finalized.'
        );
      }
      console.log('========================================\n');
    } catch (e: any) {
      console.error('========================================');
      console.error(`❌ ERROR in ${action.toUpperCase()}:`, {
        message: e?.message,
        name: e?.name,
        stack: e?.stack,
        error: e,
        errorString: String(e),
        errorKeys: e ? Object.keys(e) : [],
      });
      console.error('========================================\n');
      
      // Detect wallet cancellation/rejection
      const errorMsg = String(e?.message || e || '').toLowerCase();
      const isCancelled = errorMsg.includes('cancel') || errorMsg.includes('reject') || errorMsg.includes('denied') || errorMsg.includes('user rejected');
      
      if (isCancelled) {
        // Show toast for cancellation (not error)
        setStatusMessage('Transaction cancelled by user.');
        if (!isDevAppEnv) {
          setTimeout(() => setStatusMessage(''), 2500);
        }
      } else {
        setStatusMessage(e?.message || `Failed to execute ${action}. Check console for details.`);
      }
    } finally {
      setLoading(false);
      console.log(`🏁 ${action.toUpperCase()} flow ended (loading set to false)`);
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
      
      setTxId(tx);
      setTxFinalized(false);
      setStatusMessage(`Test credits creation submitted: ${tx.substring(0, 20)}... Waiting for finalization...`);

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
            
            if (status && (status.status === 'Finalized' || status.finalized)) {
              finalized = true;
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
      
      setTxId(tx);
      setTxFinalized(false);
      setStatusMessage(`Deposit test submitted: ${tx.substring(0, 20)}... Waiting for finalization...`);

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
            
            if (status && (status.status === 'Finalized' || status.finalized)) {
              finalized = true;
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

      const tx = await lendingAccrueInterest(executeTransaction, deltaIndex);
      
      setTxId(tx);
      setTxFinalized(false);
      setStatusMessage(`Interest accrual submitted: ${tx.substring(0, 20)}... Waiting for finalization...`);

      // Poll for transaction finalization using wallet's transactionStatus
      let finalized = false;
      const maxAttempts = 30; // 30 attempts
      const delayMs = 2000; // 2 seconds between attempts

      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
        
        if (transactionStatus) {
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
              // Fetch records in background after interest accrual finalizes
              if (finalized && requestRecords && publicKey) {
                console.log('📋 Interest accrual finalized - fetching records in background...');
                fetchRecordsInBackground(LENDING_POOL_PROGRAM_ID);
              }
              break;
            }
            setStatusMessage(
              `Interest accrual ${statusText || 'pending'}... (attempt ${attempt}/${maxAttempts})`,
            );
          } catch (e) {
            // If transactionStatus fails, continue polling
            console.warn('Failed to check transaction status:', e);
          }
        } else {
          // Fallback: just wait and assume it will finalize
          if (attempt === maxAttempts) {
            finalized = true; // Assume finalized after max wait time
          }
        }
      }

      if (finalized) {
        setTxFinalized(true);
        // Clear amount input after successful interest accrual
        setDeltaIndex(0);
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

  return (
    <div className="flex justify-center pt-16 sm:pt-20">
      <div className="space-y-6 w-full max-w-6xl">
        {/* Main content */}
        {/* Aleo Pool + inline actions & position */}
        <div className="space-y-6">
          {/* Pool overview */}
          <div className="rounded-xl bg-base-200 p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold">Aleo Pool</h2>
                <p className="text-xs opacity-70">
                  Aleo pool program:{' '}
                  <a
                    href="https://testnet.explorer.provable.com/program/lending_pool_v8.aleo"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-mono text-[11px] text-base-content underline decoration-dotted underline-offset-2 hover:decoration-solid"
                  >
                    lending_pool_v8.aleo
                  </a>
                </p>
              </div>
              <button
                onClick={() => refreshPoolState(true)}
                className="btn btn-sm btn-outline"
                disabled={loading || isRefreshingState}
              >
                {isRefreshingState ? (
                  <>
                    <span className="loading loading-spinner loading-xs mr-1" />
                    Refreshing
                  </>
                ) : (
                  'Refresh'
                )}
              </button>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
              <div className="p-3 rounded-lg bg-base-300">
                <div className="flex items-center gap-1">
                  <p className="opacity-70 text-xs">Total Aleo Supplied</p>
                  <div className="inline-block tooltip tooltip-top before:max-w-xs before:whitespace-normal" data-tip="Total amount of Aleo tokens deposited into the pool by all users">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-3 h-3 opacity-60 cursor-help">
                      <path strokeLinecap="round" strokeLinejoin="round" d="m11.25 11.25.041-.02a.75.75 0 0 1 1.063.852l-.708 2.836a.75.75 0 0 0 1.063.853l.041-.021M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9-3.75h.008v.008H12V8.25Z" />
                    </svg>
                  </div>
                </div>
                <p className="text-lg font-semibold">{totalSupplied ?? '0'}</p>
              </div>
              <div className="p-3 rounded-lg bg-base-300">
                <div className="flex items-center gap-1">
                  <p className="opacity-70 text-xs">Total Aleo Borrowed</p>
                  <div className="inline-block tooltip tooltip-top before:max-w-xs before:whitespace-normal" data-tip="Total amount of Aleo tokens currently borrowed from the pool by all users">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-3 h-3 opacity-60 cursor-help">
                      <path strokeLinecap="round" strokeLinejoin="round" d="m11.25 11.25.041-.02a.75.75 0 0 1 1.063.852l-.708 2.836a.75.75 0 0 0 1.063.853l.041-.021M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9-3.75h.008v.008H12V8.25Z" />
                    </svg>
                  </div>
                </div>
                <p className="text-lg font-semibold">{totalBorrowed ?? '0'}</p>
              </div>
              <div className="p-3 rounded-lg bg-base-300">
                <div className="flex items-center gap-1">
                  <p className="opacity-70 text-xs">Available Liquidity</p>
                  <div className="inline-block tooltip tooltip-top before:max-w-xs before:whitespace-normal" data-tip="Amount of Aleo tokens available for borrowing (Total Supplied - Total Borrowed)">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-3 h-3 opacity-60 cursor-help">
                      <path strokeLinecap="round" strokeLinejoin="round" d="m11.25 11.25.041-.02a.75.75 0 0 1 1.063.852l-.708 2.836a.75.75 0 0 0 1.063.853l.041-.021M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9-3.75h.008v.008H12V8.25Z" />
                    </svg>
                  </div>
                </div>
                <p className="text-lg font-semibold">
                  {Math.max(0, (Number(totalSupplied) || 0) - (Number(totalBorrowed) || 0))}
                </p>
              </div>
              <div className="p-3 rounded-lg bg-base-300">
                <div className="flex items-center gap-1">
                  <p className="opacity-70 text-xs">Utilization</p>
                  <div className="inline-block tooltip tooltip-top before:max-w-xs before:whitespace-normal" data-tip="Percentage of total supplied tokens that are currently borrowed (Total Borrowed / Total Supplied × 100)">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-3 h-3 opacity-60 cursor-help">
                      <path strokeLinecap="round" strokeLinejoin="round" d="m11.25 11.25.041-.02a.75.75 0 0 1 1.063.852l-.708 2.836a.75.75 0 0 0 1.063.853l.041-.021M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9-3.75h.008v.008H12V8.25Z" />
                    </svg>
                  </div>
                </div>
                <p className="text-lg font-semibold">{formatScaled(utilizationIndex, 4)}%</p>
                {isDevAppEnv && (
                  <p className="text-[10px] opacity-60 mt-1">raw: {utilizationIndex ?? '0'}</p>
                )}
              </div>
              <div className="p-3 rounded-lg bg-base-300">
                <div className="flex items-center gap-1">
                  <p className="opacity-70 text-xs">Interest Index</p>
                  <div className="inline-block tooltip tooltip-top before:max-w-xs before:whitespace-normal" data-tip="Cumulative interest rate index tracking interest accrual over time (scaled by 1,000,000)">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-3 h-3 opacity-60 cursor-help">
                      <path strokeLinecap="round" strokeLinejoin="round" d="m11.25 11.25.041-.02a.75.75 0 0 1 1.063.852l-.708 2.836a.75.75 0 0 0 1.063.853l.041-.021M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9-3.75h.008v.008H12V8.25Z" />
                    </svg>
                  </div>
                </div>
                <p className="text-lg font-semibold">{formatScaled(interestIndex, 6)}</p>
                {isDevAppEnv && (
                  <p className="text-[10px] opacity-60 mt-1">raw: {interestIndex ?? '0'}</p>
                )}
              </div>
            </div>
            {/* In production, embed Actions + Your Position inside this Aleo Pool card */}
            {!isDevAppEnv && connected && (
              <div className="mt-6 grid gap-6 md:grid-cols-2">
                {/* Inline Lending Actions */}
                <div className="space-y-3">
                  <h3 className="font-semibold text-sm">Lending/Borrowing Actions</h3>
                  <label className="form-control w-full">
                    <span className="label-text">Amount</span>
                    <input
                      type="number"
                      inputMode="decimal"
                      placeholder="0"
                      className={`input input-bordered w-full [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none ${amountError ? 'input-error' : ''}`}
                      value={amount === 0 ? '' : amount}
                      onChange={(e) => {
                        const raw = e.target.value;
                        setAmountError(null);
                        if (raw === '' || raw === undefined) {
                          setAmount(0);
                          return;
                        }
                        const n = Number(raw);
                        if (!Number.isNaN(n) && n >= 0) setAmount(n);
                      }}
                      onKeyDown={(e) => {
                        if (['e', 'E', '+', '-'].includes(e.key)) e.preventDefault();
                      }}
                      disabled={loading || !connected}
                      min={0}
                    />
                    {amountError && (
                      <p className="mt-1 text-xs text-error">{amountError}</p>
                    )}
                  </label>

                  <div className="mt-3 flex flex-wrap gap-2">
                    <span className="inline-block tooltip tooltip-bottom tooltip-button before:max-w-xs before:whitespace-normal" data-tip="Deposit Aleo tokens into the pool to earn interest. Your tokens become available for others to borrow.">
                      <button
                        type="button"
                        onClick={() => handleAction('deposit')}
                        disabled={loading || !connected || amount <= 0}
                        className="btn btn-outline border-2 min-h-10"
                        title="Deposit Aleo tokens into the pool to earn interest."
                      >
                        {loading ? 'Processing...' : 'Deposit'}
                      </button>
                    </span>
                    <span className="inline-block tooltip tooltip-bottom tooltip-button before:max-w-xs before:whitespace-normal" data-tip="Borrow Aleo tokens from the pool using your supplied tokens as collateral. You'll pay interest on borrowed amount.">
                      <button
                        type="button"
                        onClick={() => handleAction('borrow')}
                        disabled={loading || !connected || amount <= 0}
                        className="btn btn-outline border-2 min-h-10"
                        title="Borrow Aleo from the pool using your supplied tokens as collateral."
                      >
                        Borrow
                      </button>
                    </span>
                    <span className="inline-block tooltip tooltip-bottom tooltip-button before:max-w-xs before:whitespace-normal" data-tip="Repay borrowed Aleo tokens to reduce your debt. This decreases your total borrowed amount.">
                      <button
                        type="button"
                        onClick={() => handleAction('repay')}
                        disabled={loading || !connected || amount <= 0}
                        className="btn btn-outline border-2 min-h-10"
                        title="Repay borrowed Aleo to reduce your debt."
                      >
                        Repay
                      </button>
                    </span>
                    <span className="inline-block tooltip tooltip-bottom tooltip-button before:max-w-xs before:whitespace-normal" data-tip="Withdraw your supplied Aleo tokens from the pool. You can withdraw up to your net supplied amount (subject to pool liquidity).">
                      <button
                        type="button"
                        onClick={() => handleAction('withdraw')}
                        disabled={loading || !connected || amount <= 0}
                        className="btn btn-outline border-2 min-h-10"
                        title="Withdraw your supplied Aleo from the pool."
                      >
                        Withdraw
                      </button>
                    </span>
                  </div>
                </div>

                {/* Inline Your Position summary */}
                <div className="space-y-3">
                  <h3 className="font-semibold text-sm">Your Position</h3>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="p-3 rounded-lg bg-base-300">
                      <div className="flex items-center gap-1">
                        <p className="opacity-70 text-xs">Net Supplied</p>
                        <div className="inline-block tooltip tooltip-top before:max-w-xs before:whitespace-normal" data-tip={`Your current net supplied Aleo tokens (Total Deposits - Total Withdrawals = ${totalDeposits} - ${totalWithdrawals}). This is the amount you can withdraw, subject to pool liquidity.`}>
                          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-3 h-3 opacity-60 cursor-help">
                            <path strokeLinecap="round" strokeLinejoin="round" d="m11.25 11.25.041-.02a.75.75 0 0 1 1.063.852l-.708 2.836a.75.75 0 0 0 1.063.853l.041-.021M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9-3.75h.008v.008H12V8.25Z" />
                          </svg>
                        </div>
                      </div>
                      <p className="text-lg font-semibold text-success">{userSupplied}</p>
                    </div>
                    <div className="p-3 rounded-lg bg-base-300">
                      <div className="flex items-center gap-1">
                        <p className="opacity-70 text-xs">Net Borrowed</p>
                        <div className="inline-block tooltip tooltip-top before:max-w-xs before:whitespace-normal" data-tip={`Your current net borrowed Aleo tokens (Total Borrows - Total Repayments = ${totalBorrows} - ${totalRepayments}). This is the amount you need to repay to fully clear your debt.`}>
                          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-3 h-3 opacity-60 cursor-help">
                            <path strokeLinecap="round" strokeLinejoin="round" d="m11.25 11.25.041-.02a.75.75 0 0 1 1.063.852l-.708 2.836a.75.75 0 0 0 1.063.853l.041-.021M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9-3.75h.008v.008H12V8.25Z" />
                          </svg>
                        </div>
                      </div>
                      <p className="text-lg font-semibold text-error">{userBorrowed}</p>
                    </div>
                    <div className="p-3 rounded-lg bg-base-300">
                      <div className="flex items-center gap-1">
                        <p className="opacity-70 text-xs">Total Deposits</p>
                        <div className="inline-block tooltip tooltip-top before:max-w-xs before:whitespace-normal" data-tip={`Cumulative total of all Aleo tokens you've deposited into the pool. This is tracked on-chain in the user_total_deposits mapping.`}>
                          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-3 h-3 opacity-60 cursor-help">
                            <path strokeLinecap="round" strokeLinejoin="round" d="m11.25 11.25.041-.02a.75.75 0 0 1 1.063.852l-.708 2.836a.75.75 0 0 0 1.063.853l.041-.021M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9-3.75h.008v.008H12V8.25Z" />
                          </svg>
                        </div>
                      </div>
                      <p className="text-lg font-semibold">{totalDeposits}</p>
                    </div>
                    <div className="p-3 rounded-lg bg-base-300">
                      <div className="flex items-center gap-1">
                        <p className="opacity-70 text-xs">Total Borrows</p>
                        <div className="inline-block tooltip tooltip-top before:max-w-xs before:whitespace-normal" data-tip={`Cumulative total of all Aleo tokens you've borrowed from the pool. This is tracked on-chain in the user_total_borrows mapping.`}>
                          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-3 h-3 opacity-60 cursor-help">
                            <path strokeLinecap="round" strokeLinejoin="round" d="m11.25 11.25.041-.02a.75.75 0 0 1 1.063.852l-.708 2.836a.75.75 0 0 0 1.063.853l.041-.021M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9-3.75h.008v.008H12V8.25Z" />
                          </svg>
                        </div>
                      </div>
                      <p className="text-lg font-semibold">{totalBorrows}</p>
                    </div>
                  </div>
                  {/* How much user can withdraw / needs to repay */}
                  {Number(userSupplied) > 0 && (
                    <p className="text-xs opacity-80">
                      You can withdraw up to <strong>{userSupplied}</strong> from this pool (subject
                      to available liquidity).
                    </p>
                  )}
                  {Number(userBorrowed) > 0 && (
                    <p className="text-xs opacity-80">
                      You need to repay <strong>{userBorrowed}</strong> to fully clear your debt.
                    </p>
                  )}
                  {Number(userSupplied) === 0 &&
                    Number(userBorrowed) === 0 &&
                    Number(totalDeposits) === 0 && (
                      <p className="text-xs opacity-70">
                        No activity yet. Make a deposit or borrow to open a position.
                      </p>
                    )}
                </div>
              </div>
            )}
          </div>

          {/* Actions + Interest Management (dev-only full panel) */}
          {isDevAppEnv && connected && (
            <div className="rounded-xl bg-base-200 p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold">Actions</h2>
                <span className="text-[11px] opacity-60">
                  Interest controls are for operator / testing only.
                </span>
              </div>

              <div className="grid gap-6 md:grid-cols-2">
                {/* Lending Actions */}
                <div className="space-y-3">
                  <h3 className="font-semibold text-sm">Lending/Borrowing Actions</h3>
                  <label className="form-control w-full">
                    <span className="label-text">Amount</span>
                    <input
                      type="number"
                      inputMode="decimal"
                      placeholder="0"
                      className={`input input-bordered w-full [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none ${amountError ? 'input-error' : ''}`}
                      value={amount === 0 ? '' : amount}
                      onChange={(e) => {
                        const raw = e.target.value;
                        setAmountError(null);
                        if (raw === '' || raw === undefined) {
                          setAmount(0);
                          return;
                        }
                        const n = Number(raw);
                        if (!Number.isNaN(n) && n >= 0) setAmount(n);
                      }}
                      onKeyDown={(e) => {
                        if (['e', 'E', '+', '-'].includes(e.key)) e.preventDefault();
                      }}
                      disabled={loading || !connected}
                      min={0}
                    />
                    {amountError && (
                      <p className="mt-1 text-xs text-error">{amountError}</p>
                    )}
                  </label>

                  <div className="mt-3 flex flex-wrap gap-2">
                    <span className="inline-block tooltip tooltip-bottom tooltip-button before:max-w-xs before:whitespace-normal" data-tip="Deposit Aleo tokens into the pool to earn interest. Your tokens become available for others to borrow.">
                      <button
                        type="button"
                        onClick={() => handleAction('deposit')}
                        disabled={loading || !connected || amount <= 0}
                        className="btn btn-outline border-2 min-h-10"
                        title="Deposit Aleo tokens into the pool to earn interest."
                      >
                        {loading ? 'Processing...' : 'Deposit'}
                      </button>
                    </span>
                    <span className="inline-block tooltip tooltip-bottom tooltip-button before:max-w-xs before:whitespace-normal" data-tip="Borrow Aleo tokens from the pool using your supplied tokens as collateral. You'll pay interest on borrowed amount.">
                      <button
                        type="button"
                        onClick={() => handleAction('borrow')}
                        disabled={loading || !connected || amount <= 0}
                        className="btn btn-outline border-2 min-h-10"
                        title="Borrow Aleo from the pool using your supplied tokens as collateral."
                      >
                        Borrow
                      </button>
                    </span>
                    <span className="inline-block tooltip tooltip-bottom tooltip-button before:max-w-xs before:whitespace-normal" data-tip="Repay borrowed Aleo tokens to reduce your debt. This decreases your total borrowed amount.">
                      <button
                        type="button"
                        onClick={() => handleAction('repay')}
                        disabled={loading || !connected || amount <= 0}
                        className="btn btn-outline border-2 min-h-10"
                        title="Repay borrowed Aleo to reduce your debt."
                      >
                        Repay
                      </button>
                    </span>
                    <span className="inline-block tooltip tooltip-bottom tooltip-button before:max-w-xs before:whitespace-normal" data-tip="Withdraw your supplied Aleo tokens from the pool. You can withdraw up to your net supplied amount (subject to pool liquidity).">
                      <button
                        type="button"
                        onClick={() => handleAction('withdraw')}
                        disabled={loading || !connected || amount <= 0}
                        className="btn btn-outline border-2 min-h-10"
                        title="Withdraw your supplied Aleo from the pool."
                      >
                        Withdraw
                      </button>
                    </span>
                  </div>
                </div>

                {/* Interest Management */}
                <div className="space-y-3">
                  <h3 className="font-semibold text-sm">Interest Management</h3>
                  <label className="form-control w-full">
                    <span className="label-text">Delta Index</span>
                    <input
                      type="number"
                      className="input input-bordered w-full"
                      value={deltaIndex}
                      onChange={(e) => setDeltaIndex(Number(e.target.value || 0))}
                      disabled={loading || !connected}
                      min="0"
                    />
                  </label>

                  <Button
                    onClick={handleAccrueInterest}
                    disabled={loading || !connected}
                    variant="ghost"
                  >
                    {loading ? 'Processing...' : 'Accrue Interest'}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>

      </div>

      {/* Testing tools removed: no direct credits.aleo wallet usage in UI now */}

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
                  href={getExplorerTxUrl(txId)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="link link-primary text-sm mt-2 inline-block"
                >
                  View on Explorer →
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

