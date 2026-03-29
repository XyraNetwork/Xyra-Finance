/**
 * Development-only helpers to inspect cross-collateral borrow limits against live chain state.
 * No program redeploy: reads mappings via the same RPC path as the app.
 *
 * In the browser console (localhost, after `npm run dev`):
 *
 *   await window.__xyraBorrowDebug.diagnoseBorrow('aleo1...', 'aleo', 1_000_000n)
 *
 * Full mapping probe (keys + user_scaled_* + pool totals + caps):
 *
 *   await window.__xyraBorrowDebug.probeMyMappings('aleo1...')
 *
 * `@/…` imports do not work in the raw console — use `window.__xyraBorrowDebug` only.
 *
 * **HMR:** Helpers use a fresh `import('@/components/aleo/rpc')` each call so wasm/RPC does not
 * run from a disposed module after hot reload. If you still see odd errors, hard-refresh the page.
 */

import { BOUNTY_PROGRAM_ID } from '@/types';

/** Fresh module graph after HMR — avoids "disposed module" + @provablehq/wasm warnings. */
async function loadRpc() {
  return import('@/components/aleo/rpc');
}

export type XyraBorrowDebug = {
  /** Same as `NEXT_PUBLIC_LENDING_POOL_PROGRAM_ID` / `BOUNTY_PROGRAM_ID` when env matches. */
  programId: string;
  LENDING_POOL_PROGRAM_ID: string;
  computeUserKeyFieldFromAddress: (address: string) => ReturnType<
    Awaited<ReturnType<typeof loadRpc>>['computeUserKeyFieldFromAddress']
  >;
  computeLendingPositionMappingKey: (
    address: string,
    assetIdField: string,
  ) => ReturnType<Awaited<ReturnType<typeof loadRpc>>['computeLendingPositionMappingKey']>;
  getCrossCollateralBorrowCapsFromChain: (
    programId: string,
    address: string,
  ) => ReturnType<Awaited<ReturnType<typeof loadRpc>>['getCrossCollateralBorrowCapsFromChain']>;
  getAleoPoolUserEffectivePosition: (
    programId: string,
    address: string,
    assetIdField?: string,
  ) => ReturnType<Awaited<ReturnType<typeof loadRpc>>['getAleoPoolUserEffectivePosition']>;
  getMappingValueDebug: (
    programId: string,
    mappingName: string,
    key: string,
  ) => ReturnType<Awaited<ReturnType<typeof loadRpc>>['getMappingValueDebug']>;
  probeLendingPositionMappings: (
    programId: string,
    address: string,
  ) => ReturnType<Awaited<ReturnType<typeof loadRpc>>['probeLendingPositionMappings']>;
  probeUserKeyVariantsForAleoSupply: (
    programId: string,
    address: string,
  ) => ReturnType<Awaited<ReturnType<typeof loadRpc>>['probeUserKeyVariantsForAleoSupply']>;
  diagnoseBorrow: (
    walletAddress: string,
    borrowAsset: 'aleo' | 'usdcx' | 'usad',
    borrowAmountMicro: bigint,
  ) => Promise<void>;
  probeMyMappings: (walletAddress: string) => ReturnType<
    Awaited<ReturnType<typeof loadRpc>>['probeLendingPositionMappings']
  >;
};

declare global {
  interface Window {
    __xyraBorrowDebug?: XyraBorrowDebug;
  }
}

export function installDevBorrowDebug(): void {
  if (process.env.NODE_ENV !== 'development' || typeof window === 'undefined') return;

  const programId = BOUNTY_PROGRAM_ID;

  const diagnoseBorrow = async (
    walletAddress: string,
    borrowAsset: 'aleo' | 'usdcx' | 'usad',
    borrowAmountMicro: bigint,
  ) => {
    const m = await loadRpc();
    const caps = await m.getCrossCollateralBorrowCapsFromChain(programId, walletAddress);
    const field =
      borrowAsset === 'aleo' ? '0field' : borrowAsset === 'usdcx' ? '1field' : '2field';
    const pos = await m.getAleoPoolUserEffectivePosition(programId, walletAddress, field);

    /* eslint-disable no-console */
    console.groupCollapsed('[xyra] borrow diagnose', programId, walletAddress);
    if (!caps) {
      console.warn('getCrossCollateralBorrowCapsFromChain returned null (keys or RPC issue).');
    } else {
      console.table({
        totalCollateralUsd_micro: caps.totalCollateralUsd.toString(),
        totalDebtUsd_micro: caps.totalDebtUsd.toString(),
        headroomUsd_micro: caps.headroomUsd.toString(),
        maxBorrow_micro_aleo: caps.maxBorrowMicroAleo.toString(),
        maxBorrow_micro_usdcx: caps.maxBorrowMicroUsdcx.toString(),
        maxBorrow_micro_usad: caps.maxBorrowMicroUsad.toString(),
      });
    }
    const [pkA, pkU, pkD] = await Promise.all([
      m.computeLendingPositionMappingKey(walletAddress, '0field'),
      m.computeLendingPositionMappingKey(walletAddress, '1field'),
      m.computeLendingPositionMappingKey(walletAddress, '2field'),
    ]);
    console.log('mapping keys', { aleo: pkA, usdcx: pkU, usad: pkD });
    console.log('effective position (borrow asset)', field, pos);

    const maxFor =
      borrowAsset === 'aleo'
        ? caps?.maxBorrowMicroAleo
        : borrowAsset === 'usdcx'
          ? caps?.maxBorrowMicroUsdcx
          : caps?.maxBorrowMicroUsad;
    const ok = maxFor != null && borrowAmountMicro <= maxFor;
    console.log('requested borrow micro', borrowAmountMicro.toString());
    console.log('chain max borrowed micro (same asset)', maxFor?.toString() ?? 'n/a');
    console.log('within chain-derived max?', ok);
    if (!ok) {
      console.warn(
        'Amount is above computed max or caps missing. finalize_borrow assert will reject if on-chain state matches.',
      );
    }
    console.groupEnd();
    /* eslint-enable no-console */
  };

  window.__xyraBorrowDebug = {
    programId,
    LENDING_POOL_PROGRAM_ID: programId,
    computeUserKeyFieldFromAddress: async (address) =>
      (await loadRpc()).computeUserKeyFieldFromAddress(address),
    computeLendingPositionMappingKey: async (address, assetIdField) =>
      (await loadRpc()).computeLendingPositionMappingKey(address, assetIdField),
    getCrossCollateralBorrowCapsFromChain: async (pid, address) =>
      (await loadRpc()).getCrossCollateralBorrowCapsFromChain(pid, address),
    getAleoPoolUserEffectivePosition: async (pid, address, assetIdField) =>
      (await loadRpc()).getAleoPoolUserEffectivePosition(pid, address, assetIdField),
    getMappingValueDebug: async (pid, mappingName, key) =>
      (await loadRpc()).getMappingValueDebug(pid, mappingName, key),
    probeLendingPositionMappings: async (pid, address) =>
      (await loadRpc()).probeLendingPositionMappings(pid, address),
    probeUserKeyVariantsForAleoSupply: async (pid, address) =>
      (await loadRpc()).probeUserKeyVariantsForAleoSupply(pid, address),
    diagnoseBorrow,
    probeMyMappings: async (walletAddress: string) => {
      const m = await loadRpc();
      return m.probeLendingPositionMappings(m.LENDING_POOL_PROGRAM_ID, walletAddress);
    },
  };

  // eslint-disable-next-line no-console
  console.info(
    '[xyra] Mapping / borrow debug: `await window.__xyraBorrowDebug.probeMyMappings("aleo1…")` — `@/` imports do not work in DevTools.',
  );
}
