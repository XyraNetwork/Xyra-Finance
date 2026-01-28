import type { NextPage } from 'next';
import type { ReactElement, ReactNode } from 'react';
import { Network } from '@provablehq/aleo-types';

//Change to Network.MAINNET for mainnet or Network.TESTNET for testnet
export const CURRENT_NETWORK: Network = Network.TESTNET;


// Default Aleo RPC host for testnet-beta used by the starter template.
// This is the endpoint that supports the custom JSON-RPC methods used in `rpc.ts`
// such as `executeTransition`, `getMappingValue`, and `aleoTransactionsForProgram`.
export const CURRENT_RPC_URL = "https://testnetbeta.aleorpc.com";

export type NextPageWithLayout<P = {}> = NextPage<P> & {
  authorization?: boolean;
  getLayout?: (page: ReactElement) => ReactNode;
};

// src/types/index.ts
export type ProposalData = {
  bountyId: number;
  proposalId: number;
  proposerAddress: string;
  proposalText?: string;
  fileName?: string;
  fileUrl?: string;
  status?: string;
  rewardSent?: boolean;
};

export type BountyData = {
  id: number;
  title: string;
  reward: string;
  deadline: string;
  creatorAddress: string;
  proposals?: ProposalData[];
};

// Aleo program ID for the lending pool Leo program.
// This should match `program` in Lending-Borrowing/program.json ("lending_pool_v8.aleo").
export const BOUNTY_PROGRAM_ID = 'lending_pool_v8.aleo';
