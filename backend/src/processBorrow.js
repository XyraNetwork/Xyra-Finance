import 'dotenv/config';
import { runBorrow } from './processWithdrawal.js';

function parseArgs() {
  const [, , toAddress, amountStr] = process.argv;
  if (!toAddress || !amountStr) {
    console.error(
      'Usage: node src/processBorrow.js <user_address> <amount_in_credits>\n' +
        'Example: node src/processBorrow.js aleo1user... 1',
    );
    process.exit(1);
  }
  const amountCredits = Number(amountStr);
  if (!Number.isFinite(amountCredits) || amountCredits <= 0) {
    console.error('Amount must be a positive number (whole credits).');
    process.exit(1);
  }
  return { toAddress, amountCredits };
}

(async () => {
  const { toAddress, amountCredits } = parseArgs();
  try {
    await runBorrow(toAddress, amountCredits);
  } catch (err) {
    console.error('❌ Borrow (vault transfer) failed:', err);
    process.exit(1);
  }
})();
