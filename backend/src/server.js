import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { runWithdrawal, runBorrow, runWithdrawalUsdc, runBorrowUsdc } from './processWithdrawal.js';
import { logTestnetStatus } from './checkTestnet.js';
import { updateVaultTx, setVaultStatus } from './supabase.js';
import { startVaultWatcher } from './vaultWatcher.js';

const app = express();
const PORT = process.env.PORT || 4000;

// In-process queue for vault operations: one at a time to avoid RPC overload and vault key contention.
// Set VAULT_QUEUE_CONCURRENCY to 2 or 3 if your RPC supports limited parallelism (default 1).
const VAULT_QUEUE_CONCURRENCY = Math.max(1, Math.min(10, Number(process.env.VAULT_QUEUE_CONCURRENCY) || 1));
const vaultQueue = [];
let vaultQueueRunning = 0;

function runVaultTask(fn) {
  return new Promise((resolve, reject) => {
    vaultQueue.push({ fn, resolve, reject });
    processVaultQueue();
  });
}

function processVaultQueue() {
  while (vaultQueueRunning < VAULT_QUEUE_CONCURRENCY && vaultQueue.length > 0) {
    const entry = vaultQueue.shift();
    vaultQueueRunning += 1;
    Promise.resolve(entry.fn())
      .then((result) => entry.resolve(result))
      .catch((err) => entry.reject(err))
      .finally(() => {
        vaultQueueRunning -= 1;
        processVaultQueue();
      });
  }
}

// Allow frontend origin(s) to call this backend. Comma-separated for multiple (e.g. production + local).
const corsOriginEnv = process.env.CORS_ORIGIN || 'http://localhost:3003';
const allowedOrigins = corsOriginEnv.split(',').map((o) => o.trim()).filter(Boolean);
const corsOptions = {
  origin: (origin, cb) => {
    if (!origin) return cb(null, true);
    if (allowedOrigins.includes(origin)) return cb(null, true);
    if (allowedOrigins.length === 1 && allowedOrigins[0] === '*') return cb(null, true);
    cb(null, false);
  },
};
app.use(cors(corsOptions));

app.use(express.json());

app.post('/withdraw', async (req, res) => {
  try {
    const { userAddress, amountCredits, finalTxId } = req.body || {};
    if (!userAddress || typeof userAddress !== 'string') {
      return res.status(400).json({ error: 'Missing or invalid userAddress' });
    }
    const amount = Number(amountCredits);
    if (!Number.isFinite(amount) || amount <= 0) {
      return res.status(400).json({ error: 'Missing or invalid amountCredits' });
    }
    if (!finalTxId || typeof finalTxId !== 'string') {
      return res.status(400).json({ error: 'Missing or invalid finalTxId' });
    }

    console.log('📥 Queuing withdrawal from frontend:', { userAddress, amountCredits: amount, finalTxId });
    const { rowsUpdated } = await setVaultStatus(userAddress, finalTxId, 'withdraw', 'vault_processing');
    if (rowsUpdated > 0) {
      runVaultTask(() => runWithdrawal(userAddress, amount))
        .then((transactionId) => {
          return updateVaultTx(userAddress, finalTxId, 'withdraw', transactionId);
        })
        .catch((err) => {
          console.error('❌ Vault withdraw task failed:', err);
          setVaultStatus(userAddress, finalTxId, 'withdraw', 'vault_pending');
        });
    }

    return res.json({ ok: true, queued: true });
  } catch (err) {
    console.error('❌ /withdraw handler failed:', err);
    const message = err?.message || 'Internal server error';
    return res.status(500).json({ error: message });
  }
});

app.post('/borrow', async (req, res) => {
  try {
    const { userAddress, amountCredits, finalTxId } = req.body || {};
    if (!userAddress || typeof userAddress !== 'string') {
      return res.status(400).json({ error: 'Missing or invalid userAddress' });
    }
    const amount = Number(amountCredits);
    if (!Number.isFinite(amount) || amount <= 0) {
      return res.status(400).json({ error: 'Missing or invalid amountCredits' });
    }
    if (!finalTxId || typeof finalTxId !== 'string') {
      return res.status(400).json({ error: 'Missing or invalid finalTxId' });
    }

    console.log('📥 Queuing borrow from frontend:', { userAddress, amountCredits: amount, finalTxId });
    const { rowsUpdated } = await setVaultStatus(userAddress, finalTxId, 'borrow', 'vault_processing');
    if (rowsUpdated > 0) {
      runVaultTask(() => runBorrow(userAddress, amount))
        .then((transactionId) => {
          return updateVaultTx(userAddress, finalTxId, 'borrow', transactionId);
        })
        .catch((err) => {
          console.error('❌ Vault borrow task failed:', err);
          setVaultStatus(userAddress, finalTxId, 'borrow', 'vault_pending');
        });
    }

    return res.json({ ok: true, queued: true });
  } catch (err) {
    console.error('❌ /borrow handler failed:', err);
    const message = err?.message || 'Internal server error';
    return res.status(500).json({ error: message });
  }
});

app.post('/withdraw-usdc', async (req, res) => {
  try {
    const { userAddress, amountUsdc, finalTxId } = req.body || {};
    if (!userAddress || typeof userAddress !== 'string') {
      return res.status(400).json({ error: 'Missing or invalid userAddress' });
    }
    const amount = Number(amountUsdc);
    if (!Number.isFinite(amount) || amount <= 0) {
      return res.status(400).json({ error: 'Missing or invalid amountUsdc (u64 human, e.g. 1 = 1 USDC)' });
    }
    if (!finalTxId || typeof finalTxId !== 'string') {
      return res.status(400).json({ error: 'Missing or invalid finalTxId' });
    }

    console.log('📥 Queuing USDC withdrawal from frontend:', { userAddress, amountUsdc: amount, finalTxId });
    const { rowsUpdated } = await setVaultStatus(userAddress, finalTxId, 'withdraw', 'vault_processing');
    if (rowsUpdated > 0) {
      runVaultTask(() => runWithdrawalUsdc(userAddress, amount))
        .then((transactionId) => {
          return updateVaultTx(userAddress, finalTxId, 'withdraw', transactionId);
        })
        .catch((err) => {
          console.error('❌ Vault withdraw-usdc task failed:', err);
          setVaultStatus(userAddress, finalTxId, 'withdraw', 'vault_pending');
        });
    }

    return res.json({ ok: true, queued: true });
  } catch (err) {
    console.error('❌ /withdraw-usdc handler failed:', err);
    const message = err?.message || 'Internal server error';
    return res.status(500).json({ error: message });
  }
});

app.post('/borrow-usdc', async (req, res) => {
  try {
    const { userAddress, amountUsdc, finalTxId } = req.body || {};
    if (!userAddress || typeof userAddress !== 'string') {
      return res.status(400).json({ error: 'Missing or invalid userAddress' });
    }
    const amount = Number(amountUsdc);
    if (!Number.isFinite(amount) || amount <= 0) {
      return res.status(400).json({ error: 'Missing or invalid amountUsdc (u64 human, e.g. 1 = 1 USDC)' });
    }
    if (!finalTxId || typeof finalTxId !== 'string') {
      return res.status(400).json({ error: 'Missing or invalid finalTxId' });
    }

    console.log('📥 Queuing USDC borrow from frontend:', { userAddress, amountUsdc: amount, finalTxId });
    const { rowsUpdated } = await setVaultStatus(userAddress, finalTxId, 'borrow', 'vault_processing');
    if (rowsUpdated > 0) {
      runVaultTask(() => runBorrowUsdc(userAddress, amount))
        .then((transactionId) => {
          return updateVaultTx(userAddress, finalTxId, 'borrow', transactionId);
        })
        .catch((err) => {
          console.error('❌ Vault borrow-usdc task failed:', err);
          setVaultStatus(userAddress, finalTxId, 'borrow', 'vault_pending');
        });
    }

    return res.json({ ok: true, queued: true });
  } catch (err) {
    console.error('❌ /borrow-usdc handler failed:', err);
    const message = err?.message || 'Internal server error';
    return res.status(500).json({ error: message });
  }
});

app.listen(PORT, async () => {
  console.log(`✅ Vault backend (withdraw + borrow) listening on http://localhost:${PORT}`);
  console.log(`   Vault queue: concurrency ${VAULT_QUEUE_CONCURRENCY} (set VAULT_QUEUE_CONCURRENCY in .env to change)`);
  await logTestnetStatus();
  if (process.env.VAULT_WATCHER_ENABLED !== 'false') {
    startVaultWatcher(runVaultTask);
  } else {
    console.log('   Vault watcher: disabled (VAULT_WATCHER_ENABLED=false)');
  }
});

