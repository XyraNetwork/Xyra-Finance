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
const LENDING_POOL_PROGRAM_ID = (process.env.LENDING_POOL_PROGRAM_ID || 'xyra_lending_v29.aleo').trim();
const LENDING_POOL_ADMIN_ADDRESS = (process.env.LENDING_POOL_ADMIN_ADDRESS || '').trim();
const POOL_ADMIN_PRIVATE_KEY = (process.env.POOL_ADMIN_PRIVATE_KEY || '').trim();
const ACCRUE_TX_FEE_CREDITS = Number(process.env.ACCRUE_TX_FEE_CREDITS || '0.2');
const ACCRUE_INTERVAL_MS = Number(process.env.ACCRUE_INTERVAL_MS || '3600000');
const ASSET_IDS = ['0field', '1field', '2field'];

function resolveAdminKey() {
  if (POOL_ADMIN_PRIVATE_KEY) return POOL_ADMIN_PRIVATE_KEY;
  const vaultPk = (process.env.VAULT_PRIVATE_KEY || '').trim();
  const vaultAddr = (process.env.VAULT_ADDRESS || '').trim();
  if (vaultPk && vaultAddr && LENDING_POOL_ADMIN_ADDRESS && vaultAddr === LENDING_POOL_ADMIN_ADDRESS) {
    return vaultPk;
  }
  return '';
}

async function createProgramManager(privateKey) {
  await logTestnetStatus();
  const account = new Account({ privateKey });
  const signer = account.address().to_string();
  if (LENDING_POOL_ADMIN_ADDRESS && signer !== LENDING_POOL_ADMIN_ADDRESS) {
    throw new Error(`Signer ${signer} must match LENDING_POOL_ADMIN_ADDRESS ${LENDING_POOL_ADMIN_ADDRESS}`);
  }

  const networkClient = new AleoNetworkClient(ALEO_RPC_URL);
  networkClient.setAccount(account);
  const keyProvider = new AleoKeyProvider();
  keyProvider.useCache(true);
  const recordProvider = new NetworkRecordProvider(account, networkClient);
  const programManager = new ProgramManager(ALEO_RPC_URL, keyProvider, recordProvider);
  programManager.setAccount(account);
  return { programManager, signer };
}

export async function runAccrueOnceForAllAssets() {
  const adminPk = resolveAdminKey();
  if (!adminPk) {
    throw new Error('Missing admin key: set POOL_ADMIN_PRIVATE_KEY (or VAULT_PRIVATE_KEY when VAULT_ADDRESS == LENDING_POOL_ADMIN_ADDRESS).');
  }
  const { programManager, signer } = await createProgramManager(adminPk);
  const results = [];

  for (const assetId of ASSET_IDS) {
    const startedAt = new Date().toISOString();
    try {
      console.log(`[accrue] submit ${LENDING_POOL_PROGRAM_ID}/accrue_interest(${assetId}) signer=${signer} at=${startedAt}`);
      const txId = await programManager.execute({
        programName: LENDING_POOL_PROGRAM_ID,
        functionName: 'accrue_interest',
        priorityFee: ACCRUE_TX_FEE_CREDITS,
        privateFee: false,
        inputs: [assetId],
      });
      console.log(`[accrue] tx submitted asset=${assetId} txId=${txId}`);
      results.push({ assetId, ok: true, txId });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`[accrue] failed asset=${assetId} error=${message}`);
      results.push({ assetId, ok: false, error: message });
    }
  }

  return results;
}

export async function startAccrueScheduler() {
  if (!Number.isFinite(ACCRUE_INTERVAL_MS) || ACCRUE_INTERVAL_MS < 60_000) {
    throw new Error(`ACCRUE_INTERVAL_MS must be >= 60000. Received: ${ACCRUE_INTERVAL_MS}`);
  }
  console.log(`[accrue] scheduler started interval=${ACCRUE_INTERVAL_MS}ms program=${LENDING_POOL_PROGRAM_ID}`);

  const runCycle = async () => {
    const cycleStart = new Date().toISOString();
    console.log(`[accrue] cycle start ${cycleStart}`);
    const res = await runAccrueOnceForAllAssets();
    const okCount = res.filter((r) => r.ok).length;
    const failCount = res.length - okCount;
    console.log(`[accrue] cycle end ok=${okCount} failed=${failCount}`);
  };

  await runCycle();
  setInterval(() => {
    runCycle().catch((e) => {
      const message = e instanceof Error ? e.message : String(e);
      console.error(`[accrue] cycle crashed: ${message}`);
    });
  }, ACCRUE_INTERVAL_MS);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  startAccrueScheduler().catch((e) => {
    const message = e instanceof Error ? e.message : String(e);
    console.error(`[accrue] scheduler fatal: ${message}`);
    process.exit(1);
  });
}

