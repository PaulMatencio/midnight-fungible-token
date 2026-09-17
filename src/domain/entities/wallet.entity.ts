/**
 * Domain Entities & Models: Wallet & Identity
 * Filename: src/domain/entities/wallet.entity.ts
 */

export type WalletMode = 'lace' | 'test';

export interface WalletIdentity {
  name: string;
  label: string;
  addressHex: string;
  role: 'user' | 'admin';
}

export interface WalletBalances {
  tNightBalance: string;
  tNightDisplay: string;
  dustBalance: string;
  dustDisplay: string;
  shieldedBalance?: string;
  isSynced: boolean;
  isLocked?: boolean;
  isChannelShutdown?: boolean;
  errorMessage?: string | null;
}

export interface NetworkConfig {
  contractName: string;
  contractAddress: string;
  contractSalt?: string;
  ownerSecretKey?: string;
  owner?: string;
  networkId: string;
  indexerUrl: string;
  indexerWsUrl: string;
  nodeUrl: string;
  proofServerUrl: string;
  faucetUrl: string;
  explorerUrl: string;
}
