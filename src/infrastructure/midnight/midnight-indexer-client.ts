/**
 * Midnight Indexer Client
 * Filename: src/infrastructure/midnight/midnight-indexer-client.ts
 *
 * Direct GraphQL client for querying on-chain contract state, deployment actions,
 * transaction metadata, and decoding token distribution shares between accounts.
 */

import { ContractState } from '@midnight-ntwrk/midnight-js-protocol/compact-runtime';
import { ledger, type Ledger } from '@/src/contracts/fungible-token/contract/index.js';
import { MIDNIGHT_CONFIG, PRESET_IDENTITIES } from '@/src/infrastructure/config/midnight-config';
import { FungibleTokenClient } from '@/src/client/fungible-token-sdk';
import { bech32m } from '@scure/base';

export interface AccountShare {
  addressHex: string;
  addressBech32: string;
  balance: bigint;
  formattedBalance: string;
  sharePercentage: number; // 0 - 100
  isCurrentUser?: boolean;
  isOwner?: boolean;
  label?: string;
  mappedWalletAddress?: string; // Optional: raw connected Lace address mapped to this derived account
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
  owner?: string;
  ownerBech32?: string;
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
 * Converts any Midnight address format into a 32-byte Uint8Array for Compact circuits.
 * Supports:
 * 1. Midnight Bech32m addresses (unshielded e.g. mn_addr_..., or shielded e.g. mn_shield-addr_...)
 * 2. 32-byte hex strings (with or without 0x prefix)
 */
export function addressToBytes32(addr: string): Uint8Array {
  if (!addr || typeof addr !== 'string') {
    return new Uint8Array(32);
  }
  const trimmed = addr.trim();

  // 1. Bech32m Midnight Address
  if (
    trimmed.toLowerCase().startsWith('mn_') ||
    trimmed.toLowerCase().startsWith('midnight') ||
    trimmed.toLowerCase().startsWith('mn1')
  ) {
    try {
      const decoded = bech32m.decodeToBytes(trimmed, 200);
      if (decoded.bytes.length === 32) {
        return new Uint8Array(decoded.bytes);
      }
      if (decoded.bytes.length >= 32) {
        return new Uint8Array(decoded.bytes.subarray(0, 32));
      }
    } catch {
      // fallback
    }
  }

  // 2. Hex string format
  const cleanHex = trimmed.replace(/^0x/, '').trim();
  if (/^[0-9a-fA-F]{64}$/.test(cleanHex)) {
    const bytes = new Uint8Array(32);
    for (let i = 0; i < 32; i++) {
      bytes[i] = parseInt(cleanHex.substr(i * 2, 2), 16) || 0;
    }
    return bytes;
  }

  if (/^[0-9a-fA-F]+$/.test(cleanHex) && cleanHex.length <= 64) {
    const padded = cleanHex.padStart(64, '0');
    const bytes = new Uint8Array(32);
    for (let i = 0; i < 32; i++) {
      bytes[i] = parseInt(padded.substr(i * 2, 2), 16) || 0;
    }
    return bytes;
  }

  return toByteArray(cleanHex);
}

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
    if (typeof accountBytesOrHex === 'string') {
      const trimmed = accountBytesOrHex.trim();
      if (trimmed.startsWith('mn_') || trimmed.startsWith('midnight')) {
        return trimmed;
      }
    }
    const bytes = typeof accountBytesOrHex === 'string' ? addressToBytes32(accountBytesOrHex) : accountBytesOrHex;
    const prefix = networkId === 'devnet' ? 'mn_addr_devnet' : 'mn_addr_preprod';
    return bech32m.encode(prefix, bech32m.toWords(bytes));
  } catch {
    return typeof accountBytesOrHex === 'string' ? accountBytesOrHex : bytesToHex(accountBytesOrHex);
  }
}

import { formatBalance } from '@/src/presentation/utils/format';
export { formatBalance };

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
 * Identifies known test identities or current user, mapping on-chain derived accounts
 * back to the user's raw connected Lace wallet.
 */
export function resolveAccountLabel(
  addressHex: string,
  currentUserAddress?: string | null,
  contractSalt?: Uint8Array | string
): { label?: string; isCurrentUser: boolean; mappedWalletAddress?: string } {
  const cleanHex = addressHex.toLowerCase().replace(/^0x/, '');
  const cleanUser = (currentUserAddress || '').toLowerCase().replace(/^0x/, '');

  let isCurrentUser = false;

  if (cleanUser) {
    // 1. Direct hex match
    if (cleanUser === cleanHex) {
      isCurrentUser = true;
    }
    // 2. Bech32m direct match
    else if (cleanUser.startsWith('mn_') && formatBech32Address(cleanHex).toLowerCase() === cleanUser) {
      isCurrentUser = true;
    }
    // 3. Derived account match (the on-chain holder account was derived from the raw Lace wallet)
    else {
      try {
        const userBytes = addressToBytes32(currentUserAddress!);
        const rawUserHex = bytesToHex(userBytes).toLowerCase();
        if (cleanHex === rawUserHex) {
          isCurrentUser = true;
        } else {
          // Derive on-chain spendable account identity
          const salt = contractSalt ?? MIDNIGHT_CONFIG.contractSalt ?? new Uint8Array(32).fill(42);
          const derived = FungibleTokenClient.deriveAccount(userBytes, salt);
          const derivedHex = bytesToHex(derived).toLowerCase();
          if (cleanHex === derivedHex) {
            isCurrentUser = true;
          }
        }
      } catch {
        // Safe fallback
      }
    }
  }

  // Check preset identities (e.g. Alice, Bob, Charlie)
  const presetMatch = PRESET_IDENTITIES.find((p) => {
    const pClean = p.addressHex.toLowerCase().replace(/^0x/, '');
    if (pClean === cleanHex) return true;
    try {
      const salt = contractSalt ?? MIDNIGHT_CONFIG.contractSalt ?? new Uint8Array(32).fill(42);
      const derivedPreset = bytesToHex(FungibleTokenClient.deriveAccount(addressToBytes32(pClean), salt)).toLowerCase();
      return derivedPreset === cleanHex;
    } catch {
      return false;
    }
  });

  const formattedPresetName = presetMatch
    ? presetMatch.name.charAt(0).toUpperCase() + presetMatch.name.slice(1)
    : undefined;

  if (isCurrentUser) {
    return {
      label: formattedPresetName ? `${formattedPresetName} (You)` : 'You (Lace Wallet)',
      isCurrentUser: true,
      mappedWalletAddress: currentUserAddress || undefined,
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
    contractSalt?: Uint8Array | string;
    networkId?: string;
    blockHeight?: number;
    txHash?: string;
    source?: 'indexer' | 'local_cache' | 'simulated';
  }
): IndexerTokenReport {
  const decimals = Number(ledgerState._decimals || 0n);
  const totalSupply = ledgerState._totalSupply || 0n;
  const holders: AccountShare[] = [];
  const ownerHex = ledgerState.owner ? bytesToHex(ledgerState.owner) : undefined;
  const ownerBech32 = ledgerState.owner ? formatBech32Address(ledgerState.owner, options?.networkId) : undefined;

  if (ledgerState._balances && typeof ledgerState._balances[Symbol.iterator] === 'function') {
    for (const [accountBytes, balance] of ledgerState._balances) {
      const addressHex = bytesToHex(accountBytes);
      const addressBech32 = formatBech32Address(accountBytes, options?.networkId);
      const { label, isCurrentUser, mappedWalletAddress } = resolveAccountLabel(
        addressHex,
        options?.currentUserAddress,
        options?.contractSalt
      );
      const isOwner = Boolean(ownerHex && addressHex.toLowerCase() === ownerHex.toLowerCase());

      const sharePercentage =
        totalSupply > 0n ? Number((balance * 10000n) / totalSupply) / 100 : 0;

      holders.push({
        addressHex,
        addressBech32,
        balance,
        formattedBalance: formatTokenAmount(balance, decimals),
        sharePercentage,
        isCurrentUser,
        isOwner,
        label: isOwner ? (label ? `${label} (Owner)` : 'Contract Owner') : label,
        mappedWalletAddress,
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
    isInitialized: Boolean((ledgerState as any)._isInitialized ?? (ledgerState.owner && !ledgerState.owner.every((b: number) => b === 0))),
    owner: ownerHex,
    ownerBech32: ownerBech32,
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
    contractSalt?: Uint8Array | string;
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
    contractSalt: options?.contractSalt,
    networkId: options?.networkId || 'preprod',
    blockHeight: contractAction.transaction?.block?.height,
    txHash: contractAction.transaction?.hash,
    source: 'indexer',
  });
}

export interface OnChainTxVerification {
  id?: number | string;
  hash: string;
  blockHeight?: number;
  blockHash?: string;
  protocolVersion?: number;
  contractActions?: Array<{ address: string }>;
  verified: boolean;
  error?: string;
  checkedAt: string;
}

/**
 * Directly queries the Midnight Indexer GraphQL API to verify whether a transaction has been confirmed on-chain.
 */
export async function queryTransactionOnChain(
  txHash: string,
  indexerUrl: string = 'https://indexer.preprod.midnight.network/api/v4/graphql'
): Promise<OnChainTxVerification> {
  const cleanHash = txHash.replace(/^0x/i, '').trim();

  // Validate hex characters
  const isHex = /^[0-9a-fA-F]+$/.test(cleanHash);
  if (!isHex || cleanHash.length === 0) {
    return {
      hash: txHash,
      verified: false,
      error: `Invalid transaction hash "${txHash}". Midnight on-chain transaction hashes must be valid hexadecimal strings (64 characters / 32 bytes).`,
      checkedAt: new Date().toISOString(),
    };
  }

  // Construct offset: if 64 hex characters (32 bytes), use hash; otherwise use identifier
  const is32ByteHash = cleanHash.length === 64;
  const offsetVariable = is32ByteHash
    ? { hash: cleanHash.toLowerCase() }
    : { identifier: cleanHash.toLowerCase() };

  const query = `
    query VerifyTx($offset: TransactionOffset!) {
      transactions(offset: $offset) {
        id
        hash
        protocolVersion
        block {
          height
          hash
        }
        contractActions {
          address
        }
      }
    }
  `;

  try {
    const res = await fetch(indexerUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, variables: { offset: offsetVariable } }),
      signal: AbortSignal.timeout(8000),
    });

    if (!res.ok) {
      throw new Error(`Indexer responded with HTTP ${res.status}: ${res.statusText}`);
    }

    const json = await res.json();
    if (json.errors && json.errors.length > 0) {
      const errMsg = json.errors[0].message || '';
      if (errMsg.includes('ByteArray<32>')) {
        throw new Error(
          `Invalid 32-byte transaction hash format (${cleanHash.length} chars). Midnight on-chain transaction hashes must be exactly 64 hexadecimal characters.`
        );
      }
      throw new Error(errMsg);
    }

    const txs = json.data?.transactions || [];
    if (txs.length === 0) {
      return {
        hash: cleanHash,
        verified: false,
        error: is32ByteHash
          ? 'Transaction not found in indexer yet (pending inclusion or indexing lag, usually ~15-30s). Note: Simulated transactions are not on-chain.'
          : `Identifier (${cleanHash.slice(0, 16)}...) not indexed on Midnight Preprod.`,
        checkedAt: new Date().toISOString(),
      };
    }

    const first = txs[0];
    return {
      id: first.id,
      hash: first.hash,
      blockHeight: first.block?.height,
      blockHash: first.block?.hash,
      protocolVersion: first.protocolVersion,
      contractActions: first.contractActions,
      verified: true,
      checkedAt: new Date().toISOString(),
    };
  } catch (err: any) {
    return {
      hash: cleanHash,
      verified: false,
      error: err?.message || 'Failed to connect to Midnight Indexer',
      checkedAt: new Date().toISOString(),
    };
  }
}

