import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { runWithdrawal, runBorrow, runWithdrawalUsdc, runBorrowUsdc } from './processWithdrawal.js';
import { logTestnetStatus } from './checkTestnet.js';

const app = express();
const PORT = process.env.PORT || 4000;

// Allow frontend origin to call this backend
const allowedOrigin = process.env.CORS_ORIGIN || 'http://localhost:3003';
app.use(
  cors({
    origin: allowedOrigin,
  }),
);

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

    // Await vault transfer so we can return the transaction ID to the frontend
    const transactionId = await runWithdrawal(userAddress, amount);
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

    const transactionId = await runBorrow(userAddress, amount);
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

    const transactionId = await runWithdrawalUsdc(userAddress, amount);
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

    const transactionId = await runBorrowUsdc(userAddress, amount);
    return res.json({ ok: true, transactionId });
  } catch (err) {
    console.error('❌ /borrow-usdc handler failed:', err);
    const message = err?.message || 'Internal server error';
    return res.status(500).json({ error: message });
  }
});

app.listen(PORT, async () => {
  console.log(`✅ Vault backend (withdraw + borrow) listening on http://localhost:${PORT}`);
  await logTestnetStatus();
});

