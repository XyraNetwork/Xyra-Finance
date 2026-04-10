import 'dotenv/config';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  Account,
  ProgramManager,
  AleoKeyProvider,
  NetworkRecordProvider,
  AleoNetworkClient,
} from '@provablehq/sdk';
import fetch from 'node-fetch';
import { logTestnetStatus } from './checkTestnet.js';

const __filename = fileURLToPath(import.meta.url);

/** argv[1] is often relative (e.g. src/processStakeStrategy.js); must compare resolved paths. */
function isDirectRun() {
  const entry = process.argv[1];
  if (!entry) return false;
  try {
    return path.resolve(entry) === __filename;
  } catch {
    return false;
  }
}

/** Match frontend `CURRENT_RPC_URL` — Provable explorer `/v1` root often returns 404 for JSON-RPC POST. */
const ALEO_RPC_URL = process.env.ALEO_RPC_URL || 'https://testnetbeta.aleorpc.com';
const STRATEGY_PRIVATE_KEY = process.env.STRATEGY_PRIVATE_KEY || process.env.VAULT_PRIVATE_KEY;
const STAKE_VALIDATOR_ADDRESS = process.env.STAKE_VALIDATOR_ADDRESS;
const STAKE_WITHDRAW_ADDRESS = process.env.STAKE_WITHDRAW_ADDRESS || process.env.VAULT_ADDRESS;
const STAKE_PRIORITY_FEE = Number(process.env.STAKE_PRIORITY_FEE_CREDITS || '0.2');
const ONE_ALEO_MICRO = 1_000_000;

/** Native delegation minimum per Aleo docs (`bond_public` delegator): ≥ 10,000 credits (ALEO). */
const MIN_DELEGATION_ALEO = 10_000;
const MIN_DELEGATION_MICRO = MIN_DELEGATION_ALEO * ONE_ALEO_MICRO;
const STAKE_ALLOW_BELOW_MIN_DELEGATION =
  String(process.env.STAKE_ALLOW_BELOW_MIN_DELEGATION || '').toLowerCase() === 'true';

/** REST base for `/testnet/transaction/confirmed/...` (independent of ALEO_RPC_URL used to broadcast). */
const ALEO_EXPLORER_API_BASE = (process.env.ALEO_EXPLORER_API_BASE || 'https://api.explorer.provable.com/v1').replace(
  /\/$/,
  '',
);
const STAKE_SKIP_CONFIRM_WAIT = String(process.env.STAKE_SKIP_CONFIRM_WAIT || '').toLowerCase() === 'true';
const STAKE_CONFIRM_TIMEOUT_MS = Number(process.env.STAKE_CONFIRM_TIMEOUT_MS || '180000');
const STAKE_CONFIRM_POLL_MS = Number(process.env.STAKE_CONFIRM_POLL_MS || '4000');

if (!STRATEGY_PRIVATE_KEY) {
  console.error(
    '[stake-strategy] STRATEGY_PRIVATE_KEY (or VAULT_PRIVATE_KEY fallback) is not set in backend/.env',
  );
  process.exit(1);
}

if (!STAKE_VALIDATOR_ADDRESS) {
  console.error('[stake-strategy] STAKE_VALIDATOR_ADDRESS is not set in backend/.env');
  process.exit(1);
}

if (!STAKE_WITHDRAW_ADDRESS) {
  console.error('[stake-strategy] STAKE_WITHDRAW_ADDRESS (or VAULT_ADDRESS fallback) is not set.');
  process.exit(1);
}

/** `credits.aleo/bond_public` expects `address.public` = standard Bech32 `aleo1...` (not `at1...` or other IDs). */
function requireAleoAddress(label, raw) {
  const v = String(raw || '').trim();
  if (!v.startsWith('aleo1')) {
    console.error(`[stake-strategy] ${label} must be an Aleo address starting with aleo1 (bond_public input type address.public).`);
    console.error(`  Current value begins with: ${v ? JSON.stringify(v.slice(0, 12)) : '(empty)'}`);
    console.error(
      '  If the explorer showed at1… or another prefix, find the validator\'s aleo1… delegation address on testnet.',
    );
    process.exit(1);
  }
  return v;
}

const STAKE_VALIDATOR = requireAleoAddress('STAKE_VALIDATOR_ADDRESS', STAKE_VALIDATOR_ADDRESS);
const STAKE_WITHDRAW = requireAleoAddress('STAKE_WITHDRAW_ADDRESS', STAKE_WITHDRAW_ADDRESS);

function parseArgs() {
  const action = (process.argv[2] || 'cycle').toLowerCase();

  if (!['bond', 'unbond', 'claim', 'cycle'].includes(action)) {
    console.error('Usage: node src/processStakeStrategy.js [bond|unbond|claim|cycle] [amountAleo]');
    process.exit(1);
  }

  if (action === 'claim') {
    return { action, amountMicro: 0 };
  }

  const raw = process.argv[3];
  let amountAleo;
  if (raw != null && raw !== '') {
    amountAleo = Number(raw);
  } else if (action === 'bond' || action === 'cycle') {
    amountAleo = MIN_DELEGATION_ALEO;
  } else {
    amountAleo = 1;
  }

  const amountMicro = Math.round(amountAleo * ONE_ALEO_MICRO);
  if (!Number.isFinite(amountMicro) || amountMicro <= 0) {
    console.error('amountAleo must be a positive number.');
    process.exit(1);
  }

  return { action, amountMicro };
}

async function createManager() {
  await logTestnetStatus();

  const account = new Account({ privateKey: STRATEGY_PRIVATE_KEY });
  const networkClient = new AleoNetworkClient(ALEO_RPC_URL);
  const keyProvider = new AleoKeyProvider();
  keyProvider.useCache(true);
  const recordProvider = new NetworkRecordProvider(account, networkClient);
  const programManager = new ProgramManager(ALEO_RPC_URL, keyProvider, recordProvider);
  programManager.setAccount(account);

  return { account, programManager };
}

/** Best-effort summary when explorer returns status rejected (no plain-text reason in API). */
function logRejectedExecutionHints(body) {
  const rej = body?.rejected;
  if (!rej || typeof rej !== 'object') return;

  const t = rej.type;
  console.error(`[stake-strategy] rejection kind: ${t ?? 'unknown'}`);

  const transitions = rej.execution?.transitions;
  if (Array.isArray(transitions) && transitions.length > 0) {
    const tr = transitions[0];
    console.error(
      `[stake-strategy] failed transition: ${tr.program || '?'}/${tr.function || '?'} (explorer does not return an assertion message).`,
    );
    if (tr.function === 'bond_public') {
      console.error(
        `[stake-strategy] Per https://developer.aleo.org/concepts/network/staking/ — delegators must bond ≥ ${MIN_DELEGATION_ALEO.toLocaleString()} ALEO; validator must have committee is_open; use public balance for bond + fees.`,
      );
    }
  }

  console.error(
    '[stake-strategy] SDK lines like "Check program imports" / "function keys will be synthesized" are proving-key warnings — they are not the on-chain rejection cause.',
  );
}

/**
 * Poll Provable explorer for on-chain confirmation. Broadcast RPC (e.g. testnetbeta.aleorpc.com) may not
 * expose this route; confirmation uses api.explorer.provable.com/v1 by default.
 * @returns {{ ok: boolean, status?: string, body?: object }}
 */
async function logTransactionConfirmation(txId) {
  const explorerTxUrl = `https://testnet.explorer.provable.com/transaction/${txId}`;
  const confirmedUrl = `${ALEO_EXPLORER_API_BASE}/testnet/transaction/confirmed/${txId}`;

  if (STAKE_SKIP_CONFIRM_WAIT) {
    console.log('[stake-strategy] confirmation poll skipped (STAKE_SKIP_CONFIRM_WAIT=true).');
    console.log('[stake-strategy] view:', explorerTxUrl);
    return { ok: true, status: 'skipped' };
  }

  console.log('[stake-strategy] waiting for on-chain confirmation…');
  console.log('[stake-strategy] poll:', confirmedUrl);
  const deadline = Date.now() + STAKE_CONFIRM_TIMEOUT_MS;
  let attempt = 0;

  while (Date.now() < deadline) {
    attempt += 1;
    try {
      const res = await fetch(confirmedUrl);
      const text = await res.text();
      let body = null;
      try {
        body = text ? JSON.parse(text) : null;
      } catch {
        body = null;
      }

      if (res.ok && body && typeof body.status === 'string') {
        const st = body.status.toLowerCase();
        if (st === 'accepted' || st === 'confirmed') {
          console.log(`[stake-strategy] ✅ transaction SUCCEEDED (explorer status: ${body.status})`);
          console.log('[stake-strategy]', explorerTxUrl);
          return { ok: true, status: body.status, body };
        }
        if (st === 'rejected') {
          console.error(
            '[stake-strategy] ❌ transaction NOT applied on-chain (status: rejected). The fee transaction may still have succeeded.',
          );
          console.error('[stake-strategy]', explorerTxUrl);
          logRejectedExecutionHints(body);
          return { ok: false, status: body.status, body };
        }
        console.warn(`[stake-strategy] confirmation returned status "${body.status}" (treating as indeterminate).`);
        console.log('[stake-strategy]', explorerTxUrl);
        return { ok: true, status: body.status, body };
      }
    } catch (err) {
      console.warn(`[stake-strategy] confirmation poll #${attempt} error:`, err?.message || err);
    }

    const wait = Math.min(STAKE_CONFIRM_POLL_MS, Math.max(0, deadline - Date.now()));
    if (wait <= 0) break;
    await new Promise((r) => setTimeout(r, wait));
  }

  console.error(
    `[stake-strategy] ⏱️ confirmation TIMEOUT after ${STAKE_CONFIRM_TIMEOUT_MS}ms — could not read final status (still pending or API lag).`,
  );
  console.error('[stake-strategy]', explorerTxUrl);
  return { ok: false, status: 'timeout' };
}

async function executeCredits(programManager, functionName, candidateInputs) {
  let lastErr = null;
  for (const inputs of candidateInputs) {
    try {
      console.log(`[stake-strategy] trying credits.aleo/${functionName} with inputs:`, inputs);
      const txId = await programManager.execute({
        programName: 'credits.aleo',
        functionName,
        priorityFee: STAKE_PRIORITY_FEE,
        privateFee: false,
        inputs,
      });
      console.log(`[stake-strategy] submitted ${functionName}: ${txId}`);
      const confirm = await logTransactionConfirmation(txId);
      if (!confirm.ok) {
        throw new Error(
          confirm.status === 'rejected'
            ? `On-chain execution rejected (see explorer). Tx: ${txId}`
            : `Confirmation did not succeed (status: ${confirm.status ?? 'unknown'}). Tx: ${txId}`,
        );
      }
      return txId;
    } catch (e) {
      lastErr = e;
      console.warn(
        `[stake-strategy] ${functionName} attempt failed for inputs ${JSON.stringify(inputs)}:`,
        e?.message || e,
      );
    }
  }
  throw lastErr || new Error(`Failed to execute credits.aleo/${functionName}`);
}

export async function runBondPublic(amountMicro = ONE_ALEO_MICRO) {
  if (!STAKE_ALLOW_BELOW_MIN_DELEGATION && amountMicro < MIN_DELEGATION_MICRO) {
    throw new Error(
      `bond_public requires ≥ ${MIN_DELEGATION_ALEO.toLocaleString()} ALEO per Aleo staking rules (https://developer.aleo.org/concepts/network/staking/#delegating-to-a-validator). ` +
        'Set STAKE_ALLOW_BELOW_MIN_DELEGATION=true to attempt smaller amounts (on-chain will likely reject).',
    );
  }

  const { account, programManager } = await createManager();
  const signer = account.address().to_string();
  console.log('[stake-strategy] signer:', signer);
  console.log('[stake-strategy] action: bond_public');
  console.log('[stake-strategy] validator:', STAKE_VALIDATOR);
  console.log('[stake-strategy] withdrawal:', STAKE_WITHDRAW);
  console.log('[stake-strategy] amount_micro:', amountMicro);

  // Same order as docs: bond_public <validator> <withdrawal_address> <amount_microcredits>
  const amt = `${amountMicro}u64`;
  return executeCredits(programManager, 'bond_public', [[STAKE_VALIDATOR, STAKE_WITHDRAW, amt]]);
}

export async function runUnbondPublic(amountMicro = ONE_ALEO_MICRO) {
  const { account, programManager } = await createManager();
  const signer = account.address().to_string();
  console.log('[stake-strategy] signer:', signer);
  console.log('[stake-strategy] action: unbond_public');
  console.log('[stake-strategy] amount_micro:', amountMicro);

  const amt = `${amountMicro}u64`;
  // Same as SDK buildUnbondPublicTransaction: (staker_address, amount_u64)
  return executeCredits(programManager, 'unbond_public', [[signer, amt]]);
}

export async function runClaimUnbondPublic() {
  const { account, programManager } = await createManager();
  const signer = account.address().to_string();
  console.log('[stake-strategy] signer:', signer);
  console.log('[stake-strategy] action: claim_unbond_public');

  return executeCredits(programManager, 'claim_unbond_public', [[signer]]);
}

export async function runCycle(amountMicro = ONE_ALEO_MICRO) {
  const bondTx = await runBondPublic(amountMicro);
  const unbondTx = await runUnbondPublic(amountMicro);
  return { bondTx, unbondTx };
}

async function main() {
  const { action, amountMicro } = parseArgs();
  console.log('========================================');
  console.log('🏁 Aleo staking strategy runner');
  console.log('========================================');
  console.log('[stake-strategy] rpc:', ALEO_RPC_URL);
  console.log('[stake-strategy] priority_fee_credits:', STAKE_PRIORITY_FEE);
  console.log(
    `[stake-strategy] native delegation minimum: ${MIN_DELEGATION_ALEO.toLocaleString()} ALEO (bond); unbond/claim after 360-block unbond period.`,
  );

  let out;
  if (action === 'bond') out = await runBondPublic(amountMicro);
  else if (action === 'unbond') out = await runUnbondPublic(amountMicro);
  else if (action === 'claim') out = await runClaimUnbondPublic();
  else out = await runCycle(amountMicro);

  console.log('[stake-strategy] done:', out);
}

if (isDirectRun()) {
  main().catch((e) => {
    console.error('[stake-strategy] failed:', e?.message || e);
    process.exit(1);
  });
}

