import { describe, it, expect, beforeEach } from 'vitest';
import * as CompactRuntime from '@midnight-ntwrk/compact-runtime';
import { Contract, ledger, type Witnesses } from '../contract/index.js';

type PrivateState = {
  readonly currentSecretKey: Uint8Array;
};

describe('FungibleTokenV2_2 Contract Tests', () => {
  const dummyContractAddress = '00'.repeat(32);
  const dummyCoinPublicKey = '01'.repeat(32);
  const dummyAddressBytes = Uint8Array.from(Buffer.from(dummyContractAddress, 'hex'));

  const MAX_UINT128 = 340282366920938463463374607431768211455n;

  const createKey = (byteVal: number): Uint8Array => new Uint8Array(32).fill(byteVal);
  const zeroKey = (): Uint8Array => new Uint8Array(32).fill(0);

  const CONTRACT_SALT = createKey(99);
  const OWNER_SK = createKey(1);
  const ALICE_SK = createKey(2);
  const BOB_SK = createKey(3);
  const CHARLIE_SK = createKey(4);
  const PAUSER_SK = createKey(5);

  const TOKEN_NAME = 'Midnight Privacy Token';
  const TOKEN_SYMBOL = 'MPT';
  const TOKEN_DECIMALS = 8n;
  const TOKEN_MAX_SUPPLY = 1_000_000n * 10n ** TOKEN_DECIMALS;

  const domainTagAuth = new Uint8Array(32);
  domainTagAuth.set(new TextEncoder().encode('fungible-token:auth'));

  const domainTagContract = new Uint8Array(32);
  domainTagContract.set(new TextEncoder().encode('fungible-token:contract'));

  // Helper instance to dynamically resolve persistentHash methods
  const helperContract = new Contract({
    localSecretKey: (ctx: any) => [ctx.privateState, new Uint8Array(32)],
  });
  const proto = Object.getPrototypeOf(helperContract);
  const hashMethods = Object.getOwnPropertyNames(proto).filter((k) => k.startsWith('_persistentHash'));

  const authHashMethod =
    hashMethods.find((method) => {
      try {
        const t1 = (helperContract as any)[method]([domainTagAuth, CONTRACT_SALT, createKey(1)]);
        const t2 = (helperContract as any)[method]([domainTagAuth, CONTRACT_SALT, createKey(2)]);
        return t1 instanceof Uint8Array && t2 instanceof Uint8Array && Buffer.from(t1).compare(Buffer.from(t2)) !== 0;
      } catch {
        return false;
      }
    }) || '_persistentHash_0';

  const contractAccountHashMethod =
    hashMethods.find((method) => {
      try {
        const t = (helperContract as any)[method]([domainTagContract, { bytes: dummyAddressBytes }]);
        return t instanceof Uint8Array;
      } catch {
        return false;
      }
    }) || '_persistentHash_1';

  const deriveAccount = (sk: Uint8Array, salt: Uint8Array = CONTRACT_SALT): Uint8Array => {
    return (helperContract as any)[authHashMethod]([domainTagAuth, salt, sk]);
  };

  const deriveContractAccount = (): Uint8Array => {
    return (helperContract as any)[contractAccountHashMethod]([domainTagContract, { bytes: dummyAddressBytes }]);
  };

  let OWNER_ACCOUNT: Uint8Array;
  let ALICE_ACCOUNT: Uint8Array;
  let BOB_ACCOUNT: Uint8Array;
  let CHARLIE_ACCOUNT: Uint8Array;
  let PAUSER_ACCOUNT: Uint8Array;

  let contract: Contract<PrivateState>;
  let circuitContext: any;
  let currentCallerSecretKey: Uint8Array;
  let privateState: PrivateState;

  const setCallerSecretKey = (sk: Uint8Array) => {
    currentCallerSecretKey = sk;
    privateState = { currentSecretKey: sk };
    if (circuitContext) {
      circuitContext.currentPrivateState = privateState;
    }
  };

  const witnesses: Witnesses<PrivateState> = {
    localSecretKey: (ctx) => [
      ctx.privateState,
      ctx.privateState?.currentSecretKey ?? currentCallerSecretKey,
    ],
  };

  const runCircuit = (circuitFn: (...args: any[]) => any, ...args: any[]) => {
    if (circuitContext) {
      circuitContext.currentPrivateState = privateState;
    }
    const normalizedArgs = args.map((arg) => (typeof arg === 'number' ? BigInt(arg) : arg));
    const result = circuitFn(circuitContext, ...normalizedArgs);
    circuitContext = CompactRuntime.createCircuitContext(
      dummyContractAddress,
      dummyCoinPublicKey,
      result.context.currentQueryContext.state,
      privateState
    );
    return result.result;
  };

  const getLedgerState = () => {
    return ledger(circuitContext.currentQueryContext.state);
  };

  const getBalance = (account: Uint8Array): bigint => {
    const s = getLedgerState();
    return s._balances.member(account) ? s._balances.lookup(account) : 0n;
  };

  const getAllowance = (ownerAcc: Uint8Array, spender: Uint8Array): bigint => {
    const s = getLedgerState();
    const key: [Uint8Array, Uint8Array] = [ownerAcc, spender];
    return s._allowances.member(key) ? s._allowances.lookup(key) : 0n;
  };

  const deployContract = (maxSupply: bigint = TOKEN_MAX_SUPPLY) => {
    contract = new Contract(witnesses);
    currentCallerSecretKey = OWNER_SK;
    privateState = { currentSecretKey: OWNER_SK };

    OWNER_ACCOUNT = deriveAccount(OWNER_SK);
    ALICE_ACCOUNT = deriveAccount(ALICE_SK);
    BOB_ACCOUNT = deriveAccount(BOB_SK);
    CHARLIE_ACCOUNT = deriveAccount(CHARLIE_SK);
    PAUSER_ACCOUNT = deriveAccount(PAUSER_SK);

    const constructorCtx = CompactRuntime.createConstructorContext(privateState, dummyCoinPublicKey);
    const { currentContractState } = contract.initialState(
      constructorCtx,
      CONTRACT_SALT,
      OWNER_ACCOUNT,
      TOKEN_NAME,
      TOKEN_SYMBOL,
      TOKEN_DECIMALS,
      maxSupply
    );

    circuitContext = CompactRuntime.createCircuitContext(
      dummyContractAddress,
      dummyCoinPublicKey,
      currentContractState.data,
      privateState
    );
  };

  beforeEach(() => {
    deployContract();
  });

  describe('Initialization & Metadata', () => {
    it('should initialize ledger state correctly with custom maxSupply', () => {
      const state = getLedgerState();
      expect(state._name).toBe(TOKEN_NAME);
      expect(state._symbol).toBe(TOKEN_SYMBOL);
      expect(state._decimals).toBe(TOKEN_DECIMALS);
      expect(state._maxSupply).toBe(TOKEN_MAX_SUPPLY);
      expect(state._totalSupply).toBe(0n);
      expect(state._contractSalt).toEqual(CONTRACT_SALT);
      expect(state._paused).toBe(false);
      expect(state.owner).toEqual(OWNER_ACCOUNT);
      expect(state._emergencyPauser).toEqual(OWNER_ACCOUNT);
    });

    it('should default maxSupply to MAX_UINT128 when initialized with 0', () => {
      deployContract(0n);
      expect(getLedgerState()._maxSupply).toBe(MAX_UINT128);
    });

    it('should return 0 balance for accounts without mints or transfers', () => {
      expect(getBalance(ALICE_ACCOUNT)).toBe(0n);
      expect(getBalance(BOB_ACCOUNT)).toBe(0n);
    });

    it('should return 0 allowance for non-existent owner-spender pairs', () => {
      expect(getAllowance(ALICE_ACCOUNT, BOB_ACCOUNT)).toBe(0n);
    });
  });

  describe('Minting', () => {
    it('should allow the owner to mint tokens to an account', () => {
      setCallerSecretKey(OWNER_SK);
      const mintAmount = 5_000n * 10n ** TOKEN_DECIMALS;
      const success = runCircuit(contract.circuits.mint, ALICE_ACCOUNT, mintAmount);

      expect(success).toBe(true);
      expect(getBalance(ALICE_ACCOUNT)).toBe(mintAmount);
      expect(getLedgerState()._totalSupply).toBe(mintAmount);
    });

    it('should fail when a non-owner attempts to mint tokens', () => {
      setCallerSecretKey(ALICE_SK);
      expect(() => {
        runCircuit(contract.circuits.mint, ALICE_ACCOUNT, 1_000n);
      }).toThrow('FungibleToken: caller authorization failed');
    });

    it('should fail when minting to the zero address', () => {
      setCallerSecretKey(OWNER_SK);
      expect(() => {
        runCircuit(contract.circuits.mint, zeroKey(), 1_000n);
      }).toThrow('FungibleToken: invalid receiver');
    });

    it('should fail when mint amount exceeds max supply', () => {
      setCallerSecretKey(OWNER_SK);
      expect(() => {
        runCircuit(contract.circuits.mint, ALICE_ACCOUNT, TOKEN_MAX_SUPPLY + 1n);
      }).toThrow('FungibleToken: supply overflow');
    });
  });

  describe('Transfers', () => {
    const initialAliceBalance = 10_000n;

    beforeEach(() => {
      setCallerSecretKey(OWNER_SK);
      runCircuit(contract.circuits.mint, ALICE_ACCOUNT, initialAliceBalance);
    });

    it('should allow token holder to transfer tokens', () => {
      setCallerSecretKey(ALICE_SK);
      const transferAmount = 4_000n;
      const success = runCircuit(contract.circuits.transfer, ALICE_ACCOUNT, BOB_ACCOUNT, transferAmount);

      expect(success).toBe(true);
      expect(getBalance(ALICE_ACCOUNT)).toBe(initialAliceBalance - transferAmount);
      expect(getBalance(BOB_ACCOUNT)).toBe(transferAmount);
      expect(getLedgerState()._totalSupply).toBe(initialAliceBalance);
    });

    it('should allow self-transfers (from == to) when balance is sufficient', () => {
      setCallerSecretKey(ALICE_SK);
      const success = runCircuit(contract.circuits.transfer, ALICE_ACCOUNT, ALICE_ACCOUNT, 5_000n);

      expect(success).toBe(true);
      expect(getBalance(ALICE_ACCOUNT)).toBe(initialAliceBalance);
    });

    it('should fail self-transfers when balance is insufficient', () => {
      setCallerSecretKey(ALICE_SK);
      expect(() => {
        runCircuit(contract.circuits.transfer, ALICE_ACCOUNT, ALICE_ACCOUNT, initialAliceBalance + 1n);
      }).toThrow('FungibleToken: insufficient balance');
    });

    it('should fail transfer with insufficient balance', () => {
      setCallerSecretKey(ALICE_SK);
      expect(() => {
        runCircuit(contract.circuits.transfer, ALICE_ACCOUNT, BOB_ACCOUNT, initialAliceBalance + 1n);
      }).toThrow('FungibleToken: insufficient balance');
    });

    it('should fail transfer when caller is spoofing sender identity', () => {
      setCallerSecretKey(BOB_SK);
      expect(() => {
        runCircuit(contract.circuits.transfer, ALICE_ACCOUNT, BOB_ACCOUNT, 1_000n);
      }).toThrow('FungibleToken: caller authorization failed');
    });

    it('should fail transfer to zero receiver', () => {
      setCallerSecretKey(ALICE_SK);
      expect(() => {
        runCircuit(contract.circuits.transfer, ALICE_ACCOUNT, zeroKey(), 1_000n);
      }).toThrow('FungibleToken: invalid receiver');
    });

    it('should fail transfer from zero sender', () => {
      setCallerSecretKey(ALICE_SK);
      expect(() => {
        runCircuit(contract.circuits.transfer, zeroKey(), BOB_ACCOUNT, 1_000n);
      }).toThrow('FungibleToken: caller authorization failed');
    });
  });

  describe('Approvals & Allowances', () => {
    it('should allow an account to approve a spender', () => {
      setCallerSecretKey(ALICE_SK);
      const allowanceAmount = 5_000n;
      const success = runCircuit(contract.circuits.approve, ALICE_ACCOUNT, BOB_ACCOUNT, allowanceAmount);

      expect(success).toBe(true);
      expect(getAllowance(ALICE_ACCOUNT, BOB_ACCOUNT)).toBe(allowanceAmount);
    });

    it('should allow overwriting existing allowance', () => {
      setCallerSecretKey(ALICE_SK);
      runCircuit(contract.circuits.approve, ALICE_ACCOUNT, BOB_ACCOUNT, 5_000n);
      runCircuit(contract.circuits.approve, ALICE_ACCOUNT, BOB_ACCOUNT, 2_000n);

      expect(getAllowance(ALICE_ACCOUNT, BOB_ACCOUNT)).toBe(2_000n);
    });

    it('should fail approve when caller does not match owner identity', () => {
      setCallerSecretKey(BOB_SK);
      expect(() => {
        runCircuit(contract.circuits.approve, ALICE_ACCOUNT, BOB_ACCOUNT, 5_000n);
      }).toThrow('FungibleToken: caller authorization failed');
    });

    it('should fail approve with zero spender', () => {
      setCallerSecretKey(ALICE_SK);
      expect(() => {
        runCircuit(contract.circuits.approve, ALICE_ACCOUNT, zeroKey(), 5_000n);
      }).toThrow('FungibleToken: invalid spender');
    });
  });

  describe('TransferFrom', () => {
    const aliceBalance = 10_000n;
    const initialAllowance = 5_000n;

    beforeEach(() => {
      setCallerSecretKey(OWNER_SK);
      runCircuit(contract.circuits.mint, ALICE_ACCOUNT, aliceBalance);

      setCallerSecretKey(ALICE_SK);
      runCircuit(contract.circuits.approve, ALICE_ACCOUNT, BOB_ACCOUNT, initialAllowance);
    });

    it('should allow authorized spender to transfer tokens from owner', () => {
      setCallerSecretKey(BOB_SK);
      const spendAmount = 2_000n;
      const success = runCircuit(
        contract.circuits.transferFrom,
        BOB_ACCOUNT,
        ALICE_ACCOUNT,
        CHARLIE_ACCOUNT,
        spendAmount
      );

      expect(success).toBe(true);
      expect(getBalance(ALICE_ACCOUNT)).toBe(aliceBalance - spendAmount);
      expect(getBalance(CHARLIE_ACCOUNT)).toBe(spendAmount);
      expect(getAllowance(ALICE_ACCOUNT, BOB_ACCOUNT)).toBe(initialAllowance - spendAmount);
    });

    it('should not deduct allowance when allowance is MAX_UINT128 (infinite approval)', () => {
      setCallerSecretKey(ALICE_SK);
      runCircuit(contract.circuits.approve, ALICE_ACCOUNT, BOB_ACCOUNT, MAX_UINT128);

      setCallerSecretKey(BOB_SK);
      const spendAmount = 2_000n;
      runCircuit(contract.circuits.transferFrom, BOB_ACCOUNT, ALICE_ACCOUNT, CHARLIE_ACCOUNT, spendAmount);

      expect(getAllowance(ALICE_ACCOUNT, BOB_ACCOUNT)).toBe(MAX_UINT128);
      expect(getBalance(CHARLIE_ACCOUNT)).toBe(spendAmount);
    });

    it('should fail transferFrom when spending amount exceeds allowance', () => {
      setCallerSecretKey(BOB_SK);
      expect(() => {
        runCircuit(
          contract.circuits.transferFrom,
          BOB_ACCOUNT,
          ALICE_ACCOUNT,
          CHARLIE_ACCOUNT,
          initialAllowance + 1n
        );
      }).toThrow('FungibleToken: insufficient allowance');
    });

    it('should fail transferFrom when spender is not caller', () => {
      setCallerSecretKey(CHARLIE_SK);
      expect(() => {
        runCircuit(
          contract.circuits.transferFrom,
          BOB_ACCOUNT,
          ALICE_ACCOUNT,
          CHARLIE_ACCOUNT,
          1_000n
        );
      }).toThrow('FungibleToken: caller authorization failed');
    });

    it('should fail transferFrom when owner has insufficient balance despite allowance', () => {
      setCallerSecretKey(ALICE_SK);
      runCircuit(contract.circuits.transfer, ALICE_ACCOUNT, CHARLIE_ACCOUNT, aliceBalance);

      setCallerSecretKey(BOB_SK);
      expect(() => {
        runCircuit(
          contract.circuits.transferFrom,
          BOB_ACCOUNT,
          ALICE_ACCOUNT,
          CHARLIE_ACCOUNT,
          initialAllowance
        );
      }).toThrow('FungibleToken: insufficient balance');
    });
  });

  describe('Burning', () => {
    const aliceBalance = 5_000n;

    beforeEach(() => {
      setCallerSecretKey(OWNER_SK);
      runCircuit(contract.circuits.mint, ALICE_ACCOUNT, aliceBalance);
    });

    it('should allow token holder to burn their own tokens', () => {
      setCallerSecretKey(ALICE_SK);
      const burnAmount = 2_000n;
      const success = runCircuit(contract.circuits.burn, ALICE_ACCOUNT, burnAmount);

      expect(success).toBe(true);
      expect(getBalance(ALICE_ACCOUNT)).toBe(aliceBalance - burnAmount);
      expect(getLedgerState()._totalSupply).toBe(aliceBalance - burnAmount);
    });

    it('should fail when burning more than account balance', () => {
      setCallerSecretKey(ALICE_SK);
      expect(() => {
        runCircuit(contract.circuits.burn, ALICE_ACCOUNT, aliceBalance + 1n);
      }).toThrow('FungibleToken: insufficient balance');
    });

    it('should fail when caller is unauthorized to burn for account', () => {
      setCallerSecretKey(BOB_SK);
      expect(() => {
        runCircuit(contract.circuits.burn, ALICE_ACCOUNT, 1_000n);
      }).toThrow('FungibleToken: caller authorization failed');
    });
  });

  describe('Emergency Stop & Pauser Management', () => {
    it('should allow owner to pause and unpause the contract', () => {
      setCallerSecretKey(OWNER_SK);
      expect(getLedgerState()._paused).toBe(false);

      expect(runCircuit(contract.circuits.pause, OWNER_ACCOUNT)).toBe(true);
      expect(getLedgerState()._paused).toBe(true);

      expect(runCircuit(contract.circuits.unpause, OWNER_ACCOUNT)).toBe(true);
      expect(getLedgerState()._paused).toBe(false);
    });

    it('should fail to pause when contract is already paused', () => {
      setCallerSecretKey(OWNER_SK);
      runCircuit(contract.circuits.pause, OWNER_ACCOUNT);

      expect(() => {
        runCircuit(contract.circuits.pause, OWNER_ACCOUNT);
      }).toThrow('FungibleToken: contract is paused');
    });

    it('should fail to unpause when contract is not paused', () => {
      setCallerSecretKey(OWNER_SK);
      expect(() => {
        runCircuit(contract.circuits.unpause, OWNER_ACCOUNT);
      }).toThrow('FungibleToken: contract is not paused');
    });

    it('should fail when unauthorized account attempts to pause', () => {
      setCallerSecretKey(ALICE_SK);
      expect(() => {
        runCircuit(contract.circuits.pause, ALICE_ACCOUNT);
      }).toThrow('FungibleToken: only pauser or owner can call this');
    });

    it('should allow owner to set a new emergency pauser', () => {
      setCallerSecretKey(OWNER_SK);
      const success = runCircuit(contract.circuits.setEmergencyPauser, OWNER_ACCOUNT, PAUSER_ACCOUNT);

      expect(success).toBe(true);
      const state = getLedgerState();
      expect(state._emergencyPauser).toEqual(PAUSER_ACCOUNT);

      // New designated pauser can pause
      setCallerSecretKey(PAUSER_SK);
      expect(runCircuit(contract.circuits.pause, PAUSER_ACCOUNT)).toBe(true);
      expect(getLedgerState()._paused).toBe(true);

      // New designated pauser can unpause
      expect(runCircuit(contract.circuits.unpause, PAUSER_ACCOUNT)).toBe(true);
      expect(getLedgerState()._paused).toBe(false);
    });

    it('should fail when non-owner attempts to set emergency pauser', () => {
      setCallerSecretKey(ALICE_SK);
      expect(() => {
        runCircuit(contract.circuits.setEmergencyPauser, ALICE_ACCOUNT, PAUSER_ACCOUNT);
      }).toThrow('FungibleToken: only owner can call this');
    });

    it('should fail when setting zero address as emergency pauser', () => {
      setCallerSecretKey(OWNER_SK);
      expect(() => {
        runCircuit(contract.circuits.setEmergencyPauser, OWNER_ACCOUNT, zeroKey());
      }).toThrow('FungibleToken: invalid pauser address');
    });
  });

  describe('Operations Guarded by Pause State', () => {
    const mintAmount = 10_000n;

    beforeEach(() => {
      setCallerSecretKey(OWNER_SK);
      runCircuit(contract.circuits.mint, ALICE_ACCOUNT, mintAmount);

      setCallerSecretKey(ALICE_SK);
      runCircuit(contract.circuits.approve, ALICE_ACCOUNT, BOB_ACCOUNT, 5_000n);

      // Pause the contract
      setCallerSecretKey(OWNER_SK);
      runCircuit(contract.circuits.pause, OWNER_ACCOUNT);
    });

    it('should reject minting when paused', () => {
      setCallerSecretKey(OWNER_SK);
      expect(() => {
        runCircuit(contract.circuits.mint, BOB_ACCOUNT, 1_000n);
      }).toThrow('FungibleToken: contract is paused');
    });

    it('should reject transfers when paused', () => {
      setCallerSecretKey(ALICE_SK);
      expect(() => {
        runCircuit(contract.circuits.transfer, ALICE_ACCOUNT, BOB_ACCOUNT, 1_000n);
      }).toThrow('FungibleToken: contract is paused');
    });

    it('should reject approvals when paused', () => {
      setCallerSecretKey(ALICE_SK);
      expect(() => {
        runCircuit(contract.circuits.approve, ALICE_ACCOUNT, BOB_ACCOUNT, 1_000n);
      }).toThrow('FungibleToken: contract is paused');
    });

    it('should reject transferFrom when paused', () => {
      setCallerSecretKey(BOB_SK);
      expect(() => {
        runCircuit(contract.circuits.transferFrom, BOB_ACCOUNT, ALICE_ACCOUNT, BOB_ACCOUNT, 1_000n);
      }).toThrow('FungibleToken: contract is paused');
    });

    it('should reject burning when paused', () => {
      setCallerSecretKey(ALICE_SK);
      expect(() => {
        runCircuit(contract.circuits.burn, ALICE_ACCOUNT, 1_000n);
      }).toThrow('FungibleToken: contract is paused');
    });
  });

  describe('Emergency Withdrawal', () => {
    const contractAccount = deriveContractAccount();
    const tokenContractAddress = { bytes: dummyAddressBytes };
    const depositedAmount = 8_000n;

    it('should allow owner to execute emergencyWithdraw when paused and contract has balance', () => {
      // Mint tokens to the deterministic contract account
      setCallerSecretKey(OWNER_SK);
      runCircuit(contract.circuits.mint, contractAccount, depositedAmount);
      expect(getBalance(contractAccount)).toBe(depositedAmount);

      // Pause contract
      runCircuit(contract.circuits.pause, OWNER_ACCOUNT);

      // Owner withdraws contract balance to owner account
      const success = runCircuit(
        contract.circuits.emergencyWithdraw,
        OWNER_ACCOUNT,
        tokenContractAddress,
        depositedAmount
      );

      expect(success).toBe(true);
      expect(getBalance(contractAccount)).toBe(0n);
      expect(getBalance(OWNER_ACCOUNT)).toBe(depositedAmount);
    });

    it('should fail emergencyWithdraw when contract is not paused', () => {
      setCallerSecretKey(OWNER_SK);
      expect(() => {
        runCircuit(contract.circuits.emergencyWithdraw, OWNER_ACCOUNT, tokenContractAddress, 1_000n);
      }).toThrow('FungibleToken: contract is not paused');
    });

    it('should fail emergencyWithdraw when called by non-owner', () => {
      setCallerSecretKey(OWNER_SK);
      runCircuit(contract.circuits.pause, OWNER_ACCOUNT);

      setCallerSecretKey(ALICE_SK);
      expect(() => {
        runCircuit(contract.circuits.emergencyWithdraw, ALICE_ACCOUNT, tokenContractAddress, 1_000n);
      }).toThrow('FungibleToken: only owner can call this');
    });

    it('should fail emergencyWithdraw when contract account balance is insufficient', () => {
      setCallerSecretKey(OWNER_SK);
      runCircuit(contract.circuits.pause, OWNER_ACCOUNT);

      expect(() => {
        runCircuit(contract.circuits.emergencyWithdraw, OWNER_ACCOUNT, tokenContractAddress, 1_000n);
      }).toThrow('FungibleToken: insufficient balance');
    });
  });
});