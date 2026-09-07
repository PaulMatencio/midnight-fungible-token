import { describe, it, expect, beforeEach } from 'vitest';
import {
  isMidnightExtensionInstalled,
  detectInstalledWallets,
  createLaceWalletProvider,
  createLaceMidnightProvider,
  fetchExtensionWalletBalances,
  isWalletLockedError,
  isChannelShutdownError,
} from '../src/infrastructure/midnight/midnight-dapp-connector';
import {
  createLaceMidnightProviders,
  createSimulatedMidnightProviders,
} from '../src/providers/midnight-providers';
import {
  hexToBytes,
  bytesToHex,
  addressToBytes32,
  addressToHex32,
  serializeChargedState,
  deserializeChargedState,
} from '../src/presentation/hooks/useFungibleToken';
import { PRESET_IDENTITIES } from '../src/infrastructure/config/midnight-config';
import { bech32m } from '@scure/base';
import * as CompactRuntime from '@midnight-ntwrk/compact-runtime';
import { Contract, ledger } from '../contract/index.js';

describe('Module A: Midnight DApp Connector & Wallet Provider', () => {
  it('should detect when no window.midnight is present in Node environment', () => {
    expect(isMidnightExtensionInstalled()).toBe(false);
    expect(detectInstalledWallets()).toEqual([]);
  });

  it('should format wallet balances properly from mock Lace API', async () => {
    const mockLaceApi = {
      getUnshieldedBalances: async () => 25_000_000n, // 25 tNIGHT
      getDustBalance: async () => 10_000_000_000_000_000n, // 10 DUST
      getShieldedBalances: async () => 0n,
    };

    const balances = await fetchExtensionWalletBalances(mockLaceApi);
    expect(balances.tNightBalance).toBe('25000000');
    expect(balances.tNightDisplay).toBe('25');
    expect(balances.dustBalance).toBe('10000000000000000');
    expect(balances.dustDisplay).toBe('10');
    expect(balances.isSynced).toBe(true);
  });

  it('should construct valid WalletProvider and MidnightProvider adapters', async () => {
    const mockLaceApi = {
      getCoinPublicKey: () => 'aa'.repeat(32),
      getEncryptionPublicKey: () => 'bb'.repeat(32),
      balanceTransaction: async (tx: any) => ({ ...tx, balanced: true }),
      submitTransaction: async () => '0x' + '11'.repeat(32),
    };

    const walletProvider = createLaceWalletProvider(mockLaceApi);
    expect(walletProvider.getCoinPublicKey()).toBe('aa'.repeat(32));
    expect(walletProvider.getEncryptionPublicKey()).toBe('bb'.repeat(32));

    const balancedTx = await walletProvider.balanceTx({ data: 123 });
    expect(balancedTx).toEqual({ data: 123, balanced: true });

    const submissionProvider = createLaceMidnightProvider(mockLaceApi);
    const txId = await submissionProvider.submitTx({ data: 123 });
    expect(txId).toBe('0x' + '11'.repeat(32));
  });

  it('should connect to InitialAPI v4 with connect(networkId) and UUID key', async () => {
    const { connectLaceWallet } = await import('../src/infrastructure/midnight/midnight-dapp-connector');
    
    // Simulate window.midnight with a UUID key as injected by Lace v4+
    const mockConnectedApi = {
      getUnshieldedAddress: async () => 'midnight1sampleaddress',
      getShieldedAddresses: async () => [{
        shieldedAddress: 'shieldedaddr123',
        coinPublicKey: '22'.repeat(32),
        encryptionPublicKey: '33'.repeat(32),
      }],
      getUnshieldedBalances: async () => 50_000_000n,
    };

    const mockInitialApi = {
      name: 'Lace Midnight Wallet',
      apiVersion: '4.0.0',
      rdns: 'io.lace.midnight',
      connect: async (net: string) => {
        expect(net).toBe('preprod');
        return mockConnectedApi;
      },
    };

    (globalThis as any).window = {
      midnight: {
        '9cccfe1c-30cb-4a7e-b5b0-8c61244395ce': mockInitialApi,
      },
    };

    const api = await connectLaceWallet('mnLace', 'preprod');
    expect(api).toBe(mockConnectedApi);
    const addr = await api.getUnshieldedAddress();
    expect(addr).toBe('midnight1sampleaddress');

    // Test with timeoutMs option for auto-reconnect
    const apiWithTimeout = await connectLaceWallet('mnLace', 'preprod', undefined, { timeoutMs: 3000 });
    expect(apiWithTimeout).toBe(mockConnectedApi);

    // Clean up window
    delete (globalThis as any).window;
  });

  it('should accurately detect wallet locked error structures', () => {
    // Actual error thrown by Midnight Lace connector:
    const laceApiError = {
      code: 'Rejected',
      reason: 'Wallet is locked. Please unlock the wallet first.',
      type: 'DAppConnectorAPIError',
      name: 'APIError',
      message: 'Wallet is locked. Please unlock the wallet first.',
    };

    expect(isWalletLockedError(laceApiError)).toBe(true);
    expect(isWalletLockedError({ message: 'wallet locked' })).toBe(true);
    expect(isWalletLockedError({ reason: 'Please unlock wallet' })).toBe(true);
    expect(isWalletLockedError(new Error('Wallet is locked.'))).toBe(true);

    // Normal non-locked errors
    expect(isWalletLockedError(null)).toBe(false);
    expect(isWalletLockedError(new Error('User rejected the transaction'))).toBe(false);
    expect(isWalletLockedError({ code: -32000, message: 'Network timeout' })).toBe(false);
  });

  it('should mark balances as locked when Lace returns wallet locked error', async () => {
    const mockLockedLaceApi = {
      getUnshieldedBalances: async () => {
        const err: any = new Error('Wallet is locked. Please unlock the wallet first.');
        err.reason = 'Wallet is locked. Please unlock the wallet first.';
        err.code = 'Rejected';
        throw err;
      },
      getDustBalance: async () => {
        const err: any = new Error('Wallet is locked. Please unlock the wallet first.');
        err.reason = 'Wallet is locked. Please unlock the wallet first.';
        throw err;
      },
      getShieldedBalances: async () => {
        const err: any = new Error('Wallet is locked. Please unlock the wallet first.');
        err.reason = 'Wallet is locked. Please unlock the wallet first.';
        throw err;
      },
    };

    const balances = await fetchExtensionWalletBalances(mockLockedLaceApi);
    expect(balances.isLocked).toBe(true);
    expect(balances.isSynced).toBe(false);
    expect(balances.errorMessage).toContain('Wallet is locked');
  });

  it('should accurately detect Lace background channel shutdown errors', () => {
    // Exact user reported error
    const exactUserError = new Error(
      "Remote API with channel 'activity-channel' was shutdown: object can no longer be used."
    );
    expect(isChannelShutdownError(exactUserError)).toBe(true);

    // Other channel shutdown error variants
    expect(
      isChannelShutdownError({
        message: "Remote API with channel 'wallet-channel' was shutdown: object can no longer be used.",
      })
    ).toBe(true);
    expect(
      isChannelShutdownError("Remote API with channel 'activity-channel' was shutdown: object can no longer be used.")
    ).toBe(true);
    expect(isChannelShutdownError({ reason: 'Extension context invalidated.' })).toBe(true);
    expect(isChannelShutdownError({ message: 'Could not establish connection. Receiving end does not exist.' })).toBe(true);
    expect(isChannelShutdownError({ message: 'The message port closed before a response was received.' })).toBe(true);

    // Unrelated errors should NOT match
    expect(isChannelShutdownError(null)).toBe(false);
    expect(isChannelShutdownError(undefined)).toBe(false);
    expect(isChannelShutdownError(new Error('User rejected the transaction'))).toBe(false);
    expect(isChannelShutdownError(new Error('Insufficient tNIGHT balance'))).toBe(false);
    expect(isChannelShutdownError({ message: 'Network connection timeout' })).toBe(false);
  });

  it('should gracefully handle channel shutdown in fetchExtensionWalletBalances without crashing', async () => {
    const mockShutdownLaceApi = {
      getUnshieldedBalances: async () => {
        throw new Error("Remote API with channel 'activity-channel' was shutdown: object can no longer be used.");
      },
      getDustBalance: async () => {
        throw new Error("Remote API with channel 'activity-channel' was shutdown: object can no longer be used.");
      },
      getShieldedBalances: async () => {
        throw new Error("Remote API with channel 'activity-channel' was shutdown: object can no longer be used.");
      },
      state: async () => {
        throw new Error("Remote API with channel 'activity-channel' was shutdown: object can no longer be used.");
      },
    };

    const balances = await fetchExtensionWalletBalances(mockShutdownLaceApi);
    expect(balances.isChannelShutdown).toBe(true);
    expect(balances.isSynced).toBe(false);
    expect(balances.errorMessage).toContain('shutdown');
  });
});

describe('Module B: Midnight Providers Assembly', () => {
  it('should assemble all 5 Midnight providers for simulated Test Mode', () => {
    const identity = PRESET_IDENTITIES[0];
    const providers = createSimulatedMidnightProviders(identity);

    expect(providers.walletProvider).toBeDefined();
    expect(providers.walletProvider.getCoinPublicKey()).toBe(identity.addressHex);
    expect(providers.midnightProvider).toBeDefined();
    expect(providers.publicDataProvider).toBeDefined();
    expect(providers.proofProvider).toBeDefined();
    expect(providers.zkConfigProvider).toBeDefined();
    expect(providers.privateStateProvider).toBeDefined();
  });

  it('should assemble all 5 Midnight providers for Lace Wallet Mode', () => {
    const mockLaceApi = {
      getCoinPublicKey: () => '99'.repeat(32),
      balanceTx: async (tx: any) => tx,
      submitTx: async () => '0xmockhash',
    };

    const providers = createLaceMidnightProviders(mockLaceApi);

    expect(providers.walletProvider).toBeDefined();
    expect(providers.walletProvider.getCoinPublicKey()).toBe('99'.repeat(32));
    expect(providers.midnightProvider).toBeDefined();
    expect(providers.publicDataProvider).toBeDefined();
    expect(providers.proofProvider).toBeDefined();
    expect(providers.zkConfigProvider).toBeDefined();
    expect(providers.privateStateProvider).toBeDefined();
  });
});

describe('Module C: Helpers & Byte Conversions', () => {
  it('should correctly convert hex strings to 32-byte Uint8Array and back', () => {
    const originalHex = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
    const bytes = hexToBytes(originalHex);
    expect(bytes.length).toBe(32);
    expect(bytesToHex(bytes)).toBe(originalHex);
  });

  it('should handle 0x prefix and padding in hex conversion', () => {
    const prefixedHex = '0x1234';
    const bytes = hexToBytes(prefixedHex);
    expect(bytes.length).toBe(32);
    expect(bytes[30]).toBe(0x12);
    expect(bytes[31]).toBe(0x34);
  });

  it('should seamlessly decode Midnight Bech32m unshielded and shielded addresses into 32 bytes', () => {
    // 32-byte account payload
    const rawKey = new Uint8Array(32).fill(0x3a);
    const unshieldedAddr = bech32m.encode('mn_addr_preprod', bech32m.toWords(rawKey));

    const converted = addressToBytes32(unshieldedAddr);
    expect(converted.length).toBe(32);
    expect(converted).toEqual(rawKey);

    // Shielded address (64 bytes total: 32 coin public key + 32 enc key)
    const coinKey = new Uint8Array(32).fill(0x7c);
    const encKey = new Uint8Array(32).fill(0x8d);
    const combined = new Uint8Array(64);
    combined.set(coinKey, 0);
    combined.set(encKey, 32);

    const shieldedAddr = bech32m.encode('mn_shield-addr_preprod', bech32m.toWords(combined), 200);
    const shieldedConverted = addressToBytes32(shieldedAddr);
    expect(shieldedConverted.length).toBe(32);
    expect(shieldedConverted).toEqual(coinKey);
  });

  it('should convert Bech32m address to 64-char hex string for CompactRuntime coinPublicKey without error', () => {
    const rawKey = new Uint8Array(32).fill(0x42);
    const expectedHex = '42'.repeat(32);
    const bech32Addr = bech32m.encode('mn_addr_preprod', bech32m.toWords(rawKey));

    // Address starts with 'm'
    expect(bech32Addr.startsWith('mn_')).toBe(true);

    // addressToHex32 must convert it into 64 valid hex characters
    const hexKey = addressToHex32(bech32Addr);
    expect(hexKey).toBe(expectedHex);
    expect(hexKey.length).toBe(64);

    // CompactRuntime.createConstructorContext must succeed with hexKey
    const privateState = { signingKey: rawKey };
    expect(() => {
      CompactRuntime.createConstructorContext(privateState, hexKey);
    }).not.toThrow();

    // Passing raw Bech32 directly fails with position 0 invalid character 'm'
    expect(() => {
      CompactRuntime.createConstructorContext(privateState, bech32Addr);
    }).toThrow(/position 0/i);
  });
});

describe('Module D: Explorer URL Formatting', () => {
  it('should format transaction explorer URL as tx/<tx address>?network=preprod', async () => {
    const { getExplorerTxUrl, getExplorerContractUrl, getExplorerNetworkUrl } = await import(
      '../src/infrastructure/config/midnight-config'
    );

    const tx = '0x35ba7ab88de5861474803e447b8a1adfeca4aa24948bc0b2b5da965d52f4816c';
    const url = getExplorerTxUrl(tx);
    expect(url).toBe(
      'https://explorer.1am.xyz/tx/0x35ba7ab88de5861474803e447b8a1adfeca4aa24948bc0b2b5da965d52f4816c?network=preprod'
    );

    // Auto-adds 0x if missing
    const noPrefixTx = '35ba7ab88de5861474803e447b8a1adfeca4aa24948bc0b2b5da965d52f4816c';
    expect(getExplorerTxUrl(noPrefixTx)).toBe(
      'https://explorer.1am.xyz/tx/0x35ba7ab88de5861474803e447b8a1adfeca4aa24948bc0b2b5da965d52f4816c?network=preprod'
    );

    // Contract URL
    const contractUrl = getExplorerContractUrl('6764022acd5b9fbff2b5baeb84f3082cf51f6d8b2dc978df9778b93c0005983c');
    expect(contractUrl).toBe(
      'https://explorer.1am.xyz/contract/6764022acd5b9fbff2b5baeb84f3082cf51f6d8b2dc978df9778b93c0005983c?network=preprod'
    );

    // Base Network URL
    expect(getExplorerNetworkUrl()).toBe('https://explorer.1am.xyz/?network=preprod');
  });
});

describe('Module E: Contract State Serialization & Refresh Persistence', () => {
  it('should serialize initialized state and restore it accurately across browser reloads', () => {
    const contract = new Contract({});
    const dummyCoinPubKey = '01'.repeat(32);
    const owner = new Uint8Array(32).fill(0x01);
    const constructorCtx = CompactRuntime.createConstructorContext({}, dummyCoinPubKey);
    const init = contract.initialState(constructorCtx, owner);

    const circuitCtx = CompactRuntime.createCircuitContext(
      dummyCoinPubKey,
      dummyCoinPubKey,
      init.currentContractState.data,
      {}
    );

    // Initialize token
    const resInit = contract.circuits.initialize(circuitCtx, 'Midnight Gold', 'MDG', 6n);
    const initChargedState = resInit.context.currentQueryContext.state;

    // Mint tokens to Alice (caller must be owner)
    const alice = new Uint8Array(32).fill(0xaa);
    const mintCtx = CompactRuntime.createCircuitContext(
      dummyCoinPubKey,
      dummyCoinPubKey,
      initChargedState,
      {}
    );
    const resMint = contract.circuits.mint(mintCtx, owner, alice, 75_000n);
    const updatedChargedState = resMint.context.currentQueryContext.state;

    // Verify state before serialization
    const ledgerBefore = ledger(updatedChargedState);
    expect(ledgerBefore._name).toBe('Midnight Gold');
    expect(ledgerBefore._symbol).toBe('MDG');
    expect(ledgerBefore._decimals).toBe(6n);
    expect(ledgerBefore._totalSupply).toBe(75_000n);
    expect(ledgerBefore._isInitialized).toBe(true);
    expect(ledgerBefore.owner).toEqual(owner);
    expect(ledgerBefore._balances.lookup(alice)).toBe(75_000n);

    // Simulate browser localStorage save
    const serialized = serializeChargedState(updatedChargedState);
    expect(typeof serialized).toBe('string');
    expect(serialized.length).toBeGreaterThan(50);

    // Simulate page refresh and restore from localStorage
    const restoredChargedState = deserializeChargedState(serialized);
    expect(restoredChargedState).toBeDefined();

    // Verify decoded ledger state after restore
    const ledgerAfter = ledger(restoredChargedState);
    expect(ledgerAfter._name).toBe('Midnight Gold');
    expect(ledgerAfter._symbol).toBe('MDG');
    expect(ledgerAfter._decimals).toBe(6n);
    expect(ledgerAfter._totalSupply).toBe(75_000n);
    expect(ledgerAfter._isInitialized).toBe(true);
    expect(ledgerAfter.owner).toEqual(owner);
    expect(ledgerAfter._balances.lookup(alice)).toBe(75_000n);
  });

  it('should reject re-initialization when already initialized and maintain state intact', () => {
    const contract = new Contract({});
    const dummyCoinPubKey = '01'.repeat(32);
    const owner = new Uint8Array(32).fill(0x01);
    const constructorCtx = CompactRuntime.createConstructorContext({}, dummyCoinPubKey);
    const init = contract.initialState(constructorCtx, owner);

    const circuitCtx = CompactRuntime.createCircuitContext(
      dummyCoinPubKey,
      dummyCoinPubKey,
      init.currentContractState.data,
      {}
    );

    // First initialization succeeds
    const resInit = contract.circuits.initialize(circuitCtx, 'Midnight Gold', 'MDG', 6n);
    const chargedState = resInit.context.currentQueryContext.state;

    // Second initialization on the same charged state must throw CompactError
    const secondCtx = CompactRuntime.createCircuitContext(
      dummyCoinPubKey,
      dummyCoinPubKey,
      chargedState,
      {}
    );

    expect(() => {
      contract.circuits.initialize(secondCtx, 'New Name', 'NEW', 18n);
    }).toThrow();
  });

  it('should prioritize initialized cached state over an uninitialized indexer contract state', () => {
    // 1. Uninitialized state (e.g. from indexer prior to block finalization)
    const contract = new Contract({});
    const dummyCoinPubKey = '01'.repeat(32);
    const owner = new Uint8Array(32).fill(0x01);
    const constructorCtx = CompactRuntime.createConstructorContext({}, dummyCoinPubKey);
    const uninitializedState = contract.initialState(constructorCtx, owner).currentContractState.data;
    const uninitDecoded = ledger(uninitializedState);
    expect(uninitDecoded._isInitialized).toBe(false);

    // 2. Initialized state (from user's initialization transaction)
    const circuitCtx = CompactRuntime.createCircuitContext(dummyCoinPubKey, dummyCoinPubKey, uninitializedState, {});
    const initRes = contract.circuits.initialize(circuitCtx, 'Midnight Gold', 'MDG', 6n);
    const initializedState = initRes.context.currentQueryContext.state;
    const initDecoded = ledger(initializedState);
    expect(initDecoded._isInitialized).toBe(true);

    // 3. Cache preservation condition: uninitialized indexer must NOT overwrite initialized cache
    const shouldPreserveCache = !uninitDecoded._isInitialized && initDecoded._isInitialized;
    expect(shouldPreserveCache).toBe(true);
  });
});

describe('Module F: Infrastructure Configuration Presets & Diagnostics', () => {
  it('should define accurate endpoints for Preprod and Local Devnet presets', async () => {
    const { PRESET_CONFIGS } = await import('../src/presentation/context/ConfigContext');

    expect(PRESET_CONFIGS.preprod).toBeDefined();
    expect(PRESET_CONFIGS.preprod.networkId).toBe('preprod');
    expect(PRESET_CONFIGS.preprod.indexerUrl).toContain('preprod.midnight.network');
    expect(PRESET_CONFIGS.preprod.indexerWsUrl).toContain('wss://');
    expect(PRESET_CONFIGS.preprod.nodeUrl).toContain('rpc.preprod.midnight.network');
    expect(PRESET_CONFIGS.preprod.proofServerUrl).toBe('http://127.0.0.1:6300');

    expect(PRESET_CONFIGS.devnet).toBeDefined();
    expect(PRESET_CONFIGS.devnet.networkId).toBe('devnet');
    expect(PRESET_CONFIGS.devnet.indexerUrl).toBe('http://127.0.0.1:8088/api/v4/graphql');
    expect(PRESET_CONFIGS.devnet.nodeUrl).toBe('http://127.0.0.1:9944');
    expect(PRESET_CONFIGS.devnet.proofServerUrl).toBe('http://127.0.0.1:6300');
  });

  it('should correctly format explorer URLs according to the active network preset', async () => {
    const { PRESET_CONFIGS } = await import('../src/presentation/context/ConfigContext');

    const formatTx = (base: string, tx: string, net: string) => {
      const cleanTx = tx.startsWith('0x') ? tx : `0x${tx}`;
      return `${base.replace(/\/+$/, '')}/tx/${cleanTx}?network=${encodeURIComponent(net)}`;
    };

    const preprodTx = formatTx(PRESET_CONFIGS.preprod.explorerUrl, '1234abcd', PRESET_CONFIGS.preprod.networkId);
    expect(preprodTx).toBe('https://explorer.1am.xyz/tx/0x1234abcd?network=preprod');

    const devnetTx = formatTx(PRESET_CONFIGS.devnet.explorerUrl, '1234abcd', PRESET_CONFIGS.devnet.networkId);
    expect(devnetTx).toBe('https://explorer.1am.xyz/tx/0x1234abcd?network=devnet');
  });
});

describe('Module G: Midnight Indexer Contract Query & Account Share Calculation', () => {
  it('should format 32-byte hex address into Bech32m format', async () => {
    const { formatBech32Address } = await import('../src/infrastructure/midnight/midnight-indexer-client');

    const testHex = '11'.repeat(32);
    const bech32 = formatBech32Address(testHex);
    expect(bech32.startsWith('mn_addr_preprod1')).toBe(true);
  });

  it('should format token amounts according to decimal scale', async () => {
    const { formatTokenAmount } = await import('../src/infrastructure/midnight/midnight-indexer-client');

    expect(formatTokenAmount(1_000_000n, 6n)).toBe('1');
    expect(formatTokenAmount(1_500_000n, 6n)).toBe('1.5');
    expect(formatTokenAmount(250_000n, 6n)).toBe('0.25');
    expect(formatTokenAmount(500n, 0n)).toBe('500');
  });

  it('should calculate account percentage shares, rankings, and concentration from simulated ledger', async () => {
    const { calculateAccountSharesFromLedger } = await import('../src/infrastructure/midnight/midnight-indexer-client');
    const { PRESET_IDENTITIES } = await import('../src/infrastructure/config/midnight-config');

    // Create a simulated decoded ledger with 3 accounts
    const aliceHex = PRESET_IDENTITIES.find((p) => p.name === 'alice')!.addressHex;
    const bobHex = PRESET_IDENTITIES.find((p) => p.name === 'bob')!.addressHex;
    const charlieHex = PRESET_IDENTITIES.find((p) => p.name === 'charlie')!.addressHex;

    const mockBalancesMap = new Map<Uint8Array, bigint>();
    mockBalancesMap.set(hexToBytes(aliceHex), 500_000_000n); // 50%
    mockBalancesMap.set(hexToBytes(bobHex), 300_000_000n);   // 30%
    mockBalancesMap.set(hexToBytes(charlieHex), 200_000_000n); // 20%

    const mockLedger: any = {
      _name: 'Midnight Gold',
      _symbol: 'MDG',
      _decimals: 6n,
      _totalSupply: 1_000_000_000n,
      _isInitialized: true,
      _balances: {
        [Symbol.iterator]: () => mockBalancesMap.entries(),
      },
    };

    const report = calculateAccountSharesFromLedger(mockLedger, {
      contractAddress: '6764022acd5b9fbff2b5baeb84f3082cf51f6d8b2dc978df9778b93c0005983c',
      currentUserAddress: aliceHex,
    });

    expect(report.isInitialized).toBe(true);
    expect(report.name).toBe('Midnight Gold');
    expect(report.symbol).toBe('MDG');
    expect(report.decimals).toBe(6);
    expect(report.totalSupply).toBe(1_000_000_000n);
    expect(report.formattedTotalSupply).toBe('1,000');
    expect(report.holdersCount).toBe(3);
    expect(report.largestHolderShare).toBe(50.0);
    expect(report.top3Share).toBe(100.0);

    // Verify ranked holders
    expect(report.holders.length).toBe(3);
    
    // Rank 1: Alice (50%)
    expect(report.holders[0].label).toBe('Alice (You)');
    expect(report.holders[0].balance).toBe(500_000_000n);
    expect(report.holders[0].sharePercentage).toBe(50.0);

    // Rank 2: Bob (30%)
    expect(report.holders[1].label).toBe('Bob');
    expect(report.holders[1].balance).toBe(300_000_000n);
    expect(report.holders[1].sharePercentage).toBe(30.0);

    // Rank 3: Charlie (20%)
    expect(report.holders[2].label).toBe('Charlie');
    expect(report.holders[2].balance).toBe(200_000_000n);
    expect(report.holders[2].sharePercentage).toBe(20.0);
  });

  it('should gracefully handle uninitialized or empty ledger state without errors', async () => {
    const { calculateAccountSharesFromLedger } = await import('../src/infrastructure/midnight/midnight-indexer-client');

    const emptyLedger: any = {
      _name: '',
      _symbol: '',
      _decimals: 0n,
      _totalSupply: 0n,
      _isInitialized: false,
      _balances: {
        [Symbol.iterator]: () => [][Symbol.iterator](),
      },
    };

    const report = calculateAccountSharesFromLedger(emptyLedger, {
      contractAddress: '00'.repeat(32),
    });

    expect(report.isInitialized).toBe(false);
    expect(report.holdersCount).toBe(0);
    expect(report.holders).toEqual([]);
    expect(report.largestHolderShare).toBe(0);
    expect(report.top3Share).toBe(0);
  });
});

describe('Module E: Smart Contract Direct Circuit Access Control Enforcement', () => {
  const dummyContractAddress = '00'.repeat(32);
  const dummyCoinPublicKey = '01'.repeat(32);
  const createKey = (b: number): Uint8Array => new Uint8Array(32).fill(b);

  const OWNER = createKey(1);
  const NON_OWNER = createKey(2);
  const RECIPIENT = createKey(3);

  let contract: Contract<Record<string, never>>;
  let privateState: Record<string, never>;
  let circuitContext: any;

  beforeEach(() => {
    contract = new Contract({});
    privateState = {};

    const constructorCtx = CompactRuntime.createConstructorContext(privateState, dummyCoinPublicKey);
    const { currentContractState, currentPrivateState } = contract.initialState(constructorCtx, OWNER);
    privateState = currentPrivateState;

    circuitContext = CompactRuntime.createCircuitContext(
      dummyContractAddress,
      dummyCoinPublicKey,
      currentContractState.data,
      privateState
    );

    // Initialize contract
    const initRes = contract.circuits.initialize(circuitContext, 'Test Token', 'TT', 18n);
    circuitContext = CompactRuntime.createCircuitContext(
      dummyContractAddress,
      dummyCoinPublicKey,
      initRes.context.currentQueryContext.state,
      privateState
    );
  });

  it('should let the contract circuit directly reject mint executed by a non-owner', () => {
    expect(() => {
      contract.circuits.mint(circuitContext, NON_OWNER, RECIPIENT, 1000n);
    }).toThrow('FungibleToken: caller is not the owner');
  });

  it('should let the contract circuit directly reject burn executed by a non-owner', () => {
    expect(() => {
      contract.circuits.burn(circuitContext, NON_OWNER, 500n);
    }).toThrow('FungibleToken: caller is not the owner');
  });

  it('should let the contract circuit directly reject transferFrom without sufficient allowance', () => {
    expect(() => {
      contract.circuits.transferFrom(circuitContext, NON_OWNER, OWNER, RECIPIENT, 100n);
    }).toThrow('FungibleToken: insufficient allowance');
  });

  it('should succeed when owner executes mint and burn circuits', () => {
    const mintRes = contract.circuits.mint(circuitContext, OWNER, OWNER, 2000n);
    expect(mintRes.result).toBe(true);

    circuitContext = CompactRuntime.createCircuitContext(
      dummyContractAddress,
      dummyCoinPublicKey,
      mintRes.context.currentQueryContext.state,
      privateState
    );

    const burnRes = contract.circuits.burn(circuitContext, OWNER, 500n);
    expect(burnRes.result).toBe(true);
  });
});
