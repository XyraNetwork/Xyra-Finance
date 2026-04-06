/**
 * Logical tests for cross-asset withdraw burn ladder (ALEO → USDCx → USAD).
 * Run: node scripts/test-withdraw-rounding.mjs
 *
 * On-chain `withdraw` uses **floor** burns; `getCrossCollateralWithdrawCapsFromChain` must use the same.
 * Ceil in the RPC cap helper was optimistic → UI allowed amounts that reverted on `rem_after_usad <= 3`.
 */

const PRICE_SCALE = 1_000_000n;
const WITHDRAW_XA_REMAINDER_MAX = 3n;

function toU64Leo(x) {
  const max = 18446744073709551615n;
  if (x <= 0n) return 0n;
  return x > max ? max : x;
}

function burnLadderFloor(withdrawUsd, realSup, prices, supUsdBefore) {
  let rem = withdrawUsd;
  const burnAmt = [0n, 0n, 0n];
  for (let idx = 0; idx < 3; idx++) {
    const targetUsd = rem > supUsdBefore[idx] ? supUsdBefore[idx] : rem;
    const burnAmtRaw = toU64Leo((targetUsd * PRICE_SCALE) / prices[idx]);
    const burnAmtIdx = burnAmtRaw > realSup[idx] ? realSup[idx] : burnAmtRaw;
    const burnUsd = toU64Leo((burnAmtIdx * prices[idx]) / PRICE_SCALE);
    rem = rem > burnUsd ? rem - burnUsd : 0n;
    burnAmt[idx] = burnAmtIdx;
  }
  return { rem, burnAmt };
}

function burnLadderCeil(withdrawUsd, realSup, prices, supUsdBefore) {
  let rem = withdrawUsd;
  const burnAmt = [0n, 0n, 0n];
  for (let idx = 0; idx < 3; idx++) {
    const targetUsd = rem > supUsdBefore[idx] ? supUsdBefore[idx] : rem;
    const p = prices[idx];
    const burnAmtRaw = toU64Leo((targetUsd * PRICE_SCALE + p - 1n) / p);
    const burnAmtIdx = burnAmtRaw > realSup[idx] ? realSup[idx] : burnAmtRaw;
    const burnUsd = toU64Leo((burnAmtIdx * prices[idx]) / PRICE_SCALE);
    rem = rem > burnUsd ? rem - burnUsd : 0n;
    burnAmt[idx] = burnAmtIdx;
  }
  return { rem, burnAmt };
}

function totalBurnUsdMicro(burnAmt, prices) {
  let t = 0n;
  for (let i = 0; i < 3; i++) {
    t += toU64Leo((burnAmt[i] * prices[i]) / PRICE_SCALE);
  }
  return t;
}

/** USDCx micro out when price_usdcx == PRICE_SCALE (1 USD in PRICE units): credit_micro == total_burn_usd. */
function finalizeStableCreditOk(amountMicro, burnAmt, prices, priceStable) {
  const totalUsd = totalBurnUsdMicro(burnAmt, prices);
  const creditMicro = (totalUsd * PRICE_SCALE) / priceStable;
  const availU2 = 0n;
  const sum = availU2 + creditMicro;
  const short = sum >= amountMicro ? 0n : amountMicro - sum;
  const okStrict = sum >= amountMicro;
  const okWithSubsidy = short <= WITHDRAW_XA_REMAINDER_MAX;
  return { totalUsd, creditMicro, sum, short, okStrict, okWithSubsidy };
}

function assertCond(name, cond) {
  if (!cond) {
    console.error('FAIL:', name);
    process.exit(1);
  }
  console.log('ok:', name);
}

// From localhost-1775296499540.log: oracle prices
const priceAleo = 44133n;
const priceStable = 1_000_000n;
const prices = [priceAleo, priceStable, priceStable];
const realSupAleo = 1_000_000n;
const realSup = [realSupAleo, 0n, 0n];
const supUsdBefore = [
  toU64Leo((realSupAleo * priceAleo) / PRICE_SCALE),
  0n,
  0n,
];

console.log('--- Log-like position: 1e6 micro ALEO supply, prices [44133, 1e6, 1e6] ---');
console.log('supUsdBefore[0]', supUsdBefore[0].toString());

for (const amountMicro of [33099n, 44123n, 44133n]) {
  const withdrawUsd = toU64Leo((amountMicro * priceStable) / PRICE_SCALE);
  const f = burnLadderFloor(withdrawUsd, realSup, prices, supUsdBefore);
  const c = burnLadderCeil(withdrawUsd, realSup, prices, supUsdBefore);
  const finF = finalizeStableCreditOk(amountMicro, f.burnAmt, prices, priceStable);
  const finC = finalizeStableCreditOk(amountMicro, c.burnAmt, prices, priceStable);

  console.log('\namountMicro', amountMicro.toString(), 'withdrawUsd', withdrawUsd.toString());
  console.log('  FLOOR rem', f.rem.toString(), 'finalize strict?', finF.okStrict, 'credit', finF.creditMicro.toString());
  console.log('  CEIL  rem', c.rem.toString(), 'finalize strict?', finC.okStrict, 'credit', finC.creditMicro.toString());

  assertCond(`floor case ${amountMicro}: transition rem <= RMAX`, f.rem <= WITHDRAW_XA_REMAINDER_MAX);
  assertCond(`ceil case ${amountMicro}: rem is 0 (single-asset full ladder)`, c.rem === 0n);
  assertCond(`ceil case ${amountMicro}: finalize strict OK`, finC.okStrict);
  if (amountMicro === 33099n || amountMicro === 44123n) {
    assertCond(`floor case ${amountMicro}: was broken strict finalize (documents bug)`, !finF.okStrict);
  }
}

console.log('\nAll withdraw rounding tests passed.');
