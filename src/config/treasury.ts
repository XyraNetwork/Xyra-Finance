/**
 * Treasury Configuration
 * 
 * The lending pool uses an external treasury (admin wallet) to hold pool credits.
 * Users must request credits from treasury before completing withdraw/borrow operations.
 */

export const TREASURY_ADDRESS = 'aleo1rhgdu77hgyqd3xjj8ucu3jj9r2krwz6mnzyd80gncr5fxcwlh5rsvzp9px';

export const TREASURY_ADMIN_CONTACT = 'admin@example.com'; // Update with actual contact

export const TREASURY_REQUEST_INSTRUCTIONS = {
  withdraw: (amount: number, userAddress: string) => `
📋 TO COMPLETE WITHDRAW:

1. Request ${amount} credits from treasury
   - Treasury Address: ${TREASURY_ADDRESS}
   - Your Address: ${userAddress}
   - Amount: ${amount} credits

2. Contact treasury admin:
   - Email: ${TREASURY_ADMIN_CONTACT}
   - Or use the "Request Withdraw" button below

3. Wait for credits to arrive:
   - Admin will send credits via credits.aleo/transfer_private
   - Check your wallet for new credits.aleo records
   - Wait 10-30 seconds for wallet to index

4. Complete withdraw:
   - Once you receive credits, click "Complete Withdraw"
   - The contract will validate and update your position
  `,
  
  borrow: (amount: number, userAddress: string) => `
📋 TO COMPLETE BORROW:

1. Request ${amount} credits from treasury
   - Treasury Address: ${TREASURY_ADDRESS}
   - Your Address: ${userAddress}
   - Amount: ${amount} credits

2. Contact treasury admin:
   - Email: ${TREASURY_ADMIN_CONTACT}
   - Or use the "Request Borrow" button below

3. Wait for credits to arrive:
   - Admin will send credits via credits.aleo/transfer_private
   - Check your wallet for new credits.aleo records
   - Wait 10-30 seconds for wallet to index

4. Complete borrow:
   - Once you receive credits, click "Complete Borrow"
   - The contract will validate and update your position
  `,
};

export function getTreasuryRequestMessage(action: 'withdraw' | 'borrow', amount: number, userAddress: string): string {
  return TREASURY_REQUEST_INSTRUCTIONS[action](amount, userAddress);
}
