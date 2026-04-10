import 'dotenv/config';
import {
  Account,
  ProgramManager,
  AleoKeyProvider,
  NetworkRecordProvider,
  AleoNetworkClient,
} from '@provablehq/sdk';
import { logTestnetStatus } from './checkTestnet.js';

const ALEO_RPC_URL = process.env.ALEO_RPC_URL || 'https://testnetbeta.aleorpc.com';
const FLASH_TX_FEE_CREDITS = Number(process.env.FLASH_TX_FEE_CREDITS || '0.2');
const LENDING_POOL_PROGRAM_ID = (process.env.LENDING_POOL_PROGRAM_ID || 'xyra_lending_v28.aleo').trim();
const LENDING_POOL_ADMIN_ADDRESS = (process.env.LENDING_POOL_ADMIN_ADDRESS || '').trim();
const POOL_ADMIN_PRIVATE_KEY = (process.env.POOL_ADMIN_PRIVATE_KEY || '').trim();
const STRATEGY_PRIVATE_KEY = (process.env.STRATEGY_PRIVATE_KEY || process.env.VAULT_PRIVATE_KEY || '').trim();

const ASSET_FIELDS = new Set(['0field', '1field', '2field']);

function validateAssetField(assetIdField) {
  if (!ASSET_FIELDS.has(String(assetIdField || ''))) {
    throw new Error("asset_id must be one of: '0field' | '1field' | '2field'");
  }
}

function assertU64(name, n, { allowZero = true } = {}) {
  const val = Number(n);
  if (!Number.isFinite(val) || val < 0 || (!allowZero && val === 0)) {
    throw new Error(`${name} must be a ${allowZero ? 'non-negative' : 'positive'} number`);
  }
  return Math.round(val);
}

async function createProgramManager(privateKey) {
  if (!privateKey) throw new Error('Missing private key for signer');
  await logTestnetStatus();
  const account = new Account({ privateKey });
  const networkClient = new AleoNetworkClient(ALEO_RPC_URL);
  networkClient.setAccount(account);
  const keyProvider = new AleoKeyProvider();
  keyProvider.useCache(true);
  const recordProvider = new NetworkRecordProvider(account, networkClient);
  const programManager = new ProgramManager(ALEO_RPC_URL, keyProvider, recordProvider);
  programManager.setAccount(account);
  return { account, programManager };
}

export async function runSetFlashParams({
  assetIdField,
  enabled,
  premiumBps,
  maxAmountMicro,
}) {
  validateAssetField(assetIdField);
  const premium = assertU64('premiumBps', premiumBps);
  const max = assertU64('maxAmountMicro', maxAmountMicro);
  if (premium > 10_000) throw new Error('premiumBps must be <= 10000');
  if (!POOL_ADMIN_PRIVATE_KEY) throw new Error('POOL_ADMIN_PRIVATE_KEY missing in backend/.env');

  const { account, programManager } = await createProgramManager(POOL_ADMIN_PRIVATE_KEY);
  const signer = account.address().to_string();
  if (LENDING_POOL_ADMIN_ADDRESS && signer !== LENDING_POOL_ADMIN_ADDRESS) {
    throw new Error(`Signer ${signer} must match LENDING_POOL_ADMIN_ADDRESS ${LENDING_POOL_ADMIN_ADDRESS}`);
  }

  const inputs = [
    assetIdField,
    enabled ? 'true' : 'false',
    `${premium}u64`,
    `${max}u64`,
  ];

  const txId = await programManager.execute({
    programName: LENDING_POOL_PROGRAM_ID,
    functionName: 'set_flash_params',
    priorityFee: FLASH_TX_FEE_CREDITS,
    privateFee: false,
    inputs,
  });

  return { txId, signer, program: LENDING_POOL_PROGRAM_ID, function: 'set_flash_params' };
}

export async function runSetFlashStrategyAllowed({ strategyId, allowed }) {
  if (!strategyId || typeof strategyId !== 'string' || !strategyId.endsWith('field')) {
    throw new Error("strategyId must be a Leo field string (example: '123field')");
  }
  if (!POOL_ADMIN_PRIVATE_KEY) throw new Error('POOL_ADMIN_PRIVATE_KEY missing in backend/.env');

  const { account, programManager } = await createProgramManager(POOL_ADMIN_PRIVATE_KEY);
  const signer = account.address().to_string();
  if (LENDING_POOL_ADMIN_ADDRESS && signer !== LENDING_POOL_ADMIN_ADDRESS) {
    throw new Error(`Signer ${signer} must match LENDING_POOL_ADMIN_ADDRESS ${LENDING_POOL_ADMIN_ADDRESS}`);
  }

  const txId = await programManager.execute({
    programName: LENDING_POOL_PROGRAM_ID,
    functionName: 'set_flash_strategy_allowed',
    priorityFee: FLASH_TX_FEE_CREDITS,
    privateFee: false,
    inputs: [strategyId, allowed ? 'true' : 'false'],
  });

  return { txId, signer, program: LENDING_POOL_PROGRAM_ID, function: 'set_flash_strategy_allowed' };
}

export async function runFlashOpen({
  assetIdField,
  principalMicro,
  minProfitMicro,
  strategyId,
}) {
  validateAssetField(assetIdField);
  const principal = assertU64('principalMicro', principalMicro, { allowZero: false });
  const minProfit = assertU64('minProfitMicro', minProfitMicro);
  if (!strategyId || typeof strategyId !== 'string' || !strategyId.endsWith('field')) {
    throw new Error("strategyId must be a Leo field string (example: '123field')");
  }
  if (!STRATEGY_PRIVATE_KEY) throw new Error('STRATEGY_PRIVATE_KEY (or VAULT_PRIVATE_KEY fallback) missing in backend/.env');

  const { account, programManager } = await createProgramManager(STRATEGY_PRIVATE_KEY);
  const signer = account.address().to_string();

  const txId = await programManager.execute({
    programName: LENDING_POOL_PROGRAM_ID,
    functionName: 'flash_open',
    priorityFee: FLASH_TX_FEE_CREDITS,
    privateFee: false,
    inputs: [
      assetIdField,
      `${principal}u64`,
      `${minProfit}u64`,
      strategyId,
    ],
  });

  return { txId, signer, program: LENDING_POOL_PROGRAM_ID, function: 'flash_open' };
}

