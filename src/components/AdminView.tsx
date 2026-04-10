'use client';

import React, { useEffect, useState } from 'react';
import { useWallet } from '@provablehq/aleo-wallet-adaptor-react';
import { useWalletModal } from '@provablehq/aleo-wallet-adaptor-react-ui';
import { LENDING_POOL_PROGRAM_ID, USDC_LENDING_POOL_PROGRAM_ID, getAssetAdminParams, getProtocolFeesForAsset } from '@/components/aleo/rpc';
import { lendingInitializeAleoPool } from '@/components/aleo/rpc';
import { lendingInitializeUsdcPool } from '@/components/aleo/rpc';
import { ADMIN_ADDRESS } from '@/types';

const getProvableExplorerTxUrl = (id: string) =>
  `https://testnet.explorer.provable.com/transaction/${encodeURIComponent((id || '').trim())}`;

export function AdminView() {
  const { address, connected, connecting, executeTransaction, transactionStatus } = useWallet();
  const { setVisible } = useWalletModal();
  const [initLoading, setInitLoading] = useState(false);
  const [initMessage, setInitMessage] = useState<string | null>(null);
  const [initTxId, setInitTxId] = useState<string | null>(null);
  const [initUsdcLoading, setInitUsdcLoading] = useState(false);
  const [initUsdcMessage, setInitUsdcMessage] = useState<string | null>(null);
  const [initUsdcTxId, setInitUsdcTxId] = useState<string | null>(null);
  const [adminAsset, setAdminAsset] = useState<'0field' | '1field' | '2field'>('0field');
  const [adminPriceInput, setAdminPriceInput] = useState('');
  const [adminSubmitting, setAdminSubmitting] = useState(false);
  const [adminStatus, setAdminStatus] = useState('');
  const [adminTxId, setAdminTxId] = useState<string | null>(null);
  const [accrueSubmitting, setAccrueSubmitting] = useState(false);
  const [accrueStatus, setAccrueStatus] = useState('');
  const [accrueTxId, setAccrueTxId] = useState<string | null>(null);
  const [paramsSubmitting, setParamsSubmitting] = useState(false);
  const [paramsStatus, setParamsStatus] = useState('');
  const [paramsTxId, setParamsTxId] = useState<string | null>(null);
  const [ltvInput, setLtvInput] = useState('7500');
  const [liqThresholdInput, setLiqThresholdInput] = useState('8000');
  const [liqBonusInput, setLiqBonusInput] = useState('500');
  const [baseRateInput, setBaseRateInput] = useState('200');
  const [slopeRateInput, setSlopeRateInput] = useState('1200');
  const [reserveFactorInput, setReserveFactorInput] = useState('1000');
  const [paramsLoading, setParamsLoading] = useState(false);
  const [paramsLoaded, setParamsLoaded] = useState(false);
  const [paramsFetchError, setParamsFetchError] = useState('');
  const [flashSubmitting, setFlashSubmitting] = useState(false);
  const [flashStatus, setFlashStatus] = useState('');
  const [flashTxId, setFlashTxId] = useState<string | null>(null);
  const [flashEnabled, setFlashEnabled] = useState(true);
  const [flashAsset, setFlashAsset] = useState<'0field' | '1field' | '2field'>('0field');
  const [flashPremiumInput, setFlashPremiumInput] = useState('5');
  const [flashMaxAmountInput, setFlashMaxAmountInput] = useState('');
  const [strategySubmitting, setStrategySubmitting] = useState(false);
  const [strategyStatus, setStrategyStatus] = useState('');
  const [strategyTxId, setStrategyTxId] = useState<string | null>(null);
  const [strategyIdInput, setStrategyIdInput] = useState('');
  const [strategyAllowed, setStrategyAllowed] = useState(true);
  const [feesSubmitting, setFeesSubmitting] = useState(false);
  const [feesStatus, setFeesStatus] = useState('');
  const [feesTxId, setFeesTxId] = useState<string | null>(null);
  const [feesAmountInput, setFeesAmountInput] = useState('');
  const [feesMax, setFeesMax] = useState<string>('');
  const [feesMaxByAsset, setFeesMaxByAsset] = useState<{ a: string; u: string; d: string }>({ a: '0', u: '0', d: '0' });
  const [feesMaxLoading, setFeesMaxLoading] = useState(false);
  const [feesMaxError, setFeesMaxError] = useState('');

  const envAdmin = (process.env.NEXT_PUBLIC_LENDING_ADMIN_ADDRESS || '').trim();
  const fallbackAdmin = 'aleo1rhgdu77hgyqd3xjj8ucu3jj9r2krwz6mnzyd80gncr5fxcwlh5rsvzp9px';
  const normalizedAdmin = (envAdmin || ADMIN_ADDRESS || fallbackAdmin).toLowerCase();
  const normalizedAddress = (address || '').trim().toLowerCase();

  const isAdmin =
    typeof address === 'string' &&
    normalizedAdmin.length > 0 &&
    normalizedAddress === normalizedAdmin;
  const hasSeparateUsdcPool = USDC_LENDING_POOL_PROGRAM_ID !== LENDING_POOL_PROGRAM_ID;

  const handleInitialize = async () => {
    if (!executeTransaction || !isAdmin) return;
    setInitLoading(true);
    setInitMessage(null);
    setInitTxId(null);
    try {
      const txId = await lendingInitializeAleoPool(executeTransaction);
      if (txId === '__CANCELLED__') {
        setInitMessage('Transaction cancelled.');
        return;
      }
      setInitTxId(txId);
      setInitMessage('Transaction submitted. Wait for confirmation.');
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Initialize failed';
      setInitMessage(msg);
    } finally {
      setInitLoading(false);
    }
  };
  
  const waitForFinalization = async (txId: string): Promise<'accepted' | 'rejected' | 'timeout'> => {
    const maxAttempts = 45;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      await new Promise((resolve) => setTimeout(resolve, 2000));
      if (!transactionStatus) continue;
      try {
        const statusResult = await transactionStatus(txId);
        const statusText =
          typeof statusResult === 'string'
            ? statusResult
            : (statusResult as { status?: string })?.status ?? '';
        const lower = statusText.toLowerCase();
        if (lower === 'finalized' || lower === 'accepted') return 'accepted';
        if (lower === 'rejected' || lower === 'failed' || lower === 'dropped') return 'rejected';
      } catch {
        // Keep polling.
      }
    }
    return 'timeout';
  };

  const submitAdminTx = async (
    functionName: string,
    inputs: string[],
    setSubmitting: (v: boolean) => void,
    setStatus: (v: string) => void,
    setTxId: (v: string | null) => void,
  ) => {
    if (!isAdmin) {
      setStatus('Only the configured admin wallet can call this function.');
      return;
    }
    if (!executeTransaction) {
      setStatus('Wallet not ready.');
      return;
    }
    setSubmitting(true);
    setTxId(null);
    setStatus(`Submitting ${functionName}...`);
    try {
      const tx = await executeTransaction({
        program: LENDING_POOL_PROGRAM_ID,
        function: functionName,
        inputs,
        fee: 0.2 * 1_000_000,
        privateFee: false,
      });
      const txId = tx?.transactionId as string | undefined;
      if (!txId) throw new Error('No transactionId returned.');
      setTxId(txId);
      setStatus(`Submitted (${txId.slice(0, 12)}...). Waiting for finalization...`);
      const result = await waitForFinalization(txId);
      if (result === 'accepted') setStatus(`${functionName} finalized.`);
      else if (result === 'rejected') setStatus('Transaction rejected.');
      else setStatus('Transaction not finalized in time. Check explorer.');
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : `${functionName} failed`;
      setStatus(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleSetAssetPrice = async () => {
    if (!isAdmin) {
      setAdminStatus('Only the configured admin wallet can call this function.');
      return;
    }
    if (!executeTransaction) {
      setAdminStatus('Wallet not ready.');
      return;
    }
    const human = Number(adminPriceInput);
    if (!Number.isFinite(human) || human <= 0) {
      setAdminStatus('Enter a valid positive price.');
      return;
    }
    const priceScaled = BigInt(Math.round(human * 1_000_000));
    if (priceScaled <= 0n) {
      setAdminStatus('Scaled price must be > 0.');
      return;
    }

    setAdminSubmitting(true);
    setAdminTxId(null);
    setAdminStatus('Submitting set_asset_price...');
    try {
      const tx = await executeTransaction({
        program: LENDING_POOL_PROGRAM_ID,
        function: 'set_asset_price',
        inputs: [adminAsset, `${priceScaled.toString()}u64`],
        fee: 0.2 * 1_000_000,
        privateFee: false,
      });
      const txId = tx?.transactionId as string | undefined;
      if (!txId) throw new Error('No transactionId returned.');
      setAdminTxId(txId);
      setAdminStatus(`Submitted (${txId.slice(0, 12)}...). Waiting for finalization...`);
      const result = await waitForFinalization(txId);
      if (result === 'accepted') setAdminStatus('Price updated on-chain.');
      else if (result === 'rejected') setAdminStatus('Transaction rejected.');
      else setAdminStatus('Transaction not finalized in time. Check explorer.');
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'set_asset_price failed';
      setAdminStatus(msg);
    } finally {
      setAdminSubmitting(false);
    }
  };

  const handleAccrueInterest = async () => {
    await submitAdminTx(
      'accrue_interest',
      [adminAsset],
      setAccrueSubmitting,
      setAccrueStatus,
      setAccrueTxId,
    );
  };

  const toU64Input = (raw: string): string | null => {
    const n = Number(raw);
    if (!Number.isFinite(n) || n < 0) return null;
    if (!Number.isInteger(n)) return null;
    return `${n}u64`;
  };

  const handleSetAssetParams = async () => {
    const ltv = toU64Input(ltvInput);
    const liqThreshold = toU64Input(liqThresholdInput);
    const liqBonus = toU64Input(liqBonusInput);
    const baseRate = toU64Input(baseRateInput);
    const slopeRate = toU64Input(slopeRateInput);
    const reserveFactor = toU64Input(reserveFactorInput);
    if (!ltv || !liqThreshold || !liqBonus || !baseRate || !slopeRate || !reserveFactor) {
      setParamsStatus('Enter valid integer values for all params.');
      return;
    }
    await submitAdminTx(
      'set_asset_params',
      [adminAsset, ltv, liqThreshold, liqBonus, baseRate, slopeRate, reserveFactor],
      setParamsSubmitting,
      setParamsStatus,
      setParamsTxId,
    );
  };

  useEffect(() => {
    let mounted = true;
    const loadCurrentParams = async () => {
      setParamsLoading(true);
      setParamsFetchError('');
      try {
        const current = await getAssetAdminParams(adminAsset, LENDING_POOL_PROGRAM_ID);
        if (!mounted) return;
        if (current.ltv != null) setLtvInput(current.ltv.toString());
        if (current.liqThreshold != null) setLiqThresholdInput(current.liqThreshold.toString());
        if (current.liqBonus != null) setLiqBonusInput(current.liqBonus.toString());
        if (current.baseRate != null) setBaseRateInput(current.baseRate.toString());
        if (current.slopeRate != null) setSlopeRateInput(current.slopeRate.toString());
        if (current.reserveFactor != null) setReserveFactorInput(current.reserveFactor.toString());
        setParamsLoaded(true);
      } catch {
        if (!mounted) return;
        setParamsFetchError('Could not read current on-chain params for this asset.');
      } finally {
        if (mounted) setParamsLoading(false);
      }
    };
    void loadCurrentParams();
    return () => {
      mounted = false;
    };
  }, [adminAsset]);

  useEffect(() => {
    let mounted = true;
    const loadProtocolFeesMax = async () => {
      setFeesMaxLoading(true);
      setFeesMaxError('');
      try {
        const [maxA, maxU, maxD] = await Promise.all([
          getProtocolFeesForAsset('0field', LENDING_POOL_PROGRAM_ID),
          getProtocolFeesForAsset('1field', LENDING_POOL_PROGRAM_ID),
          getProtocolFeesForAsset('2field', LENDING_POOL_PROGRAM_ID),
        ]);
        if (!mounted) return;
        setFeesMaxByAsset({
          a: (maxA ?? 0n).toString(),
          u: (maxU ?? 0n).toString(),
          d: (maxD ?? 0n).toString(),
        });
        const selected = adminAsset === '0field' ? maxA : adminAsset === '1field' ? maxU : maxD;
        setFeesMax((selected ?? 0n).toString());
      } catch {
        if (!mounted) return;
        setFeesMaxError('Could not read current protocol fees max.');
      } finally {
        if (mounted) setFeesMaxLoading(false);
      }
    };
    void loadProtocolFeesMax();
    return () => {
      mounted = false;
    };
  }, [adminAsset, feesTxId]);

  const handleSetFlashParams = async () => {
    const premium = toU64Input(flashPremiumInput);
    const maxAmount = toU64Input(flashMaxAmountInput);
    if (!premium || !maxAmount) {
      setFlashStatus('Enter valid integer values for premium and max amount.');
      return;
    }
    await submitAdminTx(
      'set_flash_params',
      [flashAsset, flashEnabled ? 'true' : 'false', premium, maxAmount],
      setFlashSubmitting,
      setFlashStatus,
      setFlashTxId,
    );
  };

  const handleSetFlashStrategyAllowed = async () => {
    const strategyField = strategyIdInput.trim();
    if (!strategyField.endsWith('field')) {
      setStrategyStatus('Strategy ID must be a field literal (example: 123field).');
      return;
    }
    await submitAdminTx(
      'set_flash_strategy_allowed',
      [strategyField, strategyAllowed ? 'true' : 'false'],
      setStrategySubmitting,
      setStrategyStatus,
      setStrategyTxId,
    );
  };

  const handleWithdrawFees = async () => {
    const amount = toU64Input(feesAmountInput);
    if (!amount || amount === '0u64') {
      setFeesStatus('Enter a valid fee withdrawal amount > 0.');
      return;
    }
    await submitAdminTx(
      'withdraw_fees',
      [adminAsset, amount],
      setFeesSubmitting,
      setFeesStatus,
      setFeesTxId,
    );
  };

  const handleInitializeUsdc = async () => {
    if (!executeTransaction || !isAdmin) return;
    setInitUsdcLoading(true);
    setInitUsdcMessage(null);
    setInitUsdcTxId(null);
    try {
      const txId = await lendingInitializeUsdcPool(executeTransaction);
      if (txId === '__CANCELLED__') {
        setInitUsdcMessage('Transaction cancelled.');
        return;
      }
      setInitUsdcTxId(txId);
      setInitUsdcMessage('Transaction submitted. Wait for confirmation.');
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Initialize failed';
      setInitUsdcMessage(msg);
    } finally {
      setInitUsdcLoading(false);
    }
  };

  if (!connected) {
    return (
      <div className="max-w-3xl mx-auto w-full px-4 sm:px-8 pb-20">
        <div
          className="rounded-[28px] px-8 py-10 text-center"
          style={{ background: 'linear-gradient(140deg, rgba(15,23,42,0.65), rgba(2,6,23,0.8))', border: '1px solid rgba(148,163,184,0.18)' }}
        >
          <h2 className="text-2xl font-semibold text-white mb-2">Admin Panel</h2>
          <p className="text-slate-400 mb-6">Connect the configured admin wallet to access admin actions.</p>
          <button
            type="button"
            onClick={() => setVisible(true)}
            disabled={connecting}
            className="px-6 py-2.5 rounded-xl text-sm font-semibold text-white transition-all bg-[#0B1221] border border-white/10 hover:border-white/20 hover:bg-[#111827] disabled:opacity-60"
          >
            {connecting ? 'Connecting...' : 'Connect Wallet'}
          </button>
        </div>
      </div>
    );
  }

  if (!normalizedAdmin || normalizedAdmin.length === 0) {
    return (
      <div className="max-w-xl mx-auto w-full px-4 sm:px-8 pb-20">
        <div className="rounded-2xl bg-base-200/80 border border-base-300 p-6">
          <h2 className="text-xl font-bold text-base-content mb-2">Admin</h2>
          <p className="text-base-content/70 text-sm">
            Admin is not configured. Set <span className="font-mono text-xs">NEXT_PUBLIC_LENDING_ADMIN_ADDRESS</span> in .env to enable.
          </p>
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="max-w-3xl mx-auto w-full px-4 sm:px-8 pb-20">
        <div
          className="rounded-[28px] px-8 py-10"
          style={{ background: 'linear-gradient(140deg, rgba(15,23,42,0.65), rgba(2,6,23,0.8))', border: '1px solid rgba(148,163,184,0.18)' }}
        >
          <h2 className="text-2xl font-semibold text-white mb-2">Admin Panel</h2>
          <p className="text-slate-400">
            This page is available only for the configured admin wallet.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto w-full px-4 sm:px-8 space-y-6 pb-20">
      <div
        className="rounded-[28px] px-8 py-8"
        style={{ background: 'linear-gradient(140deg, rgba(15,23,42,0.65), rgba(2,6,23,0.8))', border: '1px solid rgba(148,163,184,0.18)' }}
      >
        <h2 className="text-2xl font-semibold text-white mb-1">Admin Panel</h2>
        <p className="text-slate-400 text-sm">Admin-only actions are available for this wallet.</p>
      </div>

      <div className={`grid grid-cols-1 ${hasSeparateUsdcPool ? 'lg:grid-cols-2' : ''} gap-6`}>
        <div
          className="rounded-[28px] p-6"
          style={{ background: 'linear-gradient(140deg, rgba(15,23,42,0.65), rgba(2,6,23,0.8))', border: '1px solid rgba(148,163,184,0.18)' }}
        >
          <div className="font-medium text-white mb-1">
            {hasSeparateUsdcPool ? 'Initialize ALEO pool' : 'Initialize Lending pool'}
          </div>
          <p className="text-sm text-slate-400 mb-3">
            {hasSeparateUsdcPool
              ? 'One-time setup for the ALEO lending pool.'
              : 'One-time setup for the lending pool (ALEO + USDC use the same program).'}
          </p>
          <p className="text-xs text-slate-500 mb-3 font-mono break-all">{LENDING_POOL_PROGRAM_ID}</p>
          <button
            type="button"
            className="px-4 py-2 rounded-xl font-semibold disabled:opacity-50"
            style={{ background: 'linear-gradient(to right, #22d3ee, #6366f1)', color: '#030712' }}
            onClick={handleInitialize}
            disabled={initLoading}
          >
            {initLoading ? 'Submitting...' : hasSeparateUsdcPool ? 'Initialize ALEO pool' : 'Initialize lending pool'}
          </button>
          {initMessage && <p className="mt-3 text-sm text-slate-300">{initMessage}</p>}
          {initTxId && initTxId !== '__CANCELLED__' && (
            <p className="mt-1 text-xs text-slate-500 font-mono break-all">{initTxId}</p>
          )}
        </div>

        {hasSeparateUsdcPool && (
          <div
            className="rounded-[28px] p-6"
            style={{ background: 'linear-gradient(140deg, rgba(15,23,42,0.65), rgba(2,6,23,0.8))', border: '1px solid rgba(148,163,184,0.18)' }}
          >
            <div className="font-medium text-white mb-1">Initialize USDC pool</div>
            <p className="text-sm text-slate-400 mb-3">
              One-time setup for the USDC lending pool.
            </p>
            <p className="text-xs text-slate-500 mb-3 font-mono break-all">{USDC_LENDING_POOL_PROGRAM_ID}</p>
            <button
              type="button"
              className="px-4 py-2 rounded-xl font-semibold disabled:opacity-50"
              style={{ background: 'linear-gradient(to right, #22d3ee, #6366f1)', color: '#030712' }}
              onClick={handleInitializeUsdc}
              disabled={initUsdcLoading}
            >
              {initUsdcLoading ? 'Submitting...' : 'Initialize USDC pool'}
            </button>
            {initUsdcMessage && <p className="mt-3 text-sm text-slate-300">{initUsdcMessage}</p>}
            {initUsdcTxId && initUsdcTxId !== '__CANCELLED__' && (
              <p className="mt-1 text-xs text-slate-500 font-mono break-all">{initUsdcTxId}</p>
            )}
          </div>
        )}
      </div>

      <div
        className="rounded-[28px] p-6"
        style={{ background: 'linear-gradient(140deg, rgba(15,23,42,0.65), rgba(2,6,23,0.8))', border: '1px solid rgba(148,163,184,0.18)' }}
      >
        <h3 className="text-lg font-semibold text-white mb-4">Update Asset Price</h3>
        <div className="grid grid-cols-1 md:grid-cols-[1fr_1fr_auto] gap-3">
          <select
            value={adminAsset}
            onChange={(e) => setAdminAsset(e.target.value as '0field' | '1field' | '2field')}
            className="rounded-xl px-3 py-2 bg-transparent text-slate-200 border border-white/10"
          >
            <option value="0field">ALEO (0field)</option>
            <option value="1field">USDCx (1field)</option>
            <option value="2field">USAD (2field)</option>
          </select>
          <input
            type="number"
            step="any"
            min="0"
            value={adminPriceInput}
            onChange={(e) => setAdminPriceInput(e.target.value)}
            placeholder="Price in USD (e.g. 0.044563)"
            className="rounded-xl px-3 py-2 bg-transparent text-slate-100 border border-white/10"
          />
          <button
            type="button"
            onClick={() => void handleSetAssetPrice()}
            disabled={adminSubmitting}
            className="px-4 py-2 rounded-xl font-semibold disabled:opacity-50"
            style={{ background: 'linear-gradient(to right, #22d3ee, #6366f1)', color: '#030712' }}
          >
            {adminSubmitting ? 'Submitting...' : 'Set Asset Price'}
          </button>
        </div>
        <p className="text-xs text-slate-500 mt-2">On-chain input uses `price * 1e6` (`u64`).</p>
        {adminStatus && <p className="text-sm text-slate-300 mt-3">{adminStatus}</p>}
        {adminTxId && (
          <a
            href={getProvableExplorerTxUrl(adminTxId)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block text-cyan-400 text-sm mt-2 hover:text-cyan-300"
          >
            View tx in explorer ↗
          </a>
        )}
      </div>

      <div
        className="rounded-[28px] p-6"
        style={{ background: 'linear-gradient(140deg, rgba(15,23,42,0.65), rgba(2,6,23,0.8))', border: '1px solid rgba(148,163,184,0.18)' }}
      >
        <h3 className="text-lg font-semibold text-white mb-4">Accrue Interest</h3>
        <p className="text-sm text-slate-400 mb-3">
          Calls `accrue_interest` for selected asset ID to update pool indices and rates.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-3">
          <select
            value={adminAsset}
            onChange={(e) => setAdminAsset(e.target.value as '0field' | '1field' | '2field')}
            className="rounded-xl px-3 py-2 bg-transparent text-slate-200 border border-white/10"
          >
            <option value="0field">ALEO (0field)</option>
            <option value="1field">USDCx (1field)</option>
            <option value="2field">USAD (2field)</option>
          </select>
          <button
            type="button"
            onClick={() => void handleAccrueInterest()}
            disabled={accrueSubmitting}
            className="px-4 py-2 rounded-xl font-semibold disabled:opacity-50"
            style={{ background: 'linear-gradient(to right, #22d3ee, #6366f1)', color: '#030712' }}
          >
            {accrueSubmitting ? 'Submitting...' : 'Accrue Interest'}
          </button>
        </div>
        {accrueStatus && <p className="text-sm text-slate-300 mt-3">{accrueStatus}</p>}
        {accrueTxId && (
          <a
            href={getProvableExplorerTxUrl(accrueTxId)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block text-cyan-400 text-sm mt-2 hover:text-cyan-300"
          >
            View tx in explorer ↗
          </a>
        )}
      </div>

      <div
        className="rounded-[28px] p-6"
        style={{ background: 'linear-gradient(140deg, rgba(15,23,42,0.65), rgba(2,6,23,0.8))', border: '1px solid rgba(148,163,184,0.18)' }}
      >
        <h3 className="text-lg font-semibold text-white mb-4">Set Asset Params</h3>
        <p className="text-sm text-slate-400 mb-4">
          Configure risk and rate model for selected asset. Values are loaded from current on-chain mappings.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <label className="text-slate-300 text-sm">
            Loan-to-Value (LTV, bps)
            <input value={ltvInput} onChange={(e) => setLtvInput(e.target.value)} placeholder="e.g. 7500" className="mt-1 w-full rounded-xl px-3 py-2 bg-transparent text-slate-100 border border-white/10" />
            <span className="text-xs text-slate-500">Max borrow % of collateral value (7500 = 75%).</span>
          </label>
          <label className="text-slate-300 text-sm">
            Liquidation Threshold (bps)
            <input value={liqThresholdInput} onChange={(e) => setLiqThresholdInput(e.target.value)} placeholder="e.g. 8000" className="mt-1 w-full rounded-xl px-3 py-2 bg-transparent text-slate-100 border border-white/10" />
            <span className="text-xs text-slate-500">Health-factor risk limit before liquidation eligibility. Example: 8000 = 80% threshold.</span>
          </label>
          <label className="text-slate-300 text-sm">
            Liquidation Bonus (bps)
            <input value={liqBonusInput} onChange={(e) => setLiqBonusInput(e.target.value)} placeholder="e.g. 500" className="mt-1 w-full rounded-xl px-3 py-2 bg-transparent text-slate-100 border border-white/10" />
            <span className="text-xs text-slate-500">Extra payout % to liquidator path (500 = 5%).</span>
          </label>
          <label className="text-slate-300 text-sm">
            Base Rate
            <input value={baseRateInput} onChange={(e) => setBaseRateInput(e.target.value)} placeholder="e.g. 200" className="mt-1 w-full rounded-xl px-3 py-2 bg-transparent text-slate-100 border border-white/10" />
            <span className="text-xs text-slate-500">Minimum borrow interest model parameter. Example: 200 means 2% base component in rate model units.</span>
          </label>
          <label className="text-slate-300 text-sm">
            Slope Rate
            <input value={slopeRateInput} onChange={(e) => setSlopeRateInput(e.target.value)} placeholder="e.g. 1200" className="mt-1 w-full rounded-xl px-3 py-2 bg-transparent text-slate-100 border border-white/10" />
            <span className="text-xs text-slate-500">Interest increases with utilization using this slope. Example: 1200 means 12% slope component in rate model units.</span>
          </label>
          <label className="text-slate-300 text-sm">
            Reserve Factor (scale = 10000)
            <input value={reserveFactorInput} onChange={(e) => setReserveFactorInput(e.target.value)} placeholder="e.g. 1000" className="mt-1 w-full rounded-xl px-3 py-2 bg-transparent text-slate-100 border border-white/10" />
            <span className="text-xs text-slate-500">Share of interest kept by protocol (1000 = 10%).</span>
          </label>
        </div>
        <div className="mt-3 text-xs text-slate-500">
          {paramsLoading
            ? 'Loading current on-chain values...'
            : paramsFetchError || (paramsLoaded ? 'Loaded current on-chain values into all fields for selected asset.' : '')}
        </div>
        <button
          type="button"
          onClick={() => void handleSetAssetParams()}
          disabled={paramsSubmitting}
          className="mt-3 px-4 py-2 rounded-xl font-semibold disabled:opacity-50"
          style={{ background: 'linear-gradient(to right, #22d3ee, #6366f1)', color: '#030712' }}
        >
          {paramsSubmitting ? 'Submitting...' : 'Set Asset Params'}
        </button>
        {paramsStatus && <p className="text-sm text-slate-300 mt-3">{paramsStatus}</p>}
        {paramsTxId && <a href={getProvableExplorerTxUrl(paramsTxId)} target="_blank" rel="noopener noreferrer" className="inline-block text-cyan-400 text-sm mt-2 hover:text-cyan-300">View tx in explorer ↗</a>}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div
          className="rounded-[28px] p-6"
          style={{ background: 'linear-gradient(140deg, rgba(15,23,42,0.65), rgba(2,6,23,0.8))', border: '1px solid rgba(148,163,184,0.18)' }}
        >
          <h3 className="text-lg font-semibold text-white mb-4">Set Flash Params</h3>
          <div className="grid grid-cols-1 gap-3">
            <select
              value={flashAsset}
              onChange={(e) => setFlashAsset(e.target.value as '0field' | '1field' | '2field')}
              className="rounded-xl px-3 py-2 bg-transparent text-slate-200 border border-white/10"
            >
              <option value="0field">ALEO (0field)</option>
              <option value="1field">USDCx (1field)</option>
              <option value="2field">USAD (2field)</option>
            </select>
            <select value={flashEnabled ? 'true' : 'false'} onChange={(e) => setFlashEnabled(e.target.value === 'true')} className="rounded-xl px-3 py-2 bg-transparent text-slate-200 border border-white/10">
              <option value="true">enabled: true</option>
              <option value="false">enabled: false</option>
            </select>
            <input value={flashPremiumInput} onChange={(e) => setFlashPremiumInput(e.target.value)} placeholder="premium_bps (u64)" className="rounded-xl px-3 py-2 bg-transparent text-slate-100 border border-white/10" />
            <input value={flashMaxAmountInput} onChange={(e) => setFlashMaxAmountInput(e.target.value)} placeholder="max_amount (u64 micro)" className="rounded-xl px-3 py-2 bg-transparent text-slate-100 border border-white/10" />
          </div>
          <button
            type="button"
            onClick={() => void handleSetFlashParams()}
            disabled={flashSubmitting}
            className="mt-3 px-4 py-2 rounded-xl font-semibold disabled:opacity-50"
            style={{ background: 'linear-gradient(to right, #22d3ee, #6366f1)', color: '#030712' }}
          >
            {flashSubmitting ? 'Submitting...' : 'Set Flash Params'}
          </button>
          {flashStatus && <p className="text-sm text-slate-300 mt-3">{flashStatus}</p>}
          {flashTxId && <a href={getProvableExplorerTxUrl(flashTxId)} target="_blank" rel="noopener noreferrer" className="inline-block text-cyan-400 text-sm mt-2 hover:text-cyan-300">View tx in explorer ↗</a>}
        </div>

        <div
          className="rounded-[28px] p-6"
          style={{ background: 'linear-gradient(140deg, rgba(15,23,42,0.65), rgba(2,6,23,0.8))', border: '1px solid rgba(148,163,184,0.18)' }}
        >
          <h3 className="text-lg font-semibold text-white mb-4">Set Flash Strategy Allowed</h3>
          <div className="grid grid-cols-1 gap-3">
            <input value={strategyIdInput} onChange={(e) => setStrategyIdInput(e.target.value)} placeholder="strategy_id (field)" className="rounded-xl px-3 py-2 bg-transparent text-slate-100 border border-white/10" />
            <select value={strategyAllowed ? 'true' : 'false'} onChange={(e) => setStrategyAllowed(e.target.value === 'true')} className="rounded-xl px-3 py-2 bg-transparent text-slate-200 border border-white/10">
              <option value="true">allowed: true</option>
              <option value="false">allowed: false</option>
            </select>
          </div>
          <button
            type="button"
            onClick={() => void handleSetFlashStrategyAllowed()}
            disabled={strategySubmitting}
            className="mt-3 px-4 py-2 rounded-xl font-semibold disabled:opacity-50"
            style={{ background: 'linear-gradient(to right, #22d3ee, #6366f1)', color: '#030712' }}
          >
            {strategySubmitting ? 'Submitting...' : 'Set Flash Strategy'}
          </button>
          {strategyStatus && <p className="text-sm text-slate-300 mt-3">{strategyStatus}</p>}
          {strategyTxId && <a href={getProvableExplorerTxUrl(strategyTxId)} target="_blank" rel="noopener noreferrer" className="inline-block text-cyan-400 text-sm mt-2 hover:text-cyan-300">View tx in explorer ↗</a>}
        </div>
      </div>

      <div
        className="rounded-[28px] p-6"
        style={{ background: 'linear-gradient(140deg, rgba(15,23,42,0.65), rgba(2,6,23,0.8))', border: '1px solid rgba(148,163,184,0.18)' }}
      >
        <h3 className="text-lg font-semibold text-white mb-4">Withdraw Protocol Fees</h3>
        <p className="text-xs text-slate-500 mb-1">
          Max withdrawable now (selected asset): {feesMaxLoading ? 'loading...' : `${feesMax || '0'} (u64 micro)`}
        </p>
        <p className="text-xs text-slate-500 mb-3">
          ALEO: {feesMaxByAsset.a} | USDCx: {feesMaxByAsset.u} | USAD: {feesMaxByAsset.d}
        </p>
        <div className="grid grid-cols-1 md:grid-cols-[1fr_1fr_auto] gap-3">
          <select
            value={adminAsset}
            onChange={(e) => setAdminAsset(e.target.value as '0field' | '1field' | '2field')}
            className="rounded-xl px-3 py-2 bg-transparent text-slate-200 border border-white/10"
          >
            <option value="0field">ALEO (0field)</option>
            <option value="1field">USDCx (1field)</option>
            <option value="2field">USAD (2field)</option>
          </select>
          <input value={feesAmountInput} onChange={(e) => setFeesAmountInput(e.target.value)} placeholder="amount (u64 micro)" className="rounded-xl px-3 py-2 bg-transparent text-slate-100 border border-white/10" />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setFeesAmountInput(feesMax || '0')}
              disabled={feesSubmitting || feesMaxLoading}
              className="px-4 py-2 rounded-xl font-semibold disabled:opacity-50 border border-white/10 text-slate-200"
            >
              Max
            </button>
            <button
              type="button"
              onClick={() => void handleWithdrawFees()}
              disabled={feesSubmitting}
              className="px-4 py-2 rounded-xl font-semibold disabled:opacity-50"
              style={{ background: 'linear-gradient(to right, #22d3ee, #6366f1)', color: '#030712' }}
            >
              {feesSubmitting ? 'Submitting...' : 'Withdraw Fees'}
            </button>
          </div>
        </div>
        {feesMaxError && <p className="text-sm text-amber-300 mt-2">{feesMaxError}</p>}
        {feesStatus && <p className="text-sm text-slate-300 mt-3">{feesStatus}</p>}
        {feesTxId && <a href={getProvableExplorerTxUrl(feesTxId)} target="_blank" rel="noopener noreferrer" className="inline-block text-cyan-400 text-sm mt-2 hover:text-cyan-300">View tx in explorer ↗</a>}
      </div>
    </div>
  );
}
