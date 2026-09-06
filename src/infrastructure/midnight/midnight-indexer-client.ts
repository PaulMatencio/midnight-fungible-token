/**
 * Midnight Indexer Client
 * Filename: src/infrastructure/midnight/midnight-indexer-client.ts
 *
 * Direct GraphQL client for querying on-chain contract state, deployment actions,
 * transaction metadata, and decoding token distribution shares between accounts.
 */

import { ContractState } from '@midnight-ntwrk/midnight-js-protocol/compact-runtime';
import { ledger, type Ledger } from '@/src/contracts/fungible-token/contract/index.js';
import { PRESET_IDENTITIES } from '@/src/infrastructure/config/midnight-config';
import { bech32m } from '@scure/base';

export interface AccountShare {
  addressHex: string;
  addressBech32: string;
  balance: bigint;
  formattedBalance: string;
  sharePercentage: number; // 0 - 100
  isCurrentUser?: boolean;
  label?: string;
}

export interface IndexerTokenReport {
  contractAddress: string;
  blockHeight?: number;
  blockHash?: string;
  txHash?: string;
  name: string;
  symbol: string;
  decimals: number;
  totalSupply: bigint;
  formattedTotalSupply: string;
  isInitialized: boolean;
  holders: AccountShare[];
  holdersCount: number;
  largestHolderShare: number;
  top3Share: number;
  fetchedAt: Date;
  source: 'indexer' | 'local_cache' | 'simulated';
  error?: string;
}

export const CONTRACT_ACTION_QUERY = `
  query GetContractAction($address: HexEncoded!) {
    contractAction(address: $address) {
      address
      state
      transaction {
        hash
        block {
          height
          hash
        }
      }
    }
  }
`;

/**
 * Converts a hex string into a Uint8Array byte array.
 */
export function toByteArray(hex: string): Uint8Array {
  const clean = hex.startsWith('0x') ? hex.slice(2) : hex;
  const bytes = new Uint8Array(clean.length / 2);
  for (let i = 0; i < clean.length; i += 2) {
    bytes[i / 2] = parseInt(clean.substring(i, i + 2), 16);
  }
  return bytes;
}

export const hexToBytes = toByteArray;

/**
 * Converts a 32-byte Uint8Array into a 64-char lowercase hex string.
 */
export function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Formats a 32-byte account public key into a Midnight Bech32m address.
 */
export function formatBech32Address(accountBytesOrHex: Uint8Array | string, networkId: string = 'preprod'): string {
  try {
    const bytes = typeof accountBytesOrHex === 'string' ? hexToBytes(accountBytesOrHex) : accountBytesOrHex;
    const prefix = networkId === 'devnet' ? 'mn_addr_devnet' : 'mn_addr_preprod';
    return bech32m.encode(prefix, bech32m.toWords(bytes));
  } catch {
    return typeof accountBytesOrHex === 'string' ? accountBytesOrHex : bytesToHex(accountBytesOrHex);
  }
}

/**
 * Formats a bigint token amount according to token decimals.
 */
export function formatTokenAmount(amount: bigint, decimals: number | bigint): string {
  const dec = Number(decimals);
  if (dec === 0) return amount.toLocaleString();
  const divisor = 10n ** BigInt(dec);
  const integerPart = amount / divisor;
  const fractionalPart = amount % divisor;

  if (fractionalPart === 0n) {
    return integerPart.toLocaleString();
  }

  const fracStr = fractionalPart.toString().padStart(dec, '0').replace(/0+$/, '');
  return `${integerPart.toLocaleString()}.${fracStr}`;
}

/**
 * Identifies known test identities or current user.
 */
export function resolveAccountLabel(
  addressHex: string,
  currentUserAddress?: string | null
): { label?: string; isCurrentUser: boolean } {
  const cleanHex = addressHex.toLowerCase().replace(/^0x/, '');
  const cleanUser = (currentUserAddress || '').toLowerCase().replace(/^0x/, '');

  const isCurrentUser =
    Boolean(cleanUser) &&
    (cleanUser === cleanHex ||
      (cleanUser.startsWith('mn_') && formatBech32Address(cleanHex).toLowerCase() === cleanUser));

  const presetMatch = PRESET_IDENTITIES.find((p) => p.addressHex.toLowerCase() === cleanHex);
  const formattedPresetName = presetMatch
    ? presetMatch.name.charAt(0).toUpperCase() + presetMatch.name.slice(1)
    : undefined;

  if (isCurrentUser) {
    return {
      label: formattedPresetName ? `${formattedPresetName} (You)` : 'You (Connected)',
      isCurrentUser: true,
    };
  }

  if (formattedPresetName) {
    return { label: formattedPresetName, isCurrentUser: false };
  }

  return { label: undefined, isCurrentUser: false };
}

/**
 * Calculates AccountShare items from a decoded Compact FungibleToken Ledger.
 */
export function calculateAccountSharesFromLedger(
  ledgerState: Ledger,
  options?: {
    contractAddress?: string;
    currentUserAddress?: string | null;
    networkId?: string;
    blockHeight?: number;
    txHash?: string;
    source?: 'indexer' | 'local_cache' | 'simulated';
  }
): IndexerTokenReport {
  const decimals = Number(ledgerState._decimals || 0n);
  const totalSupply = ledgerState._totalSupply || 0n;
  const holders: AccountShare[] = [];

  if (ledgerState._balances && typeof ledgerState._balances[Symbol.iterator] === 'function') {
    for (const [accountBytes, balance] of ledgerState._balances) {
      const addressHex = bytesToHex(accountBytes);
      const addressBech32 = formatBech32Address(accountBytes, options?.networkId);
      const { label, isCurrentUser } = resolveAccountLabel(addressHex, options?.currentUserAddress);

      const sharePercentage =
        totalSupply > 0n ? Number((balance * 10000n) / totalSupply) / 100 : 0;

      holders.push({
        addressHex,
        addressBech32,
        balance,
        formattedBalance: formatTokenAmount(balance, decimals),
        sharePercentage,
        isCurrentUser,
        label,
      });
    }
  }

  // Sort descending by balance
  holders.sort((a, b) => {
    if (b.balance > a.balance) return 1;
    if (b.balance < a.balance) return -1;
    return 0;
  });

  const largestHolderShare = holders.length > 0 ? holders[0].sharePercentage : 0;
  const top3Share = holders.slice(0, 3).reduce((acc, h) => acc + h.sharePercentage, 0);

  return {
    contractAddress: options?.contractAddress || '',
    blockHeight: options?.blockHeight,
    txHash: options?.txHash,
    name: ledgerState._name || 'Midnight Fungible Token',
    symbol: ledgerState._symbol || 'MFT',
    decimals,
    totalSupply,
    formattedTotalSupply: formatTokenAmount(totalSupply, decimals),
    isInitialized: ledgerState._isInitialized,
    holders,
    holdersCount: holders.length,
    largestHolderShare: Math.round(largestHolderShare * 100) / 100,
    top3Share: Math.round(top3Share * 100) / 100,
    fetchedAt: new Date(),
    source: options?.source || 'indexer',
  };
}

/**
 * Queries the Midnight Indexer via GraphQL, deserializes the contract state,
 * and builds a comprehensive token and account distribution report.
 */
export async function queryIndexerContractState(
  contractAddress: string,
  indexerUrl: string,
  options?: {
    currentUserAddress?: string | null;
    networkId?: string;
  }
): Promise<IndexerTokenReport> {
  const cleanAddr = contractAddress.trim();
  const cleanUrl = indexerUrl.trim();

  const response = await fetch(cleanUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query: CONTRACT_ACTION_QUERY,
      variables: { address: cleanAddr },
    }),
    signal: AbortSignal.timeout(6000),
  });

  if (!response.ok) {
    throw new Error(`Midnight indexer HTTP error ${response.status}: ${response.statusText}`);
  }

  const json = await response.json();
  if (json.errors && json.errors.length > 0) {
    throw new Error(`GraphQL query error: ${json.errors[0].message}`);
  }

  const contractAction = json.data?.contractAction;
  if (!contractAction || !contractAction.state) {
    return {
      contractAddress: cleanAddr,
      name: 'Midnight Fungible Token',
      symbol: 'MFT',
      decimals: 6,
      totalSupply: 0n,
      formattedTotalSupply: '0',
      isInitialized: false,
      holders: [],
      holdersCount: 0,
      largestHolderShare: 0,
      top3Share: 0,
      fetchedAt: new Date(),
      source: 'indexer',
      error: 'Contract not yet indexed on this network',
    };
  }

  // Deserialize Compact state
  const stateBytes = toByteArray(contractAction.state);
  const contractState = ContractState.deserialize(stateBytes);
  const decodedLedger = ledger(contractState.data);

  return calculateAccountSharesFromLedger(decodedLedger, {
    contractAddress: cleanAddr,
    currentUserAddress: options?.currentUserAddress,
    networkId: options?.networkId || 'preprod',
    blockHeight: contractAction.transaction?.block?.height,
    txHash: contractAction.transaction?.hash,
    source: 'indexer',
  });
}
