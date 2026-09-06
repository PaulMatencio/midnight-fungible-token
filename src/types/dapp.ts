/**
 * DApp Data Transfer Objects & Type Definitions
 */

export type TransactionStatus =
  | 'idle'
  | 'preparing'
  | 'proving'
  | 'submitting'
  | 'confirmed'
  | 'failed';

export interface ActivityItem {
  id: string;
  circuitName: string;
  params: Record<string, string>;
  status: 'pending' | 'confirmed' | 'failed';
  txHash?: string;
  blockHeight?: number;
  timestamp: number;
  error?: string;
}

export interface WalletIdentity {
  name: string;
  label: string;
  addressHex: string;
  role: 'user' | 'admin';
}

export interface NetworkConfig {
  contractName: string;
  contractAddress: string;
  networkId: string;
  indexerUrl: string;
  indexerWsUrl: string;
  nodeUrl: string;
  proofServerUrl: string;
  faucetUrl: string;
  explorerUrl: string;
}

export interface TokenMetadata {
  name: string;
  symbol: string;
  decimals: number;
  totalSupply: bigint;
  isInitialized: boolean;
  owner?: string;
  ownerBech32?: string;
  isCallerOwner?: boolean;
}
