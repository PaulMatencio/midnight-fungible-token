'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { container } from '@/src/infrastructure/di/container';
import { useWallet } from '@/src/presentation/context/WalletContext';
import { useToast } from '@/src/presentation/context/ToastContext';
import { useConfig } from '@/src/presentation/context/ConfigContext';
import { MIDNIGHT_CONFIG, PRESET_IDENTITIES } from '@/src/infrastructure/config/midnight-config';
import { isWalletLockedError, isChannelShutdownError } from '@/src/infrastructure/midnight/midnight-dapp-connector';
import { checkInfrastructureHealth } from '@/src/providers/midnight-providers';
import { formatBalance } from '@/src/presentation/utils/format';
import type { ActivityItem, TokenMetadata, TransactionStatus } from '@/src/types/dapp';
import type { IndexerTokenReport } from '@/src/infrastructure/midnight/midnight-indexer-client';
import { formatBech32Address } from '@/src/infrastructure/midnight/midnight-indexer-client';
import { FungibleTokenClient } from '@/src/client/fungible-token-sdk';

// Re-export domain value objects & persistence helpers for backward compatibility
export {
  addressToBytes32,
  hexToBytes,
  bytesToHex,
  addressToHex32,
  Address,
} from '@/src/domain/entities/address.vo';

export {
  serializeChargedState,
  deserializeChargedState,
} from '@/src/infrastructure/persistence/local-storage-contract-state.storage';

export { formatBalance };

import {
  addressToBytes32,
  bytesToHex,
  addressToHex32,
  hexToBytes,
} from '@/src/domain/entities/address.vo';

export function loadPersistentActivities(contractAddress?: string): ActivityItem[] {
  return container.activityStorage.loadActivities(contractAddress);
}

export function savePersistentActivities(
  items: ActivityItem[],
  contractAddress?: string,
  forceClear = false
): void {
  container.activityStorage.saveActivities(items, contractAddress, forceClear);
}

export function extractDetailedErrorMessage(err: any): string {
  if (!err) return 'Transaction failed';

  // 1. Check for DomainError instances or direct typed errors
  if (
    err.name === 'DomainError' ||
    err.name === 'InsufficientBalanceError' ||
    err.name === 'SupplyOverflowError' ||
    err.name === 'UnauthorizedError' ||
    err.name === 'ContractPausedError' ||
    err.name === 'ContractNotInitializedError' ||
    err.name === 'WalletLockedError' ||
    err.name === 'TransactionDeclinedError'
  ) {
    return err.message;
  }

  // 2. Check for Lace wallet locked or channel shutdown
  if (isWalletLockedError(err)) {
    return 'Your Lace wallet is locked. Please click the Lace extension icon, enter your password to unlock it, and try again.';
  }
  if (isChannelShutdownError(err)) {
    return 'Lace extension connection was idle or interrupted. Please refresh your browser page and retry your transaction.';
  }

  // 3. Inspect recursive causes
  const messages: string[] = [];
  let curr = err;
  let depth = 0;
  let hasRejection = false;
  let isContractTypeMismatch = false;
  let isProofServerError = false;
  let callTxFailureInfo: string | null = null;

  while (curr && depth < 8) {
    const name = curr.name || '';
    const msg = typeof curr === 'string' ? curr : curr.message && curr.message !== 'Error' ? curr.message : '';
    const reason = curr.reason || curr.info || curr.description || '';
    const combined = `${name} ${msg} ${reason}`.toLowerCase();

    // Check rejection
    if (
      name === 'PermissionRejected' ||
      curr.code === 'PermissionRejected' ||
      curr.code === 'Rejected' ||
      curr.code === 2 ||
      combined.includes('permission rejected') ||
      combined.includes('user rejected') ||
      combined.includes('declined') ||
      combined.includes('user cancelled')
    ) {
      hasRejection = true;
    }

    // Check CallTxFailedError
    if (name === 'CallTxFailedError' || curr.finalizedTxData) {
      const circuit = curr.circuitId || 'circuit';
      const status = curr.finalizedTxData?.status;
      callTxFailureInfo = `On-chain execution failed: circuit '${circuit}' was rejected by consensus${status ? ` (status: ${status})` : ''}.`;
    }

    // Check ContractTypeError
    if (
      name === 'ContractTypeError' ||
      combined.includes('mismatched verifier keys') ||
      combined.includes('are undefined or have mismatched')
    ) {
      isContractTypeMismatch = true;
    }

    // Check Proof Server
    if (
      combined.includes('proof-server') ||
      combined.includes('proof server') ||
      combined.includes('proving failed') ||
      (combined.includes(':6300') && combined.includes('failed to fetch'))
    ) {
      isProofServerError = true;
    }

    // Collect message strings
    if (typeof curr === 'string') {
      messages.push(curr);
    } else {
      if (reason && typeof reason === 'string') messages.push(reason);
      if (msg && typeof msg === 'string') messages.push(msg);
    }

    curr = curr.cause;
    depth++;
  }

  if (hasRejection) {
    return 'Transaction was declined or cancelled in Lace wallet.';
  }
  if (callTxFailureInfo) {
    return callTxFailureInfo;
  }
  if (isContractTypeMismatch) {
    return 'Contract verifier key mismatch: the deployed contract code at this address does not match this dApp version.';
  }
  if (isProofServerError) {
    return 'Zero-Knowledge proof generation failed. Please verify that the proof server is running and accessible.';
  }

  // Clean raw messages
  const cleaned = messages
    .map((m) => {
      let s = m.replace(/^Unexpected error (submitting|executing) scoped transaction '<[^>]+>':\s*/i, '').trim();
      s = s.replace(/^Error:\s*/i, '').trim();
      return s;
    })
    .filter((m) => m && m !== 'Error' && !m.startsWith("Unexpected error submitting scoped transaction '<unnamed>'"));

  // Check for known patterns in cleaned messages
  for (const m of cleaned) {
    const lower = m.toLowerCase();
    if (lower.includes('insufficient') && (lower.includes('dust') || lower.includes('balance') || lower.includes('fee'))) {
      return m;
    }
    if (lower.includes('exceed') || lower.includes('paused') || lower.includes('unauthorized') || lower.includes('not authorized')) {
      return m;
    }
  }

  if (cleaned.length > 0) {
    if (cleaned[0].startsWith('{') && cleaned[0].endsWith('}')) {
      try {
        const parsed = JSON.parse(cleaned[0]);
        if (parsed.message) return parsed.message;
        if (parsed.circuitId) return `On-chain execution failed for circuit '${parsed.circuitId}'.`;
      } catch {}
    }
    return cleaned[0];
  }

  return 'Transaction could not be completed. Please check your wallet connection, DUST balance, and network settings.';
}

export function useFungibleToken() {
  const { mode, accountAddress, isConnected, extensionApi, refreshBalances } = useWallet();
  const { showToast } = useToast();
  const { config } = useConfig();
  const activeContractAddress = config?.contractAddress || MIDNIGHT_CONFIG.contractAddress;

  // React Presentation States
  const [metadata, setMetadata] = useState<TokenMetadata>({
    name: 'Midnight Fungible Token',
    symbol: 'MFT',
    decimals: 6,
    totalSupply: 0n,
    isInitialized: false,
  });

  const [txStatus, setTxStatus] = useState<TransactionStatus>('idle');
  const [currentTxHash, setCurrentTxHash] = useState<string | null>(null);
  const [currentBlock, setCurrentBlock] = useState<number | null>(null);
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [activeActionName, setActiveActionName] = useState<string | null>(null);

  const [activityLog, setActivityLog] = useState<ActivityItem[]>(() => {
    return container.manageActivityLogUseCase.getActivities(activeContractAddress);
  });

  const [infraStatus, setInfraStatus] = useState<{ proofServer: boolean; indexer: boolean }>({
    proofServer: false,
    indexer: false,
  });
  const [indexerReport, setIndexerReport] = useState<IndexerTokenReport | null>(null);
  const [isQueryingIndexer, setIsQueryingIndexer] = useState<boolean>(false);

  // Synchronize container adapters with reactive wallet and config state
  useEffect(() => {
    container.walletGateway.setMode(mode);
    if (extensionApi && mode === 'lace') {
      (container.walletGateway as any).extensionApi = extensionApi;
      (container.walletGateway as any).currentAddress = accountAddress;
      (container.walletGateway as any).connected = true;
    } else if (mode === 'lace') {
      (container.walletGateway as any).extensionApi = null;
      (container.walletGateway as any).currentAddress = null;
      (container.walletGateway as any).connected = false;
    }
    container.tokenContractGateway.updateConfig({
      contractAddress: activeContractAddress,
      contractSalt: metadata.contractSalt || (config as any)?.contractSalt || MIDNIGHT_CONFIG.contractSalt,
      networkId: config?.networkId || MIDNIGHT_CONFIG.networkId,
      nodeUrl: config?.nodeUrl || MIDNIGHT_CONFIG.nodeUrl,
      indexerUrl: config?.indexerUrl || MIDNIGHT_CONFIG.indexerUrl,
      proofServerUrl: config?.proofServerUrl || MIDNIGHT_CONFIG.proofServerUrl,
    });
  }, [mode, extensionApi, accountAddress, config, activeContractAddress, metadata.contractSalt]);

  // Derived user address representations
  const activeContractSaltBytes = useMemo(() => {
    const saltStr = metadata.contractSalt || (config as any)?.contractSalt || MIDNIGHT_CONFIG.contractSalt;
    return saltStr && saltStr.length === 64
      ? hexToBytes(saltStr)
      : new Uint8Array(32).fill(42);
  }, [metadata.contractSalt, config]);

  const userDerivedAccountHex = useMemo(() => {
    if (!accountAddress) return '';
    try {
      const bytes = FungibleTokenClient.deriveAccount(addressToBytes32(accountAddress), activeContractSaltBytes);
      return bytesToHex(bytes);
    } catch {
      return '';
    }
  }, [accountAddress, activeContractSaltBytes]);

  const userDerivedAccountBech32 = useMemo(() => {
    if (!userDerivedAccountHex) return '';
    return formatBech32Address(userDerivedAccountHex, config?.networkId || MIDNIGHT_CONFIG.networkId);
  }, [userDerivedAccountHex, config?.networkId]);

  const dismissTxStatus = useCallback(() => {
    setTxStatus('idle');
    setStatusMessage('');
    setActiveActionName(null);
  }, []);

  // Sync activities from localStorage & server-side API
  useEffect(() => {
    let mounted = true;

    const syncActivities = async () => {
      const localItems = container.manageActivityLogUseCase.getActivities(activeContractAddress);
      if (mounted && localItems.length > 0) {
        setActivityLog(localItems);
      }

      try {
        const res = await fetch('/api/activities');
        if (res.ok) {
          const data = await res.json();
          if (data.success && Array.isArray(data.activities) && data.activities.length > 0) {
            if (mounted) {
              setActivityLog((prev) => {
                const map = new Map<string, ActivityItem>();
                [...data.activities, ...prev].forEach((item) => {
                  if (item && item.id) map.set(item.id, item);
                });
                const merged = Array.from(map.values()).sort(
                  (a, b) => (b.timestamp || 0) - (a.timestamp || 0)
                );
                container.activityStorage.saveActivities(merged, activeContractAddress);
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

  // Check infrastructure health
  useEffect(() => {
    let isMounted = true;
    const probe = async () => {
      try {
        const health = await checkInfrastructureHealth({
          proofServerUrl: config?.proofServerUrl || MIDNIGHT_CONFIG.proofServerUrl,
          indexerUrl: config?.indexerUrl || MIDNIGHT_CONFIG.indexerUrl,
        });
        if (isMounted) {
          setInfraStatus(health);
        }
      } catch (e) {
        console.warn('[useFungibleToken] Health check failed:', e);
      }
    };
    probe();
    const interval = setInterval(probe, 20000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [config]);

  // Query metadata
  const refreshMetadata = useCallback(async () => {
    try {
      const meta = await container.getTokenStateUseCase.getMetadata(
        activeContractAddress,
        accountAddress || undefined
      );
      setMetadata(meta);
    } catch (err) {
      console.warn('[useFungibleToken] Error loading metadata:', err);
    }
  }, [activeContractAddress, accountAddress]);

  // Fetch indexer report
  const fetchIndexerReport = useCallback(
    async (targetContractAddress?: string, targetIndexerUrl?: string) => {
      const addr = targetContractAddress || activeContractAddress;
      if (!addr) return;
      setIsQueryingIndexer(true);
      try {
        const report = await container.getAccountSharesUseCase.execute({
          contractAddress: addr,
          currentUserAddress: accountAddress || undefined,
          contractSalt: activeContractSaltBytes,
          indexerUrl: targetIndexerUrl || config?.indexerUrl || MIDNIGHT_CONFIG.indexerUrl,
        });
        setIndexerReport(report as any);
      } catch (err) {
        console.warn('[useFungibleToken] Indexer query error:', err);
      } finally {
        setIsQueryingIndexer(false);
      }
    },
    [activeContractAddress, accountAddress, activeContractSaltBytes, config]
  );

  // Initial and refresh load
  useEffect(() => {
    refreshMetadata();
    fetchIndexerReport();
  }, [refreshMetadata, fetchIndexerReport]);

  // Generic Execution Wrapper handling UI progress steppers and activity logging
  const runWithProgress = useCallback(
    async <T>(
      actionName: string,
      params: Record<string, string>,
      useCaseFn: (options: {
        callerAddress?: string;
        customSecretKey?: Uint8Array;
        onStatusChange: (status: TransactionStatus, message?: string) => void;
      }) => Promise<{ txHash: string; blockHeight?: number; returnValue?: any }>,
      customKey?: string
    ): Promise<any> => {
      const txId = Math.random().toString(36).substring(2, 9);
      const startTime = Date.now();

      const activityEntry: ActivityItem = {
        id: txId,
        circuitName: actionName,
        params,
        status: 'pending',
        timestamp: startTime,
        caller: accountAddress || (mode === 'test' ? PRESET_IDENTITIES[0].addressHex : undefined),
        contractAddress: activeContractAddress,
        networkId: config?.networkId || MIDNIGHT_CONFIG.networkId,
        mode,
      };

      container.manageActivityLogUseCase.recordActivity(activityEntry, activeContractAddress);
      setActivityLog(container.manageActivityLogUseCase.getActivities(activeContractAddress));
      setActiveActionName(actionName);
      setTxStatus('preparing');
      setStatusMessage(`Preparing ${actionName} operation...`);

      try {
        const effectiveSK = customKey ? hexToBytes(customKey) : undefined;
        const result = await useCaseFn({
          callerAddress: accountAddress || undefined,
          customSecretKey: effectiveSK,
          onStatusChange: (status, msg) => {
            setTxStatus(status);
            if (msg) setStatusMessage(msg);
          },
        });

        const durationMs = Date.now() - startTime;
        setCurrentTxHash(result.txHash);
        setCurrentBlock(result.blockHeight || null);
        setTxStatus('confirmed');
        setStatusMessage(`${actionName} transaction confirmed!`);

        container.manageActivityLogUseCase.updateActivity(
          txId,
          {
            status: 'confirmed',
            txHash: result.txHash,
            blockHeight: result.blockHeight,
            durationMs,
          },
          activeContractAddress
        );
        setActivityLog(container.manageActivityLogUseCase.getActivities(activeContractAddress));

        showToast('success', `${actionName} Successful`, `Transaction hash: ${result.txHash.slice(0, 10)}...`);

        refreshBalances();
        refreshMetadata();
        fetchIndexerReport();

        setTimeout(() => {
          setTxStatus('idle');
          setStatusMessage('');
          setActiveActionName(null);
        }, 5000);

        return result.returnValue ?? true;
      } catch (err: any) {
        console.error(`[useFungibleToken] Error in ${actionName}:`, err);
        setActiveActionName(null);

        const isLocked = isWalletLockedError(err);
        const isShutdown = isChannelShutdownError(err);
        const errMsg = isLocked
          ? 'Your Lace wallet is locked. Please unlock it and try again.'
          : isShutdown
          ? 'Lace extension channel was idle/shutdown. Connection refreshed.'
          : extractDetailedErrorMessage(err);

        setTxStatus('failed');
        setStatusMessage(errMsg);

        const durationMs = Date.now() - startTime;
        container.manageActivityLogUseCase.updateActivity(
          txId,
          {
            status: 'failed',
            error: errMsg,
            durationMs,
          },
          activeContractAddress
        );
        setActivityLog(container.manageActivityLogUseCase.getActivities(activeContractAddress));

        showToast(
          'error',
          isLocked ? 'Lace Wallet Locked' : `${actionName} Failed`,
          errMsg
        );

        if (isLocked || isShutdown) {
          refreshBalances();
        }

        setTimeout(() => {
          setTxStatus('idle');
          setStatusMessage('');
        }, 5000);

        throw err;
      }
    },
    [
      accountAddress,
      activeContractAddress,
      config?.networkId,
      mode,
      showToast,
      refreshBalances,
      refreshMetadata,
      fetchIndexerReport,
    ]
  );

  // Public Action Methods
  const initialize = useCallback(
    async (name: string, symbol: string, decimals: number | bigint) => {
      showToast('info', 'Constructor Initialized', 'Fungible token contract was initialized upon deployment.');
      return [] as any;
    },
    [showToast]
  );

  const resolveSpendableAddress = useCallback(
    (addressOrName: string): string => {
      const trimmed = addressOrName.trim();
      if (!trimmed) return trimmed;
      try {
        // 1. Bech32m Midnight Address (e.g. mn_addr_...)
        if (
          trimmed.toLowerCase().startsWith('mn_') ||
          trimmed.toLowerCase().startsWith('midnight') ||
          trimmed.toLowerCase().startsWith('mn1')
        ) {
          const rawBytes = addressToBytes32(trimmed);
          const derived = FungibleTokenClient.deriveAccount(rawBytes, activeContractSaltBytes);
          return bytesToHex(derived);
        }
        // 2. Preset identity name or hex
        const preset = PRESET_IDENTITIES.find(
          (p) =>
            p.name.toLowerCase() === trimmed.toLowerCase() ||
            p.addressHex.toLowerCase().replace(/^0x/, '') === trimmed.toLowerCase().replace(/^0x/, '')
        );
        if (preset) {
          const rawBytes = addressToBytes32(preset.addressHex);
          const derived = FungibleTokenClient.deriveAccount(rawBytes, activeContractSaltBytes);
          return bytesToHex(derived);
        }
        return trimmed;
      } catch {
        return trimmed;
      }
    },
    [activeContractSaltBytes]
  );

  const transfer = useCallback(
    async (toHex: string, amount: bigint | number, optionalCallerKeyHex?: string) => {
      const targetSpendableHex = resolveSpendableAddress(toHex);
      return runWithProgress(
        'transfer',
        { to: targetSpendableHex, value: BigInt(amount).toString() },
        (options) =>
          container.transferTokenUseCase.execute({
            contractAddress: activeContractAddress,
            recipient: targetSpendableHex,
            amount: BigInt(amount),
            options,
          }),
        optionalCallerKeyHex
      );
    },
    [activeContractAddress, resolveSpendableAddress, runWithProgress]
  );

  const approve = useCallback(
    async (spenderHex: string, amount: bigint | number, optionalCallerKeyHex?: string) => {
      const targetSpenderHex = resolveSpendableAddress(spenderHex);
      return runWithProgress(
        'approve',
        { spender: targetSpenderHex, value: BigInt(amount).toString() },
        (options) =>
          container.approveTokenUseCase.execute({
            contractAddress: activeContractAddress,
            spender: targetSpenderHex,
            amount: BigInt(amount),
            options,
          }),
        optionalCallerKeyHex
      );
    },
    [activeContractAddress, resolveSpendableAddress, runWithProgress]
  );

  const transferFrom = useCallback(
    async (fromHex: string, toHex: string, amount: bigint | number, optionalSpenderKeyHex?: string) => {
      const targetFromHex = resolveSpendableAddress(fromHex);
      const targetToHex = resolveSpendableAddress(toHex);
      return runWithProgress(
        'transferFrom',
        { from: targetFromHex, to: targetToHex, value: BigInt(amount).toString() },
        (options) =>
          container.transferFromTokenUseCase.execute({
            contractAddress: activeContractAddress,
            from: targetFromHex,
            to: targetToHex,
            amount: BigInt(amount),
            options,
          }),
        optionalSpenderKeyHex
      );
    },
    [activeContractAddress, resolveSpendableAddress, runWithProgress]
  );

  const resolveOwnerSecretKey = useCallback(
    (optionalKeyHex?: string): string => {
      if (optionalKeyHex && optionalKeyHex.trim()) {
        return optionalKeyHex.trim();
      }
      const saved =
        typeof window !== 'undefined'
          ? localStorage.getItem(`midnight_owner_sk_${activeContractAddress}`)
          : null;
      if (saved && saved.trim()) {
        return saved.trim();
      }
      if ((config as any)?.ownerSecretKey) {
        return (config as any).ownerSecretKey;
      }
      if (mode === 'test') {
        return accountAddress || PRESET_IDENTITIES[0].addressHex;
      }
      return accountAddress || '01'.repeat(32);
    },
    [accountAddress, activeContractAddress, config, mode]
  );

  const mint = useCallback(
    async (accountHex: string, amount: bigint | number, optionalOwnerKeyHex?: string) => {
      const ownerKey = resolveOwnerSecretKey(optionalOwnerKeyHex);
      const targetSpendableHex = resolveSpendableAddress(accountHex);
      return runWithProgress(
        'mint',
        { to: targetSpendableHex, value: BigInt(amount).toString() },
        (options) =>
          container.mintTokenUseCase.execute({
            contractAddress: activeContractAddress,
            recipient: targetSpendableHex,
            amount: BigInt(amount),
            options,
          }),
        ownerKey
      );
    },
    [activeContractAddress, resolveOwnerSecretKey, resolveSpendableAddress, runWithProgress]
  );

  const burn = useCallback(
    async (accountHexOrAmount: string | bigint | number, optionalAmount?: bigint | number, optionalCallerKeyHex?: string) => {
      let amount: bigint | number;
      if (
        typeof accountHexOrAmount === 'bigint' ||
        typeof accountHexOrAmount === 'number' ||
        (typeof accountHexOrAmount === 'string' && /^\d+$/.test(accountHexOrAmount))
      ) {
        amount = typeof accountHexOrAmount === 'string' ? BigInt(accountHexOrAmount) : accountHexOrAmount;
      } else {
        amount = optionalAmount ?? 0n;
      }

      return runWithProgress(
        'burn',
        { value: BigInt(amount).toString() },
        (options) =>
          container.burnTokenUseCase.execute({
            contractAddress: activeContractAddress,
            amount: BigInt(amount),
            options,
          }),
        optionalCallerKeyHex
      );
    },
    [activeContractAddress, runWithProgress]
  );

  const pause = useCallback(
    async (optionalKeyHex?: string) => {
      const key = resolveOwnerSecretKey(optionalKeyHex);
      return runWithProgress(
        'pause',
        {},
        (options) =>
          container.manageTokenPauseUseCase.pause(activeContractAddress, options),
        key
      );
    },
    [activeContractAddress, resolveOwnerSecretKey, runWithProgress]
  );

  const unpause = useCallback(
    async (optionalKeyHex?: string) => {
      const key = resolveOwnerSecretKey(optionalKeyHex);
      return runWithProgress(
        'unpause',
        {},
        (options) =>
          container.manageTokenPauseUseCase.unpause(activeContractAddress, options),
        key
      );
    },
    [activeContractAddress, resolveOwnerSecretKey, runWithProgress]
  );

  const setEmergencyPauser = useCallback(
    async (newPauserHex: string, optionalOwnerKeyHex?: string) => {
      const key = resolveOwnerSecretKey(optionalOwnerKeyHex);
      return runWithProgress(
        'setEmergencyPauser',
        { newPauser: newPauserHex },
        (options) =>
          container.manageEmergencyUseCase.setEmergencyPauser({
            contractAddress: activeContractAddress,
            newPauser: newPauserHex,
            options,
          }),
        key
      );
    },
    [activeContractAddress, resolveOwnerSecretKey, runWithProgress]
  );

  const emergencyWithdraw = useCallback(
    async (amount: bigint | number, tokenContractAddress?: string, optionalOwnerKeyHex?: string) => {
      const key = resolveOwnerSecretKey(optionalOwnerKeyHex);
      const target = tokenContractAddress || activeContractAddress;
      return runWithProgress(
        'emergencyWithdraw',
        { amount: BigInt(amount).toString(), target },
        (options) =>
          container.manageEmergencyUseCase.emergencyWithdraw({
            contractAddress: activeContractAddress,
            destination: target,
            amount: BigInt(amount),
            options,
          }),
        key
      );
    },
    [activeContractAddress, resolveOwnerSecretKey, runWithProgress]
  );

  const adminReallocate = useCallback(
    async (
      trappedAccountHexOrAddress: string,
      targetSpendableAccountHexOrAddress: string,
      amount: bigint | number | string,
      optionalOwnerKeyHex?: string
    ) => {
      const key = resolveOwnerSecretKey(optionalOwnerKeyHex);
      return runWithProgress(
        'adminReallocate',
        {
          from: trappedAccountHexOrAddress,
          to: targetSpendableAccountHexOrAddress,
          amount: BigInt(amount).toString(),
        },
        (options) =>
          container.manageEmergencyUseCase.adminReallocate({
            contractAddress: activeContractAddress,
            from: trappedAccountHexOrAddress,
            to: targetSpendableAccountHexOrAddress,
            amount: BigInt(amount),
            options,
          }),
        key
      );
    },
    [activeContractAddress, resolveOwnerSecretKey, runWithProgress]
  );

  // Queries
  const getBalanceOf = useCallback(
    (targetAccountAddress: string): bigint => {
      return container.getTokenStateUseCase.getBalance({
        accountAddress: targetAccountAddress,
        contractAddress: activeContractAddress,
      });
    },
    [activeContractAddress]
  );

  const getRawLockedBalanceOf = useCallback(
    (targetAccountAddress: string): bigint => {
      return container.getTokenStateUseCase.getLockedBalance({
        accountAddress: targetAccountAddress,
        contractAddress: activeContractAddress,
      });
    },
    [activeContractAddress]
  );

  const getAllowance = useCallback(
    (owner: string, spender: string): bigint => {
      return container.getTokenStateUseCase.getAllowance({
        ownerAddress: owner,
        spenderAddress: spender,
        contractAddress: activeContractAddress,
      });
    },
    [activeContractAddress]
  );

  const getAllowancesForSpender = useCallback(
    (spender: string) => {
      if (!spender) return [];
      return container.getTokenStateUseCase.getAllowancesForSpender(
        spender,
        activeContractAddress
      );
    },
    [activeContractAddress]
  );

  const resetContractCache = useCallback(() => {
    container.contractStateStorage.clearState(activeContractAddress);
    refreshMetadata();
    fetchIndexerReport();
  }, [activeContractAddress, refreshMetadata, fetchIndexerReport]);

  const clearActivityLog = useCallback(async () => {
    container.manageActivityLogUseCase.clearActivities(activeContractAddress);
    setActivityLog([]);
    try {
      await fetch(activeContractAddress ? `/api/activities?contractAddress=${activeContractAddress}` : '/api/activities', {
        method: 'DELETE',
      });
    } catch {}
  }, [activeContractAddress]);

  const dismissActivity = useCallback(async (id: string) => {
    container.manageActivityLogUseCase.dismissActivity(id, activeContractAddress);
    setActivityLog(container.manageActivityLogUseCase.getActivities(activeContractAddress));
    try {
      await fetch('/api/activities', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id,
          updates: { status: 'failed', error: 'Cancelled / Dismissed by user' },
        }),
      });
    } catch {}
  }, [activeContractAddress]);

  const clearPendingActivities = useCallback(async () => {
    const current = container.manageActivityLogUseCase.getActivities(activeContractAddress);
    const nonPending = current.filter((item) => item.status !== 'pending');
    container.activityStorage.saveActivities(nonPending, activeContractAddress, true);
    setActivityLog(nonPending);
    try {
      await fetch('/api/activities?pending=true', { method: 'DELETE' });
    } catch {}
  }, [activeContractAddress]);

  return {
    metadata,
    txStatus,
    currentTxHash,
    currentBlock,
    statusMessage,
    activityLog,
    infraStatus,
    indexerReport,
    isQueryingIndexer,
    synchronizedLedgerReport: indexerReport,
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
    getAllowancesForSpender,
    resetContractCache,
    clearActivityLog,
    dismissActivity,
    clearPendingActivities,
    activeActionName,
    dismissTxStatus,
    userDerivedAccountHex,
    userDerivedAccountBech32,
  };
}
