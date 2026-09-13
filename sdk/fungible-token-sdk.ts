/**
 * Production TypeScript Client SDK for Midnight Compact Contract: fungible-token-v2-2
 * Filename: src/client/fungible-token-sdk.ts
 *
 * Provides strongly typed interfaces, context management, witness generation,
 * cryptographic account derivation with contract salt, and circuit wrappers.
 */

import {
  type CircuitContext,
  type WitnessContext,
  type ConstructorContext,
  type ConstructorResult,
  type CircuitResults,
  type StateValue,
  type ChargedState,
} from '@midnight-ntwrk/compact-runtime';

import {
  Contract as ManagedContract,
  ledger,
  pureCircuits,
  type Witnesses as ContractWitnesses,
  type Ledger as ContractLedger,
  type Circuits,
  type ImpureCircuits,
  type ProvableCircuits,
} from '../contract/index.js';

/**
 * Interface representing the off-chain private state for caller sessions.
 */
export interface FungibleTokenPrivateState {
  readonly secretKey?: Uint8Array;
  readonly currentSecretKey?: Uint8Array;
  readonly signingKey?: Uint8Array;
  readonly [customKey: string]: unknown;
}

/**
 * Strongly typed ledger state representing public on-chain storage.
 */
export type FungibleTokenLedgerState = ContractLedger;

/**
 * Generic witness function signature adhering to Midnight runtime conventions.
 */
export type WitnessFn<PS, TReturn = void, TArgs extends unknown[] = unknown[]> = (
  context: WitnessContext<ContractLedger, PS>,
  ...args: TArgs
) => [PS, TReturn];

/**
 * Strongly typed witnesses container for off-chain computation callbacks.
 */
export type Witnesses<PS = FungibleTokenPrivateState> = ContractWitnesses<PS>;
export type FungibleTokenWitnesses<PS = FungibleTokenPrivateState> = Partial<ContractWitnesses<PS>> & {
  readonly [witnessName: string]: WitnessFn<PS, any, any[]> | undefined;
};

export interface FungibleTokenConstructorArgs {
  salt: Uint8Array | string;
  initialOwner: Uint8Array | string;
  name: string;
  symbol: string;
  decimals: bigint | number;
  maxSupply: bigint | number;
}

export interface EmergencyWithdrawParams {
  caller: Uint8Array | string;
  tokenAddress: Uint8Array | string | { bytes: Uint8Array };
  amount: bigint | number;
}

// Internal reusable helper contract to compute persistentHash for identity commitments
const _helperContract = new ManagedContract({
  localSecretKey: (ctx: any) => [ctx.privateState, new Uint8Array(32)],
} as any);

const _domainTagAuth = new Uint8Array(32);
_domainTagAuth.set(new TextEncoder().encode('fungible-token:auth'));

const _domainTagContract = new Uint8Array(32);
_domainTagContract.set(new TextEncoder().encode('fungible-token:contract'));

/**
 * Client SDK for FungibleTokenV22 Compact smart contract on Midnight.
 */
export class FungibleTokenClient<PS extends FungibleTokenPrivateState = FungibleTokenPrivateState> {
  public readonly contractInstance: ManagedContract<PS>;
  public readonly contract: ManagedContract<PS>;
  public readonly defaultContractSalt?: Uint8Array;

  constructor(
    witnessesOrSecretKey?: FungibleTokenWitnesses<PS> | Witnesses<PS> | Uint8Array,
    defaultContractSalt?: Uint8Array | string
  ) {
    let fullWitnesses: ContractWitnesses<PS>;

    if (witnessesOrSecretKey instanceof Uint8Array) {
      fullWitnesses = FungibleTokenClient.createWitnesses<PS>(witnessesOrSecretKey);
    } else if (witnessesOrSecretKey && typeof (witnessesOrSecretKey as any).localSecretKey === 'function') {
      fullWitnesses = {
        localSecretKey: (witnessesOrSecretKey as any).localSecretKey,
      };
    } else {
      fullWitnesses = {
        localSecretKey: (ctx: WitnessContext<ContractLedger, PS>): [PS, Uint8Array] => {
          const ps = ctx.privateState as any;
          const sk =
            ps?.secretKey ||
            ps?.currentSecretKey ||
            ps?.signingKey ||
            new Uint8Array(32).fill(1);
          return [ctx.privateState, FungibleTokenClient.toBytes32(sk)];
        },
      };
    }

    this.contractInstance = new ManagedContract<PS>(fullWitnesses);
    this.contract = this.contractInstance;

    if (defaultContractSalt) {
      this.defaultContractSalt = FungibleTokenClient.toBytes32(defaultContractSalt);
    }
  }

  // ==========================================
  // Cryptographic & Identity Helpers
  // ==========================================

  /**
   * Pads or parses an input string/bytes into a 32-byte Uint8Array.
   */
  public static toBytes32(input: string | Uint8Array): Uint8Array {
    if (typeof input === 'string') {
      const cleanHex = input.replace(/^0x/, '').trim();
      if (/^[0-9a-fA-F]{64}$/.test(cleanHex)) {
        const bytes = new Uint8Array(32);
        for (let i = 0; i < 32; i++) {
          bytes[i] = parseInt(cleanHex.slice(i * 2, i * 2 + 2), 16) || 0;
        }
        return bytes;
      }
      const utf8 = new TextEncoder().encode(input);
      const out = new Uint8Array(32);
      out.set(utf8.slice(0, 32));
      return out;
    }
    if (input.length === 32) {
      return input;
    }
    const out = new Uint8Array(32);
    out.set(input.slice(0, 32));
    return out;
  }

  /**
   * Formats a 32-byte array to hexadecimal string.
   */
  public static toHex(bytes: Uint8Array): string {
    return Array.from(bytes)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }

  /**
   * Derives a deterministic on-chain account identity from a private secret key and contract salt.
   * Mirrors the Compact circuit persistent hash:
   * persistentHash([pad(32, "fungible-token:auth"), _contractSalt, sk])
   */
  public static deriveAccount(
    secretKey: Uint8Array | string,
    contractSalt: string | Uint8Array = new Uint8Array(32).fill(42)
  ): Uint8Array {
    const skBytes = FungibleTokenClient.toBytes32(secretKey);
    const saltBytes = FungibleTokenClient.toBytes32(contractSalt);
    return (_helperContract as any)._persistentHash_1([_domainTagAuth, saltBytes, skBytes]);
  }

  /**
   * Instance method for deriving account.
   */
  public deriveAccount(secretKey: Uint8Array | string, contractSalt?: string | Uint8Array): Uint8Array {
    const salt = contractSalt ?? this.defaultContractSalt;
    if (!salt) {
      throw new Error('Contract salt must be provided either in the constructor or as an argument');
    }
    return FungibleTokenClient.deriveAccount(secretKey, salt);
  }

  /**
   * Returns authenticated caller identifier for a given secret key and contract salt.
   */
  public getAuthenticatedCaller(
    secretKey: Uint8Array | string,
    contractSalt?: string | Uint8Array
  ): Uint8Array {
    return this.deriveAccount(secretKey, contractSalt);
  }

  /**
   * Checks whether a given secretKey derives the expected target account identity.
   */
  public static isAuthorized(
    secretKey: Uint8Array | string,
    targetAccount: Uint8Array | string,
    contractSalt: string | Uint8Array
  ): boolean {
    const derived = FungibleTokenClient.deriveAccount(secretKey, contractSalt);
    const targetBytes = FungibleTokenClient.toBytes32(targetAccount);
    if (derived.length !== targetBytes.length) return false;
    for (let i = 0; i < derived.length; i++) {
      if (derived[i] !== targetBytes[i]) return false;
    }
    return true;
  }

  /**
   * Constructs the default witnesses configuration using a static secret key.
   */
  public static createWitnesses<PS extends FungibleTokenPrivateState = FungibleTokenPrivateState>(
    secretKey: Uint8Array | string
  ): ContractWitnesses<PS> {
    const skBytes = FungibleTokenClient.toBytes32(secretKey);
    return {
      localSecretKey: (context) => {
        const ps = context.privateState as any;
        const key = ps?.secretKey || ps?.currentSecretKey || ps?.signingKey || skBytes;
        return [context.privateState, FungibleTokenClient.toBytes32(key)];
      },
    };
  }

  // ==========================================
  // Constructor & Ledger Query Methods
  // ==========================================

  /**
   * Initializes contract constructor state. Supports positional arguments or options object.
   */
  public initialState(
    context: ConstructorContext<PS>,
    saltOrArgs: Uint8Array | string | FungibleTokenConstructorArgs,
    initialOwner?: Uint8Array | string,
    name?: string,
    symbol?: string,
    decimals?: bigint | number,
    maxSupply?: bigint | number
  ): ConstructorResult<PS> {
    if (typeof saltOrArgs === 'object' && 'salt' in saltOrArgs) {
      const args = saltOrArgs as FungibleTokenConstructorArgs;
      return this.contractInstance.initialState(
        context,
        FungibleTokenClient.toBytes32(args.salt),
        FungibleTokenClient.toBytes32(args.initialOwner),
        args.name,
        args.symbol,
        BigInt(args.decimals),
        BigInt(args.maxSupply)
      );
    }

    return this.contractInstance.initialState(
      context,
      FungibleTokenClient.toBytes32(saltOrArgs as string | Uint8Array),
      FungibleTokenClient.toBytes32(initialOwner || new Uint8Array(32)),
      name || 'Midnight Token',
      symbol || 'MDT',
      BigInt(decimals !== undefined ? decimals : 8n),
      BigInt(maxSupply !== undefined ? maxSupply : 0n)
    );
  }

  /**
   * Parses the ledger state from a StateValue or ChargedState.
   */
  public getLedger(state: StateValue | ChargedState | unknown): ContractLedger {
    return ledger(state as StateValue | ChargedState);
  }

  public queryLedgerStateFromRaw(rawState: StateValue | ChargedState | unknown): ContractLedger {
    return this.getLedger(rawState);
  }

  public getBalance(state: StateValue | ChargedState | unknown, account: Uint8Array | string): bigint {
    const accountBytes = FungibleTokenClient.toBytes32(account);
    const led = this.getLedger(state);
    if (!led._balances.member(accountBytes)) {
      return 0n;
    }
    return led._balances.lookup(accountBytes);
  }

  public getAllowance(
    state: StateValue | ChargedState | unknown,
    ownerAccount: Uint8Array | string,
    spender: Uint8Array | string
  ): bigint {
    const ownerBytes = FungibleTokenClient.toBytes32(ownerAccount);
    const spenderBytes = FungibleTokenClient.toBytes32(spender);
    const led = this.getLedger(state);
    const key: [Uint8Array, Uint8Array] = [ownerBytes, spenderBytes];
    if (!led._allowances.member(key)) {
      return 0n;
    }
    return led._allowances.lookup(key);
  }

  public isPaused(state: StateValue | ChargedState | unknown): boolean {
    return this.getLedger(state)._paused;
  }

  public getEmergencyPauser(state: StateValue | ChargedState | unknown): Uint8Array {
    return this.getLedger(state)._emergencyPauser;
  }

  public getOwner(state: StateValue | ChargedState | unknown): Uint8Array {
    return this.getLedger(state).owner;
  }

  public getTotalSupply(state: StateValue | ChargedState | unknown): bigint {
    return this.getLedger(state)._totalSupply;
  }

  public getMaxSupply(state: StateValue | ChargedState | unknown): bigint {
    return this.getLedger(state)._maxSupply;
  }

  public getName(state: StateValue | ChargedState | unknown): string {
    return this.getLedger(state)._name;
  }

  public getSymbol(state: StateValue | ChargedState | unknown): string {
    return this.getLedger(state)._symbol;
  }

  public getDecimals(state: StateValue | ChargedState | unknown): bigint {
    return this.getLedger(state)._decimals;
  }

  public getContractSalt(state: StateValue | ChargedState | unknown): Uint8Array {
    return this.getLedger(state)._contractSalt;
  }

  // ==========================================
  // Contract Circuit Executions
  // ==========================================

  public async transfer(
    context: CircuitContext<PS>,
    caller: Uint8Array | string,
    to: Uint8Array | string,
    value: bigint | number
  ): Promise<CircuitResults<PS, boolean>> {
    const callerBytes = FungibleTokenClient.toBytes32(caller);
    const toBytes = FungibleTokenClient.toBytes32(to);
    return this.contractInstance.circuits.transfer(context, callerBytes, toBytes, BigInt(value));
  }

  public async approve(
    context: CircuitContext<PS>,
    caller: Uint8Array | string,
    spender: Uint8Array | string,
    value: bigint | number
  ): Promise<CircuitResults<PS, boolean>> {
    const callerBytes = FungibleTokenClient.toBytes32(caller);
    const spenderBytes = FungibleTokenClient.toBytes32(spender);
    return this.contractInstance.circuits.approve(context, callerBytes, spenderBytes, BigInt(value));
  }

  public async transferFrom(
    context: CircuitContext<PS>,
    caller: Uint8Array | string,
    fromAccount: Uint8Array | string,
    to: Uint8Array | string,
    value: bigint | number
  ): Promise<CircuitResults<PS, boolean>> {
    const callerBytes = FungibleTokenClient.toBytes32(caller);
    const fromBytes = FungibleTokenClient.toBytes32(fromAccount);
    const toBytes = FungibleTokenClient.toBytes32(to);
    return this.contractInstance.circuits.transferFrom(context, callerBytes, fromBytes, toBytes, BigInt(value));
  }

  public async mint(
    context: CircuitContext<PS>,
    to: Uint8Array | string,
    value: bigint | number
  ): Promise<CircuitResults<PS, boolean>> {
    const toBytes = FungibleTokenClient.toBytes32(to);
    return this.contractInstance.circuits.mint(context, toBytes, BigInt(value));
  }

  public async burn(
    context: CircuitContext<PS>,
    caller: Uint8Array | string,
    value: bigint | number
  ): Promise<CircuitResults<PS, boolean>> {
    const callerBytes = FungibleTokenClient.toBytes32(caller);
    return this.contractInstance.circuits.burn(context, callerBytes, BigInt(value));
  }

  public async pause(
    context: CircuitContext<PS>,
    caller: Uint8Array | string
  ): Promise<CircuitResults<PS, boolean>> {
    const callerBytes = FungibleTokenClient.toBytes32(caller);
    return this.contractInstance.circuits.pause(context, callerBytes);
  }

  public async unpause(
    context: CircuitContext<PS>,
    caller: Uint8Array | string
  ): Promise<CircuitResults<PS, boolean>> {
    const callerBytes = FungibleTokenClient.toBytes32(caller);
    return this.contractInstance.circuits.unpause(context, callerBytes);
  }

  public async setEmergencyPauser(
    context: CircuitContext<PS>,
    caller: Uint8Array | string,
    newPauser: Uint8Array | string
  ): Promise<CircuitResults<PS, boolean>> {
    const callerBytes = FungibleTokenClient.toBytes32(caller);
    const pauserBytes = FungibleTokenClient.toBytes32(newPauser);
    return this.contractInstance.circuits.setEmergencyPauser(context, callerBytes, pauserBytes);
  }

  public async emergencyWithdraw(
    context: CircuitContext<PS>,
    callerOrParams: Uint8Array | string | EmergencyWithdrawParams,
    tokenAddress?: Uint8Array | string | { bytes: Uint8Array },
    amount?: bigint | number
  ): Promise<CircuitResults<PS, boolean>> {
    if (typeof callerOrParams === 'object' && 'caller' in callerOrParams) {
      const p = callerOrParams as EmergencyWithdrawParams;
      const callerBytes = FungibleTokenClient.toBytes32(p.caller);
      const tokenObj: { bytes: Uint8Array } =
        typeof p.tokenAddress === 'object' && 'bytes' in p.tokenAddress
          ? { bytes: FungibleTokenClient.toBytes32(p.tokenAddress.bytes) }
          : { bytes: FungibleTokenClient.toBytes32(p.tokenAddress as string | Uint8Array) };
      return this.contractInstance.circuits.emergencyWithdraw(context, callerBytes, tokenObj, BigInt(p.amount));
    }

    const callerBytes = FungibleTokenClient.toBytes32(callerOrParams as string | Uint8Array);
    const tokenObj: { bytes: Uint8Array } =
      typeof tokenAddress === 'object' && 'bytes' in tokenAddress!
        ? { bytes: FungibleTokenClient.toBytes32(tokenAddress.bytes) }
        : { bytes: FungibleTokenClient.toBytes32(tokenAddress as string | Uint8Array) };

    return this.contractInstance.circuits.emergencyWithdraw(context, callerBytes, tokenObj, BigInt(amount || 0));
  }
}

// Aliases for cross-compatibility
export { FungibleTokenClient as FungibleTokenV22Client };
export { FungibleTokenClient as FungibleTokenV22SDK };
export { ledger, pureCircuits };
export type {
  ContractLedger as Ledger,
  Circuits,
  ImpureCircuits,
  ProvableCircuits,
  FungibleTokenPrivateState as FungibleTokenV22PrivateState,
  ContractLedger as FungibleTokenV22LedgerState,
  ContractWitnesses as FungibleTokenV22Witnesses,
};
