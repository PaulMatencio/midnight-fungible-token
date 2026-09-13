'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { BehaviorSubject } from 'rxjs';
import * as CompactRuntime from '@midnight-ntwrk/compact-runtime';
import {
  FungibleTokenClient,
  type FungibleTokenLedgerState,
  type FungibleTokenPrivateState,
} from '@/src/client/fungible-token-sdk';
import { ledger, Contract } from '@/src/contracts/fungible-token/contract/index.js';
import { findDeployedContract } from '@midnight-ntwrk/midnight-js-contracts';
import { CompiledContract } from '@midnight-ntwrk/compact-js';
import { useWallet } from '@/src/presentation/context/WalletContext';
import { useToast } from '@/src/presentation/context/ToastContext';
import { useConfig } from '@/src/presentation/context/ConfigContext';
import { MIDNIGHT_CONFIG, PRESET_IDENTITIES } from '@/src/infrastructure/config/midnight-config';
import {
  createLaceMidnightProviders,
  createSimulatedMidnightProviders,
  checkInfrastructureHealth,
  type MidnightProviders,
} from '@/src/providers/midnight-providers';
import { isWalletLockedError, isChannelShutdownError } from '@/src/infrastructure/midnight/midnight-dapp-connector';
import type { ActivityItem, TokenMetadata, TransactionStatus } from '@/src/types/dapp';
import { ContractState } from '@midnight-ntwrk/midnight-js-protocol/compact-runtime';
import {
  queryIndexerContractState,
  calculateAccountSharesFromLedger,
  formatBech32Address,
  formatBalance,
  CONTRACT_ACTION_QUERY,
  toByteArray,
  type IndexerTokenReport,
  type AccountShare,
} from '@/src/infrastructure/midnight/midnight-indexer-client';

export { formatBalance };

import { bech32m } from '@scure/base';

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
        // Shielded address: coin public key is first 32 bytes
        return new Uint8Array(decoded.bytes.subarray(0, 32));
      }
    } catch (err: any) {
      console.warn('[Address Resolution] Bech32m decode warning:', err?.message || err);
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

  // 3. Fallback: pad if valid hex
  if (/^[0-9a-fA-F]+$/.test(cleanHex) && cleanHex.length <= 64) {
    const padded = cleanHex.padStart(64, '0');
    const bytes = new Uint8Array(32);
    for (let i = 0; i < 32; i++) {
      bytes[i] = parseInt(padded.substr(i * 2, 2), 16) || 0;
    }
    return bytes;
  }

  // Default fallback for arbitrary strings
  const bytes = new Uint8Array(32);
  for (let i = 0; i < Math.min(trimmed.length, 32); i++) {
    bytes[i] = trimmed.charCodeAt(i);
  }
  return bytes;
}

// Alias for backwards compatibility
export const hexToBytes = addressToBytes32;

// Helper: Convert Uint8Array to 64-char hex string
export function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

// Helper: Convert any address format (Bech32 or hex) to a 64-char hex string (32 bytes)
export function addressToHex32(addr?: string | null): string {
  if (!addr || typeof addr !== 'string') {
    return '01'.repeat(32);
  }
  return bytesToHex(addressToBytes32(addr));
}

// Helper: Generate secure or fallback transaction hash
function generateTxHash(): string {
  const arr = new Uint8Array(32);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(arr);
  } else {
    for (let i = 0; i < 32; i++) arr[i] = Math.floor(Math.random() * 256);
  }
  return '0x' + bytesToHex(arr);
}

export function extractDetailedErrorMessage(err: any): string {
  if (!err) return 'Transaction failed';
  const messages: string[] = [];
  let curr = err;
  let depth = 0;
  while (curr && depth < 5) {
    if (typeof curr === 'string') {
      messages.push(curr);
      break;
    }
    if (curr.reason && typeof curr.reason === 'string' && curr.reason.trim()) {
      messages.push(curr.reason.trim());
    }
    if (curr.info && typeof curr.info === 'string' && curr.info.trim()) {
      messages.push(curr.info.trim());
    }
    if (curr.description && typeof curr.description === 'string' && curr.description.trim()) {
      messages.push(curr.description.trim());
    }
    if (curr.message && typeof curr.message === 'string' && curr.message !== 'Error' && curr.message.trim()) {
      messages.push(curr.message.trim());
    }
    if (curr.code !== undefined && curr.code !== null) {
      if (curr.code === 2 || curr.code === 'Rejected' || curr.code === 'PermissionRejected') {
        messages.push('Transaction was declined or cancelled in Lace wallet.');
      } else if (curr.code === 1) {
        messages.push('Lace wallet rejected the transaction request.');
      } else if (typeof curr.code === 'string' && curr.code !== 'InternalError') {
        messages.push(`Lace wallet error (${curr.code})`);
      }
    }
    curr = curr.cause;
    depth++;
  }

  const cleaned = messages
    .map((m) => m.replace(/^Unexpected error (submitting|executing) scoped transaction '<[^>]+>':\s*/i, '').trim())
    .filter((m) => m && m !== 'Error' && !m.startsWith("Unexpected error submitting scoped transaction '<unnamed>': Error"));

  if (cleaned.length > 0) {
    return cleaned[0];
  }
  const fallback = err?.reason || (err?.message && err.message !== 'Error' ? err.message : null);
  if (fallback) {
    const cleanedFallback = fallback.replace(/^Unexpected error (submitting|executing) scoped transaction '<[^>]+>':\s*/i, '').trim();
    if (cleanedFallback && cleanedFallback !== 'Error' && !cleanedFallback.startsWith("Unexpected error submitting scoped transaction '<unnamed>': Error")) {
      return cleanedFallback;
    }
  }
  return 'Lace wallet transaction submission failed or was declined. Please verify that your Lace wallet is unlocked, has sufficient DUST balance, and that you confirmed the popup in Lace.';
}

const LACE_STORAGE_KEY_PREFIX = 'midnight_fungible_token_lace_state_';
const ACTIVITY_STORAGE_KEY_PREFIX = 'midnight_fungible_token_activity_';
const MASTER_AUDIT_LOG_KEY = 'midnight_fungible_token_audit_log_master_v2';
const LEGACY_MASTER_AUDIT_LOG_KEY = 'midnight_fungible_token_audit_log_master';
const TOKEN_META_KEY_PREFIX = 'midnight_fungible_token_meta_';
const MAX_PERSISTED_ACTIVITIES = 1000;

export function loadPersistentActivities(contractAddress?: string): ActivityItem[] {
  if (typeof window === 'undefined') return [];
  try {
    const itemMap = new Map<string, ActivityItem>();

    // Helper to safely parse and merge
    const ingestJson = (raw: string | null) => {
      if (!raw) return;
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          parsed.forEach((item) => {
            if (item && item.id) {
              const existing = itemMap.get(item.id);
              if (!existing || (item.status === 'confirmed' && existing.status !== 'confirmed')) {
                itemMap.set(item.id, item);
              }
            }
          });
        }
      } catch {}
    };

    // 1. Read Master key v2
    ingestJson(localStorage.getItem(MASTER_AUDIT_LOG_KEY));

    // 2. Read Legacy Master key
    ingestJson(localStorage.getItem(LEGACY_MASTER_AUDIT_LOG_KEY));

    // 3. Read specific contract key if specified
    if (contractAddress) {
      ingestJson(localStorage.getItem(`${ACTIVITY_STORAGE_KEY_PREFIX}${contractAddress}`));
    }

    // 4. Scan all localStorage keys for any other activity or audit logs
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && (key.startsWith(ACTIVITY_STORAGE_KEY_PREFIX) || key.includes('audit_log') || key.includes('activity'))) {
          ingestJson(localStorage.getItem(key));
        }
      }
    } catch {}

    return Array.from(itemMap.values())
      .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0))
      .slice(0, MAX_PERSISTED_ACTIVITIES);
  } catch (err) {
    console.warn('[useFungibleToken] Error loading persistent activities:', err);
    return [];
  }
}

export function savePersistentActivities(
  items: ActivityItem[],
  contractAddress?: string,
  forceClear = false
): void {
  if (typeof window === 'undefined') return;
  // Guard: NEVER overwrite existing storage with an empty array unless explicitly forced
  if (!forceClear && (!items || items.length === 0)) {
    return;
  }
  try {
    const trimmed = items.slice(0, MAX_PERSISTED_ACTIVITIES);
    localStorage.setItem(MASTER_AUDIT_LOG_KEY, JSON.stringify(trimmed));
    if (contractAddress) {
      localStorage.setItem(`${ACTIVITY_STORAGE_KEY_PREFIX}${contractAddress}`, JSON.stringify(trimmed));
    }
  } catch (err) {
    console.warn('[useFungibleToken] Error persisting activities:', err);
  }
}

export function serializeChargedState(chargedState: any): string {
  if (!chargedState || !chargedState.state) return '';
  const encoded = chargedState.state.encode();
  return JSON.stringify(encoded, (_key, value) => {
    if (typeof value === 'bigint') return { __type: 'bigint', val: value.toString() };
    if (value instanceof Map) return { __type: 'map', entries: Array.from(value.entries()) };
    if (value instanceof Uint8Array) return { __type: 'uint8', hex: bytesToHex(value) };
    return value;
  });
}

export function deserializeChargedState(jsonStr: string): any {
  if (!jsonStr) return null;
  const parsed = JSON.parse(jsonStr, (_key, value) => {
    if (value && typeof value === 'object') {
      if (value.__type === 'bigint') return BigInt(value.val);
      if (value.__type === 'map') return new Map(value.entries);
      if (value.__type === 'uint8') {
        const hex = value.hex || '';
        const match = hex.match(/.{1,2}/g) || [];
        return new Uint8Array(match.map((byte: string) => parseInt(byte, 16)));
      }
    }
    return value;
  });
  const stateVal = CompactRuntime.StateValue.decode(parsed);
  return new CompactRuntime.ChargedState(stateVal);
}

/**
 * Extracts comprehensive TokenMetadata from decoded ledger state,
 * computing owner hex, owner Bech32m, pause status, maxSupply, and caller permissions.
 */

export function createConfiguredClient(defaultSalt?: Uint8Array): FungibleTokenClient {
  return new FungibleTokenClient({
    localSecretKey: (ctx) => {
      const ps = ctx.privateState as FungibleTokenPrivateState;
      const sk =
        ps?.secretKey ||
        ps?.currentSecretKey ||
        ps?.signingKey ||
        new Uint8Array(32).fill(1);
      return [ctx.privateState, FungibleTokenClient.toBytes32(sk)];
    },
  }, defaultSalt);
}

export function extractMetadata(
  decoded: FungibleTokenLedgerState | any | null,
  currentCaller?: string | null,
  networkId: string = MIDNIGHT_CONFIG.networkId,
  contractSaltOrAddress?: string | Uint8Array,
  customOwnerKey?: string | Uint8Array
): TokenMetadata {
  if (!decoded) {
    return {
      name: 'Midnight Fungible Token',
      symbol: 'MFT',
      decimals: 6,
      totalSupply: 0n,
      maxSupply: 0n,
      contractSalt: undefined,
      isInitialized: false,
      isPaused: false,
      owner: undefined,
      ownerBech32: undefined,
      emergencyPauser: undefined,
      emergencyPauserBech32: undefined,
      isCallerOwner: false,
      isCallerPauser: false,
    };
  }

  const ownerBytes = decoded.owner as Uint8Array | undefined;
  const ownerHex = ownerBytes && ownerBytes.length === 32 ? bytesToHex(ownerBytes) : undefined;
  const ownerBech32 = ownerBytes && ownerBytes.length === 32 ? formatBech32Address(ownerBytes, networkId) : undefined;

  const saltBytes = decoded._contractSalt as Uint8Array | undefined;
  const contractSaltHex = saltBytes && saltBytes.length === 32
    ? bytesToHex(saltBytes)
    : typeof contractSaltOrAddress === 'string' && contractSaltOrAddress.length === 64
    ? contractSaltOrAddress
    : contractSaltOrAddress instanceof Uint8Array && contractSaltOrAddress.length === 32
    ? bytesToHex(contractSaltOrAddress)
    : undefined;

  const pauserBytes = decoded._emergencyPauser as Uint8Array | undefined;
  const emergencyPauserHex = pauserBytes && pauserBytes.length === 32 ? bytesToHex(pauserBytes) : ownerHex;
  const emergencyPauserBech32 = pauserBytes && pauserBytes.length === 32
    ? formatBech32Address(pauserBytes, networkId)
    : ownerBech32;

  // In v2.2, contract is initialized upon construction
  const isInit = decoded._isInitialized !== undefined
    ? Boolean(decoded._isInitialized)
    : Boolean(ownerHex || decoded._name || decoded._symbol || saltBytes);

  let isCallerOwner = false;
  let isCallerPauser = false;
  if (isInit) {
    const effectiveSalt = saltBytes || (contractSaltOrAddress ? (typeof contractSaltOrAddress === 'string' ? hexToBytes(contractSaltOrAddress) : contractSaltOrAddress) : new Uint8Array(32).fill(42));

    // Check if custom or stored owner secret key derives to ownerHex
    if (ownerHex) {
      let candidateKey = customOwnerKey ? (typeof customOwnerKey === 'string' ? customOwnerKey : bytesToHex(customOwnerKey)) : null;
      if (!candidateKey && typeof window !== 'undefined') {
        const addrKey = typeof contractSaltOrAddress === 'string' && contractSaltOrAddress.length === 64 ? contractSaltOrAddress : '';
        candidateKey = (addrKey ? localStorage.getItem(`midnight_owner_sk_${addrKey}`) : null) ||
          localStorage.getItem(`midnight_owner_sk_${MIDNIGHT_CONFIG.contractAddress}`) ||
          (MIDNIGHT_CONFIG as any).ownerSecretKey || null;
      }
      if (candidateKey) {
        try {
          const derived = bytesToHex(FungibleTokenClient.deriveAccount(hexToBytes(candidateKey), effectiveSalt)).toLowerCase();
          if (derived === ownerHex.toLowerCase()) {
            isCallerOwner = true;
            isCallerPauser = true;
          }
        } catch {}
      }
    }

    if (!isCallerOwner && currentCaller) {
      const callerCleanHex = addressToHex32(currentCaller).toLowerCase();
      let callerDerivedHex: string | undefined;
      try {
        const callerBytes = hexToBytes(currentCaller);
        callerDerivedHex = bytesToHex(FungibleTokenClient.deriveAccount(callerBytes, effectiveSalt)).toLowerCase();
      } catch {}

      if (ownerHex) {
        isCallerOwner =
          callerCleanHex === ownerHex.toLowerCase() ||
          Boolean(callerDerivedHex && callerDerivedHex === ownerHex.toLowerCase());
      }
      if (emergencyPauserHex) {
        isCallerPauser =
          isCallerOwner ||
          callerCleanHex === emergencyPauserHex.toLowerCase() ||
          Boolean(callerDerivedHex && callerDerivedHex === emergencyPauserHex.toLowerCase());
      }
    }
  }

  return {
    name: decoded._name || (isInit ? 'Midnight Fungible Token' : 'Uninitialized Token'),
    symbol: decoded._symbol || (isInit ? 'MFT' : '---'),
    decimals: Number(decoded._decimals !== undefined ? decoded._decimals : 0n),
    totalSupply: decoded._totalSupply || 0n,
    maxSupply: decoded._maxSupply !== undefined ? decoded._maxSupply : 0n,
    contractSalt: contractSaltHex,
    isInitialized: isInit,
    isPaused: Boolean(decoded._paused),
    owner: isInit ? ownerHex : undefined,
    ownerBech32: isInit ? ownerBech32 : undefined,
    emergencyPauser: isInit ? emergencyPauserHex : undefined,
    emergencyPauserBech32: isInit ? emergencyPauserBech32 : undefined,
    isCallerOwner,
    isCallerPauser,
  };
}

export function useFungibleToken() {
  const { mode, accountAddress, isConnected, extensionApi, refreshBalances } = useWallet();
  const { showToast } = useToast();
  const { config } = useConfig();
  const activeContractAddress = config?.contractAddress || MIDNIGHT_CONFIG.contractAddress;

  // Mode-dependent metadata
  const [metadata, setMetadata] = useState<TokenMetadata>({
    name: 'Midnight Fungible Token',
    symbol: 'MFT',
    decimals: 6,
    totalSupply: 0n,
    isInitialized: false,
  });

  const [ledgerState, setLedgerState] = useState<FungibleTokenLedgerState | null>(null);
  const [txStatus, setTxStatus] = useState<TransactionStatus>('idle');
  const [currentTxHash, setCurrentTxHash] = useState<string | null>(null);
  const [currentBlock, setCurrentBlock] = useState<number | null>(null);
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [activeActionName, setActiveActionName] = useState<string | null>(null);
  const [activityLog, setActivityLog] = useState<ActivityItem[]>(() => {
    if (typeof window !== 'undefined') {
      return loadPersistentActivities(activeContractAddress);
    }
    return [];
  });

  const dismissTxStatus = useCallback(() => {
    setTxStatus('idle');
    setStatusMessage('');
    setActiveActionName(null);
  }, []);
  const [infraStatus, setInfraStatus] = useState<{ proofServer: boolean; indexer: boolean }>({
    proofServer: false,
    indexer: false,
  });
  const [indexerReport, setIndexerReport] = useState<IndexerTokenReport | null>(null);
  const [isQueryingIndexer, setIsQueryingIndexer] = useState<boolean>(false);

  // Client and runtime context refs
  const clientRef = useRef<FungibleTokenClient>(createConfiguredClient());
  const privateStateRef = useRef<FungibleTokenPrivateState>({
    currentSecretKey: hexToBytes(accountAddress || PRESET_IDENTITIES[0].addressHex),
    signingKey: hexToBytes(accountAddress || PRESET_IDENTITIES[0].addressHex),
  });

  // Keep separate simulated state ref for Test Mode
  const simulatedChargedStateRef = useRef<any>(null);
  const laceChargedStateRef = useRef<any>(null);

  // RxJS Observable for live ledger state subscription
  const ledgerStateSubjectRef = useRef<BehaviorSubject<FungibleTokenLedgerState | null>>(
    new BehaviorSubject<FungibleTokenLedgerState | null>(null)
  );

  // Dual-layer persistence sync: load from localStorage and merge with server-side file persistence
  useEffect(() => {
    let mounted = true;

    const syncActivities = async () => {
      if (typeof window === 'undefined') return;

      // 1. Immediately read all localStorage items
      const localItems = loadPersistentActivities(activeContractAddress);
      if (mounted && localItems.length > 0) {
        setActivityLog((prev) => {
          const map = new Map<string, ActivityItem>();
          [...localItems, ...prev].forEach((item) => {
            if (item && item.id) map.set(item.id, item);
          });
          return Array.from(map.values()).sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
        });
      }

      // 2. Query server-side file persistence (/api/activities) to merge cross-session / cross-device records
      try {
        const res = await fetch('/api/activities');
        if (res.ok) {
          const data = await res.json();
          if (data.success && Array.isArray(data.activities) && data.activities.length > 0) {
            if (mounted) {
              setActivityLog((prev) => {
                const map = new Map<string, ActivityItem>();
                [...data.activities, ...localItems, ...prev].forEach((item: ActivityItem) => {
                  if (item && item.id) map.set(item.id, item);
                });
                const merged = Array.from(map.values()).sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
                savePersistentActivities(merged, activeContractAddress);
                return merged;
              });
            }
          }
        }
      } catch (err) {
        console.warn('[useFungibleToken] Could not fetch server-side activities:', err);
      }
    };

    syncActivities();
    return () => {
      mounted = false;
    };
  }, [activeContractAddress]);

  const recordActivityEntry = useCallback((entry: ActivityItem) => {
    setActivityLog((prev) => {
      const updated = [entry, ...prev.filter((p) => p.id !== entry.id)];
      savePersistentActivities(updated, activeContractAddress);
      return updated;
    });

    // Mirror to server-side file persistence
    fetch('/api/activities', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ activity: entry }),
    }).catch(() => {});
  }, [activeContractAddress]);

  const updateActivityEntry = useCallback((id: string, updates: Partial<ActivityItem>) => {
    let updatedItem: ActivityItem | undefined;
    setActivityLog((prev) => {
      const updated = prev.map((item) => {
        if (item.id === id) {
          updatedItem = { ...item, ...updates };
          return updatedItem;
        }
        return item;
      });
      savePersistentActivities(updated, activeContractAddress);
      return updated;
    });

    if (updatedItem) {
      fetch('/api/activities', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ activity: updatedItem }),
      }).catch(() => {});
    }
  }, [activeContractAddress]);

  const activeContractSaltBytes = useMemo(() => {
    if (metadata.contractSalt) {
      return hexToBytes(metadata.contractSalt);
    }
    if (config?.contractSalt) {
      return hexToBytes(config.contractSalt);
    }
    if (MIDNIGHT_CONFIG.contractSalt) {
      return hexToBytes(MIDNIGHT_CONFIG.contractSalt);
    }
    return new Uint8Array(32).fill(42);
  }, [metadata.contractSalt, config?.contractSalt]);

  // Check infrastructure health on mount
  useEffect(() => {
    checkInfrastructureHealth().then((status) => {
      setInfraStatus(status);
    });
  }, []);

  // Initialize simulated test state (ONLY for Test Mode)
  // Initializes contract strictly as defined in constructor(salt: Bytes<32>, initialOwner: Bytes<32>, ...)
  const initSimulatedTestState = useCallback(() => {
    try {
      const dummyCoinPublicKey = '01'.repeat(32);
      const testSalt = config?.contractSalt ? hexToBytes(config.contractSalt) : new Uint8Array(32).fill(42);
      const client = createConfiguredClient(testSalt);
      clientRef.current = client;
      const ownerSK = hexToBytes(PRESET_IDENTITIES[0].addressHex);
      const ownerAccount = FungibleTokenClient.deriveAccount(ownerSK, testSalt);
      const initialPrivateState: FungibleTokenPrivateState = {
        currentSecretKey: ownerSK,
        secretKey: ownerSK,
        signingKey: ownerSK,
      };
      privateStateRef.current = initialPrivateState;

      const constructorCtx = CompactRuntime.createConstructorContext(
        initialPrivateState,
        dummyCoinPublicKey
      );
      // Directly execute constructor(salt, initialOwner, name, symbol, decimals, maxSupply)
      const initResult = client.initialState(
        constructorCtx,
        testSalt,
        ownerAccount,
        'Midnight Token',
        'MDT',
        8n,
        1_000_000n
      );
      const st = initResult.currentContractState.data;
      const ps = initResult.currentPrivateState;

      simulatedChargedStateRef.current = st;
      privateStateRef.current = ps;

      const decoded = client.queryLedgerStateFromRaw(st);
      setLedgerState(decoded);
      ledgerStateSubjectRef.current.next(decoded);
      setMetadata(extractMetadata(decoded, PRESET_IDENTITIES[0].addressHex, MIDNIGHT_CONFIG.networkId, testSalt));
    } catch (err) {
      console.warn('[useFungibleToken] Simulated test initialization error:', err);
    }
  }, [config?.contractSalt]);

  // Fetch real on-chain state for Lace Wallet Mode (with localStorage fallback if indexer hasn't indexed)
  const fetchLaceOnChainState = useCallback(async () => {
    let cachedState: any = null;
    let cachedDecoded: FungibleTokenLedgerState | null = null;

    // 1. Check browser localStorage cache first (immediate restoration on reload)
    if (typeof window !== 'undefined') {
      try {
        const cachedRaw = localStorage.getItem(`${LACE_STORAGE_KEY_PREFIX}${activeContractAddress}`);
        if (cachedRaw) {
          const restoredState = deserializeChargedState(cachedRaw);
          if (restoredState) {
            const decoded = ledger(restoredState);
            if (decoded) {
              cachedState = restoredState;
              cachedDecoded = decoded;
            }
          }
        }

        // Secondary fallback check for stored metadata
        if (!cachedDecoded) {
          const cachedMetaRaw = localStorage.getItem(`${TOKEN_META_KEY_PREFIX}${activeContractAddress}`);
          if (cachedMetaRaw) {
            const parsedMeta = JSON.parse(cachedMetaRaw);
            if (parsedMeta) {
              const ownerHex = parsedMeta.owner;
              let callerDerivedHex = '';
              if (accountAddress) {
                try {
                  const callerBytes = hexToBytes(accountAddress);
                  callerDerivedHex = bytesToHex(FungibleTokenClient.deriveAccount(callerBytes, activeContractSaltBytes)).toLowerCase();
                } catch {}
              }
              const isCallerOwner = Boolean(
                ownerHex && accountAddress && (
                  addressToHex32(accountAddress).toLowerCase() === ownerHex.toLowerCase() ||
                  (callerDerivedHex && callerDerivedHex === ownerHex.toLowerCase())
                )
              );
              setMetadata({
                name: parsedMeta.name || 'Midnight Fungible Token',
                symbol: parsedMeta.symbol || 'MFT',
                decimals: Number(parsedMeta.decimals || 6),
                totalSupply: BigInt(parsedMeta.totalSupply || '0'),
                maxSupply: BigInt(parsedMeta.maxSupply || '0'),
                isInitialized: true,
                isPaused: Boolean(parsedMeta.isPaused),
                owner: ownerHex,
                ownerBech32: parsedMeta.ownerBech32,
                emergencyPauser: parsedMeta.emergencyPauser,
                emergencyPauserBech32: parsedMeta.emergencyPauserBech32,
                isCallerOwner,
                isCallerPauser: isCallerOwner,
              });
            }
          }
        }
      } catch (cacheErr) {
        console.warn('[useFungibleToken] Error reading cached state:', cacheErr);
      }
    }

    // Immediately reflect cached initialized state so UI does not flicker to uninitialized
    if (cachedState && cachedDecoded) {
      laceChargedStateRef.current = cachedState;
      const client = createConfiguredClient(activeContractSaltBytes);
      clientRef.current = client;

      setLedgerState(cachedDecoded);
      ledgerStateSubjectRef.current.next(cachedDecoded);
      setMetadata(extractMetadata(cachedDecoded, accountAddress));
      console.log('[useFungibleToken] Restored contract state from browser cache:', {
        name: cachedDecoded._name,
        symbol: cachedDecoded._symbol,
        decimals: cachedDecoded._decimals?.toString(),
        totalSupply: cachedDecoded._totalSupply?.toString(),
        maxSupply: cachedDecoded._maxSupply?.toString(),
        isPaused: cachedDecoded._paused,
      });
    }

    // 2. Query live public indexer
    try {
      const providers = createLaceMidnightProviders(extensionApi || {});
      const onChainState = await providers.publicDataProvider.queryContractState(
        activeContractAddress
      );

      if (onChainState && onChainState.data) {
        const decoded = ledger(onChainState.data);

        // If on-chain state exists, it is the canonical truth!
        if (decoded) {
          laceChargedStateRef.current = onChainState.data;
          setLedgerState(decoded);
          ledgerStateSubjectRef.current.next(decoded);
          const meta = extractMetadata(decoded, accountAddress);
          setMetadata(meta);

          if (typeof window !== 'undefined') {
            try {
              const serialized = serializeChargedState(onChainState.data);
              if (serialized) {
                localStorage.setItem(`${LACE_STORAGE_KEY_PREFIX}${activeContractAddress}`, serialized);
              }
              localStorage.setItem(
                `${TOKEN_META_KEY_PREFIX}${activeContractAddress}`,
                JSON.stringify({
                  name: meta.name,
                  symbol: meta.symbol,
                  decimals: meta.decimals,
                  totalSupply: meta.totalSupply.toString(),
                  maxSupply: meta.maxSupply ? meta.maxSupply.toString() : '0',
                  isInitialized: true,
                  isPaused: meta.isPaused,
                  owner: meta.owner,
                  ownerBech32: meta.ownerBech32,
                  emergencyPauser: meta.emergencyPauser,
                  emergencyPauserBech32: meta.emergencyPauserBech32,
                })
              );
            } catch {}
          }
          return;
        } else if (cachedState && cachedDecoded) {
          console.log('[useFungibleToken] Preserving locally cached contract state against lagging indexer.');
          return;
        } else {
          laceChargedStateRef.current = onChainState.data;
          setLedgerState(decoded);
          ledgerStateSubjectRef.current.next(decoded);
          setMetadata(extractMetadata(decoded, accountAddress));
          return;
        }
      }
    } catch (err) {
      console.warn('[useFungibleToken] On-chain state query from indexer publicDataProvider:', err);
    }

    // 2b. Direct HTTP Indexer Fallback (bypasses WebSocket/extension delays)
    try {
      const indexerUrl = config?.indexerUrl || MIDNIGHT_CONFIG.indexerUrl;
      const res = await fetch(indexerUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: CONTRACT_ACTION_QUERY,
          variables: { address: activeContractAddress.trim() },
        }),
        signal: AbortSignal.timeout(6000),
      });
      if (res.ok) {
        const json = await res.json();
        const action = json.data?.contractAction;
        if (action?.state) {
          const stateBytes = toByteArray(action.state);
          const contractState = ContractState.deserialize(stateBytes);
          const decoded = ledger(contractState.data);
          if (decoded) {
            laceChargedStateRef.current = contractState.data;
            setLedgerState(decoded);
            ledgerStateSubjectRef.current.next(decoded);
            const meta = extractMetadata(decoded, accountAddress);
            setMetadata(meta);

            if (typeof window !== 'undefined') {
              try {
                const serialized = serializeChargedState(contractState.data);
                if (serialized) {
                  localStorage.setItem(`${LACE_STORAGE_KEY_PREFIX}${activeContractAddress}`, serialized);
                }
                localStorage.setItem(
                  `${TOKEN_META_KEY_PREFIX}${activeContractAddress}`,
                  JSON.stringify({
                    name: meta.name,
                    symbol: meta.symbol,
                    decimals: meta.decimals,
                    totalSupply: meta.totalSupply.toString(),
                    maxSupply: meta.maxSupply ? meta.maxSupply.toString() : '0',
                    isInitialized: true,
                    isPaused: meta.isPaused,
                    owner: meta.owner,
                    ownerBech32: meta.ownerBech32,
                    emergencyPauser: meta.emergencyPauser,
                    emergencyPauserBech32: meta.emergencyPauserBech32,
                  })
                );
              } catch {}
            }
            return;
          }
        }
      }
    } catch (directErr) {
      console.warn('[useFungibleToken] Direct HTTP indexer query fallback:', directErr);
    }

    // 3. If already restored from cache, we are done
    if (cachedState && cachedDecoded) {
      return;
    }

    // 4. Fallback to clean state only if not found on-chain
    const client = createConfiguredClient(activeContractSaltBytes);
    clientRef.current = client;

    const dummyCoinPublicKey = addressToHex32(accountAddress);
    const initialOwnerBytes = hexToBytes(accountAddress || '01'.repeat(32));
    const initialOwnerAccount = FungibleTokenClient.deriveAccount(initialOwnerBytes, activeContractSaltBytes);
    const initialPrivateState: FungibleTokenPrivateState = {
      secretKey: initialOwnerBytes,
      currentSecretKey: initialOwnerBytes,
      signingKey: initialOwnerBytes,
    };
    privateStateRef.current = initialPrivateState;

    const constructorCtx = CompactRuntime.createConstructorContext(
      initialPrivateState,
      dummyCoinPublicKey
    );
    const initResult = client.initialState(
      constructorCtx,
      activeContractSaltBytes,
      initialOwnerAccount,
      'Euro Token',
      'EUT',
      6n,
      2000000000000n
    );
    laceChargedStateRef.current = initResult.currentContractState.data;
    privateStateRef.current = initResult.currentPrivateState;

    const decoded = client.queryLedgerStateFromRaw(laceChargedStateRef.current);
    setLedgerState(decoded);
    ledgerStateSubjectRef.current.next(decoded);

    // Default clean state for Lace mode
    setMetadata(extractMetadata(decoded, accountAddress, MIDNIGHT_CONFIG.networkId, activeContractSaltBytes));
  }, [extensionApi, accountAddress, activeContractAddress, activeContractSaltBytes, config?.indexerUrl]);

  // Query on-chain indexer for full token metadata & account distribution report
  const fetchIndexerReport = useCallback(
    async (overrideAddress?: string, overrideUrl?: string): Promise<IndexerTokenReport | null> => {
      const targetAddr = overrideAddress || activeContractAddress;
      const targetUrl = overrideUrl || MIDNIGHT_CONFIG.indexerUrl;
      setIsQueryingIndexer(true);
      try {
        const report = await queryIndexerContractState(targetAddr, targetUrl, {
          currentUserAddress: accountAddress,
          contractSalt: activeContractSaltBytes,
          networkId: MIDNIGHT_CONFIG.networkId,
        });
        setIndexerReport(report);
        return report;
      } catch (err: any) {
        console.warn('[useFungibleToken] Indexer query error:', err?.message || err);
        return null;
      } finally {
        setIsQueryingIndexer(false);
      }
    },
    [accountAddress, activeContractAddress, activeContractSaltBytes]
  );

  // Compute live account shares from the active synchronized ledger state
  const synchronizedLedgerReport = useMemo<IndexerTokenReport | null>(() => {
    if (!ledgerState) return null;
    return calculateAccountSharesFromLedger(ledgerState, {
      contractAddress: activeContractAddress,
      currentUserAddress: accountAddress,
      contractSalt: activeContractSaltBytes,
      networkId: MIDNIGHT_CONFIG.networkId,
      source: mode === 'test' ? 'simulated' : 'local_cache',
    });
  }, [ledgerState, accountAddress, activeContractSaltBytes, mode, activeContractAddress]);

  // Synchronize state when Mode changes
  useEffect(() => {
    if (mode === 'test') {
      initSimulatedTestState();
    } else {
      fetchLaceOnChainState();
    }
    fetchIndexerReport();
  }, [mode, initSimulatedTestState, fetchLaceOnChainState, fetchIndexerReport]);

  // Update caller address in private state when connected address changes
  useEffect(() => {
    if (accountAddress) {
      privateStateRef.current = {
        ...privateStateRef.current,
        signingKey: hexToBytes(accountAddress),
      };
      setMetadata((prev) => {
        let callerDerivedHex = '';
        try {
          const callerBytes = hexToBytes(accountAddress);
          callerDerivedHex = bytesToHex(FungibleTokenClient.deriveAccount(callerBytes, activeContractSaltBytes)).toLowerCase();
        } catch {}
        const isCallerOwner = Boolean(
          prev.isInitialized && prev.owner && (
            addressToHex32(accountAddress).toLowerCase() === prev.owner.toLowerCase() ||
            (callerDerivedHex && callerDerivedHex === prev.owner.toLowerCase())
          )
        );
        return { ...prev, isCallerOwner, isCallerPauser: isCallerOwner };
      });
    }
  }, [accountAddress, activeContractSaltBytes]);

  // RxJS State Subscription Hook: Subscribe to ledgerState changes
  useEffect(() => {
    const subscription = ledgerStateSubjectRef.current.subscribe((state) => {
      if (state) {
        setLedgerState(state);
        const caller = accountAddress || (mode === 'test' ? PRESET_IDENTITIES[0].addressHex : null);
        setMetadata(extractMetadata(state, caller));
      }
    });

    return () => subscription.unsubscribe();
  }, [mode, accountAddress]);

  // Unified Circuit Execution Runner (Managing 4-step progress: Preparing -> Proving -> Submitting -> Confirmed)
  const executeCircuit = useCallback(
    async (
      circuitName: string,
      params: Record<string, string>,
      circuitFn: (ctx: CompactRuntime.CircuitContext<any>) => any | Promise<any>,
      options?: {
        customSecretKey?: Uint8Array | string;
        callerAccount?: Uint8Array;
        circuitArgs?: any[];
      }
    ) => {
      const txId = Math.random().toString(36).substring(2, 9);
      const startTime = Date.now();
      const activityEntry: ActivityItem = {
        id: txId,
        circuitName,
        params,
        status: 'pending',
        timestamp: startTime,
        caller: accountAddress || (mode === 'test' ? PRESET_IDENTITIES[0].addressHex : undefined),
        contractAddress: activeContractAddress,
        networkId: MIDNIGHT_CONFIG.networkId,
        mode,
      };

      recordActivityEntry(activityEntry);
      setActiveActionName(circuitName);

      try {
        let effectiveSK: Uint8Array;
        if (options?.customSecretKey) {
          effectiveSK =
            typeof options.customSecretKey === 'string'
              ? hexToBytes(options.customSecretKey)
              : options.customSecretKey;
        } else {
          const callerHex =
            accountAddress || (mode === 'test' ? PRESET_IDENTITIES[0].addressHex : '01'.repeat(32));
          effectiveSK = hexToBytes(callerHex);
        }

        // =========================================================================
        // LACE WALLET MODE: LIVE ON-CHAIN TRANSACTION EXECUTION VIA MIDNIGHT NETWORK
        // =========================================================================
        if (mode === 'lace') {
          if (!extensionApi) {
            throw new Error(
              'Lace wallet is not connected. Please click "Connect Lace" in the top bar to connect or unlock your wallet, then try again.'
            );
          }
          // STEP 1: Building Transaction Intent & Evaluating Witnesses
          setTxStatus('preparing');
          setStatusMessage(`Building ${circuitName} transaction intent & resolving Compact witnesses...`);

          const rawProviders = createLaceMidnightProviders(extensionApi, { nodeUrl: config.nodeUrl });

          // Wrap providers with step-by-step progress tracking for each lifecycle phase
          const providers = {
            ...rawProviders,
            proofProvider: {
              ...rawProviders.proofProvider,
              proveTx: async (unprovenTx: any, config?: any) => {
                // STEP 2: Zero-Knowledge Proof Generation via Proof Server
                setTxStatus('proving');
                setStatusMessage('Generating Zero-Knowledge Proof (PLONK circuit) via Proof Server...');
                return await rawProviders.proofProvider.proveTx(unprovenTx, config);
              },
            },
            walletProvider: {
              ...rawProviders.walletProvider,
              balanceTx: async (tx: any, ttl?: Date) => {
                // STEP 3: Lace Wallet Signature & DUST Fee Balancing
                setTxStatus('signing');
                setStatusMessage('Please approve and sign the transaction in your Lace wallet extension...');
                return await rawProviders.walletProvider.balanceTx(tx, ttl);
              },
            },
            midnightProvider: {
              ...rawProviders.midnightProvider,
              submitTx: async (tx: any) => {
                // STEP 4: Submitting Extrinsic to Midnight Network
                setTxStatus('submitting');
                setStatusMessage('Submitting signed transaction extrinsic to Midnight network...');
                const txId = await rawProviders.midnightProvider.submitTx(tx);
                setStatusMessage(`Extrinsic broadcasted (${txId.slice(0, 10)}...). Waiting for on-chain block inclusion...`);
                return txId;
              },
            },
          };

          // Ensure private state is synchronized with effective secret key BEFORE finding contract
          await providers.privateStateProvider.set('fungible-token-state', { secretKey: effectiveSK });

          const witnesses = {
            localSecretKey: (ctx: any) => {
              // Prioritize effectiveSK (e.g. ownerSK during mint/admin or callerSK during user circuits)
              const sk = effectiveSK || ctx.privateState?.secretKey;
              return [{ ...ctx.privateState, secretKey: sk }, sk];
            },
          };

          const compiledContract = CompiledContract.make('fungible-token', Contract).pipe(
            CompiledContract.withWitnesses(witnesses)
          );

          const foundContract = await findDeployedContract(providers as any, {
            compiledContract: compiledContract as any,
            contractAddress: activeContractAddress,
            privateStateId: 'fungible-token-state',
            initialPrivateState: { secretKey: effectiveSK },
          } as any);

          const callFn = (foundContract.callTx as any)[circuitName];
          if (typeof callFn !== 'function') {
            throw new Error(`Circuit '${circuitName}' is not defined on deployed contract`);
          }

          const circuitArgs = options?.circuitArgs || [];
          console.log(`[useFungibleToken] Executing live on-chain callTx.${circuitName} with args:`, circuitArgs);

          const finalizedTxData = await callFn(...circuitArgs);
          console.log(`[useFungibleToken] Live on-chain callTx.${circuitName} finalized:`, finalizedTxData);

          const submittedHash =
            (finalizedTxData?.public as any)?.txHash ||
            (finalizedTxData?.public as any)?.txId ||
            currentTxHash ||
            '';
          const blockNum = (finalizedTxData?.public as any)?.blockHeight;

          // STEP 5: Committed on-chain in consensus block
          setCurrentTxHash(submittedHash);
          setCurrentBlock(blockNum);
          setTxStatus('confirmed');
          setStatusMessage(`Committed on-chain in Block #${blockNum}!`);

          // Invalidate stale local storage cache so indexer is source of truth
          if (typeof window !== 'undefined') {
            try {
              localStorage.removeItem(`${LACE_STORAGE_KEY_PREFIX}${activeContractAddress}`);
              localStorage.removeItem(`${TOKEN_META_KEY_PREFIX}${activeContractAddress}`);
            } catch {}
          }

          // Update activity log with real transaction hash, block height, and duration
          const durationMs = Date.now() - startTime;
          updateActivityEntry(txId, {
            status: 'confirmed',
            txHash: submittedHash,
            blockHeight: blockNum,
            durationMs,
          });

          showToast(
            'success',
            `${circuitName} Successful`,
            `On-chain transaction ${submittedHash.slice(0, 10)}... confirmed in Block #${blockNum}`
          );

          // Refresh on-chain state from indexer
          setTimeout(async () => {
            await fetchLaceOnChainState();
            refreshBalances();
            fetchIndexerReport();
          }, 1500);

          setTimeout(() => {
            setTxStatus('idle');
            setStatusMessage('');
            setActiveActionName(null);
          }, 6000);

          return finalizedTxData;
        }

        // =========================================================================
        // TEST MODE: SIMULATED EXECUTION (NO WALLET)
        // =========================================================================
        // STEP 1: Building Transaction Intent
        setTxStatus('preparing');
        setStatusMessage(`Building ${circuitName} transaction intent (Simulated)...`);
        await new Promise((r) => setTimeout(r, 600));

        // STEP 2: Zero-Knowledge Proof Generation
        setTxStatus('proving');
        setStatusMessage('Generating Zero-Knowledge Proof (Compact Runtime Simulated)...');
        await new Promise((r) => setTimeout(r, 750));

        // STEP 3: Wallet Signature & Fee Balancing
        setTxStatus('signing');
        setStatusMessage('Balancing DUST fee & signing transaction intent (Simulated)...');
        await new Promise((r) => setTimeout(r, 600));

        const providers = createSimulatedMidnightProviders();

        if (!simulatedChargedStateRef.current) {
          initSimulatedTestState();
        }
        const currentActiveChargedState = simulatedChargedStateRef.current;

        privateStateRef.current = {
          ...privateStateRef.current,
          secretKey: effectiveSK,
          currentSecretKey: effectiveSK,
          signingKey: effectiveSK,
        };

        const coinPubKey = addressToHex32(providers.walletProvider.getCoinPublicKey());
        const circuitCtx = CompactRuntime.createCircuitContext(
          activeContractAddress,
          coinPubKey,
          currentActiveChargedState,
          privateStateRef.current
        );

        const result = await circuitFn(circuitCtx);
        const updatedChargedState = result?.context?.currentQueryContext?.state ?? currentActiveChargedState;
        const updatedPrivateState = result?.context?.currentPrivateState ?? privateStateRef.current;

        // STEP 4: Submitting Extrinsic
        setTxStatus('submitting');
        setStatusMessage('Submitting transaction extrinsic to Midnight Blockchain (Simulated)...');

        const submittedHash = await providers.midnightProvider.submitTx({ circuitName, params });
        await new Promise((r) => setTimeout(r, 650));

        // STEP 5: Committed
        const blockNum = 184200 + Math.floor(Math.random() * 50);

        setCurrentTxHash(submittedHash);
        setCurrentBlock(blockNum);
        setTxStatus('confirmed');
        setStatusMessage(`Committed in Block #${blockNum} (Simulated)`);

        privateStateRef.current = updatedPrivateState;

        const updatedLedger = clientRef.current.queryLedgerStateFromRaw(updatedChargedState);
        setLedgerState(updatedLedger);
        ledgerStateSubjectRef.current.next(updatedLedger);

        simulatedChargedStateRef.current = updatedChargedState;

        const caller = accountAddress || PRESET_IDENTITIES[0].addressHex;
        const meta = extractMetadata(updatedLedger, caller);
        setMetadata(meta);

        const durationMs = Date.now() - startTime;
        updateActivityEntry(txId, {
          status: 'confirmed',
          txHash: submittedHash,
          blockHeight: blockNum,
          durationMs,
        });

        showToast(
          'success',
          `${circuitName} Successful`,
          `Simulated transaction ${submittedHash.slice(0, 10)}... confirmed in Block #${blockNum}`
        );

        refreshBalances();
        fetchIndexerReport();

        setTimeout(() => {
          setTxStatus('idle');
          setStatusMessage('');
          setActiveActionName(null);
        }, 5000);

        return result.result;
      } catch (err: any) {
        console.error(`[useFungibleToken] Error in ${circuitName}:`, err);
        setActiveActionName(null);
        const isLocked = isWalletLockedError(err);
        const isShutdown = isChannelShutdownError(err);
        const errMsg = isLocked
          ? 'Your Lace wallet is locked. Please click the Lace extension icon in your browser toolbar, enter your password to unlock it, and try again.'
          : isShutdown
          ? 'Lace extension channel was idle/shutdown. Connection has been refreshed. Please retry your transaction.'
          : extractDetailedErrorMessage(err);

        setTxStatus('failed');
        setStatusMessage(errMsg);

        const durationMs = Date.now() - startTime;
        updateActivityEntry(txId, {
          status: 'failed',
          error: errMsg,
          durationMs,
        });

        showToast(
          'error',
          isLocked ? 'Lace Wallet Locked' : isShutdown ? 'Lace Channel Reconnected' : `${circuitName} Failed`,
          errMsg
        );

        if (isLocked || isShutdown) {
          refreshBalances();
        }

        setTimeout(() => {
          setTxStatus('idle');
          setStatusMessage('');
        }, 5000);

        const errorToThrow = new Error(errMsg, { cause: err });
        throw errorToThrow;
      }
    },
    [mode, extensionApi, showToast, refreshBalances, activeContractAddress, fetchLaceOnChainState, fetchIndexerReport, extractMetadata, recordActivityEntry, updateActivityEntry]
  );

  // Direct queries (read-only) against current decoded ledger state
  const getBalanceOf = useCallback(
    (accountHex: string): bigint => {
      if (!accountHex) return 0n;
      const accountBytes = addressToBytes32(accountHex);
      let derived: Uint8Array | null = null;
      try {
        derived = FungibleTokenClient.deriveAccount(accountBytes, activeContractSaltBytes);
      } catch {}

      // 1. Check spendable derived account first in live synchronized ledger state
      if (ledgerState && ledgerState._balances) {
        if (derived && ledgerState._balances.member(derived)) {
          return ledgerState._balances.lookup(derived);
        }
        if (ledgerState._balances.member(accountBytes)) {
          return ledgerState._balances.lookup(accountBytes);
        }
      }

      // 2. Check in synchronizedLedgerReport and indexerReport holders
      const derivedHex = derived ? bytesToHex(derived).toLowerCase() : '';
      const rawHex = bytesToHex(accountBytes).toLowerCase();
      const cleanInput = accountHex.toLowerCase().replace(/^0x/, '');
      const isAccountConnectedUser = Boolean(
        accountAddress &&
          (cleanInput === accountAddress.toLowerCase().replace(/^0x/, '') ||
            accountHex === accountAddress ||
            (accountAddress.startsWith('mn_') && formatBech32Address(rawHex).toLowerCase() === accountAddress.toLowerCase()))
      );

      const findInHolders = (reportHolders?: AccountShare[]): bigint | null => {
        if (!reportHolders || reportHolders.length === 0) return null;
        const matched = reportHolders.find((h) => {
          const hHex = h.addressHex.toLowerCase();
          if (derivedHex && hHex === derivedHex) return true;
          if (hHex === rawHex) return true;
          if (cleanInput && hHex === cleanInput) return true;
          if (h.addressBech32 && h.addressBech32.toLowerCase() === cleanInput) return true;
          if (isAccountConnectedUser && h.isCurrentUser) return true;
          return false;
        });
        return matched !== undefined ? matched.balance : null;
      };

      const syncBalance = findInHolders(synchronizedLedgerReport?.holders);
      if (syncBalance !== null) return syncBalance;

      const indexerBalance = findInHolders(indexerReport?.holders);
      if (indexerBalance !== null) return indexerBalance;

      return 0n;
    },
    [ledgerState, activeContractSaltBytes, synchronizedLedgerReport, indexerReport, accountAddress]
  );

  const getRawLockedBalanceOf = useCallback(
    (accountHex: string): bigint => {
      if (!accountHex) return 0n;
      const accountBytes = addressToBytes32(accountHex);
      if (ledgerState && ledgerState._balances) {
        if (ledgerState._balances.member(accountBytes)) {
          return ledgerState._balances.lookup(accountBytes);
        }
      }
      const rawHex = bytesToHex(accountBytes).toLowerCase();
      const match = (synchronizedLedgerReport?.holders || indexerReport?.holders)?.find(
        (h) => h.addressHex.toLowerCase() === rawHex
      );
      return match ? match.balance : 0n;
    },
    [ledgerState, synchronizedLedgerReport, indexerReport]
  );

  const getAllowance = useCallback(
    (ownerHex: string, spenderHex: string): bigint => {
      if (!ledgerState || !ledgerState._allowances) return 0n;
      const ownerBytes = hexToBytes(ownerHex);
      const spenderBytes = hexToBytes(spenderHex);
      const key: [Uint8Array, Uint8Array] = [ownerBytes, spenderBytes];

      if (!ledgerState._allowances.member(key)) {
        return 0n;
      }
      return ledgerState._allowances.lookup(key);
    },
    [ledgerState]
  );

  // Helper to ensure recipient addresses are always converted to their spendable derived accounts
  const resolveSpendableDestination = useCallback(
    (destHex: string): Uint8Array => {
      const clean = destHex.toLowerCase().replace(/^0x/, '');
      const ownerClean = (metadata.owner || '').toLowerCase().replace(/^0x/, '');
      // If destination is already the owner's spendable account, use as-is
      if (ownerClean && clean === ownerClean) {
        return hexToBytes(clean);
      }
      let toBytes = hexToBytes(clean);
      try {
        toBytes = FungibleTokenClient.deriveAccount(toBytes, activeContractSaltBytes);
      } catch {}
      return toBytes;
    },
    [metadata.owner, activeContractSaltBytes]
  );

  // Circuit Wrappers adhering strictly to Compact types and BigInt safety
  const initialize = useCallback(
    async (name: string, symbol: string, decimals: number | bigint) => {
      showToast('info', 'Constructor Initialized', 'FungibleTokenV22 is initialized in constructor upon contract deployment.');
      return [] as any;
    },
    [showToast]
  );

  const transfer = useCallback(
    async (toHex: string, amount: bigint | number, optionalCallerKeyHex?: string) => {
      let callerSK: Uint8Array;
      if (optionalCallerKeyHex && optionalCallerKeyHex.trim()) {
        callerSK = hexToBytes(optionalCallerKeyHex.trim());
      } else {
        const callerHex = accountAddress || (mode === 'test' ? PRESET_IDENTITIES[0].addressHex : '01'.repeat(32));
        callerSK = hexToBytes(callerHex);
      }
      const callerAccount = FungibleTokenClient.deriveAccount(callerSK, activeContractSaltBytes);
      const toBytes = resolveSpendableDestination(toHex);
      const valBigInt = BigInt(amount);

      return executeCircuit(
        'transfer',
        { to: toHex, value: valBigInt.toString() },
        (ctx) => clientRef.current.transfer(ctx, callerAccount, toBytes, valBigInt),
        {
          customSecretKey: callerSK,
          circuitArgs: [callerAccount, toBytes, valBigInt],
        }
      );
    },
    [accountAddress, mode, activeContractSaltBytes, resolveSpendableDestination, executeCircuit]
  );

  const approve = useCallback(
    async (spenderHex: string, amount: bigint | number, optionalCallerKeyHex?: string) => {
      let callerSK: Uint8Array;
      if (optionalCallerKeyHex && optionalCallerKeyHex.trim()) {
        callerSK = hexToBytes(optionalCallerKeyHex.trim());
      } else {
        const callerHex = accountAddress || (mode === 'test' ? PRESET_IDENTITIES[0].addressHex : '01'.repeat(32));
        callerSK = hexToBytes(callerHex);
      }
      const callerAccount = FungibleTokenClient.deriveAccount(callerSK, activeContractSaltBytes);
      const spenderBytes = resolveSpendableDestination(spenderHex);
      const valBigInt = BigInt(amount);

      return executeCircuit(
        'approve',
        { spender: spenderHex, value: valBigInt.toString() },
        (ctx) => clientRef.current.approve(ctx, callerAccount, spenderBytes, valBigInt),
        {
          customSecretKey: callerSK,
          circuitArgs: [callerAccount, spenderBytes, valBigInt],
        }
      );
    },
    [accountAddress, mode, activeContractSaltBytes, resolveSpendableDestination, executeCircuit]
  );

  const transferFrom = useCallback(
    async (fromHex: string, toHex: string, amount: bigint | number, optionalSpenderKeyHex?: string) => {
      let spenderSK: Uint8Array;
      if (optionalSpenderKeyHex && optionalSpenderKeyHex.trim()) {
        spenderSK = hexToBytes(optionalSpenderKeyHex.trim());
      } else {
        const callerHex = accountAddress || (mode === 'test' ? PRESET_IDENTITIES[0].addressHex : '01'.repeat(32));
        spenderSK = hexToBytes(callerHex);
      }
      const spenderAccount = FungibleTokenClient.deriveAccount(spenderSK, activeContractSaltBytes);
      const fromBytes = resolveSpendableDestination(fromHex);
      const toBytes = resolveSpendableDestination(toHex);
      const valBigInt = BigInt(amount);

      return executeCircuit(
        'transferFrom',
        { from: fromHex, to: toHex, value: valBigInt.toString() },
        (ctx) => clientRef.current.transferFrom(ctx, spenderAccount, fromBytes, toBytes, valBigInt),
        {
          customSecretKey: spenderSK,
          circuitArgs: [spenderAccount, fromBytes, toBytes, valBigInt],
        }
      );
    },
    [accountAddress, mode, activeContractSaltBytes, resolveSpendableDestination, executeCircuit]
  );

  const resolveOwnerSecretKey = useCallback(
    (optionalKeyHex?: string): Uint8Array => {
      if (optionalKeyHex && optionalKeyHex.trim()) {
        return hexToBytes(optionalKeyHex.trim());
      }
      // If connected wallet account directly matches or derives to owner, prioritize connected wallet
      if (accountAddress && metadata.owner) {
        try {
          const derived = bytesToHex(
            FungibleTokenClient.deriveAccount(hexToBytes(accountAddress), activeContractSaltBytes)
          ).toLowerCase();
          if (
            derived === metadata.owner.toLowerCase() ||
            addressToHex32(accountAddress).toLowerCase() === metadata.owner.toLowerCase()
          ) {
            return hexToBytes(accountAddress);
          }
        } catch {}
      }

      // Check saved key in localStorage
      const saved =
        typeof window !== 'undefined'
          ? localStorage.getItem(`midnight_owner_sk_${activeContractAddress}`)
          : null;
      if (saved && saved.trim()) {
        return hexToBytes(saved.trim());
      }
      if ((config as any)?.ownerSecretKey) {
        return hexToBytes((config as any).ownerSecretKey);
      }
      if (mode === 'test') {
        return hexToBytes(accountAddress || PRESET_IDENTITIES[0].addressHex);
      }
      return hexToBytes(accountAddress || '01'.repeat(32));
    },
    [accountAddress, metadata.owner, activeContractAddress, activeContractSaltBytes, config, mode]
  );

  const mint = useCallback(
    async (accountHex: string, amount: bigint | number, optionalOwnerKeyHex?: string) => {
      // Resolve owner secret key for mint authorization
      const ownerSK = resolveOwnerSecretKey(optionalOwnerKeyHex);
      const toBytes = resolveSpendableDestination(accountHex);
      const valBigInt = BigInt(amount);

      return executeCircuit(
        'mint',
        { to: accountHex, value: valBigInt.toString() },
        (ctx) => clientRef.current.mint(ctx, toBytes, valBigInt),
        {
          customSecretKey: ownerSK,
          circuitArgs: [toBytes, valBigInt],
        }
      );
    },
    [resolveOwnerSecretKey, resolveSpendableDestination, executeCircuit]
  );

  const burn = useCallback(
    async (accountHexOrAmount: string | bigint | number, optionalAmount?: bigint | number, optionalCallerKeyHex?: string) => {
      let accountHex: string;
      let amount: bigint | number;

      if (
        typeof accountHexOrAmount === 'bigint' ||
        typeof accountHexOrAmount === 'number' ||
        (typeof accountHexOrAmount === 'string' && /^\d+$/.test(accountHexOrAmount))
      ) {
        accountHex = accountAddress || (mode === 'test' ? PRESET_IDENTITIES[0].addressHex : '01'.repeat(32));
        amount = typeof accountHexOrAmount === 'string' ? BigInt(accountHexOrAmount) : accountHexOrAmount;
      } else {
        accountHex = accountHexOrAmount;
        amount = optionalAmount ?? 0n;
      }

      let callerSK = optionalCallerKeyHex
        ? hexToBytes(optionalCallerKeyHex)
        : hexToBytes(accountAddress || '01'.repeat(32));
      let callerAccount = hexToBytes(accountHex);

      if (mode === 'test') {
        try {
          callerAccount = FungibleTokenClient.deriveAccount(callerAccount, activeContractSaltBytes);
        } catch {}
      } else if (accountAddress) {
        // In Lace mode: if caller provided raw wallet address, spend from their derived account
        const cleanAccount = accountHex.toLowerCase().replace(/^0x/, '');
        const cleanCaller = accountAddress.toLowerCase().replace(/^0x/, '');
        if (cleanAccount === cleanCaller) {
          try {
            callerAccount = FungibleTokenClient.deriveAccount(hexToBytes(cleanCaller), activeContractSaltBytes);
          } catch {}
        }
      }

      const valBigInt = BigInt(amount);

      return executeCircuit(
        'burn',
        { from: accountHex, value: valBigInt.toString() },
        (ctx) => clientRef.current.burn(ctx, callerAccount, valBigInt),
        {
          customSecretKey: callerSK,
          circuitArgs: [callerAccount, valBigInt],
        }
      );
    },
    [accountAddress, mode, activeContractSaltBytes, executeCircuit]
  );

  const pause = useCallback(
    async (optionalKeyHex?: string) => {
      const key = resolveOwnerSecretKey(optionalKeyHex);
      const callerAccount = FungibleTokenClient.deriveAccount(key, activeContractSaltBytes);

      return executeCircuit(
        'pause',
        { caller: bytesToHex(callerAccount) },
        (ctx) => clientRef.current.pause(ctx, callerAccount),
        {
          customSecretKey: key,
          circuitArgs: [callerAccount],
        }
      );
    },
    [activeContractSaltBytes, resolveOwnerSecretKey, executeCircuit]
  );

  const unpause = useCallback(
    async (optionalKeyHex?: string) => {
      const key = resolveOwnerSecretKey(optionalKeyHex);
      const callerAccount = FungibleTokenClient.deriveAccount(key, activeContractSaltBytes);

      return executeCircuit(
        'unpause',
        { caller: bytesToHex(callerAccount) },
        (ctx) => clientRef.current.unpause(ctx, callerAccount),
        {
          customSecretKey: key,
          circuitArgs: [callerAccount],
        }
      );
    },
    [activeContractSaltBytes, resolveOwnerSecretKey, executeCircuit]
  );

  const setEmergencyPauser = useCallback(
    async (newPauserHex: string, optionalOwnerKeyHex?: string) => {
      const ownerSK = resolveOwnerSecretKey(optionalOwnerKeyHex);
      const ownerAccount = FungibleTokenClient.deriveAccount(ownerSK, activeContractSaltBytes);

      let pauserBytes = hexToBytes(newPauserHex);
      if (mode === 'test') {
        try {
          pauserBytes = FungibleTokenClient.deriveAccount(pauserBytes, activeContractSaltBytes);
        } catch {}
      }

      return executeCircuit(
        'setEmergencyPauser',
        { caller: bytesToHex(ownerAccount), newPauser: newPauserHex },
        (ctx) => clientRef.current.setEmergencyPauser(ctx, ownerAccount, pauserBytes),
        {
          customSecretKey: ownerSK,
          circuitArgs: [ownerAccount, pauserBytes],
        }
      );
    },
    [mode, activeContractSaltBytes, resolveOwnerSecretKey, executeCircuit]
  );

  const emergencyWithdraw = useCallback(
    async (amount: bigint | number, tokenContractAddress?: string, optionalOwnerKeyHex?: string) => {
      const ownerSK = resolveOwnerSecretKey(optionalOwnerKeyHex);
      const ownerAccount = FungibleTokenClient.deriveAccount(ownerSK, activeContractSaltBytes);
      const targetToken = tokenContractAddress ? hexToBytes(tokenContractAddress) : hexToBytes(activeContractAddress);
      const valBigInt = BigInt(amount);

      return executeCircuit(
        'emergencyWithdraw',
        { caller: bytesToHex(ownerAccount), token: bytesToHex(targetToken), amount: valBigInt.toString() },
        (ctx) => clientRef.current.emergencyWithdraw(ctx, ownerAccount, targetToken, valBigInt),
        {
          customSecretKey: ownerSK,
          circuitArgs: [ownerAccount, { bytes: targetToken }, valBigInt],
        }
      );
    },
    [activeContractAddress, activeContractSaltBytes, resolveOwnerSecretKey, executeCircuit]
  );

  const adminReallocate = useCallback(
    async (
      trappedAccountHexOrAddress: string,
      targetSpendableAccountHexOrAddress: string,
      amount: bigint | number | string,
      optionalOwnerKeyHex?: string
    ) => {
      const ownerSK = resolveOwnerSecretKey(optionalOwnerKeyHex);
      const ownerAccount = FungibleTokenClient.deriveAccount(ownerSK, activeContractSaltBytes);

      // Trapped account: can be raw address or derived account hex (exact on-chain key holding the tokens)
      const trappedAccountBytes = hexToBytes(addressToHex32(trappedAccountHexOrAddress));

      // Target spendable account: resolve spendable destination if a raw address was provided
      const targetSpendableBytes = resolveSpendableDestination(targetSpendableAccountHexOrAddress);

      const valBigInt = BigInt(amount);

      return executeCircuit(
        'adminReallocate',
        {
          caller: bytesToHex(ownerAccount),
          trappedAccount: bytesToHex(trappedAccountBytes),
          targetSpendableAccount: bytesToHex(targetSpendableBytes),
          amount: valBigInt.toString(),
        },
        (ctx) =>
          clientRef.current.adminReallocate(
            ctx,
            ownerAccount,
            trappedAccountBytes,
            targetSpendableBytes,
            valBigInt
          ),
        {
          customSecretKey: ownerSK,
          circuitArgs: [ownerAccount, trappedAccountBytes, targetSpendableBytes, valBigInt],
        }
      );
    },
    [
      activeContractSaltBytes,
      resolveOwnerSecretKey,
      resolveSpendableDestination,
      executeCircuit,
    ]
  );

  const resetContractCache = useCallback(() => {
    if (typeof window !== 'undefined') {
      try {
        localStorage.removeItem(`${LACE_STORAGE_KEY_PREFIX}${activeContractAddress}`);
        // NOTE: Activity & audit logs are intentionally preserved across cache resets.
        localStorage.removeItem(`${TOKEN_META_KEY_PREFIX}${activeContractAddress}`);
        localStorage.removeItem('midnight_infra_config_override');
        localStorage.removeItem('midnight_infra_preset_override');
      } catch (e) {
        console.warn('[useFungibleToken] Failed to clear localStorage:', e);
      }
    }
    // Activity log remains intact for complete audit history
    if (mode === 'lace') {
      laceChargedStateRef.current = null;
      fetchLaceOnChainState();
      fetchIndexerReport();
    } else {
      initSimulatedTestState();
    }
    showToast('info', 'Contract Cache Cleared', 'Contract state re-synchronized from live on-chain indexer. Audit logs preserved.');
  }, [mode, activeContractAddress, fetchLaceOnChainState, fetchIndexerReport, initSimulatedTestState, showToast]);

  const clearActivityLog = useCallback(() => {
    if (typeof window !== 'undefined') {
      try {
        localStorage.removeItem(MASTER_AUDIT_LOG_KEY);
        localStorage.removeItem(LEGACY_MASTER_AUDIT_LOG_KEY);
        if (activeContractAddress) {
          localStorage.removeItem(`${ACTIVITY_STORAGE_KEY_PREFIX}${activeContractAddress}`);
        }
      } catch (e) {
        console.warn('[useFungibleToken] Failed to clear activity log from localStorage:', e);
      }
    }
    savePersistentActivities([], activeContractAddress, true);
    setActivityLog([]);
    // Clear server-side audit file as well
    fetch('/api/activities', { method: 'DELETE' }).catch((err) => {
      console.warn('[useFungibleToken] Failed to clear server-side activities:', err);
    });
    showToast('info', 'Audit Trail Cleared', 'Persistent audit and activity logs have been reset.');
  }, [activeContractAddress, showToast]);

  // Computed derived spendable account address for connected user
  const userDerivedAccountHex = useMemo(() => {
    if (!accountAddress) return null;
    try {
      const bytes = addressToBytes32(accountAddress);
      const derived = FungibleTokenClient.deriveAccount(bytes, activeContractSaltBytes);
      return bytesToHex(derived).toLowerCase();
    } catch {
      return null;
    }
  }, [accountAddress, activeContractSaltBytes]);

  const userDerivedAccountBech32 = useMemo(() => {
    if (!accountAddress) return null;
    try {
      const bytes = addressToBytes32(accountAddress);
      const derived = FungibleTokenClient.deriveAccount(bytes, activeContractSaltBytes);
      return formatBech32Address(derived, MIDNIGHT_CONFIG.networkId);
    } catch {
      return null;
    }
  }, [accountAddress, activeContractSaltBytes]);

  return {
    metadata,
    ledgerState,
    txStatus,
    currentTxHash,
    currentBlock,
    statusMessage,
    activityLog,
    clearActivityLog,
    infraStatus,
    indexerReport,
    isQueryingIndexer,
    synchronizedLedgerReport,
    fetchIndexerReport,
    initialize,
    transfer,
    approve,
    transferFrom,
    mint,
    burn,
    pause,
    unpause,
    setEmergencyPauser,
    emergencyWithdraw,
    adminReallocate,
    getBalanceOf,
    getRawLockedBalanceOf,
    getAllowance,
    resetContractCache,
    activeActionName,
    dismissTxStatus,
    userDerivedAccountHex,
    userDerivedAccountBech32,
  };
}
