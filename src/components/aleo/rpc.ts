import { JSONRPCClient } from 'json-rpc-2.0';
import { BOUNTY_PROGRAM_ID, CURRENT_NETWORK, CURRENT_RPC_URL } from '@/types';
import { Network } from '@provablehq/aleo-types';
import { frontendLogger } from '@/utils/logger';
import { TREASURY_ADDRESS, getTreasuryRequestMessage } from '@/config/treasury';

// Note: @aleohq/wasm is not imported directly due to WASM build issues in Next.js
// We'll use dynamic import when needed, or fall back to contract call method

// For clarity, alias the lending pool program ID.
export const LENDING_POOL_PROGRAM_ID = BOUNTY_PROGRAM_ID;

/**
 * Debug function to diagnose what records are available in the wallet
 * Call this from the browser console: window.debugRecords(requestRecords)
 */
export async function debugAllRecords(
  requestRecords?: (program: string, includeSpent?: boolean) => Promise<any[]>,
  publicKey?: string
): Promise<any> {
  if (!requestRecords) {
    return { error: 'requestRecords not available. Make sure wallet is connected.' };
  }

  console.log('🔍 === WALLET RECORDS DIAGNOSIS ===');
  
  const results: any = {
    timestamp: new Date().toISOString(),
    publicKey: publicKey?.substring(0, 20) + '...',
    approaches: {},
  };

  let creditsRecordsResult: any = [];
  let lendingPoolRecordsResult: any = [];
  let allRecordsResult: any = [];
  const errors: string[] = [];
  const warnings: string[] = [];

  // Approach 1: Get all records (empty string)
  try {
    console.log('📋 Fetching ALL records (empty string)...');
    const allRecords = await requestRecords('', false);
    allRecordsResult = allRecords || [];
    results.approaches.allRecords = {
      success: true,
      count: allRecords?.length || 0,
      records: allRecords || [],
    };
    console.log('✅ All records:', allRecords?.length || 0);
    if (allRecords && Array.isArray(allRecords)) {
      allRecords.forEach((r: any, i: number) => {
        console.log(`  [${i}] Program: ${r.program_id || r.programId || 'unknown'}, Keys: ${Object.keys(r).join(', ')}`);
      });
    }
  } catch (e: any) {
    const errMsg = `Failed to fetch all records: ${e.message}`;
    console.warn('⚠️', errMsg);
    errors.push(errMsg);
    results.approaches.allRecords = { success: false, error: e.message };
  }

  // Approach 3: Get lending pool records
  try {
    console.log('📋 Fetching LENDING POOL records...');
    const lendingRecords = await requestRecords(LENDING_POOL_PROGRAM_ID, false);
    lendingPoolRecordsResult = lendingRecords || [];
    results.approaches.lendingRecords = {
      success: true,
      count: lendingRecords?.length || 0,
      records: lendingRecords || [],
    };
    console.log('✅ Lending pool records:', lendingRecords?.length || 0);
    if (lendingRecords && Array.isArray(lendingRecords)) {
      lendingRecords.forEach((r: any, i: number) => {
        console.log(`  [${i}]:`, JSON.stringify(r, null, 2).substring(0, 300));
      });
    }
  } catch (e: any) {
    const errMsg = `Failed to fetch lending pool records: ${e.message}`;
    console.warn('⚠️', errMsg);
    errors.push(errMsg);
    results.approaches.lendingRecords = { success: false, error: e.message };
  }

  console.log('🔍 === DIAGNOSIS COMPLETE ===');
  console.log('📊 Summary:', results);
  
  // Store diagnostic in logger
  frontendLogger.storeRecordDiagnostic(
    publicKey,
    creditsRecordsResult,
    lendingPoolRecordsResult,
    allRecordsResult,
    errors,
    warnings
  );
  
  return results;
}

// Default fee for lending pool functions (in credits, will be converted to microcredits).
// If you see fee-related errors in Leo Wallet, you can increase this.
const DEFAULT_LENDING_FEE = 0.2; // 0.2 credits = 200,000 microcredits

// Flag to disable credits record check (for testing purposes)
// When true, skips validation and creates a mock record if none found
const DISABLE_CREDITS_CHECK = false; // Set to false to re-enable checks

// Create the JSON-RPC client
export const client = getClient(CURRENT_RPC_URL);


// returns a string for address-based mappings
export async function fetchMappingValueString(
  mappingName: string,
  key: number
): Promise<string> {
  try {
    const result = await client.request('getMappingValue', {
      programId: LENDING_POOL_PROGRAM_ID,
      mappingName,
      key: `${key}.public`,
    });
    return result.value; // The address is stored as string in 'result.value'
  } catch (error) {
    console.error(`Failed to fetch mapping ${mappingName} with key ${key}:`, error);
    throw error;
  }
}

export async function fetchMappingValueRaw(
  mappingName: string,
  key: string
): Promise<string> {
  try {

    const keyString = `${key}u64`;

    const result = await client.request("getMappingValue", {
      program_id: LENDING_POOL_PROGRAM_ID,
      mapping_name: mappingName,
      key: keyString,
    });

    if (!result) {
      throw new Error(
        `No result returned for mapping "${mappingName}" and key "${keyString}"`
      );
    }

    return result;
  } catch (error) {
    console.error(`Failed to fetch mapping "${mappingName}" with key "${key}":`, error);
    throw error;
  }
}


export async function fetchBountyStatusAndReward(bountyId: string) {
  try {
 
    const keyU64 = `${bountyId}u64`;


    const statusResult = await client.request('getMappingValue', {
      program_id: LENDING_POOL_PROGRAM_ID,
      mapping_name: 'bounty_status',
      key: keyU64,
    });

    const rewardResult = await client.request('getMappingValue', {
      program_id: LENDING_POOL_PROGRAM_ID,
      // In the Leo program this is stored as `bounty_payment`
      mapping_name: 'bounty_payment',
      key: keyU64,
    });

    return {
      status: statusResult?.value ?? statusResult ?? null,
      reward: rewardResult?.value ?? rewardResult ?? null,
    };
  } catch (error) {
    console.error('Error fetching bounty status/reward from chain:', error);
    throw new Error('Failed to fetch chain data');
  }
}

export async function readBountyMappings(bountyId: string) {
  // Fetch raw strings for all mappings
  const creator = await fetchMappingValueRaw('bounty_creator', bountyId);
  const payment = await fetchMappingValueRaw('bounty_payment', bountyId);
  const status = await fetchMappingValueRaw('bounty_status', bountyId);

  return {
    creator,  
    payment,  
    status,   
  };
}

export async function readProposalMappings(bountyId: number, proposalId: number) {
  // Ensure safe arithmetic using BigInt
  const compositeProposalId = (BigInt(bountyId) * BigInt(1_000_000) + BigInt(proposalId)).toString();

  console.log("Fetching data for Composite Proposal ID:", compositeProposalId);

  try {
    // Fetch all mappings related to the proposal
    const proposalBountyId = await fetchMappingValueRaw("proposal_bounty_id", compositeProposalId);
    const proposalProposer = await fetchMappingValueRaw("proposal_proposer", compositeProposalId);
    const proposalStatus = await fetchMappingValueRaw("proposal_status", compositeProposalId);

    return {
      proposalBountyId,
      proposalProposer,
      proposalStatus,
    };
  } catch (error) {
    console.error("Error fetching proposal mappings:", error);
    throw error;
  }
}



/**
 * Utility to fetch program transactions
 */
export async function getProgramTransactions(
  functionName: string,
  page = 0,
  maxTransactions = 100
) {
  return client.request('aleoTransactionsForProgram', {
    programId: LENDING_POOL_PROGRAM_ID,
    functionName,
    page,
    maxTransactions,
  });
}

/**
 * Transfer credits publicly between two accounts.
 */
export async function transferPublic(
  recipient: string,
  amount: string
): Promise<string> {
  const inputs = [
    `${recipient}.public`, // Recipient's public address
    `${amount}u64`,    // Amount to transfer
  ];

  const result = await client.request('executeTransition', {
    programId: CREDITS_PROGRAM_ID,
    functionName: 'transfer_public',
    inputs,
  });

  if (!result.transactionId) {
    throw new Error('Transaction failed: No transactionId returned.');
  }
  return result.transactionId;
}

/**
 * Transfer credits privately between two accounts.
 *
 * This function calls the on-chain "transfer_private" transition,
 * which exactly expects three inputs in the following order:
 *  - r0: Sender's credits record (credits.record)
 *  - r1: Recipient's address with a ".private" suffix (address.private)
 *  - r2: Transfer amount with a "u64.private" suffix (u64.private)
 *
 * It returns two credits records:
 *  - The first output is the recipient's updated credits record.
 *  - The second output is the sender's updated credits record.
 */
export async function transferPrivate(
  senderRecord: string,
  recipient: string,
  amount: string
): Promise<{ recipientRecord: string; senderRecord: string }> {
  // Exactly matching the expected input types:
  const inputs = [
    `${senderRecord}`,         // r0: credits.record
    `${recipient}.private`,    // r1: address.private
    `${amount}u64.private`,     // r2: u64.private
  ];

  const result = await client.request('executeTransition', {
    programId: CREDITS_PROGRAM_ID,
    functionName: 'transfer_private',
    inputs,
  });

  if (!result.transactionId) {
    throw new Error('Transaction failed: No transactionId returned.');
  }

  // The Aleo program returns:
  //   result.outputs[0] -> recipient's updated credits record (r4)
  //   result.outputs[1] -> sender's updated credits record (r5)
  return {
    recipientRecord: result.outputs[0],
    senderRecord: result.outputs[1],
  };
}

/**
 * Call the `main` transition of the `sample.aleo` program.
 *
 * Leo:
 *   transition main(public a: u32, b: u32) -> u32
 */
// ----------------- Lending Pool helpers -----------------

/**
 * Helper: Get the latest UserPosition record or create a new one
 * Returns the record in the format expected by Aleo transitions (as a string)
 */
/**
 * Get the latest UserActivity record from wallet records, or return a zero activity for first-time users.
 * IMPORTANT: Always fetch from wallet records (requestRecords), never use activity from transaction result.
 * This ensures we always have the most up-to-date activity from the contract.
 * 
 * UserActivity contains 4 counters: total_deposits, total_withdrawals, total_borrows, total_repayments
 * Frontend calculates: net_supplied = total_deposits - total_withdrawals
 *                      net_borrowed = total_borrows - total_repayments
 * 
 * For first-time users (no record found), returns a zero activity object that the contract will accept.
 * The contract automatically handles first-time users when all counters are 0.
 * 
 * @param requestRecords - Function to fetch records from wallet
 * @param publicKey - User's public key (for validation and creating zero activity)
 * @returns The latest UserActivity record, or a zero activity object for first-time users
 */
async function getOrCreateActivity(
  requestRecords: (program: string, includeSpent?: boolean) => Promise<any[]>,
  publicKey: string
): Promise<any> {
  try {
    console.log('getOrCreateActivity: Fetching latest records from wallet for program:', LENDING_POOL_PROGRAM_ID);
    // requestRecords takes two parameters: (programId: string, includeSpent?: boolean)
    const records = await requestRecords(LENDING_POOL_PROGRAM_ID, false);
    console.log('getOrCreateActivity: Found records:', records?.length || 0);
    
    if (records && records.length > 0) {
      // Find the most recent UserActivity record
      // Records are typically returned with the newest last, so iterate in reverse
      // IMPORTANT: Always use the LATEST record from wallet, not from transaction result
      for (let i = records.length - 1; i >= 0; i--) {
        const record = records[i];
        console.log('getOrCreateActivity: Checking record', i, ':', typeof record);
        
        // Records from the wallet are typically already in the correct format
        if (typeof record === 'string') {
          // If it's already a string, check if it looks like a UserActivity record
          if (record.includes('owner') || record.includes('total_deposits') || record.includes('total_withdrawals') || 
              record.includes('total_borrows') || record.includes('total_repayments')) {
            console.log('getOrCreateActivity: Found UserActivity record (string format) - using latest from wallet');
            return record;
          }
        } else if (record && typeof record === 'object') {
          // If it's an object, check if it has UserActivity fields
          const recordData = record;
          const hasUserActivityFields = 
            recordData.program_id === LENDING_POOL_PROGRAM_ID || 
            recordData.programId === LENDING_POOL_PROGRAM_ID ||
            recordData.recordName === 'UserActivity' ||
            recordData.type === 'UserActivity' ||
            recordData.recordType === 'UserActivity' ||
            (recordData.data && (
              recordData.data.total_deposits !== undefined || 
              recordData.data.total_withdrawals !== undefined ||
              recordData.data.total_borrows !== undefined ||
              recordData.data.total_repayments !== undefined
            )) ||
            (recordData.total_deposits !== undefined || 
             recordData.total_withdrawals !== undefined ||
             recordData.total_borrows !== undefined ||
             recordData.total_repayments !== undefined);
          
          if (hasUserActivityFields) {
            console.log('getOrCreateActivity: Found UserActivity record (object format) - using latest from wallet');
            // Verify the owner matches (if we can extract it)
            // This ensures we're using the correct user's activity
            if (publicKey && recordData.owner && recordData.owner !== publicKey) {
              console.warn('getOrCreateActivity: Record owner does not match publicKey, continuing search...');
              continue;
            }
            return record; // Return the record object - wallet adapter handles serialization
          }
        }
      }
    }
    
    // No record found - return a zero activity for first-time users
    // The contract will accept this and automatically create the activity
    // The wallet adapter expects records as objects with a specific structure
    console.log('getOrCreateActivity: No existing record found, creating zero activity for first-time user');
    
    // Create a zero activity record object that matches the wallet adapter's expected format
    // The wallet adapter expects records to have a structure similar to what requestRecords returns
    // Format: { program_id, data: { owner, total_deposits, total_withdrawals, total_borrows, total_repayments } }
    const zeroActivityObject = {
      program_id: LENDING_POOL_PROGRAM_ID,
      recordName: 'UserActivity',
      data: {
        owner: `${publicKey}.private`,
        total_deposits: `0u64.private`,
        total_withdrawals: `0u64.private`,
        total_borrows: `0u64.private`,
        total_repayments: `0u64.private`,
      },
    };
    
    console.log('getOrCreateActivity: Created zero activity record object:', zeroActivityObject);
    return zeroActivityObject;
  } catch (error) {
    console.error('getOrCreateActivity: Failed to get activity record from wallet:', error);
    // Return zero activity for first-time users even on error
    // Format it as a proper object structure that matches wallet adapter expectations
    const zeroActivityObject = {
      program_id: LENDING_POOL_PROGRAM_ID,
      recordName: 'UserActivity',
      data: {
        owner: `${publicKey}.private`,
        total_deposits: `0u64.private`,
        total_withdrawals: `0u64.private`,
        total_borrows: `0u64.private`,
        total_repayments: `0u64.private`,
      },
    };
    console.log('getOrCreateActivity: Created zero activity record object (error fallback):', zeroActivityObject);
    return zeroActivityObject;
  }
}

/**
 * Deposit into the lending pool using executeTransaction (starter-style API).
 * v8 API: deposit(public amount: u64) -> (UserActivity, Future)
 */
export async function lendingDeposit(
  executeTransaction: ((tx: any) => Promise<any>) | undefined,
  amount: number,
): Promise<string> {
  console.log('========================================');
  console.log('💰 LENDING DEPOSIT FUNCTION CALLED (executeTransaction)');
  console.log('========================================');
  console.log('📥 Input Parameters:', {
    amount,
    network: CURRENT_NETWORK,
    programId: LENDING_POOL_PROGRAM_ID,
  });

  if (!executeTransaction) {
    throw new Error('executeTransaction is not available from the connected wallet.');
  }

  if (amount <= 0) {
    throw new Error('Deposit amount must be greater than 0');
  }

  try {
    const inputs = [`${amount}u64`];

    // Optional: best-effort deploy check
    try {
      const poolState = await getLendingPoolState();
      console.log('✅ Contract appears to be deployed (pool state accessible)', poolState);
    } catch (deployError: any) {
      console.warn('⚠️ Could not verify contract deployment:', deployError?.message);
    }

    console.log('🔍 Calling executeTransaction for deposit (public fee)...');
    const result = await executeTransaction({
      program: LENDING_POOL_PROGRAM_ID,
      function: 'deposit',
      inputs,
      fee: DEFAULT_LENDING_FEE * 1_000_000,
      // Match aleo-dev-toolkit's ExecuteTransaction example: `privateFee` controls fee privacy
      privateFee: false,
    });

    const tempId: string | undefined = result?.transactionId;
    if (!tempId) {
      throw new Error('Deposit failed: No temporary transactionId returned from wallet.');
    }

    console.log('Temporary Transaction ID (deposit):', tempId);
    return tempId;
  } catch (error: any) {
    console.error('❌ LENDING DEPOSIT FUNCTION FAILED:', error);

    const rawMsg = String(error?.message || error || '').toLowerCase();
    const isCancelled =
      rawMsg.includes('operation was cancelled by the user') ||
      rawMsg.includes('operation was canceled by the user') ||
      rawMsg.includes('user cancelled') ||
      rawMsg.includes('user canceled') ||
      rawMsg.includes('user rejected') ||
      rawMsg.includes('rejected by user') ||
      rawMsg.includes('transaction cancelled by user');

    if (isCancelled) {
      console.warn('💡 Deposit transaction cancelled by user (handled gracefully).');
      // Sentinel value for cancellation – caller should interpret and NOT treat as error.
      return '__CANCELLED__';
    }

    throw new Error(`Deposit transaction failed: ${error?.message || 'Unknown error'}`);
  }
}

/**
 * Borrow from the lending pool using wallet adapter (v8 - simplified API).
 * v8 API: borrow(public amount: u64) -> (UserActivity, Future)
 * - Updates public pool state (total_borrowed, utilization_index)
 * - Updates private user mappings (increments total_borrows counter)
 * - No Credits record needed - just amount
 */
export async function lendingBorrow(
  executeTransaction: ((tx: any) => Promise<any>) | undefined,
  amount: number,
): Promise<string> {
  if (!executeTransaction) {
    throw new Error('executeTransaction is not available from the connected wallet.');
  }

  if (amount <= 0) {
    throw new Error('Borrow amount must be greater than 0');
  }

  try {
    const inputs = [`${amount}u64`];

    // Check pool liquidity (same logic as before)
    try {
      const poolState = await getLendingPoolState();
      const totalSupplied = poolState.totalSupplied ? Number(poolState.totalSupplied) : 0;
      const totalBorrowed = poolState.totalBorrowed ? Number(poolState.totalBorrowed) : 0;
      const availableLiquidity = totalSupplied - totalBorrowed;

      if (totalSupplied === 0) {
        throw new Error('Cannot borrow: No liquidity in the pool. Please deposit first.');
      }

      if (amount > availableLiquidity) {
        throw new Error(
          `Cannot borrow: Insufficient liquidity. Available: ${availableLiquidity}, Requested: ${amount}`,
        );
      }
    } catch (error: any) {
      if (error.message.includes('Cannot borrow')) {
        throw error;
      }
      console.warn('Pool state check failed:', error);
    }

    console.log('🔍 Calling executeTransaction for borrow (public fee)...');
    const result = await executeTransaction({
      program: LENDING_POOL_PROGRAM_ID,
      function: 'borrow',
      inputs,
      fee: DEFAULT_LENDING_FEE * 1_000_000,
      privateFee: false,
    });

    const tempId: string | undefined = result?.transactionId;
    if (!tempId) {
      throw new Error('Borrow failed: No temporary transactionId returned from wallet.');
    }

    console.log('Temporary Transaction ID (borrow):', tempId);
    return tempId;
  } catch (error: any) {
    console.error('❌ LENDING BORROW FUNCTION FAILED:', error);

    const rawMsg = String(error?.message || error || '').toLowerCase();
    const isCancelled =
      rawMsg.includes('operation was cancelled by the user') ||
      rawMsg.includes('operation was canceled by the user') ||
      rawMsg.includes('user cancelled') ||
      rawMsg.includes('user canceled') ||
      rawMsg.includes('user rejected') ||
      rawMsg.includes('rejected by user') ||
      rawMsg.includes('transaction cancelled by user');

    if (isCancelled) {
      console.warn('💡 Borrow transaction cancelled by user (handled gracefully).');
      return '__CANCELLED__';
    }

    throw new Error(`Borrow transaction failed: ${error?.message || 'Unknown error'}`);
  }
}

/**
 * Repay to the lending pool using wallet adapter (v8 - simplified API).
 * v8 API: repay(public amount: u64) -> (UserActivity, Future)
 * - Updates public pool state (total_borrowed, utilization_index)
 * - Updates private user mappings (increments total_repayments counter)
 * - No Credits record needed - just amount
 */
export async function lendingRepay(
  executeTransaction: ((tx: any) => Promise<any>) | undefined,
  amount: number,
): Promise<string> {
  if (!executeTransaction) {
    throw new Error('executeTransaction is not available from the connected wallet.');
  }

  if (amount <= 0) {
    throw new Error('Repay amount must be greater than 0');
  }

  try {
    const inputs = [`${amount}u64`];

    console.log('🔍 Calling executeTransaction for repay (public fee)...');
    const result = await executeTransaction({
      program: LENDING_POOL_PROGRAM_ID,
      function: 'repay',
      inputs,
      fee: DEFAULT_LENDING_FEE * 1_000_000,
      privateFee: false,
    });

    const tempId: string | undefined = result?.transactionId;
    if (!tempId) {
      throw new Error('Repay failed: No temporary transactionId returned from wallet.');
    }

    console.log('Temporary Transaction ID (repay):', tempId);
    return tempId;
  } catch (error: any) {
    console.error('❌ LENDING REPAY FUNCTION FAILED:', error);

    const rawMsg = String(error?.message || error || '').toLowerCase();
    const isCancelled =
      rawMsg.includes('operation was cancelled by the user') ||
      rawMsg.includes('operation was canceled by the user') ||
      rawMsg.includes('user cancelled') ||
      rawMsg.includes('user canceled') ||
      rawMsg.includes('user rejected') ||
      rawMsg.includes('rejected by user') ||
      rawMsg.includes('transaction cancelled by user');

    if (isCancelled) {
      console.warn('💡 Repay transaction cancelled by user (handled gracefully).');
      return '__CANCELLED__';
    }

    throw new Error(`Repay transaction failed: ${error?.message || 'Unknown error'}`);
  }
}

/**
 * Withdraw from the lending pool using wallet adapter (v8 - simplified API).
 * v8 API: withdraw(public amount: u64) -> (UserActivity, Future)
 * - Updates public pool state (total_supplied, utilization_index)
 * - Updates private user mappings (increments total_withdrawals counter)
 * - No Credits record needed - just amount
 */
export async function lendingWithdraw(
  executeTransaction: ((tx: any) => Promise<any>) | undefined,
  amount: number,
): Promise<string> {
  if (!executeTransaction) {
    throw new Error('executeTransaction is not available from the connected wallet.');
  }

  if (amount <= 0) {
    throw new Error('Withdraw amount must be greater than 0');
  }

  try {
    const inputs = [`${amount}u64`];

    console.log('🔍 Calling executeTransaction for withdraw (public fee)...');
    const result = await executeTransaction({
      program: LENDING_POOL_PROGRAM_ID,
      function: 'withdraw',
      inputs,
      fee: DEFAULT_LENDING_FEE * 1_000_000,
      privateFee: false,
    });

    const tempId: string | undefined = result?.transactionId;
    if (!tempId) {
      throw new Error('Withdraw failed: No temporary transactionId returned from wallet.');
    }

    console.log('Temporary Transaction ID (withdraw):', tempId);
    return tempId;
  } catch (error: any) {
    console.error('❌ LENDING WITHDRAW FUNCTION FAILED:', error);

    const rawMsg = String(error?.message || error || '').toLowerCase();
    const isCancelled =
      rawMsg.includes('operation was cancelled by the user') ||
      rawMsg.includes('operation was canceled by the user') ||
      rawMsg.includes('user cancelled') ||
      rawMsg.includes('user canceled') ||
      rawMsg.includes('user rejected') ||
      rawMsg.includes('rejected by user') ||
      rawMsg.includes('transaction cancelled by user');

    if (isCancelled) {
      console.warn('💡 Withdraw transaction cancelled by user (handled gracefully).');
      return '__CANCELLED__';
    }

    throw new Error(`Withdraw transaction failed: ${error?.message || 'Unknown error'}`);
  }
}

/**
 * Accrue interest on the pool using wallet adapter.
 * Calls: lending_pool_v8.aleo/accrue_interest(public delta_index: u64) -> Future
 */
export async function lendingAccrueInterest(
  executeTransaction: ((tx: any) => Promise<any>) | undefined,
  deltaIndex: number
): Promise<string> {
  console.log('========================================');
  console.log('📈 LENDING ACCRUE INTEREST FUNCTION CALLED');
  console.log('========================================');
  console.log('📥 Input Parameters:', {
    deltaIndex,
    network: CURRENT_NETWORK,
    programId: LENDING_POOL_PROGRAM_ID,
  });

  if (!executeTransaction) {
    throw new Error('executeTransaction is not available from the connected wallet.');
  }
  // Use the same default fee logic as other lending functions
  const fee = DEFAULT_LENDING_FEE * 1_000_000;

  try {
    const inputs = [`${deltaIndex}u64`];
    console.log('💰 Transaction Configuration:', {
      inputs,
      fee: `${fee} microcredits`,
    });

    console.log('🔍 Calling executeTransaction for accrue_interest (public fee)...');
    const result = await executeTransaction({
      program: LENDING_POOL_PROGRAM_ID,
      function: 'accrue_interest',
      inputs,
      fee,
      privateFee: false,
    });

    const tempId: string | undefined = result?.transactionId;
    if (!tempId) {
      throw new Error('Accrue interest failed: No temporary transactionId returned from wallet.');
    }

    console.log('Temporary Transaction ID (accrue_interest):', tempId);
    console.log('========================================\n');
    return tempId;
  } catch (error: any) {
    console.error('========================================');
    console.error('❌ LENDING ACCRUE INTEREST FUNCTION FAILED');
    console.error('========================================');
    console.error('📋 Error Details:', {
      message: error?.message,
      name: error?.name,
      stack: error?.stack,
      error: error,
    });
    console.error('========================================\n');

    const rawMsg = String(error?.message || error || '').toLowerCase();
    const isCancelled =
      rawMsg.includes('operation was cancelled by the user') ||
      rawMsg.includes('operation was canceled by the user') ||
      rawMsg.includes('user cancelled') ||
      rawMsg.includes('user canceled') ||
      rawMsg.includes('user rejected') ||
      rawMsg.includes('rejected by user') ||
      rawMsg.includes('transaction cancelled by user');

    if (isCancelled) {
      console.warn('💡 Accrue interest transaction cancelled by user (handled gracefully).');
      return '__CANCELLED__';
    }

    throw new Error(`Accrue interest transaction failed: ${error?.message || 'Unknown wallet error'}`);
  }
}

/**
 * Read global pool state from mappings.
 * Keys are always GLOBAL_KEY = 0u8 in the Leo program.
 */
export async function getLendingPoolState(): Promise<{
  totalSupplied: string | null;
  totalBorrowed: string | null;
  utilizationIndex: string | null;
  interestIndex: string | null;
}> {
  const key = '0u8';

  try {
    // Note: Public RPC endpoints may not support 'getMappingValue' method
    // This will trigger CORS preflight (OPTIONS) requests
    // If the method is not supported, we'll catch the error and return nulls
    
    // Wrap client.request in Promise.resolve to ensure it's a proper Promise
    const requestWithErrorHandling = async (mappingName: string) => {
      try {
        return await Promise.resolve(client.request('getMappingValue', {
          program_id: LENDING_POOL_PROGRAM_ID,
          mapping_name: mappingName,
          key,
        }));
      } catch (err: any) {
        console.warn(`getLendingPoolState: Failed to fetch ${mappingName}:`, err?.message);
        return null;
      }
    };
    
    const [supplied, borrowed, utilization, interest] = await Promise.all([
      requestWithErrorHandling('total_supplied'),
      requestWithErrorHandling('total_borrowed'),
      requestWithErrorHandling('utilization_index'),
      requestWithErrorHandling('interest_index'),
    ]);

    const extract = (res: any): string | null => {
      if (res == null) return null;
      const raw = res.value ?? res ?? null;
      if (raw == null) return null;
      const str = String(raw);
      // Strip common Leo suffixes like "u64" so the UI shows plain numbers.
      return str.replace(/u64$/i, '');
    };

    return {
      totalSupplied: extract(supplied),
      totalBorrowed: extract(borrowed),
      utilizationIndex: extract(utilization),
      interestIndex: extract(interest),
    };
  } catch (error: any) {
    console.error('getLendingPoolState: Error fetching pool state:', error);
    return {
      totalSupplied: null,
      totalBorrowed: null,
      utilizationIndex: null,
      interestIndex: null,
    };
  }
}

/**
 * Get address hash from contract (helper function for v8).
 * Calls: lending_pool_v8.aleo/get_address_hash() -> field
 */
export async function getAddressHashFromContract(
  requestTransaction: ((transaction: any) => Promise<string>) | undefined,
  publicKey: string,
  requestTransactionHistory?: (program: string) => Promise<any[]>
): Promise<string | null> {
  if (!requestTransaction || !publicKey) {
    throw new Error('Wallet not connected or requestTransaction unavailable');
  }

  try {
    const inputs: string[] = [];
    const fee = DEFAULT_LENDING_FEE * 1_000_000;
    const chainId = CURRENT_NETWORK === Network.TESTNET 
      ? Network.TESTNET 
      : String(CURRENT_NETWORK);
    
    const transaction = {
      programId: LENDING_POOL_PROGRAM_ID,
      functionName: 'get_address_hash',
      inputs,
      fee,
      chainId,
    };
    
    const txId = await requestTransaction(transaction);
    console.log('✅ get_address_hash transaction submitted:', txId);
    
    // Wait for transaction to finalize and extract hash from output
    // Note: This is a simplified version - you may need to adjust based on actual transaction output format
    return txId;
  } catch (error: any) {
    console.error('getAddressHashFromContract failed:', error);
    return null;
  }
}

/**
 * Get user activity from contract (helper function for v8).
 * Calls: lending_pool_v8.aleo/get_user_activity() -> (UserActivity, Future)
 */
export async function getUserActivityFromContract(
  requestTransaction: ((transaction: any) => Promise<string>) | undefined,
  publicKey: string
): Promise<string | null> {
  if (!requestTransaction || !publicKey) {
    throw new Error('Wallet not connected or requestTransaction unavailable');
  }

  try {
    const inputs: string[] = [];
    const fee = DEFAULT_LENDING_FEE * 1_000_000;
    const chainId = CURRENT_NETWORK === Network.TESTNET 
      ? Network.TESTNET 
      : String(CURRENT_NETWORK);
    
    const transaction = {
      programId: LENDING_POOL_PROGRAM_ID,
      functionName: 'get_user_activity',
      inputs,
      fee,
      chainId,
    };
    
    const txId = await requestTransaction(transaction);
    console.log('✅ get_user_activity transaction submitted:', txId);
    
    return txId;
  } catch (error: any) {
    console.error('getUserActivityFromContract failed:', error);
    return null;
  }
}

/**
 * Create test credits (for testing only - v8 does not have this function).
 * Note: v8 does not have create_test_credits function
 */
export async function createTestCredits(
  requestTransaction: ((transaction: any) => Promise<string>) | undefined,
  publicKey: string,
  amount: number
): Promise<string> {
  // Note: v8 does not have create_test_credits function
  // This function is kept for backward compatibility but will throw an error
  throw new Error('v8 does not support create_test_credits. Use actual credits.aleo records from your wallet.');
}

/**
 * Deposit test with real credits (for testing only - v8 does not have this function).
 * Note: v8 does not have deposit_test function
 */
export async function depositTestReal(
  requestTransaction: ((transaction: any) => Promise<string>) | undefined,
  publicKey: string,
  amount: number,
  requestRecords?: (program: string, includeSpent?: boolean) => Promise<any[]>
): Promise<string> {
  // Note: v8 does not have deposit_test function
  // This function is kept for backward compatibility but will throw an error
  throw new Error('v8 does not support deposit_test. Use the regular deposit function instead.');
}

/**
 * Repay borrowed amount to the pool using wallet adapter.
export async function lendingRepay(
  requestTransaction: ((transaction: any) => Promise<string>) | undefined,
  publicKey: string,
  amount: number,
  requestRecords?: (program: string, includeSpent?: boolean) => Promise<any[]>
): Promise<string> {
  console.log('========================================');
  console.log('💰 LENDING REPAY FUNCTION CALLED (Option 1 - Real Tokens)');
  console.log('========================================');
  
  if (!requestTransaction || !publicKey) {
    throw new Error('Wallet not connected or requestTransaction unavailable');
  }

  if (!requestRecords) {
    throw new Error('requestRecords is not available. Please ensure your wallet is connected.');
  }

  const chainId = CURRENT_NETWORK === Network.TESTNET 
    ? Network.TESTNET 
    : String(CURRENT_NETWORK);
  
  const fee = DEFAULT_LENDING_FEE * 1_000_000;

  try {
    // Option 1: Fetch credits record from wallet (real Aleo tokens)
    console.log('🔍 Step 1: Fetching credits records from wallet...');
    console.log('📋 Credits Program ID:', CREDITS_PROGRAM_ID);
    console.log('📋 requestRecords function:', typeof requestRecords);
    
    // Convert amount (in credits) to microcredits (1 credit = 1_000_000 microcredits)
    const requiredMicrocredits = amount * 1_000_000;
    
    // Fetch all credits records from wallet
    let allCreditsRecords: any[] = [];
    try {
      // requestRecords takes two parameters: (programId: string, includeSpent?: boolean)
      // includeSpent: false = only unspent records, true = include spent records
      allCreditsRecords = await requestRecords(CREDITS_PROGRAM_ID, false);
      console.log(`📋 requestRecords returned:`, {
        isArray: Array.isArray(allCreditsRecords),
        length: allCreditsRecords?.length || 0,
        type: typeof allCreditsRecords,
        firstRecord: allCreditsRecords?.[0] ? JSON.stringify(allCreditsRecords[0]).substring(0, 200) : 'none',
      });
    } catch (recordsError: any) {
      console.error('❌ Error fetching credits records:', {
        message: recordsError?.message,
        error: recordsError,
      });
      // PHASE 3: Provide helpful error message with test credits option
      console.log('💡 PHASE 3: No credits records found for repay. For testing:');
        console.log('   Get Aleo credits from: https://faucet.aleo.org/ (testnet)');
        console.log('   Wait 10-30 seconds after receiving credits for wallet to index them');
        throw new Error(
          `No credits.aleo records found in wallet. ` +
          `Please: 1) Get Aleo credits from the testnet faucet (https://faucet.aleo.org/), ` +
          `2) Wait 10-30 seconds for wallet to index the new records, ` +
          `3) Then try repay again. ` +
          `Required: ${requiredMicrocredits} microcredits (${amount} credits) + ${fee / 1_000_000} credits fee. ` +
          `Error: ${recordsError?.message || 'Unknown error'}`
        );
    }
    
    if (!allCreditsRecords || !Array.isArray(allCreditsRecords) || allCreditsRecords.length === 0) {
      if (DISABLE_CREDITS_CHECK) {
        console.warn('⚠️ CREDITS CHECK DISABLED: No credits records found, but check is disabled. Creating mock record for testing.');
        // Create a mock credits record structure for testing
        allCreditsRecords = [{
          data: {
            owner: publicKey,
            microcredits: `${requiredMicrocredits + fee}u64.private`,
          },
          spent: false,
          program_id: CREDITS_PROGRAM_ID,
        }];
        console.log('📋 Created mock credits record:', allCreditsRecords[0]);
      } else {
        console.error('❌ No credits records found:', {
          allCreditsRecords,
          isArray: Array.isArray(allCreditsRecords),
          length: allCreditsRecords?.length,
        });
        throw new Error(
          'No credits records found in wallet. ' +
          'Please ensure: 1) You have Aleo credits in your wallet, 2) Your wallet is connected, ' +
          '3) You have granted record access permissions to the app.'
        );
      }
    }
    
    console.log(`📋 Found ${allCreditsRecords.length} total credits records`);
    
    // Log record structure for debugging
    if (allCreditsRecords.length > 0) {
      console.log('📋 Sample record structure:', {
        record: allCreditsRecords[0],
        hasData: !!allCreditsRecords[0]?.data,
        hasMicrocredits: !!allCreditsRecords[0]?.data?.microcredits,
        microcreditsValue: allCreditsRecords[0]?.data?.microcredits,
        spent: allCreditsRecords[0]?.spent,
        keys: Object.keys(allCreditsRecords[0] || {}),
      });
    }
    
    // Filter for private, unspent records
    // Try multiple record formats
    const privateRecords = allCreditsRecords.filter((record: any) => {
      // Check if record has microcredits field (could be in data or directly on record)
      const microcredits = record.data?.microcredits || record.microcredits;
      const isPrivate = microcredits && (
        typeof microcredits === 'string' && microcredits.endsWith('u64.private')
      );
      return isPrivate;
    });
    
    console.log(`📋 Found ${privateRecords.length} private credits records`);
    
    const unspentRecords = privateRecords.filter((record: any) => {
      const spent = record.spent === false || record.spent === undefined || record.data?.spent === false;
      return spent;
    });
    
    console.log(`📋 Found ${unspentRecords.length} unspent private credits records`);
    
    if (unspentRecords.length === 0) {
      // Provide more helpful error message
      const allSpent = privateRecords.length > 0 && privateRecords.every((r: any) => r.spent === true);
      if (DISABLE_CREDITS_CHECK) {
        console.warn('⚠️ CREDITS CHECK DISABLED: No unspent records, but check is disabled. Creating mock record for testing.');
        // Create a mock unspent record
        unspentRecords.push({
          data: {
            owner: publicKey,
            microcredits: `${requiredMicrocredits + fee}u64.private`,
          },
          spent: false,
          program_id: CREDITS_PROGRAM_ID,
        });
        console.log('📋 Created mock unspent credits record');
      } else {
        if (allSpent) {
          throw new Error('All credits records are already spent. Please wait for new records or receive more credits.');
        } else {
          throw new Error(
            'No unspent credits records available. ' +
            `Found ${privateRecords.length} private records but all are marked as spent. ` +
            'Please ensure you have available Aleo credits in your wallet.'
          );
        }
      }
    }
    
    // Helper to extract microcredits value
    const extractMicrocredits = (valueStr: string | undefined): number => {
      if (!valueStr || typeof valueStr !== 'string') return 0;
      const match = valueStr.match(/^(\d+)/);
      return match ? parseInt(match[1], 10) : 0;
    };
    
    // Find a record with enough microcredits (including fee)
    const totalNeeded = requiredMicrocredits + fee;
    console.log('💰 Credit requirements:', {
      amount: `${amount} credits`,
      requiredMicrocredits: `${requiredMicrocredits} microcredits`,
      fee: `${fee} microcredits`,
      totalNeeded: `${totalNeeded} microcredits (${totalNeeded / 1_000_000} credits)`,
    });
    
    let suitableRecord = unspentRecords.find((record: any) => {
      // Try both record.data.microcredits and record.microcredits
      const microcreditsStr = record.data?.microcredits || record.microcredits;
      const recordMicrocredits = extractMicrocredits(microcreditsStr);
      console.log('🔍 Checking record:', {
        microcreditsStr,
        recordMicrocredits,
        totalNeeded,
        sufficient: recordMicrocredits >= totalNeeded,
      });
      return recordMicrocredits >= totalNeeded;
    });
    
    if (!suitableRecord) {
      const recordAmounts = unspentRecords.map((r: any) => {
        const microcreditsStr = r.data?.microcredits || r.microcredits;
        return extractMicrocredits(microcreditsStr);
      });
      const maxAvailable = recordAmounts.length > 0 ? Math.max(...recordAmounts) : 0;
      const totalAvailable = recordAmounts.reduce((sum, amt) => sum + amt, 0);
      
      console.error('❌ No suitable record found:', {
        totalNeeded: `${totalNeeded} microcredits`,
        maxAvailable: `${maxAvailable} microcredits`,
        totalAvailable: `${totalAvailable} microcredits`,
        recordAmounts,
      });
      
      throw new Error(
        `Insufficient credits. Need ${totalNeeded / 1_000_000} credits (${amount} repay + ${fee / 1_000_000} fee), ` +
        `but largest available record has ${maxAvailable / 1_000_000} credits. ` +
        `Total available: ${totalAvailable / 1_000_000} credits across ${unspentRecords.length} records.`
      );
    }
    
    console.log('✅ Found suitable credits record:', {
      microcredits: suitableRecord.data?.microcredits || suitableRecord.microcredits,
      owner: suitableRecord.data?.owner || suitableRecord.owner,
      recordStructure: Object.keys(suitableRecord),
    });
    
    // Prepare the credits record for the transaction
    // The record format should match what the contract expects
    // Contract expects: { owner: address, microcredits: u64 }
    // When fetched from wallet, records have owner at top level and data fields nested
    // IMPORTANT: Pass as Leo record literal STRING with .private visibility modifiers
    // PHASE 3: Pass the record object directly to wallet adapter
    // The wallet adapter expects the actual record object from requestRecords, not a string
    console.log('✅ Using Credits Record Object for Transaction:', {
      recordId: suitableRecord.id,
      owner: suitableRecord.owner || suitableRecord.data?.owner,
      microcredits: suitableRecord.data?.microcredits || suitableRecord.microcredits,
      programId: suitableRecord.program_id,
      recordName: suitableRecord.recordName,
      spent: suitableRecord.spent,
    });
    
    // Call repay transition with amount and credits record object
    // Contract validates record owner and amount, then consumes the record
    // Pass record object directly (wallet adapter handles serialization)
    const repayInputs = [`${amount}u64`, suitableRecord];
    
    console.log('lendingRepay: Transaction inputs:', {
      amount: `${amount} credits`,
      requiredMicrocredits: `${requiredMicrocredits} microcredits`,
      fee: `${fee} microcredits`,
      creditsRecord: '[Record Object]',
      recordId: suitableRecord.id,
      programId: LENDING_POOL_PROGRAM_ID,
      chainId,
    });
    
    console.log('🔍 Step 2: Creating transaction object...');
    const repayTransaction = Transaction.createTransaction(
      publicKey,
      chainId,
      LENDING_POOL_PROGRAM_ID,
      'repay',
      repayInputs,
      fee,
      false
    );

    console.log('✅ Transaction object created');
    console.log('🔍 Step 3: Requesting transaction signature from wallet...');
    const repayTxId = await requestTransaction(repayTransaction);
    console.log('✅ Transaction submitted successfully!');
    console.log('📤 Transaction ID:', repayTxId);
    
    return repayTxId;
  } catch (error: any) {
    console.error('========================================');
    console.error('❌ LENDING REPAY FUNCTION FAILED');
    console.error('========================================');
    console.error('📋 Error Details:', {
      message: error?.message,
      name: error?.name,
      stack: error?.stack,
      error: error,
    });
    console.error('========================================\n');
    throw new Error(`Repay transaction failed: ${error?.message || 'Unknown wallet error'}`);
  }
}

/**
 * Withdraw supplied liquidity from the pool using wallet adapter.
 * Following basic_bank.aleo pattern - contract reads user data from mappings automatically.
 * - Updates public pool state (total_supplied, utilization_index)
 * - Updates private user mappings (increments total_withdrawals counter)
 * Returns: (UserActivity, Future) - both updated in one transaction
 * No need to pass old_activity - contract reads from mappings using hashed address
 */

/**
 * Accrue interest on the pool using wallet adapter.
 * Calls: lending_pool_v8.aleo/accrue_interest(public delta_index: u64) -> Future
 */

// Cache for address hashes to avoid recomputing
const addressHashCache = new Map<string, string>();

/**
 * Compute BHP256 hash of an Aleo address directly in JavaScript (no transaction needed!).
 * 
 * This computes BHP256::hash_to_field(address) which is used as the key
 * for reading user activity from public mappings.
 * 
 * Uses @aleohq/wasm library to compute the hash client-side.
 * The hash is cached to avoid recomputing.
 * 
 * @param address - Aleo address (aleo1...)
 * @returns Hash as field value (string representation), or null if failed
 */
function computeAddressHash(address: string): string | null {
  try {
    // Check cache first
    if (addressHashCache.has(address)) {
      const cachedHash = addressHashCache.get(address);
      console.log('computeAddressHash: Using cached hash for:', address);
      return cachedHash || null;
    }
    
    console.log('computeAddressHash: BHP256 hash computation via @aleohq/wasm is currently disabled');
    console.log('computeAddressHash: Reason: WASM build issues in Next.js (wbg module resolution)');
    console.log('computeAddressHash: Falling back to contract call method or records method');
    
    // TODO: Once @aleohq/wasm is properly configured with Next.js, implement BHP256 hashing here
    // The implementation would be:
    // 1. Dynamically import @aleohq/wasm (to avoid build-time issues)
    // 2. Use Address.from_string(address)
    // 3. Call BHP256::hash_to_field() equivalent
    // 4. Return the hash as a field string
    
    return null;
  } catch (error) {
    console.error('computeAddressHash: Failed to compute hash:', error);
    return null;
  }
}

/**
 * Read user's activity from UserActivity records returned by contract transitions.
/**
 * Read user's activity from UserActivity records returned by contract transitions.
 * 
 * IMPORTANT: The records returned by contract transitions show the LATEST transaction amounts,
 * not cumulative totals. The contract updates mappings correctly, but the returned records
 * are placeholders showing only the current transaction.
 * 
 * For EXACT cumulative values, we need to read from mappings using the hash method.
 * However, for simplicity, this function reads from records (which show latest transaction).
 * 
 * @param publicKey - User's Aleo address (aleo1...)
 * @param requestRecords - Function from useWallet() to request records (required)
 * @param requestTransaction - Function to call contract transitions (optional, for hash method)
 */
export async function getUserPosition(
  publicKey?: string,
  requestRecords?: (program: string, includeSpent?: boolean) => Promise<any[]>,
  requestTransaction?: ((transaction: any) => Promise<string>) | undefined,
  transactionStatus?: (txId: string) => Promise<any>,
  requestTransactionHistory?: (programId: string) => Promise<any[]>
): Promise<{
  supplied: string | null;
  borrowed: string | null;
  totalDeposits: string | null;
  totalWithdrawals: string | null;
  totalBorrows: string | null;
  totalRepayments: string | null;
}> {
  // Note: The contract returns UserActivity records, but they are placeholders (show current transaction, not cumulative)
  // The actual cumulative values are in mappings, which require hash computation to read
  // For simplicity, we'll read from records (which show latest transaction amounts)
  // The contract logic correctly updates mappings in finalize functions
  
  // Fallback: Read from records (may be placeholders, but better than nothing)
  if (!requestRecords) {
    console.warn('getUserPosition: requestRecords not available');
    return { 
      supplied: '0', 
      borrowed: '0',
      totalDeposits: '0',
      totalWithdrawals: '0',
      totalBorrows: '0',
      totalRepayments: '0',
    };
  }
  if (!requestRecords) {
    console.warn('getUserPosition: requestRecords not available');
    return { 
      supplied: '0', 
      borrowed: '0',
      totalDeposits: '0',
      totalWithdrawals: '0',
      totalBorrows: '0',
      totalRepayments: '0',
    };
  }

  try {
    // Request all UserActivity records from the wallet for lending_pool_v8.aleo
    // These are PRIVATE records - only visible to the wallet owner
    console.log('========================================');
    console.log('🔍 getUserPosition: RECORD FETCH DEBUG');
    console.log('========================================');
    console.log('Step 1: Calling requestRecords with program ID:', LENDING_POOL_PROGRAM_ID);
    console.log('User Address:', publicKey);
    console.log('requestRecords function type:', typeof requestRecords);
    
    // Request records from current program only (lending_pool_v8.aleo)
    let records: any[] | null = null;
    
    try {
      console.log('Requesting records for program:', LENDING_POOL_PROGRAM_ID);
      // requestRecords takes two parameters: (programId: string, includeSpent?: boolean)
      records = await requestRecords(LENDING_POOL_PROGRAM_ID, false);
      console.log('requestRecords returned:', records?.length || 0, 'records');
      
      if (records && Array.isArray(records) && records.length > 0) {
        console.log('✅ Successfully got records from current program');
      } else {
        console.warn('⚠️ No records found for current program');
      }
    } catch (recordsError: any) {
      console.warn('requestRecords failed:', recordsError?.message);
      records = null;
    }
    
    console.log('Final records result:');
    console.log('  - Records:', records);
    console.log('  - Is Array:', Array.isArray(records));
    console.log('  - Records Count:', records?.length || 0);
    console.log('  - Records Type:', typeof records);
    console.log('  - Is Null:', records === null);
    console.log('  - Is Undefined:', records === undefined);
    console.log('  - Full Records (first 1000 chars):', JSON.stringify(records, null, 2).substring(0, 1000));
    console.log('========================================');
    
    // Check if records is null, undefined, or empty
    if (records === null || records === undefined) {
      console.error('❌ getUserPosition: requestRecords returned null or undefined');
      console.error('This might mean:');
      console.error('  1. The wallet has not indexed records yet');
      console.error('  2. requestRecords function is not working correctly');
      console.error('  3. Permission issue with the wallet');
      return { 
        supplied: '0', 
        borrowed: '0',
        totalDeposits: '0',
        totalWithdrawals: '0',
        totalBorrows: '0',
        totalRepayments: '0',
      };
    }
    
    if (!Array.isArray(records)) {
      console.error('❌ getUserPosition: requestRecords did not return an array');
      console.error('Returned type:', typeof records);
      console.error('Returned value:', records);
      // Try to convert to array if it's an object
      if (records && typeof records === 'object') {
        console.log('Attempting to convert object to array...');
        records = Object.values(records);
        console.log('Converted records:', records);
      } else {
        return { 
          supplied: '0', 
          borrowed: '0',
          totalDeposits: '0',
          totalWithdrawals: '0',
          totalBorrows: '0',
          totalRepayments: '0',
        };
      }
    }
    
    if (records.length === 0) {
      console.error('❌ getUserPosition: NO RECORDS FOUND (array is empty)');
      console.error('This means the wallet has not indexed the UserActivity record yet.');
      console.error('Solutions:');
      console.error('  1. Wait 10-30 seconds after transaction finalizes');
      console.error('  2. Disconnect and reconnect wallet');
      console.error('  3. Check if transaction actually completed on explorer');
      console.error('  4. Check wallet activity view to see if records are there');
      return { 
        supplied: '0', 
        borrowed: '0',
        totalDeposits: '0',
        totalWithdrawals: '0',
        totalBorrows: '0',
        totalRepayments: '0',
      };
    }

    // Calculate CUMULATIVE totals by summing ALL UserActivity records
    // Each transaction creates a new record with the transaction amount
    // Summing all records gives the cumulative total (matching the mappings)
    let cumulativeTotalDeposits = 0;
    let cumulativeTotalWithdrawals = 0;
    let cumulativeTotalBorrows = 0;
    let cumulativeTotalRepayments = 0;
    let recordsProcessed = 0;

    // Iterate through ALL records and sum them up
    console.log('📊 Processing', records.length, 'records...');
    for (let i = 0; i < records.length; i++) {
      const record = records[i];
      try {
        console.log(`\n--- Processing Record ${i + 1}/${records.length} ---`);
        console.log('Record type:', typeof record);
        console.log('Record:', record);
        
        let recordData: any;
        if (typeof record === 'string') {
          try {
            recordData = JSON.parse(record);
            console.log('Parsed from JSON string');
          } catch {
            recordData = { raw: record };
            console.log('Could not parse as JSON, treating as raw string');
          }
        } else {
          recordData = record;
          console.log('Record is already an object');
        }
        
        console.log('Record Data:', JSON.stringify(recordData, null, 2));
        console.log('Record Keys:', recordData ? Object.keys(recordData) : 'null');
        
        // Check if this is a UserActivity record - be more lenient
        const hasUserActivityFields = 
          (recordData.data && (
            recordData.data.total_deposits !== undefined || 
            recordData.data.total_withdrawals !== undefined ||
            recordData.data.total_borrows !== undefined ||
            recordData.data.total_repayments !== undefined
          )) ||
          (recordData.total_deposits !== undefined || 
           recordData.total_withdrawals !== undefined ||
           recordData.total_borrows !== undefined ||
           recordData.total_repayments !== undefined);
        
        const matchesProgram = 
          recordData.program_id === LENDING_POOL_PROGRAM_ID || 
          recordData.programId === LENDING_POOL_PROGRAM_ID ||
          recordData.program === LENDING_POOL_PROGRAM_ID;
        
        const isUserActivity = hasUserActivityFields || matchesProgram;
        
        console.log('Is UserActivity?', isUserActivity);
        console.log('  - Has UserActivity fields:', hasUserActivityFields);
        console.log('  - Matches program:', matchesProgram);
        
        if (isUserActivity || hasUserActivityFields) {
          console.log('✅ Found UserActivity record!');
          
          // Helper function to extract numeric value from various formats
          const extractValue = (value: any): number | undefined => {
            if (value === undefined || value === null) return undefined;
            
            // If it's already a number
            if (typeof value === 'number') {
              return isNaN(value) ? undefined : value;
            }
            
            // If it's a string, try to parse it
            if (typeof value === 'string') {
              // Handle formats like "100u64.private", "100u64", "100"
              // Remove ".private", ".public", "u64" suffixes
              const cleaned = value.replace(/\.(private|public)$/, '').replace(/u64$/, '').trim();
              const num = Number(cleaned);
              return isNaN(num) ? undefined : num;
            }
            
            return undefined;
          };
          
          // Try multiple possible record structures
          let totalDeposits: number | undefined;
          let totalWithdrawals: number | undefined;
          let totalBorrows: number | undefined;
          let totalRepayments: number | undefined;
          
          // Structure 1: recordData.data.total_deposits (nested data) - THIS IS THE ACTUAL FORMAT!
          if (recordData.data) {
            // Values are like "0u64.private" or "100u64.private"
            totalDeposits = extractValue(recordData.data.total_deposits);
            totalWithdrawals = extractValue(recordData.data.total_withdrawals);
            totalBorrows = extractValue(recordData.data.total_borrows);
            totalRepayments = extractValue(recordData.data.total_repayments);
            console.log('getUserPosition: Extracted from data - deposits:', totalDeposits, 'withdrawals:', totalWithdrawals, 'borrows:', totalBorrows, 'repayments:', totalRepayments);
          }
          
          // Structure 2: recordData.total_deposits (top level)
          if (totalDeposits === undefined && recordData.total_deposits !== undefined) {
            console.log('📦 Trying top-level total_deposits');
            totalDeposits = extractValue(recordData.total_deposits);
          }
          if (totalWithdrawals === undefined && recordData.total_withdrawals !== undefined) {
            totalWithdrawals = extractValue(recordData.total_withdrawals);
          }
          if (totalBorrows === undefined && recordData.total_borrows !== undefined) {
            totalBorrows = extractValue(recordData.total_borrows);
          }
          if (totalRepayments === undefined && recordData.total_repayments !== undefined) {
            totalRepayments = extractValue(recordData.total_repayments);
          }
          
          // Structure 3: Deep search in the object
          if (totalDeposits === undefined || totalWithdrawals === undefined || totalBorrows === undefined || totalRepayments === undefined) {
            const searchInObject = (obj: any, key: string): any => {
              if (!obj || typeof obj !== 'object') return undefined;
              if (key in obj) return obj[key];
              for (const k in obj) {
                if (typeof obj[k] === 'object') {
                  const found = searchInObject(obj[k], key);
                  if (found !== undefined) return found;
                }
              }
              return undefined;
            };
            
            if (totalDeposits === undefined) {
              totalDeposits = extractValue(searchInObject(recordData, 'total_deposits'));
            }
            if (totalWithdrawals === undefined) {
              totalWithdrawals = extractValue(searchInObject(recordData, 'total_withdrawals'));
            }
            if (totalBorrows === undefined) {
              totalBorrows = extractValue(searchInObject(recordData, 'total_borrows'));
            }
            if (totalRepayments === undefined) {
              totalRepayments = extractValue(searchInObject(recordData, 'total_repayments'));
            }
          }
          
          console.log('getUserPosition: Extracted values from record - deposits:', totalDeposits, 'withdrawals:', totalWithdrawals, 'borrows:', totalBorrows, 'repayments:', totalRepayments);
          
          // Sum up all values to get cumulative totals
          // Each record represents one transaction, so summing all gives cumulative
          if (totalDeposits !== undefined && !isNaN(totalDeposits)) {
            cumulativeTotalDeposits += totalDeposits;
          }
          if (totalWithdrawals !== undefined && !isNaN(totalWithdrawals)) {
            cumulativeTotalWithdrawals += totalWithdrawals;
          }
          if (totalBorrows !== undefined && !isNaN(totalBorrows)) {
            cumulativeTotalBorrows += totalBorrows;
          }
          if (totalRepayments !== undefined && !isNaN(totalRepayments)) {
            cumulativeTotalRepayments += totalRepayments;
          }
          
          recordsProcessed++;
          console.log('getUserPosition: Cumulative totals so far - deposits:', cumulativeTotalDeposits, 'withdrawals:', cumulativeTotalWithdrawals, 'borrows:', cumulativeTotalBorrows, 'repayments:', cumulativeTotalRepayments);
        }
      } catch (e) {
        // Skip records that can't be parsed
        console.warn('getUserPosition: Failed to parse record:', e, record);
      }
    }

    // Calculate net positions from the cumulative counters
    const calculatedNetSupplied = cumulativeTotalDeposits - cumulativeTotalWithdrawals;
    const calculatedNetBorrowed = cumulativeTotalBorrows - cumulativeTotalRepayments;

    console.log('========================================');
    console.log('📊 getUserPosition: CUMULATIVE TOTALS FROM RECORDS');
    console.log('========================================');
    console.log('📝 Records Processed:', recordsProcessed, 'out of', records.length);
    console.log('💰 Cumulative Activity Totals (Sum of All Records):');
    console.log('  - Total Deposits:', cumulativeTotalDeposits, '(sum of all deposit records)');
    console.log('  - Total Withdrawals:', cumulativeTotalWithdrawals, '(sum of all withdrawal records)');
    console.log('  - Total Borrows:', cumulativeTotalBorrows, '(sum of all borrow records)');
    console.log('  - Total Repayments:', cumulativeTotalRepayments, '(sum of all repay records)');
    console.log('📈 Net Positions:');
    console.log('  - Net Supplied:', calculatedNetSupplied, '(deposits - withdrawals)');
    console.log('  - Net Borrowed:', calculatedNetBorrowed, '(borrows - repayments)');
    console.log('========================================');
    console.log('ℹ️  Note: These are cumulative totals calculated by summing all UserActivity records.');
    console.log('ℹ️  Each transaction creates a new record, so summing all gives the cumulative total.');
    console.log('========================================');

    // Return net positions (for backward compatibility) and individual counters
    // All values are returned as strings for display
    return {
      supplied: String(calculatedNetSupplied >= 0 ? calculatedNetSupplied : 0), // Net supplied (deposits - withdrawals)
      borrowed: String(calculatedNetBorrowed >= 0 ? calculatedNetBorrowed : 0), // Net borrowed (borrows - repayments)
      totalDeposits: String(cumulativeTotalDeposits), // Cumulative deposits (sum of all records)
      totalWithdrawals: String(cumulativeTotalWithdrawals), // Cumulative withdrawals (sum of all records)
      totalBorrows: String(cumulativeTotalBorrows), // Cumulative borrows (sum of all records)
      totalRepayments: String(cumulativeTotalRepayments), // Cumulative repayments (sum of all records)
    };
  } catch (error) {
    console.error('getUserPosition: Failed to fetch user activity from private records:', error);
    return { 
      supplied: '0', 
      borrowed: '0',
      totalDeposits: '0',
      totalWithdrawals: '0',
      totalBorrows: '0',
      totalRepayments: '0',
    };
  }
}

/**
 * 1. Post Bounty
 */
export async function postBounty(
  caller: string,
  bountyId: number,
  reward: number
): Promise<string> {
  const inputs = [
    `${caller}.private`,
    `${bountyId}.private`,
    `${caller}.private`,
    `${reward}.private`,
  ];
  const result = await client.request('executeTransition', {
    programId: BOUNTY_PROGRAM_ID,
    functionName: 'post_bounty',
    inputs,
  });
  if (!result.transactionId) {
    throw new Error('Transaction failed: No transactionId returned.');
  }
  return result.transactionId;
}

/**
 * 2. View Bounty by ID
 */
export async function viewBountyById(
  bountyId: number
): Promise<{ payment: number; status: number }> {
  const inputs = [`${bountyId}.private`];
  const result = await client.request('executeTransition', {
    programId: BOUNTY_PROGRAM_ID,
    functionName: 'view_bounty_by_id',
    inputs,
  });

  // Fetch finalized data from the mappings
  const payment = await fetchMappingValue('bounty_output_payment', bountyId);
  const status = await fetchMappingValue('bounty_output_status', bountyId);

  return { payment, status };
}

/**
 * 3. Submit Proposal
 */
export async function submitProposal(
  caller: string,
  bountyId: number,
  proposalId: number,
  proposer: string
): Promise<string> {
  const inputs = [
    `${caller}.private`,
    `${bountyId}.private`,
    `${proposalId}.private`,
    `${proposer}.private`,
  ];
  const result = await client.request('executeTransition', {
    programId: BOUNTY_PROGRAM_ID,
    functionName: 'submit_proposal',
    inputs,
  });
  return result.transactionId;
}

/**
 * 4. Accept Proposal
 */
export async function acceptProposal(
  caller: string,
  bountyId: number,
  proposalId: number,
  creator: string,
  reward: number
): Promise<string> {
  const inputs = [
    `${caller}.private`,
    `${bountyId}.private`,
    `${proposalId}.private`,
    `${creator}.private`,
    `${reward}.private`,
  ];
  const result = await client.request('executeTransition', {
    programId: BOUNTY_PROGRAM_ID,
    functionName: 'accept_proposal',
    inputs,
  });
  return result.transactionId;
}

/**
 * 5. Delete Bounty
 */
export async function deleteBounty(
  caller: string,
  bountyId: number
): Promise<string> {
  const inputs = [`${caller}.private`, `${bountyId}.private`];
  const result = await client.request('executeTransition', {
    programId: BOUNTY_PROGRAM_ID,
    functionName: 'delete_bounty',
    inputs,
  });
  return result.transactionId;
}

/**
 * 6. Wait for Transaction Finalization (best-effort)
 *
 * NOTE:
 * - Public Aleo RPC endpoints like `testnetbeta.aleorpc.com` do NOT currently
 *   expose a `getTransactionStatus` method, so we cannot poll precise status.
 * - Instead, we do a simple timed wait to give the network time to include
 *   and finalize the transaction, then return `false` if we timed out.
 *
 * This avoids noisy "Method not found" RPC errors while still giving the user
 * feedback that we're waiting a short period for finalization.
 */
export async function waitForTransactionToFinalize(
  _transactionId: string
): Promise<boolean> {
  const totalWaitMs = 15_000; // 15 seconds total wait
  const stepMs = 3_000; // check every 3 seconds
  let waited = 0;

  while (waited < totalWaitMs) {
    await new Promise((resolve) => setTimeout(resolve, stepMs));
    waited += stepMs;
    // We *could* add optional explorer polling here in the future.
  }

  // We don't know the real status, just that we've waited long enough.
  return false;
}


/**
 * 7. Transfer Payment
 */
export async function transfer(
  caller: string,
  receiver: string,
  amount: number
): Promise<string> {
  const inputs = [`${caller}.private`, `${receiver}.private`, `${amount}.private`];
  const result = await client.request('executeTransition', {
    programId: BOUNTY_PROGRAM_ID,
    functionName: 'transfer',
    inputs,
  });
  if (!result.transactionId) {
    throw new Error('Transaction failed: No transactionId returned.');
  }
  return result.transactionId;
}


/**
 * Helper to Fetch Mapping Values
 */
export async function fetchMappingValue(
  mappingName: string,
  key: string | number // Allow both string and number
): Promise<number> {
  try {
    // Convert `key` to string if it's a number
    const keyString = typeof key === 'number' ? `${key}.public` : `${key}.public`;

    const result = await client.request('getMappingValue', {
      programId: BOUNTY_PROGRAM_ID,
      mappingName,
      key: keyString, // Always pass as a string
    });

    return parseInt(result.value, 10); // Parse as integer
  } catch (error) {
    console.error(
      `Failed to fetch mapping ${mappingName} with key ${key}:`,
      error
    );
    throw error;
  }
}

/**
 * Utility to Create JSON-RPC Client
 */
export function getClient(apiUrl: string): JSONRPCClient {
  const client: JSONRPCClient = new JSONRPCClient((jsonRPCRequest: any) =>
    fetch(apiUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(jsonRPCRequest),
    }).then((response) => {
      if (response.status === 200) {
        return response.json().then((jsonRPCResponse) =>
          client.receive(jsonRPCResponse)
        );
      }
      throw new Error(response.statusText);
    })
  );
  return client;
}

/**
 * Get Verifying Key for a Function
 */
async function getDeploymentTransaction(programId: string): Promise<any> {
  const response = await fetch(`${CURRENT_RPC_URL}find/transactionID/deployment/${programId}`);
  const deployTxId = await response.json();
  const txResponse = await fetch(`${CURRENT_RPC_URL}transaction/${deployTxId}`);
  const tx = await txResponse.json();
  return tx;
}

export async function getVerifyingKey(
  programId: string,
  functionName: string
): Promise<string> {
  const deploymentTx = await getDeploymentTransaction(programId);

  const allVerifyingKeys = deploymentTx.deployment.verifying_keys;
  const verifyingKey = allVerifyingKeys.filter((vk: any) => vk[0] === functionName)[0][1][0];
  return verifyingKey;
}

export async function getProgram(programId: string, apiUrl: string): Promise<string> {
  const client = getClient(apiUrl);
  const program = await client.request('program', {
    id: programId
  });
  return program;
}


//Deny a proposal

export async function denyProposal(
  caller: string,
  bountyId: number,
  proposalId: number
): Promise<string> {
  const inputs = [
    `${caller}.private`,   
    `${bountyId}.private`, 
    `${proposalId}.private` 
  ];
    
    const result = await client.request('executeTransition', {
      programId: BOUNTY_PROGRAM_ID,
      functionName: 'deny_proposal', 
      inputs, 
    });

    return result.transactionId;
}