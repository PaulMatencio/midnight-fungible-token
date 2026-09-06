/**
 * Midnight Providers Assembly (Module B)
 * Combines WalletProvider, PublicDataProvider, ProofProvider, ZKConfigProvider,
 * PrivateStateProvider, and MidnightProvider into a unified structure.
 */

import { httpClientProofProvider } from '@midnight-ntwrk/midnight-js-http-client-proof-provider';
import { indexerPublicDataProvider } from '@midnight-ntwrk/midnight-js-indexer-public-data-provider';
import { FetchZkConfigProvider } from '@midnight-ntwrk/midnight-js-fetch-zk-config-provider';
import { BrowserPrivateStateProvider, type PrivateStateProvider } from './in-memory-private-state-provider';
import {
  createLaceWalletProvider,
  createLaceMidnightProvider,
} from '../infrastructure/midnight/midnight-dapp-connector';
import { MIDNIGHT_CONFIG } from '../infrastructure/config/midnight-config';
import type { WalletIdentity } from '../types/dapp';

export interface MidnightWalletProvider {
  getCoinPublicKey: () => string;
  getEncryptionPublicKey?: () => string;
  balanceTx: (tx: any, ttl?: Date) => Promise<any>;
}

export interface MidnightSubmissionProvider {
  submitTx: (tx: any) => Promise<string>;
}

export interface MidnightProviders {
  walletProvider: MidnightWalletProvider;
  midnightProvider: MidnightSubmissionProvider;
  publicDataProvider: ReturnType<typeof indexerPublicDataProvider>;
  proofProvider: any;
  zkConfigProvider: FetchZkConfigProvider<string>;
  privateStateProvider: PrivateStateProvider;
}

export interface ProviderOptions {
  proofServerUrl?: string;
  zkirBaseUrl?: string;
  indexerUrl?: string;
  indexerWsUrl?: string;
}

function resolveZkirUrl(customUrl?: string): string {
  if (customUrl) return customUrl;
  if (typeof window !== 'undefined' && window.location?.origin) {
    return `${window.location.origin}/zkir/fungible-token`;
  }
  return 'http://localhost:3000/zkir/fungible-token';
}

/**
 * Creates the 5 unified Midnight providers using a connected Lace wallet instance.
 */
export function createLaceMidnightProviders(
  extensionApi: any,
  options?: ProviderOptions
): MidnightProviders {
  const zkirBaseUrl = resolveZkirUrl(options?.zkirBaseUrl);
  const proofServerUrl = options?.proofServerUrl || MIDNIGHT_CONFIG.proofServerUrl;
  const indexerUrl = options?.indexerUrl || MIDNIGHT_CONFIG.indexerUrl;
  const indexerWsUrl = options?.indexerWsUrl || MIDNIGHT_CONFIG.indexerWsUrl;

  const zkConfigProvider = new FetchZkConfigProvider<string>(zkirBaseUrl, fetch.bind(globalThis));
  const publicDataProvider = indexerPublicDataProvider(indexerUrl, indexerWsUrl);
  const proofProvider = httpClientProofProvider(proofServerUrl, zkConfigProvider);
  const privateStateProvider = new BrowserPrivateStateProvider('midnight_lace_state_');

  const walletProvider = createLaceWalletProvider(extensionApi);
  const midnightProvider = createLaceMidnightProvider(extensionApi);

  return {
    walletProvider,
    midnightProvider,
    publicDataProvider,
    proofProvider,
    zkConfigProvider,
    privateStateProvider,
  };
}

/**
 * Creates the simulated 5 Midnight providers for Test Mode (No Wallet).
 */
export function createSimulatedMidnightProviders(
  identity?: WalletIdentity | null,
  options?: ProviderOptions
): MidnightProviders {
  const zkirBaseUrl = resolveZkirUrl(options?.zkirBaseUrl);
  const proofServerUrl = options?.proofServerUrl || MIDNIGHT_CONFIG.proofServerUrl;
  const indexerUrl = options?.indexerUrl || MIDNIGHT_CONFIG.indexerUrl;
  const indexerWsUrl = options?.indexerWsUrl || MIDNIGHT_CONFIG.indexerWsUrl;

  const coinPub = identity?.addressHex || '01'.repeat(32);

  const walletProvider: MidnightWalletProvider = {
    getCoinPublicKey: () => coinPub,
    getEncryptionPublicKey: () => coinPub,
    balanceTx: async (tx: any) => tx,
  };

  const midnightProvider: MidnightSubmissionProvider = {
    submitTx: async () => {
      const arr = new Uint8Array(32);
      if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
        crypto.getRandomValues(arr);
      } else {
        for (let i = 0; i < 32; i++) arr[i] = Math.floor(Math.random() * 256);
      }
      return '0x' + Array.from(arr).map((b) => b.toString(16).padStart(2, '0')).join('');
    },
  };

  const zkConfigProvider = new FetchZkConfigProvider<string>(zkirBaseUrl, fetch.bind(globalThis));
  const publicDataProvider = indexerPublicDataProvider(indexerUrl, indexerWsUrl);
  const proofProvider = httpClientProofProvider(proofServerUrl, zkConfigProvider);
  const privateStateProvider = new BrowserPrivateStateProvider('midnight_test_state_');

  return {
    walletProvider,
    midnightProvider,
    publicDataProvider,
    proofProvider,
    zkConfigProvider,
    privateStateProvider,
  };
}

/**
 * Checks connectivity to the network infrastructure (Proof Server and Indexer).
 */
export async function checkInfrastructureHealth(options?: ProviderOptions): Promise<{
  proofServer: boolean;
  indexer: boolean;
}> {
  const proofServerUrl = options?.proofServerUrl || MIDNIGHT_CONFIG.proofServerUrl;
  const indexerUrl = options?.indexerUrl || MIDNIGHT_CONFIG.indexerUrl;

  let proofServer = false;
  let indexer = false;

  try {
    const res = await fetch(`${proofServerUrl}/health`, { method: 'GET', signal: AbortSignal.timeout(2000) });
    proofServer = res.ok || res.status === 404; // responding HTTP
  } catch {
    proofServer = false;
  }

  try {
    const res = await fetch(indexerUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: '{ __typename }' }),
      signal: AbortSignal.timeout(2500),
    });
    indexer = res.ok;
  } catch {
    indexer = false;
  }

  return { proofServer, indexer };
}
