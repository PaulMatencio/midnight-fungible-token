/**
 * Domain Entities & Models: Token
 * Filename: src/domain/entities/token.entity.ts
 */

export interface TokenMetadata {
  name: string;
  symbol: string;
  decimals: number;
  totalSupply: bigint;
  maxSupply?: bigint;
  contractSalt?: string;
  isInitialized: boolean;
  isPaused?: boolean;
  owner?: string;
  ownerBech32?: string;
  emergencyPauser?: string;
  emergencyPauserBech32?: string;
  isCallerOwner?: boolean;
  isCallerPauser?: boolean;
}

export interface AccountShare {
  addressHex: string;
  addressBech32: string;
  balance: bigint;
  formattedBalance: string;
  sharePercentage: number;
  isCurrentUser?: boolean;
  isOwner?: boolean;
  label?: string;
  mappedWalletAddress?: string;
}

export interface HoldersReport {
  contractAddress: string;
  blockHeight?: number;
  blockHash?: string;
  txHash?: string;
  isInitialized: boolean;
  name: string;
  symbol: string;
  decimals: number;
  totalSupply: bigint;
  formattedTotalSupply: string;
  owner?: string;
  ownerBech32?: string;
  holdersCount: number;
  holders: AccountShare[];
  largestHolderShare: number;
  top3Share: number;
  contractSaltHex?: string;
  fetchedAt?: Date;
  source?: 'indexer' | 'local_cache' | 'simulated';
}
