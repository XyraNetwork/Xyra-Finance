import 'dotenv/config';
import fetch from 'node-fetch';
import { JSONRPCClient } from 'json-rpc-2.0';

const ALEO_RPC_URL = process.env.ALEO_RPC_URL;

if (!ALEO_RPC_URL) {
  console.warn(
    '[backend] ALEO_RPC_URL is not set. Set it in backend/.env based on your frontend CURRENT_RPC_URL.',
  );
}

function createClient() {
  const client = new JSONRPCClient((json) =>
    fetch(ALEO_RPC_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(json),
    }).then((response) => {
      if (response.status === 200) {
        return response.json().then((json) => client.receive(json));
      } else if (json.id !== undefined) {
        return Promise.reject(new Error(`Aleo RPC error: HTTP ${response.status}`));
      }
      return undefined;
    }),
  );
  return client;
}

export const aleoClient = createClient();

