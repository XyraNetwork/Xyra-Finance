import 'dotenv/config';
import fetch from 'node-fetch';

const ALEO_RPC_URL = process.env.ALEO_RPC_URL || 'https://testnetbeta.aleorpc.com';

/** JSON-RPC probe works here; `https://api.explorer.provable.com/v1` often returns 404 on bare POST (nginx). */
const JSONRPC_PROBE_FALLBACK = 'https://testnetbeta.aleorpc.com';

async function tryGetMappingValue(url) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'getMappingValue',
      params: {
        program_id: 'credits.aleo',
        mapping_name: 'account',
        key: process.env.VAULT_ADDRESS || 'aleo1a2ehlgqhvs3p7d4hqhs0tvgk954dr8gafu9kxse2mzu9a5sqxvpsrn98pr',
      },
    }),
  });
  const text = await res.text();
  let detail;
  try {
    detail = JSON.parse(text);
  } catch {
    detail = text;
  }
  return { res, detail, url };
}

/**
 * Verify backend can reach the Aleo testnet (Provable RPC).
 * Tries getMappingValue (same RPC the app uses for credits.aleo).
 * If ALEO_RPC_URL is api.explorer.provable.com/v1, raw POST may 404 — retries JSONRPC_PROBE_FALLBACK.
 * @returns {{ ok: boolean, message: string, url: string, detail?: any, probeUrl?: string }}
 */
export async function checkTestnetConnection() {
  const primary = ALEO_RPC_URL;
  const candidates = [primary];
  if (primary.replace(/\/$/, '') !== JSONRPC_PROBE_FALLBACK.replace(/\/$/, '')) {
    candidates.push(JSONRPC_PROBE_FALLBACK);
  }

  let lastFail = null;

  for (const url of candidates) {
    try {
      const { res, detail } = await tryGetMappingValue(url);
      if (res.ok && !detail?.error) {
        const sameAsEnv = url === primary;
        return {
          ok: true,
          message: sameAsEnv
            ? 'Connected to testnet (getMappingValue ok)'
            : `Connected to testnet via probe URL (ALEO_RPC_URL does not accept JSON-RPC POST: use ${JSONRPC_PROBE_FALLBACK} or keep current host for SDK only)`,
          url: primary,
          probeUrl: url,
          detail,
        };
      }
      if (res.ok && detail?.error) {
        return {
          ok: true,
          message: 'Connected to testnet (RPC responded)',
          url: primary,
          probeUrl: url,
          detail,
        };
      }
      if (!res.ok && res.status === 404 && url === primary) {
        lastFail = { status: res.status, detail };
        continue;
      }
      lastFail = { status: res.status, detail, url };
      if (url === candidates[candidates.length - 1]) {
        return {
          ok: false,
          message: `RPC returned HTTP ${res.status}`,
          url: primary,
          detail,
        };
      }
    } catch (err) {
      lastFail = { err };
      if (url === candidates[candidates.length - 1]) {
        return {
          ok: false,
          message: err.message || String(err),
          url: primary,
          detail: err,
        };
      }
    }
  }

  return {
    ok: false,
    message: lastFail?.status ? `RPC returned HTTP ${lastFail.status}` : 'Unknown error',
    url: primary,
    detail: lastFail?.detail,
  };
}

/**
 * Log testnet connection status to console.
 */
export async function logTestnetStatus() {
  const ALEO_RPC_URL = process.env.ALEO_RPC_URL || 'https://testnetbeta.aleorpc.com';
  console.log('🔗 Checking testnet connection...');
  console.log('   RPC URL:', ALEO_RPC_URL);
  const result = await checkTestnetConnection();
  if (result.ok) {
    console.log('   ✅', result.message);
    if (result.probeUrl && result.probeUrl !== ALEO_RPC_URL) {
      console.log('   Probe used:', result.probeUrl, '(ALEO_RPC_URL:', ALEO_RPC_URL + ')');
    }
    if (result.detail?.result != null) {
      console.log('   Latest block height:', result.detail.result);
    }
  } else {
    console.log('   ❌ Not connected:', result.message);
    if (result.detail) {
      console.log('   Detail:', typeof result.detail === 'object' ? JSON.stringify(result.detail).slice(0, 200) : result.detail);
    }
  }
  return result;
}

// Run when executed directly: node src/checkTestnet.js
if (process.argv[1]?.includes('checkTestnet.js')) {
  logTestnetStatus()
    .then((r) => process.exit(r.ok ? 0 : 1))
    .catch((e) => {
      console.error(e);
      process.exit(1);
    });
}
