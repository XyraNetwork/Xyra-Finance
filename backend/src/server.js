import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { runWithdrawal, runBorrow, runWithdrawalUsdc, runBorrowUsdc } from './processWithdrawal.js';
import { logTestnetStatus } from './checkTestnet.js';

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
    const { userAddress, amountCredits } = req.body || {};
    if (!userAddress || typeof userAddress !== 'string') {
      return res.status(400).json({ error: 'Missing or invalid userAddress' });
    }
    const amount = Number(amountCredits);
    if (!Number.isFinite(amount) || amount <= 0) {
      return res.status(400).json({ error: 'Missing or invalid amountCredits' });
    }

    console.log('📥 Received withdrawal request from frontend:', {
      userAddress,
      amountCredits: amount,
    });

    // Queue vault transfer so we don't run 100 concurrent vault ops
    const transactionId = await runVaultTask(() => runWithdrawal(userAddress, amount));
    return res.json({ ok: true, transactionId });
  } catch (err) {
    console.error('❌ /withdraw handler failed:', err);
    const message = err?.message || 'Internal server error';
    return res.status(500).json({ error: message });
  }
});

app.post('/borrow', async (req, res) => {
  try {
    const { userAddress, amountCredits } = req.body || {};
    if (!userAddress || typeof userAddress !== 'string') {
      return res.status(400).json({ error: 'Missing or invalid userAddress' });
    }
    const amount = Number(amountCredits);
    if (!Number.isFinite(amount) || amount <= 0) {
      return res.status(400).json({ error: 'Missing or invalid amountCredits' });
    }

    console.log('📥 Received borrow request from frontend:', {
      userAddress,
      amountCredits: amount,
    });

    const transactionId = await runVaultTask(() => runBorrow(userAddress, amount));
    return res.json({ ok: true, transactionId });
  } catch (err) {
    console.error('❌ /borrow handler failed:', err);
    const message = err?.message || 'Internal server error';
    return res.status(500).json({ error: message });
  }
});

app.post('/withdraw-usdc', async (req, res) => {
  try {
    const { userAddress, amountUsdc } = req.body || {};
    if (!userAddress || typeof userAddress !== 'string') {
      return res.status(400).json({ error: 'Missing or invalid userAddress' });
    }
    const amount = Number(amountUsdc);
    if (!Number.isFinite(amount) || amount <= 0) {
      return res.status(400).json({ error: 'Missing or invalid amountUsdc (u64 human, e.g. 1 = 1 USDC)' });
    }

    console.log('📥 Received USDC withdrawal request from frontend:', {
      userAddress,
      amountUsdc: amount,
    });

    const transactionId = await runVaultTask(() => runWithdrawalUsdc(userAddress, amount));
    return res.json({ ok: true, transactionId });
  } catch (err) {
    console.error('❌ /withdraw-usdc handler failed:', err);
    const message = err?.message || 'Internal server error';
    return res.status(500).json({ error: message });
  }
});

app.post('/borrow-usdc', async (req, res) => {
  try {
    const { userAddress, amountUsdc } = req.body || {};
    if (!userAddress || typeof userAddress !== 'string') {
      return res.status(400).json({ error: 'Missing or invalid userAddress' });
    }
    const amount = Number(amountUsdc);
    if (!Number.isFinite(amount) || amount <= 0) {
      return res.status(400).json({ error: 'Missing or invalid amountUsdc (u64 human, e.g. 1 = 1 USDC)' });
    }

    console.log('📥 Received USDC borrow request from frontend:', {
      userAddress,
      amountUsdc: amount,
    });

    const transactionId = await runVaultTask(() => runBorrowUsdc(userAddress, amount));
    return res.json({ ok: true, transactionId });
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
});

