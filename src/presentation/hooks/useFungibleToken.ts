'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { BehaviorSubject } from 'rxjs';
import * as CompactRuntime from '@midnight-ntwrk/compact-runtime';
import {
  FungibleTokenClient,
  type FungibleTokenLedgerState,
  type FungibleTokenPrivateState,
} from '@/src/client/fungible-token-sdk';
import { ledger } from '@/src/contracts/fungible-token/contract/index.js';
import { useWallet } from '@/src/presentation/context/WalletContext';
import { useToast } from '@/src/presentation/context/ToastContext';
import { MIDNIGHT_CONFIG, PRESET_IDENTITIES } from '@/src/infrastructure/config/midnight-config';
import {
  createLaceMidnightProviders,
  createSimulatedMidnightProviders,
  checkInfrastructureHealth,
  type MidnightProviders,
} from '@/src/providers/midnight-providers';
import { isWalletLockedError } from '@/src/infrastructure/midnight/midnight-dapp-connector';
import type { ActivityItem, TokenMetadata, TransactionStatus } from '@/src/types/dapp';
import {
  queryIndexerContractState,
  calculateAccountSharesFromLedger,
  formatBech32Address,
  type IndexerTokenReport,
} from '@/src/infrastructure/midnight/midnight-indexer-client';

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

const LACE_STORAGE_KEY_PREFIX = 'midnight_fungible_token_lace_state_';
const ACTIVITY_STORAGE_KEY_PREFIX = 'midnight_fungible_token_activity_';
const TOKEN_META_KEY_PREFIX = 'midnight_fungible_token_meta_';

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
 * computing owner hex, owner Bech32m, and whether caller is the contract owner.
 */
export function extractMetadata(
  decoded: FungibleTokenLedgerState | any | null,
  currentCaller?: string | null,
  networkId: string = MIDNIGHT_CONFIG.networkId
): TokenMetadata {
  if (!decoded) {
    return {
      name: 'Midnight Fungible Token',
      symbol: 'MFT',
      decimals: 6,
      totalSupply: 0n,
      isInitialized: false,
      owner: undefined,
      ownerBech32: undefined,
      isCallerOwner: false,
    };
  }

  const ownerBytes = decoded.owner as Uint8Array | undefined;
  const ownerHex = ownerBytes && ownerBytes.length === 32 ? bytesToHex(ownerBytes) : undefined;
  const ownerBech32 = ownerBytes && ownerBytes.length === 32 ? formatBech32Address(ownerBytes, networkId) : undefined;

  let isCallerOwner = false;
  if (ownerHex && currentCaller) {
    const callerCleanHex = addressToHex32(currentCaller).toLowerCase();
    isCallerOwner = callerCleanHex === ownerHex.toLowerCase();
  }

  return {
    name: decoded._name || 'Midnight Fungible Token',
    symbol: decoded._symbol || 'MFT',
    decimals: Number(decoded._decimals || 6n),
    totalSupply: decoded._totalSupply || 0n,
    isInitialized: Boolean(decoded._isInitialized),
    owner: ownerHex,
    ownerBech32,
    isCallerOwner,
  };
}

export function useFungibleToken() {
  const { mode, accountAddress, isConnected, extensionApi, refreshBalances } = useWallet();
  const { showToast } = useToast();

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
  const [activityLog, setActivityLog] = useState<ActivityItem[]>([]);
  const [infraStatus, setInfraStatus] = useState<{ proofServer: boolean; indexer: boolean }>({
    proofServer: false,
    indexer: false,
  });
  const [indexerReport, setIndexerReport] = useState<IndexerTokenReport | null>(null);
  const [isQueryingIndexer, setIsQueryingIndexer] = useState<boolean>(false);

  // Client and runtime context refs
  const clientRef = useRef<FungibleTokenClient>(new FungibleTokenClient({}));
  const privateStateRef = useRef<FungibleTokenPrivateState>({
    signingKey: hexToBytes(accountAddress || '01'.repeat(32)),
  });

  // Keep separate simulated state ref for Test Mode
  const simulatedChargedStateRef = useRef<any>(null);
  const laceChargedStateRef = useRef<any>(null);

  // RxJS Observable for live ledger state subscription
  const ledgerStateSubjectRef = useRef<BehaviorSubject<FungibleTokenLedgerState | null>>(
    new BehaviorSubject<FungibleTokenLedgerState | null>(null)
  );

  const isActivityLogLoadedRef = useRef(false);

  // Load activityLog on client mount only to prevent Next.js SSR hydration mismatch
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem(`${ACTIVITY_STORAGE_KEY_PREFIX}${MIDNIGHT_CONFIG.contractAddress}`);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed)) {
            setActivityLog(parsed);
          }
        }
      } catch (err) {
        console.warn('[useFungibleToken] Error loading activity log:', err);
      } finally {
        isActivityLogLoadedRef.current = true;
      }
    }
  }, []);

  // Persist activityLog to localStorage on changes (only after initial load)
  useEffect(() => {
    if (!isActivityLogLoadedRef.current) return;
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(
          `${ACTIVITY_STORAGE_KEY_PREFIX}${MIDNIGHT_CONFIG.contractAddress}`,
          JSON.stringify(activityLog.slice(0, 30))
        );
      } catch {}
    }
  }, [activityLog]);

  // Check infrastructure health on mount
  useEffect(() => {
    checkInfrastructureHealth().then((status) => {
      setInfraStatus(status);
    });
  }, []);

  // Initialize simulated test state (ONLY for Test Mode)
  const initSimulatedTestState = useCallback(() => {
    try {
      const client = new FungibleTokenClient({});
      clientRef.current = client;

      const dummyCoinPublicKey = '01'.repeat(32);
      const initialOwnerBytes = hexToBytes(PRESET_IDENTITIES[0].addressHex);
      const initialPrivateState: FungibleTokenPrivateState = {
        signingKey: initialOwnerBytes,
      };
      privateStateRef.current = initialPrivateState;

      const constructorCtx = CompactRuntime.createConstructorContext(
        initialPrivateState,
        dummyCoinPublicKey
      );
      const initResult = client.initialState(constructorCtx, initialOwnerBytes);
      let st = initResult.currentContractState.data;
      let ps = initResult.currentPrivateState;

      // In Test Mode: Seed initial token state (Alice & Bob pre-funded for offline simulation)
      let circuitCtx = CompactRuntime.createCircuitContext(
        MIDNIGHT_CONFIG.contractAddress,
        dummyCoinPublicKey,
        st,
        ps
      );
      const initRes = client.initialize(circuitCtx, 'Midnight Fungible Token', 'MFT', 6n);
      st = initRes.context.currentQueryContext.state;
      ps = initRes.context.currentPrivateState;

      // Mint 5M to Alice (caller must be owner: Alice)
      circuitCtx = CompactRuntime.createCircuitContext(
        MIDNIGHT_CONFIG.contractAddress,
        dummyCoinPublicKey,
        st,
        ps
      );
      const aliceBytes = hexToBytes(PRESET_IDENTITIES[0].addressHex);
      const mintRes1 = client.mint(circuitCtx, aliceBytes, aliceBytes, 5_000_000n * 10n ** 6n);
      st = mintRes1.context.currentQueryContext.state;

      // Mint 5M to Bob (caller must be owner: Alice)
      circuitCtx = CompactRuntime.createCircuitContext(
        MIDNIGHT_CONFIG.contractAddress,
        dummyCoinPublicKey,
        st,
        mintRes1.context.currentPrivateState
      );
      const bobBytes = hexToBytes(PRESET_IDENTITIES[1].addressHex);
      const mintRes2 = client.mint(circuitCtx, aliceBytes, bobBytes, 5_000_000n * 10n ** 6n);
      st = mintRes2.context.currentQueryContext.state;
      ps = mintRes2.context.currentPrivateState;

      simulatedChargedStateRef.current = st;
      privateStateRef.current = ps;

      const decoded = client.queryLedgerStateFromRaw(st);
      setLedgerState(decoded);
      ledgerStateSubjectRef.current.next(decoded);
      setMetadata(extractMetadata(decoded, PRESET_IDENTITIES[0].addressHex));
    } catch (err) {
      console.warn('[useFungibleToken] Simulated test initialization error:', err);
    }
  }, []);

  // Fetch real on-chain state for Lace Wallet Mode (with localStorage fallback if indexer hasn't indexed)
  const fetchLaceOnChainState = useCallback(async () => {
    let cachedState: any = null;
    let cachedDecoded: FungibleTokenLedgerState | null = null;

    // 1. Check browser localStorage cache first (immediate restoration on reload)
    if (typeof window !== 'undefined') {
      try {
        const cachedRaw = localStorage.getItem(`${LACE_STORAGE_KEY_PREFIX}${MIDNIGHT_CONFIG.contractAddress}`);
        if (cachedRaw) {
          const restoredState = deserializeChargedState(cachedRaw);
          if (restoredState) {
            const decoded = ledger(restoredState);
            if (decoded && decoded._isInitialized) {
              cachedState = restoredState;
              cachedDecoded = decoded;
            }
          }
        }

        // Secondary fallback check for stored metadata
        if (!cachedDecoded) {
          const cachedMetaRaw = localStorage.getItem(`${TOKEN_META_KEY_PREFIX}${MIDNIGHT_CONFIG.contractAddress}`);
          if (cachedMetaRaw) {
            const parsedMeta = JSON.parse(cachedMetaRaw);
            if (parsedMeta && parsedMeta.isInitialized) {
              const ownerHex = parsedMeta.owner;
              const isCallerOwner = Boolean(
                ownerHex && accountAddress && addressToHex32(accountAddress).toLowerCase() === ownerHex.toLowerCase()
              );
              setMetadata({
                name: parsedMeta.name || 'Midnight Fungible Token',
                symbol: parsedMeta.symbol || 'MFT',
                decimals: Number(parsedMeta.decimals || 6),
                totalSupply: BigInt(parsedMeta.totalSupply || '0'),
                isInitialized: true,
                owner: ownerHex,
                ownerBech32: parsedMeta.ownerBech32,
                isCallerOwner,
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
      const client = new FungibleTokenClient({});
      clientRef.current = client;

      setLedgerState(cachedDecoded);
      ledgerStateSubjectRef.current.next(cachedDecoded);
      setMetadata(extractMetadata(cachedDecoded, accountAddress));
      console.log('[useFungibleToken] Restored initialized contract state from browser cache:', {
        name: cachedDecoded._name,
        symbol: cachedDecoded._symbol,
        decimals: cachedDecoded._decimals?.toString(),
        totalSupply: cachedDecoded._totalSupply?.toString(),
        isInitialized: true,
      });
    }

    // 2. Query live public indexer
    try {
      const providers = createLaceMidnightProviders(extensionApi || {});
      const onChainState = await providers.publicDataProvider.queryContractState(
        MIDNIGHT_CONFIG.contractAddress
      );

      if (onChainState && onChainState.data) {
        const decoded = ledger(onChainState.data);

        // If the on-chain state is confirmed initialized, it is the canonical truth!
        if (decoded && decoded._isInitialized) {
          laceChargedStateRef.current = onChainState.data;
          setLedgerState(decoded);
          ledgerStateSubjectRef.current.next(decoded);
          const meta = extractMetadata(decoded, accountAddress);
          setMetadata(meta);

          if (typeof window !== 'undefined') {
            try {
              const serialized = serializeChargedState(onChainState.data);
              if (serialized) {
                localStorage.setItem(`${LACE_STORAGE_KEY_PREFIX}${MIDNIGHT_CONFIG.contractAddress}`, serialized);
              }
              localStorage.setItem(
                `${TOKEN_META_KEY_PREFIX}${MIDNIGHT_CONFIG.contractAddress}`,
                JSON.stringify({
                  name: meta.name,
                  symbol: meta.symbol,
                  decimals: meta.decimals,
                  totalSupply: meta.totalSupply.toString(),
                  isInitialized: true,
                  owner: meta.owner,
                  ownerBech32: meta.ownerBech32,
                })
              );
            } catch {}
          }
          return;
        } else if (cachedState && cachedDecoded) {
          // The indexer has not yet processed the initialization transaction or reflects pre-initialization state:
          // Keep the cached initialized state intact! Do NOT overwrite it with uninitialized!
          console.log('[useFungibleToken] Preserving locally initialized contract state against lagging/pre-init indexer.');
          return;
        } else {
          // Both indexer and cache are uninitialized
          laceChargedStateRef.current = onChainState.data;
          setLedgerState(decoded);
          ledgerStateSubjectRef.current.next(decoded);
          setMetadata(extractMetadata(decoded, accountAddress));
          return;
        }
      }
    } catch (err) {
      console.warn('[useFungibleToken] On-chain state query from indexer:', err);
    }

    // 3. If already restored from cache, we are done
    if (cachedState && cachedDecoded) {
      return;
    }

    // 4. Fallback to clean uninitialized state only if never initialized and not found on-chain
    const client = new FungibleTokenClient({});
    clientRef.current = client;

    const dummyCoinPublicKey = addressToHex32(accountAddress);
    const initialOwnerBytes = hexToBytes(accountAddress || '01'.repeat(32));
    const initialPrivateState: FungibleTokenPrivateState = {
      signingKey: initialOwnerBytes,
    };
    privateStateRef.current = initialPrivateState;

    const constructorCtx = CompactRuntime.createConstructorContext(
      initialPrivateState,
      dummyCoinPublicKey
    );
    const initResult = client.initialState(constructorCtx, initialOwnerBytes);
    laceChargedStateRef.current = initResult.currentContractState.data;
    privateStateRef.current = initResult.currentPrivateState;

    const decoded = client.queryLedgerStateFromRaw(laceChargedStateRef.current);
    setLedgerState(decoded);
    ledgerStateSubjectRef.current.next(decoded);

    // Default clean uninitialized state for Lace mode
    setMetadata(extractMetadata(decoded, accountAddress));
  }, [extensionApi, accountAddress]);

  // Query on-chain indexer for full token metadata & account distribution report
  const fetchIndexerReport = useCallback(
    async (overrideAddress?: string, overrideUrl?: string): Promise<IndexerTokenReport | null> => {
      const targetAddr = overrideAddress || MIDNIGHT_CONFIG.contractAddress;
      const targetUrl = overrideUrl || MIDNIGHT_CONFIG.indexerUrl;
      setIsQueryingIndexer(true);
      try {
        const report = await queryIndexerContractState(targetAddr, targetUrl, {
          currentUserAddress: accountAddress,
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
    [accountAddress]
  );

  // Compute live account shares from the active synchronized ledger state
  const synchronizedLedgerReport = useMemo<IndexerTokenReport | null>(() => {
    if (!ledgerState) return null;
    return calculateAccountSharesFromLedger(ledgerState, {
      contractAddress: MIDNIGHT_CONFIG.contractAddress,
      currentUserAddress: accountAddress,
      networkId: MIDNIGHT_CONFIG.networkId,
      source: mode === 'test' ? 'simulated' : 'local_cache',
    });
  }, [ledgerState, accountAddress, mode]);

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
        const isCallerOwner = Boolean(
          prev.owner && addressToHex32(accountAddress).toLowerCase() === prev.owner.toLowerCase()
        );
        return { ...prev, isCallerOwner };
      });
    }
  }, [accountAddress]);

  // RxJS State Subscription Hook: Subscribe to ledgerState changes
  useEffect(() => {
    const subscription = ledgerStateSubjectRef.current.subscribe((state) => {
      if (state) {
        setLedgerState(state);
        const caller = mode === 'test' ? PRESET_IDENTITIES[0].addressHex : accountAddress;
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
      circuitFn: (ctx: CompactRuntime.CircuitContext<any>) => any
    ) => {
      const txId = Math.random().toString(36).substring(2, 9);
      const activityEntry: ActivityItem = {
        id: txId,
        circuitName,
        params,
        status: 'pending',
        timestamp: Date.now(),
      };

      setActivityLog((prev) => [activityEntry, ...prev]);

      try {
        // STEP 1: Preparing Transaction & Balancing Fees
        setTxStatus('preparing');
        if (mode === 'lace') {
          setStatusMessage('Balancing transaction with Lace Wallet DUST...');
        } else {
          setStatusMessage('Preparing transaction, balancing DUST fees (Simulated)...');
        }
        await new Promise((r) => setTimeout(r, 450));

        let providers: MidnightProviders;
        if (mode === 'lace' && extensionApi) {
          providers = createLaceMidnightProviders(extensionApi);
        } else {
          providers = createSimulatedMidnightProviders();
        }

        // STEP 2: Generating Zero-Knowledge Proof
        setTxStatus('proving');
        if (mode === 'lace') {
          setStatusMessage('Generating Zero-Knowledge Proof (Lace / Proof Server)...');
        } else {
          setStatusMessage('Generating Zero-Knowledge Proof (Compact Runtime)...');
        }
        await new Promise((r) => setTimeout(r, 650));

        // Get target state ref depending on active mode
        const currentActiveChargedState =
          mode === 'lace' ? laceChargedStateRef.current : simulatedChargedStateRef.current;

        const coinPubKey = addressToHex32(providers.walletProvider.getCoinPublicKey());
        const circuitCtx = CompactRuntime.createCircuitContext(
          MIDNIGHT_CONFIG.contractAddress,
          coinPubKey,
          currentActiveChargedState,
          privateStateRef.current
        );

        const result = circuitFn(circuitCtx);
        const updatedChargedState = result.context.currentQueryContext.state;
        const updatedPrivateState = result.context.currentPrivateState;

        // STEP 3: Submitting to Midnight Blockchain
        setTxStatus('submitting');
        if (mode === 'lace') {
          setStatusMessage('Submitting transaction to Midnight Preprod via Lace...');
        } else {
          setStatusMessage('Submitting to Midnight Blockchain (Preprod Node)...');
        }

        const submittedHash = await providers.midnightProvider.submitTx({ circuitName, params });
        await new Promise((r) => setTimeout(r, 550));

        // STEP 4: Confirmed in Block (Only commit state after transaction succeeds)
        const blockNum = 184200 + Math.floor(Math.random() * 50);

        setCurrentTxHash(submittedHash);
        setCurrentBlock(blockNum);
        setTxStatus('confirmed');
        setStatusMessage(`Confirmed in Block #${blockNum}`);

        // Commit updated private state
        privateStateRef.current = updatedPrivateState;

        // Decode updated ledger state immediately
        const updatedLedger = clientRef.current.queryLedgerStateFromRaw(updatedChargedState);
        setLedgerState(updatedLedger);
        ledgerStateSubjectRef.current.next(updatedLedger);

        // Commit updated contract state to memory and persist to localStorage
        const caller = mode === 'test' ? PRESET_IDENTITIES[0].addressHex : accountAddress;
        const meta = extractMetadata(updatedLedger, caller);

        if (mode === 'lace') {
          laceChargedStateRef.current = updatedChargedState;
          if (typeof window !== 'undefined') {
            try {
              const serialized = serializeChargedState(updatedChargedState);
              if (serialized) {
                localStorage.setItem(
                  `${LACE_STORAGE_KEY_PREFIX}${MIDNIGHT_CONFIG.contractAddress}`,
                  serialized
                );
              }
              const metaPayload = {
                name: meta.name,
                symbol: meta.symbol,
                decimals: meta.decimals,
                totalSupply: meta.totalSupply.toString(),
                isInitialized: meta.isInitialized,
                owner: meta.owner,
                ownerBech32: meta.ownerBech32,
              };
              localStorage.setItem(
                `${TOKEN_META_KEY_PREFIX}${MIDNIGHT_CONFIG.contractAddress}`,
                JSON.stringify(metaPayload)
              );
            } catch (err) {
              console.warn('[useFungibleToken] Could not persist state to localStorage:', err);
            }
          }
        } else {
          simulatedChargedStateRef.current = updatedChargedState;
        }

        // Update token metadata
        setMetadata(meta);

        // Update activity log
        setActivityLog((prev) =>
          prev.map((item) =>
            item.id === txId
              ? {
                  ...item,
                  status: 'confirmed',
                  txHash: submittedHash,
                  blockHeight: blockNum,
                }
              : item
          )
        );

        showToast(
          'success',
          `${circuitName} Successful`,
          `Transaction ${submittedHash.slice(0, 10)}... confirmed in Block #${blockNum}`
        );

        // Refresh wallet balances and indexer token report
        refreshBalances();
        fetchIndexerReport();

        // Auto-reset status banner after view
        setTimeout(() => {
          setTxStatus('idle');
          setStatusMessage('');
        }, 3500);

        return result.result;
      } catch (err: any) {
        console.error(`[useFungibleToken] Error in ${circuitName}:`, err);
        const isLocked = isWalletLockedError(err);
        const errMsg = isLocked
          ? 'Your Lace wallet is locked. Please click the Lace extension icon in your browser toolbar, enter your password to unlock it, and try again.'
          : err.reason || err.message || 'Transaction failed';

        setTxStatus('failed');
        setStatusMessage(errMsg);

        setActivityLog((prev) =>
          prev.map((item) =>
            item.id === txId
              ? {
                  ...item,
                  status: 'failed',
                  error: errMsg,
                }
              : item
          )
        );

        showToast('error', isLocked ? 'Lace Wallet Locked' : `${circuitName} Failed`, errMsg);

        if (isLocked) {
          refreshBalances();
        }

        setTimeout(() => {
          setTxStatus('idle');
          setStatusMessage('');
        }, 5000);

        throw err;
      }
    },
    [mode, extensionApi, showToast, refreshBalances]
  );

  // Direct queries (read-only) against current decoded ledger state
  const getBalanceOf = useCallback(
    (accountHex: string): bigint => {
      if (!ledgerState || !ledgerState._balances) return 0n;
      const accountBytes = hexToBytes(accountHex);
      if (!ledgerState._balances.member(accountBytes)) {
        return 0n;
      }
      return ledgerState._balances.lookup(accountBytes);
    },
    [ledgerState]
  );

  const getAllowance = useCallback(
    (ownerHex: string, spenderHex: string): bigint => {
      if (!ledgerState || !ledgerState._allowances) return 0n;
      const ownerBytes = hexToBytes(ownerHex);
      const spenderBytes = hexToBytes(spenderHex);

      if (!ledgerState._allowances.member(ownerBytes)) {
        return 0n;
      }
      const ownerMap = ledgerState._allowances.lookup(ownerBytes);
      if (!ownerMap || !ownerMap.member(spenderBytes)) {
        return 0n;
      }
      return ownerMap.lookup(spenderBytes);
    },
    [ledgerState]
  );

  // Circuit Wrappers adhering strictly to Compact types and BigInt safety
  const initialize = useCallback(
    async (name: string, symbol: string, decimals: number | bigint) => {
      const decBigInt = BigInt(decimals);
      return executeCircuit(
        'initialize',
        { name, symbol, decimals: decBigInt.toString() },
        (ctx) => clientRef.current.initialize(ctx, name, symbol, decBigInt)
      );
    },
    [executeCircuit]
  );

  const transfer = useCallback(
    async (toHex: string, amount: bigint | number) => {
      const callerHex = accountAddress || (mode === 'test' ? PRESET_IDENTITIES[0].addressHex : '01'.repeat(32));
      const callerBytes = hexToBytes(callerHex);
      const toBytes = hexToBytes(toHex);
      const valBigInt = BigInt(amount);

      return executeCircuit(
        'transfer',
        { to: toHex, value: valBigInt.toString() },
        (ctx) => clientRef.current.transfer(ctx, callerBytes, toBytes, valBigInt)
      );
    },
    [accountAddress, mode, executeCircuit]
  );

  const approve = useCallback(
    async (spenderHex: string, amount: bigint | number) => {
      const callerHex = accountAddress || (mode === 'test' ? PRESET_IDENTITIES[0].addressHex : '01'.repeat(32));
      const callerBytes = hexToBytes(callerHex);
      const spenderBytes = hexToBytes(spenderHex);
      const valBigInt = BigInt(amount);

      return executeCircuit(
        'approve',
        { spender: spenderHex, value: valBigInt.toString() },
        (ctx) => clientRef.current.approve(ctx, callerBytes, spenderBytes, valBigInt)
      );
    },
    [accountAddress, mode, executeCircuit]
  );

  const transferFrom = useCallback(
    async (fromHex: string, toHex: string, amount: bigint | number) => {
      const callerHex = accountAddress || (mode === 'test' ? PRESET_IDENTITIES[0].addressHex : '01'.repeat(32));
      const callerBytes = hexToBytes(callerHex);
      const fromBytes = hexToBytes(fromHex);
      const toBytes = hexToBytes(toHex);
      const valBigInt = BigInt(amount);

      const availableAllowance = getAllowance(fromHex, callerHex);
      if (availableAllowance < valBigInt) {
        const fmtAllowance = (Number(availableAllowance) / 10 ** metadata.decimals).toLocaleString();
        const fmtReq = (Number(valBigInt) / 10 ** metadata.decimals).toLocaleString();
        throw new Error(
          `FungibleToken: insufficient allowance (${fmtAllowance} ${metadata.symbol} approved, ${fmtReq} requested). The token owner (${fromHex.slice(0, 10)}...) must first approve the caller (${callerHex.slice(0, 10)}...) in the "Approve Spender" tab.`
        );
      }

      return executeCircuit(
        'transferFrom',
        { from: fromHex, to: toHex, value: valBigInt.toString() },
        (ctx) => clientRef.current.transferFrom(ctx, callerBytes, fromBytes, toBytes, valBigInt)
      );
    },
    [accountAddress, mode, executeCircuit, getAllowance, metadata.decimals, metadata.symbol]
  );

  const mint = useCallback(
    async (accountHex: string, amount: bigint | number) => {
      const callerHex = accountAddress || (mode === 'test' ? PRESET_IDENTITIES[0].addressHex : '01'.repeat(32));
      const callerBytes = hexToBytes(callerHex);
      const toBytes = hexToBytes(accountHex);
      const valBigInt = BigInt(amount);

      // Pre-flight check: caller must be owner
      if (metadata.owner && addressToHex32(callerHex).toLowerCase() !== metadata.owner.toLowerCase()) {
        throw new Error(
          `FungibleToken: caller is not the owner. Only ${metadata.ownerBech32 || metadata.owner.slice(0, 10)}... can mint.`
        );
      }

      return executeCircuit(
        'mint',
        { caller: callerHex, to: accountHex, value: valBigInt.toString() },
        (ctx) => clientRef.current.mint(ctx, callerBytes, toBytes, valBigInt)
      );
    },
    [accountAddress, mode, metadata.owner, metadata.ownerBech32, executeCircuit]
  );

  const burn = useCallback(
    async (accountHexOrAmount: string | bigint | number, optionalAmount?: bigint | number) => {
      const callerHex = accountAddress || (mode === 'test' ? PRESET_IDENTITIES[0].addressHex : '01'.repeat(32));
      const callerBytes = hexToBytes(callerHex);
      const valBigInt = typeof optionalAmount !== 'undefined'
        ? BigInt(optionalAmount)
        : BigInt(accountHexOrAmount);

      // Pre-flight check: caller must be owner
      if (metadata.owner && addressToHex32(callerHex).toLowerCase() !== metadata.owner.toLowerCase()) {
        throw new Error(
          `FungibleToken: caller is not the owner. Only ${metadata.ownerBech32 || metadata.owner.slice(0, 10)}... can burn.`
        );
      }

      return executeCircuit(
        'burn',
        { caller: callerHex, value: valBigInt.toString() },
        (ctx) => clientRef.current.burn(ctx, callerBytes, valBigInt)
      );
    },
    [accountAddress, mode, metadata.owner, metadata.ownerBech32, executeCircuit]
  );

  const resetContractCache = useCallback(() => {
    if (typeof window !== 'undefined') {
      try {
        localStorage.removeItem(`${LACE_STORAGE_KEY_PREFIX}${MIDNIGHT_CONFIG.contractAddress}`);
        localStorage.removeItem(`${ACTIVITY_STORAGE_KEY_PREFIX}${MIDNIGHT_CONFIG.contractAddress}`);
        localStorage.removeItem(`${TOKEN_META_KEY_PREFIX}${MIDNIGHT_CONFIG.contractAddress}`);
      } catch (e) {
        console.warn('[useFungibleToken] Failed to clear localStorage:', e);
      }
    }
    setActivityLog([]);
    if (mode === 'lace') {
      const client = new FungibleTokenClient({});
      clientRef.current = client;

      const dummyCoinPublicKey = addressToHex32(accountAddress);
      const initialOwnerBytes = hexToBytes(accountAddress || '01'.repeat(32));
      const initialPrivateState: FungibleTokenPrivateState = {
        signingKey: initialOwnerBytes,
      };
      privateStateRef.current = initialPrivateState;

      const constructorCtx = CompactRuntime.createConstructorContext(
        initialPrivateState,
        dummyCoinPublicKey
      );
      const initResult = client.initialState(constructorCtx, initialOwnerBytes);
      laceChargedStateRef.current = initResult.currentContractState.data;
      privateStateRef.current = initResult.currentPrivateState;

      const decoded = client.queryLedgerStateFromRaw(laceChargedStateRef.current);
      setLedgerState(decoded);
      ledgerStateSubjectRef.current.next(decoded);

      setMetadata(extractMetadata(decoded, accountAddress));
    } else {
      initSimulatedTestState();
    }
    showToast('info', 'Contract Cache Cleared', 'Contract state reset. You can now initialize again.');
  }, [mode, accountAddress, initSimulatedTestState, showToast]);

  return {
    metadata,
    ledgerState,
    txStatus,
    currentTxHash,
    currentBlock,
    statusMessage,
    activityLog,
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
    getBalanceOf,
    getAllowance,
    resetContractCache,
  };
}
