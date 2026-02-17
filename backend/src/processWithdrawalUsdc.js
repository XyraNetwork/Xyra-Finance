import 'dotenv/config';
import { runWithdrawalUsdc } from './processWithdrawal.js';

/**
 * CLI for USDC withdrawal: vault sends USDCx to user.
 * Usage: node src/processWithdrawalUsdc.js <user_address> <amount_usdc_u64>
 * Example: node src/processWithdrawalUsdc.js aleo1zm5xfs4jhfekmmx2d38gjlxklslzx7kculdqpg3j3uuz5alhqyxqm8zqmz 1
 *
 * amount_usdc_u64 = human USDC (e.g. 1 = 1 USDC); backend converts to 6 decimals for transfer.
 */
function parseArgs() {
  const [, , toAddress, amountStr] = process.argv;
  if (!toAddress || !amountStr) {
    console.error(
      'Usage: node src/processWithdrawalUsdc.js <user_address> <amount_usdc_u64>\n' +
        'Example: node src/processWithdrawalUsdc.js aleo1zm5xfs4jhfekmmx2d38gjlxklslzx7kculdqpg3j3uuz5alhqyxqm8zqmz 1',
    );
    process.exit(1);
  }
  const amountUsdc = Number(amountStr);
  if (!Number.isFinite(amountUsdc) || amountUsdc <= 0) {
    console.error('Amount must be a positive number (e.g. 1 for 1 USDC).');
    process.exit(1);
  }
  return { toAddress, amountUsdc };
}

(async () => {
  const { toAddress, amountUsdc } = parseArgs();
  try {
    await runWithdrawalUsdc(toAddress, amountUsdc);
  } catch (err) {
    console.error('❌ USDC withdrawal failed:', err);
    process.exit(1);
  }
})();
