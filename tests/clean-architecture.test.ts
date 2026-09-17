/**
 * Clean Architecture Verification Test Suite
 * Tests Domain Entities, Value Objects, Use Cases, Gateways, Storage, and DI Container
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  Address,
  addressToBytes32,
  bytesToHex,
  addressToHex32,
  hexToBytes,
  rawHexToBytes,
} from '../src/domain/entities/address.vo';
import {
  DomainError,
  InsufficientBalanceError,
  UnauthorizedError,
  SupplyOverflowError,
  ContractPausedError,
} from '../src/domain/errors/domain-errors';
import type { ITokenContractGateway } from '../src/domain/ports/i-token-contract.gateway';
import type { IActivityStorage } from '../src/domain/ports/i-activity.storage';
import type { IIndexerGateway } from '../src/domain/ports/i-indexer.gateway';
import { TransferTokenUseCase } from '../src/application/use-cases/transfer-token.usecase';
import { MintTokenUseCase } from '../src/application/use-cases/mint-token.usecase';
import { BurnTokenUseCase } from '../src/application/use-cases/burn-token.usecase';
import { ApproveTokenUseCase } from '../src/application/use-cases/approve-token.usecase';
import { TransferFromTokenUseCase } from '../src/application/use-cases/transfer-from-token.usecase';
import { ManageTokenPauseUseCase } from '../src/application/use-cases/manage-token-pause.usecase';
import { ManageEmergencyUseCase } from '../src/application/use-cases/manage-emergency.usecase';
import { GetTokenStateUseCase } from '../src/application/use-cases/get-token-state.usecase';
import { GetAccountSharesUseCase } from '../src/application/use-cases/get-account-shares.usecase';
import { ManageActivityLogUseCase } from '../src/application/use-cases/manage-activity-log.usecase';
import { Container, container } from '../src/infrastructure/di/container';

describe('Clean Architecture - Domain Layer', () => {
  it('should instantiate and validate Address value object', () => {
    const raw32 = new Uint8Array(32).fill(0xab);
    const addr1 = new Address(raw32);
    expect(addr1.toBytes()).toEqual(raw32);
    expect(addr1.toHex()).toBe('ab'.repeat(32));

    const addr2 = new Address('ab'.repeat(32));
    expect(addr1.equals(addr2)).toBe(true);

    const addr3 = new Address('cd'.repeat(32));
    expect(addr1.equals(addr3)).toBe(false);
  });

  it('should preserve arbitrary length in hexToBytes for contract state payloads (>32 bytes)', () => {
    // Simulated indexer contract state payload: 100 bytes (200 hex chars)
    const largeHex = 'ab'.repeat(100);
    const converted = hexToBytes(largeHex);
    expect(converted.length).toBe(100);
    expect(converted[0]).toBe(0xab);
    expect(converted[99]).toBe(0xab);

    const raw = rawHexToBytes('0x' + largeHex);
    expect(raw.length).toBe(100);
  });

  it('should pad short hex strings to 32 bytes for Compact keys/salts', () => {
    const shortHex = '0x1234';
    const converted = hexToBytes(shortHex);
    expect(converted.length).toBe(32);
    expect(converted[30]).toBe(0x12);
    expect(converted[31]).toBe(0x34);
  });

  it('should seamlessly decode Bech32m Midnight addresses in hexToBytes and preserve public key', () => {
    const rawKey = new Uint8Array(32).fill(0x5e);
    const bech32m = require('@scure/base').bech32m;
    const addr = bech32m.encode('mn_addr_preprod', bech32m.toWords(rawKey));

    const converted = hexToBytes(addr);
    expect(converted.length).toBe(32);
    expect(converted).toEqual(rawKey);

    const fromAddressToBytes32 = addressToBytes32(addr);
    expect(fromAddressToBytes32).toEqual(rawKey);
  });

  it('should strictly detect and reject all-zero dummy transaction hashes', () => {
    const zeroHash = '0x' + '00'.repeat(32);
    const zeroHashNoPrefix = '00'.repeat(32);
    const isZero1 = /^(?:0x)?0{64}$/i.test(zeroHash);
    const isZero2 = /^(?:0x)?0{64}$/i.test(zeroHashNoPrefix);
    expect(isZero1).toBe(true);
    expect(isZero2).toBe(true);

    const validHash = '0xbd3aff9567a5ee453a43445e36961ac71a4e7cf5d2492f715f1a73ff170dde11';
    expect(/^(?:0x)?0{64}$/i.test(validHash)).toBe(false);
  });

  it('should throw typed DomainErrors with proper names and codes', () => {
    const err1 = new InsufficientBalanceError();
    expect(err1 instanceof DomainError).toBe(true);
    expect(err1.code).toBe('INSUFFICIENT_BALANCE');

    const err2 = new SupplyOverflowError();
    expect(err2.code).toBe('SUPPLY_OVERFLOW');

    const err3 = new UnauthorizedError();
    expect(err3.code).toBe('UNAUTHORIZED');

    const err4 = new ContractPausedError();
    expect(err4.code).toBe('CONTRACT_PAUSED');
  });
});

describe('Clean Architecture - Application Layer (Use Cases)', () => {
  let mockContractGateway: ITokenContractGateway;
  let mockActivityStorage: IActivityStorage;
  let mockIndexerGateway: IIndexerGateway;

  beforeEach(() => {
    mockContractGateway = {
      getContractState: vi.fn().mockResolvedValue({
        name: 'Test Token',
        symbol: 'TEST',
        decimals: 6,
        totalSupply: 500_000n,
        maxSupply: 1_000_000n,
        isInitialized: true,
      }),
      getBalanceOf: vi.fn().mockReturnValue(100_000n),
      getLockedBalanceOf: vi.fn().mockReturnValue(0n),
      getAllowance: vi.fn().mockReturnValue(50_000n),
      getAllowancesForSpender: vi.fn().mockReturnValue([
        {
          ownerAccount: '56abc12f7cc11a0fb2f4217cca218b321ed6ba2a1a8fccec76ba69c50dd76959',
          ownerLabel: 'Alice (Owner)',
          allowance: 1000_000_000n,
        },
      ]),
      initialize: vi.fn().mockResolvedValue({ txHash: '0x111' }),
      transfer: vi.fn().mockResolvedValue({ txHash: '0x222', blockHeight: 123 }),
      approve: vi.fn().mockResolvedValue({ txHash: '0x333' }),
      transferFrom: vi.fn().mockResolvedValue({ txHash: '0x444' }),
      mint: vi.fn().mockResolvedValue({ txHash: '0x555' }),
      burn: vi.fn().mockResolvedValue({ txHash: '0x666' }),
      pause: vi.fn().mockResolvedValue({ txHash: '0x777' }),
      unpause: vi.fn().mockResolvedValue({ txHash: '0x888' }),
      setEmergencyPauser: vi.fn().mockResolvedValue({ txHash: '0x999' }),
      emergencyWithdraw: vi.fn().mockResolvedValue({ txHash: '0xaaa' }),
      adminReallocate: vi.fn().mockResolvedValue({ txHash: '0xbbb' }),
    };

    mockActivityStorage = {
      loadActivities: vi.fn().mockReturnValue([]),
      saveActivities: vi.fn(),
      addActivity: vi.fn(),
      updateActivity: vi.fn(),
      clearActivities: vi.fn(),
    };

    mockIndexerGateway = {
      queryContractState: vi.fn().mockResolvedValue(null),
      fetchAccountSharesReport: vi.fn().mockResolvedValue({
        contractAddress: '00'.repeat(32),
        isInitialized: true,
        name: 'Test Token',
        symbol: 'TEST',
        decimals: 6,
        totalSupply: 500_000n,
        formattedTotalSupply: '500,000',
        holdersCount: 1,
        holders: [],
        largestHolderShare: 100,
        top3Share: 100,
      }),
    };
  });

  it('TransferTokenUseCase should enforce positive amount and caller balance before transfer', async () => {
    const useCase = new TransferTokenUseCase(mockContractGateway);

    // Amount <= 0 throws
    await expect(
      useCase.execute({
        contractAddress: '00'.repeat(32),
        recipient: '11'.repeat(32),
        amount: 0n,
      })
    ).rejects.toThrow(/greater than zero/i);

    // Insufficient balance throws
    (mockContractGateway.getBalanceOf as any).mockReturnValue(50n);
    await expect(
      useCase.execute({
        contractAddress: '00'.repeat(32),
        recipient: '11'.repeat(32),
        amount: 100n,
        options: { callerAddress: '22'.repeat(32) },
      })
    ).rejects.toThrow(InsufficientBalanceError);

    // Valid transfer succeeds
    (mockContractGateway.getBalanceOf as any).mockReturnValue(500n);
    const result = await useCase.execute({
      contractAddress: '00'.repeat(32),
      recipient: '11'.repeat(32),
      amount: 100n,
      options: { callerAddress: '22'.repeat(32) },
    });
    expect(result.success).toBe(true);
    expect(result.txHash).toBe('0x222');
    expect(mockContractGateway.transfer).toHaveBeenCalled();
  });

  it('MintTokenUseCase should enforce maxSupply cap', async () => {
    const useCase = new MintTokenUseCase(mockContractGateway);

    // totalSupply is 500_000, maxSupply is 1_000_000. Minting 600_000 exceeds cap!
    await expect(
      useCase.execute({
        contractAddress: '00'.repeat(32),
        recipient: '11'.repeat(32),
        amount: 600_000n,
      })
    ).rejects.toThrow(SupplyOverflowError);

    // Minting 100_000 succeeds
    const result = await useCase.execute({
      contractAddress: '00'.repeat(32),
      recipient: '11'.repeat(32),
      amount: 100_000n,
    });
    expect(result.success).toBe(true);
    expect(result.txHash).toBe('0x555');
  });

  it('BurnTokenUseCase should enforce positive amount and sufficient balance', async () => {
    const useCase = new BurnTokenUseCase(mockContractGateway);

    await expect(
      useCase.execute({
        contractAddress: '00'.repeat(32),
        amount: 0n,
      })
    ).rejects.toThrow(/greater than zero/i);

    (mockContractGateway.getBalanceOf as any).mockReturnValue(10n);
    await expect(
      useCase.execute({
        contractAddress: '00'.repeat(32),
        amount: 50n,
        options: { callerAddress: '22'.repeat(32) },
      })
    ).rejects.toThrow(InsufficientBalanceError);
  });

  it('ApproveTokenUseCase and TransferFromTokenUseCase should validate allowances', async () => {
    const approveUseCase = new ApproveTokenUseCase(mockContractGateway);
    const transferFromUseCase = new TransferFromTokenUseCase(mockContractGateway);

    const approveRes = await approveUseCase.execute({
      contractAddress: '00'.repeat(32),
      spender: '33'.repeat(32),
      amount: 25_000n,
    });
    expect(approveRes.success).toBe(true);

    // Trying to transferFrom more than allowance (50_000n) fails
    await expect(
      transferFromUseCase.execute({
        contractAddress: '00'.repeat(32),
        from: '44'.repeat(32),
        to: '55'.repeat(32),
        amount: 60_000n,
        options: { callerAddress: '33'.repeat(32) },
      })
    ).rejects.toThrow(InsufficientBalanceError);

    // Within allowance succeeds
    const tfRes = await transferFromUseCase.execute({
      contractAddress: '00'.repeat(32),
      from: '44'.repeat(32),
      to: '55'.repeat(32),
      amount: 40_000n,
      options: { callerAddress: '33'.repeat(32) },
    });
    expect(tfRes.success).toBe(true);
  });

  it('ManageTokenPauseUseCase and ManageEmergencyUseCase execute correctly', async () => {
    const pauseUseCase = new ManageTokenPauseUseCase(mockContractGateway);
    const emergencyUseCase = new ManageEmergencyUseCase(mockContractGateway);

    const pauseRes = await pauseUseCase.pause('00'.repeat(32));
    expect(pauseRes.success).toBe(true);

    const unpauseRes = await pauseUseCase.unpause('00'.repeat(32));
    expect(unpauseRes.success).toBe(true);

    const pauserRes = await emergencyUseCase.setEmergencyPauser({
      contractAddress: '00'.repeat(32),
      newPauser: '77'.repeat(32),
    });
    expect(pauserRes.success).toBe(true);

    const withdrawRes = await emergencyUseCase.emergencyWithdraw({
      contractAddress: '00'.repeat(32),
      destination: '88'.repeat(32),
      amount: 1000n,
    });
    expect(withdrawRes.success).toBe(true);

    const reallocateRes = await emergencyUseCase.adminReallocate({
      contractAddress: '00'.repeat(32),
      from: '88'.repeat(32),
      to: '99'.repeat(32),
      amount: 500n,
    });
    expect(reallocateRes.success).toBe(true);
  });

  it('GetTokenStateUseCase, GetAccountSharesUseCase, and ManageActivityLogUseCase return clean data', async () => {
    const stateUseCase = new GetTokenStateUseCase(mockContractGateway);
    const sharesUseCase = new GetAccountSharesUseCase(mockIndexerGateway);
    const activityUseCase = new ManageActivityLogUseCase(mockActivityStorage);

    const meta = await stateUseCase.getMetadata('00'.repeat(32));
    expect(meta.name).toBe('Test Token');

    const bal = stateUseCase.getBalance({ accountAddress: '11'.repeat(32) });
    expect(bal).toBe(100_000n);

    const granted = stateUseCase.getAllowancesForSpender('22'.repeat(32));
    expect(granted).toHaveLength(1);
    expect(granted[0].ownerAccount).toBe('56abc12f7cc11a0fb2f4217cca218b321ed6ba2a1a8fccec76ba69c50dd76959');
    expect(granted[0].allowance).toBe(1000_000_000n);

    const report = await sharesUseCase.execute({ contractAddress: '00'.repeat(32) });
    expect(report.isInitialized).toBe(true);
    expect(report.largestHolderShare).toBe(100);

    activityUseCase.recordActivity({
      id: 'tx1',
      circuitName: 'transfer',
      params: {},
      status: 'confirmed',
      timestamp: Date.now(),
    });
    expect(mockActivityStorage.addActivity).toHaveBeenCalled();
  });
});

describe('Clean Architecture - DI Container', () => {
  it('should provide singleton container with all use cases and adapters wired', () => {
    expect(container).toBeDefined();
    expect(container.walletGateway).toBeDefined();
    expect(container.tokenContractGateway).toBeDefined();
    expect(container.indexerGateway).toBeDefined();
    expect(container.activityStorage).toBeDefined();
    expect(container.contractStateStorage).toBeDefined();

    // Use Cases
    expect(container.transferTokenUseCase).toBeDefined();
    expect(container.mintTokenUseCase).toBeDefined();
    expect(container.burnTokenUseCase).toBeDefined();
    expect(container.approveTokenUseCase).toBeDefined();
    expect(container.transferFromTokenUseCase).toBeDefined();
    expect(container.manageTokenPauseUseCase).toBeDefined();
    expect(container.manageEmergencyUseCase).toBeDefined();
    expect(container.getTokenStateUseCase).toBeDefined();
    expect(container.getAccountSharesUseCase).toBeDefined();
    expect(container.manageActivityLogUseCase).toBeDefined();

    // Singleton check
    expect(Container.getInstance()).toBe(container);
  });
});

describe('Module K: Lace Wallet Audit & Activity Log Filtering', () => {
  const userBech32 = 'mn_addr_preprod1hpja5mfzyd4g8rrrueu5nt0a094lhfljx5dwzf3k6xvcuf3c2h9sh6648l';
  const rawKeyHex = 'b865da6d22236a838c63e67949adfd796bfba7f2351ae12636d1998e263855cb';
  const derivedHex = '56abc12f7cc11a0fb2f4217cca218b321ed6ba2a1a8fccec76ba69c50dd76959';
  const otherUserBech32 = 'mn_addr_preprod1q9otheruseraddressxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx';

  it('should reject all activities when no wallet is connected', async () => {
    const { isActivityForUser } = await import('../src/presentation/components/ActivityLog');
    const activity: any = {
      id: 'tx-1',
      circuitName: 'transfer',
      caller: userBech32,
      params: { to: otherUserBech32, amount: 100 },
    };

    expect(isActivityForUser(activity, null, null)).toBe(false);
    expect(isActivityForUser(activity, undefined, undefined)).toBe(false);
    expect(isActivityForUser(activity, '', '')).toBe(false);
  });

  it('should match activity when caller is the user Bech32m address', async () => {
    const { isActivityForUser } = await import('../src/presentation/components/ActivityLog');
    const activity: any = {
      id: 'tx-2',
      circuitName: 'transfer',
      caller: userBech32,
    };

    expect(isActivityForUser(activity, userBech32, derivedHex)).toBe(true);
  });

  it('should match activity when caller is the derived account hex', async () => {
    const { isActivityForUser } = await import('../src/presentation/components/ActivityLog');
    const activity: any = {
      id: 'tx-3',
      circuitName: 'burn',
      caller: derivedHex,
    };

    expect(isActivityForUser(activity, userBech32, derivedHex)).toBe(true);
    expect(isActivityForUser(activity, userBech32, `0x${derivedHex}`)).toBe(true);
  });

  it('should match activity when caller is the raw 32-byte public key hex', async () => {
    const { isActivityForUser } = await import('../src/presentation/components/ActivityLog');
    const activity: any = {
      id: 'tx-4',
      circuitName: 'mint',
      caller: rawKeyHex,
    };

    // User connected with Bech32m, auto-resolved rawKeyHex
    expect(isActivityForUser(activity, userBech32, derivedHex)).toBe(true);
  });

  it('should match activity when user is the recipient or spender in params', async () => {
    const { isActivityForUser } = await import('../src/presentation/components/ActivityLog');
    const activityReceived: any = {
      id: 'tx-5',
      circuitName: 'transfer',
      caller: otherUserBech32,
      params: { to: userBech32, amount: 500 },
    };

    expect(isActivityForUser(activityReceived, userBech32, derivedHex)).toBe(true);

    const activitySpender: any = {
      id: 'tx-6',
      circuitName: 'approve',
      caller: otherUserBech32,
      params: { spender: derivedHex, amount: 1000 },
    };

    expect(isActivityForUser(activitySpender, userBech32, derivedHex)).toBe(true);
  });

  it('should reject activities belonging entirely to other accounts', async () => {
    const { isActivityForUser } = await import('../src/presentation/components/ActivityLog');
    const otherActivity: any = {
      id: 'tx-7',
      circuitName: 'transfer',
      caller: otherUserBech32,
      params: { to: 'mn_addr_preprod1someoneelse', amount: 50 },
    };

    expect(isActivityForUser(otherActivity, userBech32, derivedHex)).toBe(false);
  });
});

