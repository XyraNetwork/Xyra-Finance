import 'dotenv/config';
import {
  Account,
  ProgramManager,
  AleoKeyProvider,
  NetworkRecordProvider,
  AleoNetworkClient,
} from '@provablehq/sdk';
import { logTestnetStatus } from './checkTestnet.js';

/** Matches `PRICE_SCALE` in program `main.leo` (1e6 micro-USD per $1). */
const PRICE_SCALE = 1_000_000;

/**
 * When set, signer must match (same rule as `processAccrueScheduler.js`).
 * When unset, we only require a resolvable admin/vault key — so v30+ deploys are not forced to match an old baked-in address.
 */
function lendingPoolAdminAddressForSignerCheck() {
  return (process.env.LENDING_POOL_ADMIN_ADDRESS || '').trim();
}

function lendingPoolProgramId() {
  return (process.env.LENDING_POOL_PROGRAM_ID || 'xyra_lending_v6.aleo').trim();
}

export function resolveAdminPrivateKey() {
  const explicit = (process.env.POOL_ADMIN_PRIVATE_KEY || '').trim();
  if (explicit) return explicit;

  const vaultPk = (process.env.VAULT_PRIVATE_KEY || '').trim();
  const vaultAddr = (process.env.VAULT_ADDRESS || '').trim();
  const adminAddr = lendingPoolAdminAddressForSignerCheck();
  if (vaultPk && vaultAddr && adminAddr && vaultAddr === adminAddr) {
    return vaultPk;
  }
  return '';
}

/** True if `runSetAssetPriceAleo` can resolve a signing key (admin or vault-when-admin). */
export function hasAdminKeyForPriceUpdate() {
  return !!resolveAdminPrivateKey();
}

/**
 * Broadcast `set_asset_price` on the lending pool program.
 * On-chain, only `ADMIN_ADDRESS` may call this (see `main.leo`); the vault address is usually different.
 *
 * @param {object} opts
 * @param {number} opts.usdSpot - Spot USD price for 1 ALEO (e.g. from CoinGecko).
 * @param {string} [opts.assetIdField] - Default `0field` (ASSET_ALEO).
 */
export async function runSetAssetPriceAleo({ usdSpot, assetIdField = '0field' }) {
  await logTestnetStatus();

  const adminPk = resolveAdminPrivateKey();
  if (!adminPk) {
    throw new Error(
      'Set POOL_ADMIN_PRIVATE_KEY to the admin wallet, or set VAULT_ADDRESS equal to LENDING_POOL_ADMIN_ADDRESS and use VAULT_PRIVATE_KEY.',
    );
  }

  const ALEO_RPC_URL = process.env.ALEO_RPC_URL || 'https://api.explorer.provable.com/v1';
  const programName = lendingPoolProgramId();
  const priorityFee = Number(process.env.ALEO_PRICE_TX_FEE_CREDITS || '0.2');

  if (!Number.isFinite(usdSpot) || usdSpot <= 0) {
    throw new Error(`Invalid usdSpot: ${usdSpot}`);
  }

  const priceU64 = Math.round(usdSpot * PRICE_SCALE);
  if (!Number.isFinite(priceU64) || priceU64 < 1) {
    throw new Error(`Price rounds to invalid u64: usdSpot=${usdSpot}`);
  }
  if (priceU64 > Number.MAX_SAFE_INTEGER) {
    throw new Error('Price u64 overflow');
  }

  const account = new Account({ privateKey: adminPk });
  const signer = account.address().to_string();
  const expectedAdmin = lendingPoolAdminAddressForSignerCheck();
  if (expectedAdmin && signer !== expectedAdmin) {
    throw new Error(
      `Signer ${signer} must match LENDING_POOL_ADMIN_ADDRESS ${expectedAdmin}. Wrong POOL_ADMIN_PRIVATE_KEY / vault key.`,
    );
  }

  const networkClient = new AleoNetworkClient(ALEO_RPC_URL);
  networkClient.setAccount(account);
  const keyProvider = new AleoKeyProvider();
  keyProvider.useCache(true);
  const recordProvider = new NetworkRecordProvider(account, networkClient);
  const programManager = new ProgramManager(ALEO_RPC_URL, keyProvider, recordProvider);
  programManager.setAccount(account);

  const inputs = [assetIdField, `${priceU64}u64`];

  console.log(
    `[aleo-price] submitting ${programName}/set_asset_price inputs=${assetIdField} ${priceU64}u64 (~$${(priceU64 / PRICE_SCALE).toFixed(6)} USD) signer=${signer}`,
  );

  const txId = await programManager.execute({
    programName,
    functionName: 'set_asset_price',
    priorityFee,
    privateFee: false,
    inputs,
  });

  console.log(`[aleo-price] set_asset_price tx: ${txId}`);
  return txId;
}
