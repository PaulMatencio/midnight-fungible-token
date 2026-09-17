/**
 * Infrastructure Adapter: Midnight Token Contract Adapter
 * Filename: src/infrastructure/midnight/midnight-token-contract.adapter.ts
 */

import * as CompactRuntime from '@midnight-ntwrk/compact-runtime';
import { CompiledContract } from '@midnight-ntwrk/compact-js';
import { findDeployedContract } from '@midnight-ntwrk/midnight-js-contracts';
import { Contract, ledger } from '@/src/contracts/fungible-token/contract/index.js';
import { FungibleTokenClient } from '@/src/client/fungible-token-sdk';
import type {
  ITokenContractGateway,
  GrantedAllowance,
  CircuitInvocationOptions,
  CircuitExecutionResult,
} from '@/src/domain/ports/i-token-contract.gateway';
import type { TokenMetadata } from '@/src/domain/entities/token.entity';
import type { IWalletGateway } from '@/src/domain/ports/i-wallet.gateway';
import type { IContractStateStorage } from '@/src/domain/ports/i-contract-state.storage';
import type { IIndexerGateway } from '@/src/domain/ports/i-indexer.gateway';
import {
  addressToBytes32,
  bytesToHex,
  addressToHex32,
  hexToBytes,
} from '@/src/domain/entities/address.vo';
import {
  createLaceMidnightProviders,
} from '@/src/providers/midnight-providers';
import {
  formatBech32Address,
  resolveAccountLabel,
} from './midnight-indexer-client';
import { ContractState } from '@midnight-ntwrk/midnight-js-protocol/compact-runtime';
import {
  serializeChargedState,
  deserializeChargedState,
} from '../persistence/local-storage-contract-state.storage';
import { MIDNIGHT_CONFIG, PRESET_IDENTITIES } from '../config/midnight-config';

export interface TokenContractAdapterDependencies {
  walletGateway: IWalletGateway;
  stateStorage?: IContractStateStorage;
  indexerGateway?: IIndexerGateway;
  networkConfig?: {
    contractAddress: string;
    networkId: string;
    nodeUrl: string;
    indexerUrl: string;
    proofServerUrl: string;
  };
}

export class MidnightTokenContractAdapter implements ITokenContractGateway {
  private readonly walletGateway: IWalletGateway;
  private readonly stateStorage?: IContractStateStorage;
  private readonly indexerGateway?: IIndexerGateway;
  private networkConfig: {
    contractAddress: string;
    contractSalt?: string;
    networkId: string;
    nodeUrl: string;
    indexerUrl: string;
    proofServerUrl: string;
  };

  private simulatedState: any | null = null;
  private client: FungibleTokenClient;

  constructor(deps: TokenContractAdapterDependencies) {
    this.walletGateway = deps.walletGateway;
    this.stateStorage = deps.stateStorage;
    this.indexerGateway = deps.indexerGateway;
    this.networkConfig = deps.networkConfig || {
      contractAddress: MIDNIGHT_CONFIG.contractAddress,
      contractSalt: MIDNIGHT_CONFIG.contractSalt,
      networkId: MIDNIGHT_CONFIG.networkId,
      nodeUrl: MIDNIGHT_CONFIG.nodeUrl,
      indexerUrl: MIDNIGHT_CONFIG.indexerUrl,
      proofServerUrl: MIDNIGHT_CONFIG.proofServerUrl,
    };

    this.client = new FungibleTokenClient();
  }

  public updateConfig(config: Partial<typeof this.networkConfig>): void {
    this.networkConfig = { ...this.networkConfig, ...config };
  }

  public getSimulatedChargedState(): any | null {
    return this.simulatedState;
  }

  public setSimulatedChargedState(state: any): void {
    this.simulatedState = state;
    if (this.stateStorage && this.networkConfig.contractAddress) {
      const serialized = serializeChargedState(state);
      this.stateStorage.saveState(this.networkConfig.contractAddress, serialized);
    }
  }

  public restoreSimulatedStateFromCache(contractAddress?: string): any | null {
    const targetAddress = contractAddress || this.networkConfig.contractAddress;
    if (this.stateStorage && targetAddress) {
      const cached = this.stateStorage.loadState(targetAddress);
      if (cached) {
        const deserialized = deserializeChargedState(cached);
        if (deserialized) {
          this.simulatedState = deserialized;
          return deserialized;
        }
      }
    }
    return null;
  }

  async getContractState(
    contractAddress: string,
    currentCaller?: string
  ): Promise<TokenMetadata> {
    const activeAddress = contractAddress || this.networkConfig.contractAddress;
    const caller = currentCaller || this.walletGateway.getAddress();
    const mode = this.walletGateway.getMode();

    // 1. In simulated test mode, decode from simulated state
    if (mode === 'test' && this.simulatedState) {
      const decoded = ledger(this.simulatedState);
      return this.decodeLedgerMetadata(decoded, activeAddress, caller);
    }

    // 2. In Lace mode or live network mode, query indexer first for latest on-chain state
    if (this.indexerGateway) {
      try {
        const rawState = await this.indexerGateway.queryContractState(activeAddress);
        if (rawState) {
          const stateBytes = hexToBytes(rawState);
          const contractState = ContractState.deserialize(stateBytes);
          const decoded = ledger(contractState.data);
          if (decoded) {
            // Update in-memory and storage cache with the live on-chain state
            this.setSimulatedChargedState(contractState.data);
            return this.decodeLedgerMetadata(decoded, activeAddress, caller);
          }
        }
      } catch (err) {
        console.warn('[MidnightTokenContractAdapter] Indexer query state error:', err);
      }
    }

    // 3. Fallback to cached state from storage if indexer is unreachable
    if (this.stateStorage) {
      const cached = this.stateStorage.loadState(activeAddress);
      if (cached) {
        const deserialized = deserializeChargedState(cached);
        if (deserialized) {
          try {
            const decoded = ledger(deserialized);
            return this.decodeLedgerMetadata(decoded, activeAddress, caller);
          } catch {}
        }
      }
    }

    return {
      name: 'Midnight Fungible Token',
      symbol: 'MFT',
      decimals: 6,
      totalSupply: 0n,
      maxSupply: 0n,
      isInitialized: false,
      isPaused: false,
      isCallerOwner: false,
      isCallerPauser: false,
    };
  }

  getBalanceOf(accountAddress: string, contractAddress?: string): bigint {
    const activeAddress = contractAddress || this.networkConfig.contractAddress;
    const decodedLedger = this.getDecodedLedger(activeAddress);
    if (!decodedLedger || !decodedLedger._balances) return 0n;

    const salt = this.resolveContractSalt(activeAddress);
    const rawTargetBytes = addressToBytes32(accountAddress);
    const derivedTargetBytes = FungibleTokenClient.deriveAccount(rawTargetBytes, salt);

    // 1. Spendable derived balance ALWAYS takes precedence
    try {
      const balDerived = decodedLedger._balances.lookup(derivedTargetBytes);
      if (balDerived && balDerived > 0n) return balDerived;
    } catch {}

    // 2. Fallback to raw balance only if no derived balance exists
    try {
      const balRaw = decodedLedger._balances.lookup(rawTargetBytes);
      if (balRaw && balRaw > 0n) return balRaw;
    } catch {}

    if (typeof decodedLedger._balances[Symbol.iterator] === 'function') {
      const targetCleanHex = addressToHex32(accountAddress).toLowerCase();
      const derivedTargetHex = bytesToHex(derivedTargetBytes).toLowerCase();

      // Check derived FIRST
      for (const [holderKey, balance] of decodedLedger._balances) {
        if (!holderKey) continue;
        const holderHex = bytesToHex(holderKey).toLowerCase();
        if (holderHex === derivedTargetHex) {
          return balance || 0n;
        }
      }

      // Then check raw
      for (const [holderKey, balance] of decodedLedger._balances) {
        if (!holderKey) continue;
        const holderHex = bytesToHex(holderKey).toLowerCase();
        if (holderHex === targetCleanHex) {
          return balance || 0n;
        }
      }
    }

    return 0n;
  }

  getLockedBalanceOf(accountAddress: string, contractAddress?: string): bigint {
    const activeAddress = contractAddress || this.networkConfig.contractAddress;
    const decodedLedger = this.getDecodedLedger(activeAddress);
    if (!decodedLedger) return 0n;

    const salt = this.resolveContractSalt(activeAddress);
    const rawTargetBytes = addressToBytes32(accountAddress);

    // Track any balance trapped at the raw un-derived address
    let lockedFromRaw = 0n;
    if (decodedLedger._balances) {
      try {
        const balRaw = decodedLedger._balances.lookup(rawTargetBytes);
        if (balRaw && balRaw > 0n) lockedFromRaw = balRaw;
      } catch {}
      if (lockedFromRaw === 0n && typeof decodedLedger._balances[Symbol.iterator] === 'function') {
        const targetCleanHex = addressToHex32(accountAddress).toLowerCase();
        for (const [holderKey, balance] of decodedLedger._balances) {
          if (!holderKey) continue;
          if (bytesToHex(holderKey).toLowerCase() === targetCleanHex) {
            lockedFromRaw = balance || 0n;
            break;
          }
        }
      }
    }

    let lockedStandard = 0n;
    if (decodedLedger._lockedBalances) {
      const derivedTargetBytes = FungibleTokenClient.deriveAccount(rawTargetBytes, salt);
      try {
        const balDerived = decodedLedger._lockedBalances.lookup(derivedTargetBytes);
        if (balDerived && balDerived > 0n) lockedStandard = balDerived;
      } catch {}
      if (lockedStandard === 0n && typeof decodedLedger._lockedBalances[Symbol.iterator] === 'function') {
        const derivedTargetHex = bytesToHex(derivedTargetBytes).toLowerCase();
        for (const [holderKey, balance] of decodedLedger._lockedBalances) {
          if (!holderKey) continue;
          if (bytesToHex(holderKey).toLowerCase() === derivedTargetHex) {
            lockedStandard = balance || 0n;
            break;
          }
        }
      }
    }

    return lockedStandard + lockedFromRaw;
  }

  /**
   * Resolves any recipient address (Bech32m, raw hex, preset identity) into its
   * on-chain spendable account derived with contractSalt.
   */
  resolveSpendableDestination(
    destination: Uint8Array | string,
    contractAddress?: string
  ): Uint8Array {
    const activeAddress = contractAddress || this.networkConfig.contractAddress;
    const salt = this.resolveContractSalt(activeAddress);
    const decodedLedger = this.getDecodedLedger(activeAddress);

    // 1. If destination is a string starting with mn_ (Midnight Bech32m address)
    if (typeof destination === 'string') {
      const trimmed = destination.trim();
      if (
        trimmed.toLowerCase().startsWith('mn_') ||
        trimmed.toLowerCase().startsWith('midnight') ||
        trimmed.toLowerCase().startsWith('mn1')
      ) {
        const rawBytes = addressToBytes32(trimmed);
        return FungibleTokenClient.deriveAccount(rawBytes, salt);
      }
      // Check preset identities by name (e.g. "alice", "bob", "charlie")
      const presetByName = PRESET_IDENTITIES.find(
        (p) => p.name.toLowerCase() === trimmed.toLowerCase()
      );
      if (presetByName) {
        const rawBytes = addressToBytes32(presetByName.addressHex);
        return FungibleTokenClient.deriveAccount(rawBytes, salt);
      }
    }

    const destBytes = typeof destination === 'string' ? hexToBytes(destination) : destination;
    const destHex = bytesToHex(destBytes).toLowerCase();

    // 2. If destination matches a preset identity's raw hex (e.g. Alice, Bob, Charlie raw keys)
    const presetByHex = PRESET_IDENTITIES.find(
      (p) => p.addressHex.toLowerCase().replace(/^0x/, '') === destHex
    );
    if (presetByHex) {
      const rawBytes = addressToBytes32(presetByHex.addressHex);
      return FungibleTokenClient.deriveAccount(rawBytes, salt);
    }

    // 3. If destination is the raw un-derived address of the current connected wallet, ALWAYS derive
    const currentWalletAddr = this.walletGateway?.getAddress?.();
    if (currentWalletAddr) {
      const rawWalletHex = bytesToHex(addressToBytes32(currentWalletAddr)).toLowerCase();
      if (destHex === rawWalletHex) {
        return FungibleTokenClient.deriveAccount(destBytes, salt);
      }
    }

    // 4. If destination is already the contract owner's derived account, preserve it
    const ownerHex = decodedLedger?.owner ? bytesToHex(decodedLedger.owner).toLowerCase() : '';
    if (ownerHex && destHex === ownerHex) {
      return destBytes;
    }

    // 5. If deriving destBytes matches an existing account in _balances, destBytes is definitely a raw address!
    const candidateDerived = FungibleTokenClient.deriveAccount(destBytes, salt);
    const candidateDerivedHex = bytesToHex(candidateDerived).toLowerCase();

    if (decodedLedger?._balances && typeof decodedLedger._balances[Symbol.iterator] === 'function') {
      for (const [holderKey] of decodedLedger._balances) {
        if (!holderKey) continue;
        const holderHex = bytesToHex(holderKey).toLowerCase();
        if (holderHex === candidateDerivedHex) {
          return candidateDerived;
        }
      }
    }

    // 6. If destination is already an on-chain account in _balances
    if (decodedLedger?._balances && typeof decodedLedger._balances[Symbol.iterator] === 'function') {
      for (const [holderKey] of decodedLedger._balances) {
        if (!holderKey) continue;
        if (bytesToHex(holderKey).toLowerCase() === destHex) {
          return destBytes;
        }
      }
    }

    // 7. Default: derive with salt to ensure spendability
    return candidateDerived;
  }

  getAllowance(
    ownerAddress: string,
    spenderAddress: string,
    contractAddress?: string
  ): bigint {
    const activeAddress = contractAddress || this.networkConfig.contractAddress;
    const decodedLedger = this.getDecodedLedger(activeAddress);
    if (!decodedLedger || !decodedLedger._allowances) return 0n;

    const salt = this.resolveContractSalt(activeAddress);
    const resolveCandidates = (addr: string): Uint8Array[] => {
      try {
        const raw = addressToBytes32(addr);
        const derived = FungibleTokenClient.deriveAccount(raw, salt);
        return [derived, raw];
      } catch {
        return [];
      }
    };

    const ownerCandidates = resolveCandidates(ownerAddress);
    const spenderCandidates = resolveCandidates(spenderAddress);

    for (const o of ownerCandidates) {
      for (const s of spenderCandidates) {
        try {
          const val = decodedLedger._allowances.lookup([o, s]);
          if (val !== undefined && val > 0n) return val;
        } catch {}
      }
    }
    return 0n;
  }

  getAllowancesForSpender(
    spenderAddress: string,
    contractAddress?: string
  ): GrantedAllowance[] {
    const activeAddress = contractAddress || this.networkConfig.contractAddress;
    const decodedLedger = this.getDecodedLedger(activeAddress);
    if (!decodedLedger || !decodedLedger._allowances) return [];

    const salt = this.resolveContractSalt(activeAddress);
    const resolveCandidates = (addr: string): Uint8Array[] => {
      try {
        const raw = addressToBytes32(addr);
        const derived = FungibleTokenClient.deriveAccount(raw, salt);
        return [derived, raw];
      } catch {
        return [];
      }
    };

    const spenderCandidates = resolveCandidates(spenderAddress);
    if (spenderCandidates.length === 0) return [];
    const spenderHexes = new Set(spenderCandidates.map((c) => bytesToHex(c).toLowerCase()));

    const results: GrantedAllowance[] = [];
    if (typeof decodedLedger._allowances[Symbol.iterator] === 'function') {
      for (const [[ownerBytes, spenderBytes], val] of decodedLedger._allowances) {
        if (val !== undefined && val > 0n) {
          const sHex = bytesToHex(spenderBytes).toLowerCase();
          if (spenderHexes.has(sHex)) {
            const oHex = bytesToHex(ownerBytes).toLowerCase();
            const { label } = resolveAccountLabel(oHex, spenderAddress, salt);
            const ownerBech32 = formatBech32Address(oHex, this.networkConfig.networkId);
            results.push({
              ownerAccount: oHex,
              ownerLabel: label,
              ownerAddress: ownerBech32,
              allowance: val,
            });
          }
        }
      }
    }

    // Sort descending by allowance amount
    results.sort((a, b) => (b.allowance > a.allowance ? 1 : b.allowance < a.allowance ? -1 : 0));
    return results;
  }

  private getDecodedLedger(contractAddress: string): any | null {
    if (this.simulatedState) {
      try {
        return ledger(this.simulatedState);
      } catch {}
    }

    if (this.stateStorage) {
      const cached = this.stateStorage.loadState(contractAddress);
      if (cached) {
        const deserialized = deserializeChargedState(cached);
        if (deserialized) {
          try {
            return ledger(deserialized);
          } catch {}
        }
      }
    }
    return null;
  }

  private resolveContractSalt(contractAddress?: string): Uint8Array {
    const targetAddress = contractAddress || this.networkConfig.contractAddress;
    const decoded = this.getDecodedLedger(targetAddress);
    if (decoded?._contractSalt && decoded._contractSalt.length === 32) {
      return decoded._contractSalt;
    }
    const cfgSalt = this.networkConfig?.contractSalt || MIDNIGHT_CONFIG.contractSalt;
    if (cfgSalt && typeof cfgSalt === 'string' && cfgSalt.length === 64) {
      return hexToBytes(cfgSalt);
    }
    if (targetAddress && targetAddress.length === 64) {
      return hexToBytes(targetAddress);
    }
    return new Uint8Array(32).fill(42);
  }

  private decodeLedgerMetadata(
    decoded: any,
    contractAddress: string,
    currentCaller?: string
  ): TokenMetadata {
    if (!decoded) {
      return {
        name: 'Midnight Fungible Token',
        symbol: 'MFT',
        decimals: 6,
        totalSupply: 0n,
        maxSupply: 0n,
        isInitialized: false,
        isPaused: false,
        isCallerOwner: false,
        isCallerPauser: false,
      };
    }

    const ownerBytes = decoded.owner as Uint8Array | undefined;
    const ownerHex = ownerBytes && ownerBytes.length === 32 ? bytesToHex(ownerBytes) : undefined;
    const ownerBech32 = ownerBytes && ownerBytes.length === 32
      ? formatBech32Address(ownerBytes, this.networkConfig.networkId)
      : undefined;

    const saltBytes = decoded._contractSalt as Uint8Array | undefined;
    const contractSaltHex = saltBytes && saltBytes.length === 32
      ? bytesToHex(saltBytes)
      : contractAddress.length === 64
      ? contractAddress
      : undefined;

    const pauserBytes = decoded._emergencyPauser as Uint8Array | undefined;
    const emergencyPauserHex = pauserBytes && pauserBytes.length === 32 ? bytesToHex(pauserBytes) : ownerHex;
    const emergencyPauserBech32 = pauserBytes && pauserBytes.length === 32
      ? formatBech32Address(pauserBytes, this.networkConfig.networkId)
      : ownerBech32;

    const isInit = decoded._isInitialized !== undefined
      ? Boolean(decoded._isInitialized)
      : Boolean(ownerHex || decoded._name || decoded._symbol || saltBytes);

    let isCallerOwner = false;
    let isCallerPauser = false;

    if (isInit && currentCaller) {
      const effectiveSalt = saltBytes || this.resolveContractSalt(contractAddress);
      const callerCleanHex = addressToHex32(currentCaller).toLowerCase();

      let callerDerivedHex: string | undefined;
      try {
        const callerBytes = addressToBytes32(currentCaller);
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

  private async executeCircuitInternal(
    circuitName: string,
    contractAddress: string,
    circuitFn: (contract: Contract<any>, ctx: CompactRuntime.CircuitContext<any>) => any,
    circuitArgs: any[],
    options?: CircuitInvocationOptions
  ): Promise<CircuitExecutionResult> {
    const mode = this.walletGateway.getMode();
    const callerAddress = options?.callerAddress || this.walletGateway.getAddress() || PRESET_IDENTITIES[0].addressHex;
    const effectiveSK = options?.customSecretKey || addressToBytes32(callerAddress);

    // LACE WALLET MODE
    if (mode === 'lace') {
      const extensionApi = this.walletGateway.getExtensionApi();
      if (!extensionApi) {
        throw new Error('Lace wallet is not connected.');
      }

      options?.onStatusChange?.('preparing', `Building ${circuitName} transaction intent...`);

      const rawProviders = createLaceMidnightProviders(extensionApi, { nodeUrl: this.networkConfig.nodeUrl });

      let broadcastedTxId: string | null = null;
      let blockWaitTimer: NodeJS.Timeout | null = null;
      let waitSeconds = 0;

      const providers = {
        ...rawProviders,
        proofProvider: {
          ...rawProviders.proofProvider,
          proveTx: async (unprovenTx: any, config?: any) => {
            options?.onStatusChange?.('proving', 'Generating Zero-Knowledge Proof (PLONK circuit)...');
            return await rawProviders.proofProvider.proveTx(unprovenTx, config);
          },
        },
        walletProvider: {
          ...rawProviders.walletProvider,
          balanceTx: async (tx: any, ttl?: Date) => {
            options?.onStatusChange?.('signing', 'Please approve and sign the transaction in Lace wallet...');
            return await rawProviders.walletProvider.balanceTx(tx, ttl);
          },
        },
        midnightProvider: {
          ...rawProviders.midnightProvider,
          submitTx: async (tx: any) => {
            options?.onStatusChange?.('submitting', 'Submitting signed transaction extrinsic to Midnight network...');
            const txId = await rawProviders.midnightProvider.submitTx(tx);
            broadcastedTxId = txId;
            waitSeconds = 0;
            options?.onStatusChange?.('submitting', `Broadcasted (${txId.slice(0, 10)}...). Waiting for block inclusion...`);
            if (blockWaitTimer) clearInterval(blockWaitTimer);
            blockWaitTimer = setInterval(() => {
              waitSeconds += 3;
              options?.onStatusChange?.(
                'submitting',
                `Broadcasted (${txId.slice(0, 10)}...). Waiting for block inclusion (${waitSeconds}s)...`
              );
            }, 3000);
            return txId;
          },
        },
      };

      await providers.privateStateProvider.set('fungible-token-state', { secretKey: effectiveSK });

      const witnesses = {
        localSecretKey: (ctx: any): [any, Uint8Array] => {
          const sk = effectiveSK || ctx.privateState?.secretKey;
          return [{ ...ctx.privateState, secretKey: sk }, sk];
        },
      };

      const compiledContract = CompiledContract.make('fungible-token', Contract).pipe(
        CompiledContract.withWitnesses(witnesses)
      );

      const foundContract = await findDeployedContract(providers as any, {
        compiledContract: compiledContract as any,
        contractAddress: contractAddress || this.networkConfig.contractAddress,
        privateStateId: 'fungible-token-state',
        initialPrivateState: { secretKey: effectiveSK },
      } as any);

      const callFn = (foundContract.callTx as any)[circuitName];
      if (typeof callFn !== 'function') {
        throw new Error(`Circuit '${circuitName}' is not defined on deployed contract`);
      }

      let txResult: any;
      try {
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => {
            reject(
              new Error(
                `Transaction confirmation timed out after 3 minutes. The transaction (${broadcastedTxId ? broadcastedTxId.slice(0, 10) + '...' : 'unknown'}) was submitted but not yet observed on-chain. Please check your transaction history or the Midnight explorer before resubmitting.`
              )
            );
          }, 180000);
        });

        txResult = await Promise.race([callFn(...circuitArgs), timeoutPromise]);
      } finally {
        if (blockWaitTimer) {
          clearInterval(blockWaitTimer);
          blockWaitTimer = null;
        }
      }

      // Validate on-chain execution status
      if (txResult?.public?.status && txResult.public.status !== 'SucceedEntirely') {
        throw new Error(
          `Transaction execution completed on-chain but failed status validation: ${String(txResult.public.status)}`
        );
      }

      // Extract transaction hash / ID from public finalization data, identifiers, or root properties
      const rawHash: string | undefined =
        txResult?.public?.txHash ||
        txResult?.public?.txId ||
        (Array.isArray(txResult?.public?.identifiers) && txResult.public.identifiers[0]) ||
        txResult?.txHash ||
        txResult?.txId ||
        txResult?.transactionId;

      // Clean and normalize transaction hash with 0x prefix
      const txHash = rawHash ? (rawHash.startsWith('0x') ? rawHash : `0x${rawHash}`) : '';

      // Strictly reject all-zero dummy hashes (64 zeros)
      if (!txHash || /^(?:0x)?0{64}$/i.test(txHash)) {
        throw new Error(
          `Transaction completed, but failed to retrieve a valid on-chain transaction hash from Midnight network.`
        );
      }

      // Extract confirmed block height
      const blockHeight: number | undefined =
        typeof txResult?.public?.blockHeight === 'number'
          ? txResult.public.blockHeight
          : typeof txResult?.blockHeight === 'number'
          ? txResult.blockHeight
          : undefined;

      // Immediately update local in-memory and persistent cache with new on-chain contract state
      if (txResult?.public?.nextContractState) {
        const nextData = txResult.public.nextContractState.data ?? txResult.public.nextContractState;
        this.setSimulatedChargedState(nextData);
      }

      options?.onStatusChange?.(
        'confirmed',
        `Transaction confirmed on-chain (Tx: ${txHash.slice(0, 10)}...${blockHeight ? ` in block #${blockHeight}` : ''})`
      );

      return {
        txHash,
        blockHeight,
        returnValue: txResult?.private?.result ?? txResult,
      };
    }

    // SIMULATED TEST MODE
    options?.onStatusChange?.('preparing', `Executing simulated ${circuitName}...`);

    const witnesses = {
      localSecretKey: (ctx: any): [any, Uint8Array] => [ctx.privateState, effectiveSK],
    };
    const contract = new Contract(witnesses);

    let currentChargedState = this.simulatedState;
    if (!currentChargedState) {
      const constructorCtx = CompactRuntime.createConstructorContext(
        { secretKey: effectiveSK },
        addressToHex32(callerAddress)
      );
      const defaultSalt = contractAddress.length === 64 ? hexToBytes(contractAddress) : new Uint8Array(32).fill(42);
      const defaultOwner = FungibleTokenClient.deriveAccount(effectiveSK, defaultSalt);

      const init = contract.initialState(
        constructorCtx,
        defaultSalt,
        defaultOwner,
        'Midnight Fungible Token',
        'MFT',
        6n,
        1_000_000_000n
      );
      currentChargedState = init.currentContractState.data;
    }

    const circuitCtx = CompactRuntime.createCircuitContext(
      contractAddress || this.networkConfig.contractAddress,
      addressToHex32(callerAddress),
      currentChargedState.state || currentChargedState,
      { secretKey: effectiveSK }
    );

    options?.onStatusChange?.('proving', 'Evaluating circuit logic...');
    const result = circuitFn(contract, circuitCtx);

    const updatedState = result?.context?.currentQueryContext?.state;
    if (updatedState) {
      this.setSimulatedChargedState({ state: updatedState });
    }

    const txHash = '0x' + bytesToHex(crypto.getRandomValues(new Uint8Array(32)));
    options?.onStatusChange?.('confirmed', `Simulated ${circuitName} succeeded`);

    return {
      txHash,
      returnValue: result?.result,
    };
  }

  async initialize(
    contractAddress: string,
    params: {
      salt: Uint8Array;
      initialOwner: Uint8Array;
      name: string;
      symbol: string;
      decimals: bigint;
      maxSupply: bigint;
    },
    options?: CircuitInvocationOptions
  ): Promise<CircuitExecutionResult> {
    const callerAddress = options?.callerAddress || this.walletGateway.getAddress() || PRESET_IDENTITIES[0].addressHex;
    const effectiveSK = options?.customSecretKey || addressToBytes32(callerAddress);

    const witnesses = {
      localSecretKey: (ctx: any): [any, Uint8Array] => [ctx.privateState, effectiveSK],
    };
    const contract = new Contract(witnesses);
    const constructorCtx = CompactRuntime.createConstructorContext(
      { secretKey: effectiveSK },
      addressToHex32(callerAddress)
    );

    const init = contract.initialState(
      constructorCtx,
      params.salt,
      params.initialOwner,
      params.name,
      params.symbol,
      params.decimals,
      params.maxSupply
    );

    this.setSimulatedChargedState({ state: init.currentContractState.data });
    const txHash = '0x' + bytesToHex(crypto.getRandomValues(new Uint8Array(32)));
    options?.onStatusChange?.('confirmed', `Initialization succeeded (Tx: ${txHash.slice(0, 10)}...)`);

    return { txHash, returnValue: true };
  }

  async transfer(
    contractAddress: string,
    recipient: Uint8Array | string,
    amount: bigint,
    options?: CircuitInvocationOptions
  ): Promise<CircuitExecutionResult> {
    const callerAddress = options?.callerAddress || this.walletGateway.getAddress() || PRESET_IDENTITIES[0].addressHex;
    const effectiveSK = options?.customSecretKey || addressToBytes32(callerAddress);
    const salt = this.resolveContractSalt(contractAddress);
    const callerAccount = FungibleTokenClient.deriveAccount(effectiveSK, salt);
    const targetSpendable = this.resolveSpendableDestination(recipient, contractAddress);

    return this.executeCircuitInternal(
      'transfer',
      contractAddress,
      (contract, ctx) => contract.circuits.transfer(ctx, callerAccount, targetSpendable, amount),
      [callerAccount, targetSpendable, amount],
      options
    );
  }

  async approve(
    contractAddress: string,
    spender: Uint8Array | string,
    amount: bigint,
    options?: CircuitInvocationOptions
  ): Promise<CircuitExecutionResult> {
    const callerAddress = options?.callerAddress || this.walletGateway.getAddress() || PRESET_IDENTITIES[0].addressHex;
    const effectiveSK = options?.customSecretKey || addressToBytes32(callerAddress);
    const salt = this.resolveContractSalt(contractAddress);
    const callerAccount = FungibleTokenClient.deriveAccount(effectiveSK, salt);
    const targetSpendable = this.resolveSpendableDestination(spender, contractAddress);

    return this.executeCircuitInternal(
      'approve',
      contractAddress,
      (contract, ctx) => contract.circuits.approve(ctx, callerAccount, targetSpendable, amount),
      [callerAccount, targetSpendable, amount],
      options
    );
  }

  async transferFrom(
    contractAddress: string,
    from: Uint8Array | string,
    to: Uint8Array | string,
    amount: bigint,
    options?: CircuitInvocationOptions
  ): Promise<CircuitExecutionResult> {
    const callerAddress = options?.callerAddress || this.walletGateway.getAddress() || PRESET_IDENTITIES[0].addressHex;
    const effectiveSK = options?.customSecretKey || addressToBytes32(callerAddress);
    const salt = this.resolveContractSalt(contractAddress);
    const callerAccount = FungibleTokenClient.deriveAccount(effectiveSK, salt);
    const fromSpendable = this.resolveSpendableDestination(from, contractAddress);
    const toSpendable = this.resolveSpendableDestination(to, contractAddress);

    return this.executeCircuitInternal(
      'transferFrom',
      contractAddress,
      (contract, ctx) => contract.circuits.transferFrom(ctx, callerAccount, fromSpendable, toSpendable, amount),
      [callerAccount, fromSpendable, toSpendable, amount],
      options
    );
  }

  async mint(
    contractAddress: string,
    recipient: Uint8Array | string,
    amount: bigint,
    options?: CircuitInvocationOptions
  ): Promise<CircuitExecutionResult> {
    const targetSpendable = this.resolveSpendableDestination(recipient, contractAddress);
    return this.executeCircuitInternal(
      'mint',
      contractAddress,
      (contract, ctx) => contract.circuits.mint(ctx, targetSpendable, amount),
      [targetSpendable, amount],
      options
    );
  }

  async burn(
    contractAddress: string,
    amount: bigint,
    options?: CircuitInvocationOptions
  ): Promise<CircuitExecutionResult> {
    const callerAddress = options?.callerAddress || this.walletGateway.getAddress() || PRESET_IDENTITIES[0].addressHex;
    const effectiveSK = options?.customSecretKey || addressToBytes32(callerAddress);
    const salt = this.resolveContractSalt(contractAddress);
    const callerAccount = FungibleTokenClient.deriveAccount(effectiveSK, salt);

    return this.executeCircuitInternal(
      'burn',
      contractAddress,
      (contract, ctx) => contract.circuits.burn(ctx, callerAccount, amount),
      [callerAccount, amount],
      options
    );
  }

  async pause(
    contractAddress: string,
    options?: CircuitInvocationOptions
  ): Promise<CircuitExecutionResult> {
    const callerAddress = options?.callerAddress || this.walletGateway.getAddress() || PRESET_IDENTITIES[0].addressHex;
    const effectiveSK = options?.customSecretKey || addressToBytes32(callerAddress);
    const salt = this.resolveContractSalt(contractAddress);
    const callerAccount = FungibleTokenClient.deriveAccount(effectiveSK, salt);

    return this.executeCircuitInternal(
      'pause',
      contractAddress,
      (contract, ctx) => contract.circuits.pause(ctx, callerAccount),
      [callerAccount],
      options
    );
  }

  async unpause(
    contractAddress: string,
    options?: CircuitInvocationOptions
  ): Promise<CircuitExecutionResult> {
    const callerAddress = options?.callerAddress || this.walletGateway.getAddress() || PRESET_IDENTITIES[0].addressHex;
    const effectiveSK = options?.customSecretKey || addressToBytes32(callerAddress);
    const salt = this.resolveContractSalt(contractAddress);
    const callerAccount = FungibleTokenClient.deriveAccount(effectiveSK, salt);

    return this.executeCircuitInternal(
      'unpause',
      contractAddress,
      (contract, ctx) => contract.circuits.unpause(ctx, callerAccount),
      [callerAccount],
      options
    );
  }

  async setEmergencyPauser(
    contractAddress: string,
    newPauser: Uint8Array,
    options?: CircuitInvocationOptions
  ): Promise<CircuitExecutionResult> {
    const callerAddress = options?.callerAddress || this.walletGateway.getAddress() || PRESET_IDENTITIES[0].addressHex;
    const effectiveSK = options?.customSecretKey || addressToBytes32(callerAddress);
    const salt = this.resolveContractSalt(contractAddress);
    const callerAccount = FungibleTokenClient.deriveAccount(effectiveSK, salt);

    return this.executeCircuitInternal(
      'setEmergencyPauser',
      contractAddress,
      (contract, ctx) => contract.circuits.setEmergencyPauser(ctx, callerAccount, newPauser),
      [callerAccount, newPauser],
      options
    );
  }

  async emergencyWithdraw(
    contractAddress: string,
    destination: Uint8Array,
    amount: bigint,
    options?: CircuitInvocationOptions
  ): Promise<CircuitExecutionResult> {
    const callerAddress = options?.callerAddress || this.walletGateway.getAddress() || PRESET_IDENTITIES[0].addressHex;
    const effectiveSK = options?.customSecretKey || addressToBytes32(callerAddress);
    const salt = this.resolveContractSalt(contractAddress);
    const callerAccount = FungibleTokenClient.deriveAccount(effectiveSK, salt);

    return this.executeCircuitInternal(
      'emergencyWithdraw',
      contractAddress,
      (contract, ctx) => contract.circuits.emergencyWithdraw(ctx, callerAccount, { bytes: destination }, amount),
      [callerAccount, { bytes: destination }, amount],
      options
    );
  }

  async adminReallocate(
    contractAddress: string,
    from: Uint8Array,
    to: Uint8Array,
    amount: bigint,
    options?: CircuitInvocationOptions
  ): Promise<CircuitExecutionResult> {
    const callerAddress = options?.callerAddress || this.walletGateway.getAddress() || PRESET_IDENTITIES[0].addressHex;
    const effectiveSK = options?.customSecretKey || addressToBytes32(callerAddress);
    const salt = this.resolveContractSalt(contractAddress);
    const callerAccount = FungibleTokenClient.deriveAccount(effectiveSK, salt);
    const targetSpendable = this.resolveSpendableDestination(to, contractAddress);

    return this.executeCircuitInternal(
      'adminReallocate',
      contractAddress,
      (contract, ctx) => contract.circuits.adminReallocate(ctx, callerAccount, from, targetSpendable, amount),
      [callerAccount, from, targetSpendable, amount],
      options
    );
  }
}
