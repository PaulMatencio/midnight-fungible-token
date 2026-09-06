# Part 1: Technical Architecture & Client SDK Documentation

## 1. Contract Overview & Architecture

The `fungible-token.compact` smart contract implements a standardized, fungible asset system on the Midnight blockchain using the Compact programming language (`pragma language_version >= 0.23`).

The contract architecture separates public on-chain verifiable ledger state from circuit execution contexts.

```
+--------------------------------------------------------------------------------+
|                         Midnight Zero-Knowledge Domain                        |
|                                                                                |
|   +------------------------------------------------------------------------+   |
|   | Circuit Execution Engine (Client-Side ZK prover / Runtime Context)     |   |
|   |                                                                        |   |
|   |  Private Parameters:  [caller: Bytes<32>, to: Bytes<32>, value]        |   |
|   |                                 |                                      |   |
|   |                                 v                                      |   |
|   |                      disclose(...) wrappers                            |   |
|   |                                 |                                      |   |
|   |                                 v                                      |   |
|   |                  Zero-Knowledge Proof Generation                       |   |
|   +---------------------------------+--------------------------------------+   |
|                                     |                                          |
+-------------------------------------|------------------------------------------+
                                      | State Transition Proof + Public Inputs
                                      v
+--------------------------------------------------------------------------------+
|                         On-Chain Public Ledger Domain                          |
|                                                                                |
|   +------------------------------------------------------------------------+   |
|   | Public Ledger State (`export ledger`)                                  |   |
|   |  - _isInitialized:  Boolean                                            |   |
|   |  - _name:           Opaque<"string">                                   |   |
|   |  - _symbol:         Opaque<"string">                                   |   |
|   |  - _decimals:       Uint<8>                                            |   |
|   |  - _totalSupply:    Uint<128>                                          |   |
|   |  - _balances:       Map<Bytes<32>, Uint<128>>                          |   |
|   |  - _allowances:     Map<Bytes<32>, Map<Bytes<32>, Uint<128>>>          |   |
|   +------------------------------------------------------------------------+   |
+--------------------------------------------------------------------------------+
```

### 1.1 Public Ledger State Schema

| State Variable | Compact Type | TypeScript SDK Equivalent | Description |
| :--- | :--- | :--- | :--- |
| `_isInitialized` | `Boolean` | `boolean` | Lifecycle guard ensuring one-time initialization |
| `_name` | `Opaque<"string">` | `string` | Public token collection name |
| `_symbol` | `Opaque<"string">` | `string` | Public token ticker symbol |
| `_decimals` | `Uint<8>` | `bigint` (0 to 255) | Divisibility exponent of the token units |
| `_totalSupply` | `Uint<128>` | `bigint` (0 to $2^{128}-1$) | Aggregated circulation count across all balances |
| `_balances` | `Map<Bytes<32>, Uint<128>>` | Custom State Map `Map<Uint8Array, bigint>` | Account balance lookup indexed by public keys |
| `_allowances` | `Map<Bytes<32>, Map<Bytes<32>, Uint<128>>>` | Custom Nested Map | Delegated spending caps indexed by `[owner][spender]` |

### 1.2 Private State & Witness Specification

While this contract operates primarily on disclosed transfers, all caller identities and arguments passed into circuits remain private to the proving context until explicitly disclosed via `disclose(...)`. The SDK accommodates private state management for key management and signing keys.

### 1.3 Available Zero-Knowledge Circuits

| Circuit Name | Parameters | Return | Assertions & Validation Rules |
| :--- | :--- | :--- | :--- |
| `initialize` | `(name_: string, symbol_: string, decimals_: Uint<8>)` | `[]` | Fails if `_isInitialized` is true. |
| `name` | `()` | `string` | Asserts contract is initialized; returns token name. |
| `symbol` | `()` | `string` | Asserts contract is initialized; returns token symbol. |
| `decimals` | `()` | `Uint<8>` | Asserts contract is initialized; returns decimals. |
| `totalSupply` | `()` | `Uint<128>` | Asserts contract is initialized; returns circulating supply. |
| `balanceOf` | `(account: Bytes<32>)` | `Uint<128>` | Asserts initialization; returns balance or 0 if unmapped. |
| `allowance` | `(owner: Bytes<32>, spender: Bytes<32>)` | `Uint<128>` | Asserts initialization; returns delegated spend cap. |
| `transfer` | `(caller: Bytes<32>, to: Bytes<32>, value: Uint<128>)` | `Boolean` | Verifies non-zero targets, sufficient balance, updates state. |
| `approve` | `(caller: Bytes<32>, spender: Bytes<32>, value: Uint<128>)` | `Boolean` | Sets allowance cap from caller to spender. |
| `transferFrom` | `(caller: Bytes<32>, fromAccount: Bytes<32>, to: Bytes<32>, value: Uint<128>)` | `Boolean` | Verifies allowance, deducts allowance, executes transfer. |
| `_mint` | `(account: Bytes<32>, value: Uint<128>)` | `[]` | Mints new supply to `account` (restricted / internal entry). |
| `_burn` | `(account: Bytes<32>, value: Uint<128>)` | `[]` | Destroys token units from `account`. |

---

## 2. Prerequisites & Installation

To install dependencies, add the following script to `scripts/fungible-token-install.sh`:

```bash
#!/usr/bin/env bash
set -euo pipefail

# scripts/fungible-token-install.sh
echo "Installing Midnight Compact Runtime and TypeScript dependencies..."

npm install --save \
  @midnight-ntwrk/compact-runtime@^0.23.0 \
  @midnight-ntwrk/compact-js@^0.23.0

npm install --save-dev \
  typescript@^5.5.0 \
  tsx@^4.19.0 \
  @types/node@^20.0.0

echo "Dependencies successfully installed."
```

Make the script executable and run:
```bash
chmod +x scripts/fungible-token-install.sh
./scripts/fungible-token-install.sh
```

---

## 3. API Reference

### `FungibleTokenClient<PS>`

Constructed via:
```typescript
const client = new FungibleTokenClient<MyPrivateState>(witnessImplementations);
```

#### Methods

- **`initialState(context: ConstructorContext<PS>): ConstructorResult<PS>`**
  Creates the initial uncommitted contract state and returns execution contexts.

- **`initialize(context: CircuitContext<PS>, name: string, symbol: string, decimals: bigint | number): CircuitResults<PS, []>`**
  Initializes token metadata and marks `_isInitialized` as `true`.

- **`mint(context: CircuitContext<PS>, account: Uint8Array, value: bigint): CircuitResults<PS, []>`**
  Creates new tokens and credits them to `account`.

- **`burn(context: CircuitContext<PS>, account: Uint8Array, value: bigint): CircuitResults<PS, []>`**
  Removes tokens from `account` balance and adjusts `totalSupply`.

- **`transfer(context: CircuitContext<PS>, caller: Uint8Array, to: Uint8Array, value: bigint): CircuitResults<PS, boolean>`**
  Transfers `value` units from `caller` to `to`.

- **`approve(context: CircuitContext<PS>, caller: Uint8Array, spender: Uint8Array, value: bigint): CircuitResults<PS, boolean>`**
  Sets approved allowance cap for `spender` from `caller`.

- **`transferFrom(context: CircuitContext<PS>, caller: Uint8Array, from: Uint8Array, to: Uint8Array, value: bigint): CircuitResults<PS, boolean>`**
  Executes allowance-backed transfer.

- **`queryLedgerStateFromRaw(rawState: StateValue | ChargedState | unknown): FungibleTokenLedgerState`**
  Parses raw ledger storage bytes into structured objects.

---

## 4. Step-by-Step Quickstart & Usage Walkthrough

Save the following runnable walkthrough script to `examples/fungible-token-example.ts`:

```typescript
/**
 * Quickstart Example: FungibleToken Client SDK
 *
 * How to run:
 *   npx tsx examples/fungible-token-example.ts
 */

import { CompactRuntime } from '@midnight-ntwrk/compact-runtime';
import { FungibleTokenClient, type FungibleTokenPrivateState } from '../src/client/fungible-token-sdk.js';

// Helper: generate 32-byte Uint8Array from single byte fill
const createAddressBytes = (fillByte: number): Uint8Array => {
  const arr = new Uint8Array(32);
  arr.fill(fillByte);
  return arr;
};

// Helper: convert Uint8Array to hex for display
const toHex = (buf: Uint8Array): string =>
  Array.from(buf).map((b) => b.toString(16).padStart(2, '0')).join('');

async function main(): Promise<void> {
  console.log('--- Starting FungibleToken SDK Walkthrough ---');

  // 1. Setup mock addresses and identities
  const contractAddress = '00'.repeat(32); // Hex string contract identifier
  const coinPublicKey = '01'.repeat(32);   // Hex string coin public key

  const alice = createAddressBytes(0xaa);
  const bob = createAddressBytes(0xbb);
  const charlie = createAddressBytes(0xcc);

  console.log(`Alice Address:   ${toHex(alice)}`);
  console.log(`Bob Address:     ${toHex(bob)}`);
  console.log(`Charlie Address: ${toHex(charlie)}`);

  // 2. Initialize Private State and Client SDK
  const initialPrivateState: FungibleTokenPrivateState = {
    signingKey: createAddressBytes(0x99),
  };

  const client = new FungibleTokenClient<FungibleTokenPrivateState>({});

  // 3. Initialize Contract via Constructor Context
  console.log('\n[1] Invoking Constructor...');
  const constructorCtx = CompactRuntime.createConstructorContext(initialPrivateState, coinPublicKey);
  const initResult = client.initialState(constructorCtx);

  let currentPrivateState = initResult.currentPrivateState;
  let currentChargedState = initResult.currentContractState.data;

  // 4. Initialize Token Metadata Circuit
  console.log('\n[2] Invoking initialize("Midnight USD", "MUSD", 6)...');
  let circuitCtx = CompactRuntime.createCircuitContext(
    contractAddress,
    coinPublicKey,
    currentChargedState,
    currentPrivateState
  );

  let result = client.initialize(circuitCtx, 'Midnight USD', 'MUSD', 6n);
  currentChargedState = result.context.currentQueryContext.state;
  currentPrivateState = result.context.currentPrivateState;

  // Query and print initial state
  let state = client.queryLedgerStateFromRaw(currentChargedState);
  console.log(`Initialized: ${state._isInitialized}`);
  console.log(`Token Name:  ${state._name}`);
  console.log(`Symbol:      ${state._symbol}`);
  console.log(`Decimals:    ${state._decimals}`);
  console.log(`Total Supply: ${state._totalSupply}`);

  // 5. Mint initial balance to Alice (1,000,000 units = 1.0 MUSD)
  console.log('\n[3] Minting 1,000,000 units to Alice...');
  circuitCtx = CompactRuntime.createCircuitContext(
    contractAddress,
    coinPublicKey,
    currentChargedState,
    currentPrivateState
  );

  const mintResult = client.mint(circuitCtx, alice, 1_000_000n);
  currentChargedState = mintResult.context.currentQueryContext.state;
  currentPrivateState = mintResult.context.currentPrivateState;

  state = client.queryLedgerStateFromRaw(currentChargedState);
  console.log(`Total Supply after Mint: ${state._totalSupply}`);
  console.log(`Alice Balance: ${state._balances.member(alice) ? state._balances.lookup(alice) : 0n}`);

  // 6. Alice transfers 400,000 units to Bob
  console.log('\n[4] Alice transferring 400,000 units to Bob...');
  circuitCtx = CompactRuntime.createCircuitContext(
    contractAddress,
    coinPublicKey,
    currentChargedState,
    currentPrivateState
  );

  const transferResult = client.transfer(circuitCtx, alice, bob, 400_000n);
  currentChargedState = transferResult.context.currentQueryContext.state;
  currentPrivateState = transferResult.context.currentPrivateState;

  state = client.queryLedgerStateFromRaw(currentChargedState);
  console.log(`Transfer Succeeded: ${transferResult.result}`);
  console.log(`Alice Balance: ${state._balances.lookup(alice)}`);
  console.log(`Bob Balance:   ${state._balances.lookup(bob)}`);

  // 7. Bob approves Charlie to spend 150,000 units
  console.log('\n[5] Bob approving Charlie for 150,000 units...');
  circuitCtx = CompactRuntime.createCircuitContext(
    contractAddress,
    coinPublicKey,
    currentChargedState,
    currentPrivateState
  );

  const approveResult = client.approve(circuitCtx, bob, charlie, 150_000n);
  currentChargedState = approveResult.context.currentQueryContext.state;
  currentPrivateState = approveResult.context.currentPrivateState;

  state = client.queryLedgerStateFromRaw(currentChargedState);
  console.log(`Charlie Allowance from Bob: ${state._allowances.lookup(bob).lookup(charlie)}`);

  // 8. Charlie transfers 50,000 units from Bob to Alice
  console.log('\n[6] Charlie executing transferFrom(Bob -> Alice, 50,000)...');
  circuitCtx = CompactRuntime.createCircuitContext(
    contractAddress,
    coinPublicKey,
    currentChargedState,
    currentPrivateState
  );

  const transferFromResult = client.transferFrom(circuitCtx, charlie, bob, alice, 50_000n);
  currentChargedState = transferFromResult.context.currentQueryContext.state;
  currentPrivateState = transferFromResult.context.currentPrivateState;

  state = client.queryLedgerStateFromRaw(currentChargedState);
  console.log(`Alice Balance:               ${state._balances.lookup(alice)}`);
  console.log(`Bob Balance:                 ${state._balances.lookup(bob)}`);
  console.log(`Charlie Remaining Allowance: ${state._allowances.lookup(bob).lookup(charlie)}`);

  // 9. Burn 100,000 units from Alice
  console.log('\n[7] Alice burning 100,000 units...');
  circuitCtx = CompactRuntime.createCircuitContext(
    contractAddress,
    coinPublicKey,
    currentChargedState,
    currentPrivateState
  );

  const burnResult = client.burn(circuitCtx, alice, 100_000n);
  currentChargedState = burnResult.context.currentQueryContext.state;
  currentPrivateState = burnResult.context.currentPrivateState;

  state = client.queryLedgerStateFromRaw(currentChargedState);
  console.log(`Final Total Supply: ${state._totalSupply}`);
  console.log(`Final Alice Balance: ${state._balances.lookup(alice)}`);

  console.log('\n--- Walkthrough Completed Successfully ---');
}

main().catch((err) => {
  console.error('Execution failed:', err);
  process.exit(1);
});
```

---

## 5. Privacy & Security Considerations

1. **Explicit Data Disclosure**: In Compact >= 0.23, circuit arguments are private by default within the ZK proving execution. When assigning to public ledger mappings (`_balances`, `_allowances`), the arguments are explicitly published on-chain using `disclose(...)`.
2. **Zero-Key Invariant**: The contract safeguards the ledger by preventing transfers, approvals, mints, or burns targeting or originating from `default<Bytes<32>>` (the zero key).
3. **Arithmetic Bounds**: All token balances and total supply operate on bounded `Uint<128>` primitives with assertion checks preventing overflow and underflow conditions.

---

# Part 2: Production TypeScript Client SDK Implementation

```typescript
/**
 * Production Client SDK for FungibleToken Compact Smart Contract
 * Filename: src/client/fungible-token-sdk.ts
 *
 * Provides strongly typed interfaces, context management, and circuit wrappers
 * for interacting with the fungible-token contract on the Midnight blockchain.
 */

import {
  type CircuitContext,
  type QueryContext,
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
  type Witnesses as ContractWitnesses,
  type Ledger as ContractLedger,
} from '../../contracts/managed/fungible-token/contract/index.js';

/**
 * Interface representing the off-chain private state for the caller session.
 */
export interface FungibleTokenPrivateState {
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
export type FungibleTokenWitnesses<PS> = Partial<ContractWitnesses<PS>> & {
  readonly [witnessName: string]: WitnessFn<PS, any, any[]> | undefined;
};

/**
 * Production-ready TypeScript Client SDK Adapter for FungibleToken.
 */
export class FungibleTokenClient<PS extends FungibleTokenPrivateState = FungibleTokenPrivateState> {
  private readonly contractInstance: ManagedContract<PS>;

  /**
   * Initializes the FungibleToken SDK client with required witness bindings.
   *
   * @param witnesses Optional implementation of off-chain witness functions.
   */
  constructor(witnesses: FungibleTokenWitnesses<PS> = {}) {
    this.contractInstance = new ManagedContract<PS>(witnesses as ContractWitnesses<PS>);
  }

  /**
   * Generates the initial contract and runtime states for deployment.
   *
   * @param context Constructor context containing initial private state and coin public key.
   * @returns ConstructorResult containing initial contract and private states.
   */
  public initialState(context: ConstructorContext<PS>): ConstructorResult<PS> {
    return this.contractInstance.initialState(context);
  }

  /**
   * Invokes the `initialize` circuit to set metadata on the token.
   *
   * @param context Circuit execution context.
   * @param name Token name string.
   * @param symbol Token symbol ticker.
   * @param decimals Token decimal places (0 to 255).
   * @returns Circuit execution results containing updated context and empty tuple `[]`.
   */
  public initialize(
    context: CircuitContext<PS>,
    name: string,
    symbol: string,
    decimals: bigint | number
  ): CircuitResults<PS, []> {
    const decimalsBigInt = typeof decimals === 'number' ? BigInt(decimals) : decimals;
    return this.contractInstance.circuits.initialize(context, name, symbol, decimalsBigInt);
  }

  /**
   * Invokes the `name` circuit to query the on-chain token name.
   *
   * @param context Circuit execution context.
   * @returns Circuit execution results containing token name string.
   */
  public name(context: CircuitContext<PS>): CircuitResults<PS, string> {
    return this.contractInstance.circuits.name(context);
  }

  /**
   * Invokes the `symbol` circuit to query the on-chain token symbol.
   *
   * @param context Circuit execution context.
   * @returns Circuit execution results containing token symbol string.
   */
  public symbol(context: CircuitContext<PS>): CircuitResults<PS, string> {
    return this.contractInstance.circuits.symbol(context);
  }

  /**
   * Invokes the `decimals` circuit to query the token decimals.
   *
   * @param context Circuit execution context.
   * @returns Circuit execution results containing decimals as bigint.
   */
  public decimals(context: CircuitContext<PS>): CircuitResults<PS, bigint> {
    return this.contractInstance.circuits.decimals(context);
  }

  /**
   * Invokes the `totalSupply` circuit to query the total token supply.
   *
   * @param context Circuit execution context.
   * @returns Circuit execution results containing total supply as bigint.
   */
  public totalSupply(context: CircuitContext<PS>): CircuitResults<PS, bigint> {
    return this.contractInstance.circuits.totalSupply(context);
  }

  /**
   * Invokes the `balanceOf` circuit to retrieve the balance for an account.
   *
   * @param context Circuit execution context.
   * @param account 32-byte address public key.
   * @returns Circuit execution results containing the balance as bigint.
   */
  public balanceOf(
    context: CircuitContext<PS>,
    account: Uint8Array
  ): CircuitResults<PS, bigint> {
    this.assertValidAddress(account, 'account');
    return this.contractInstance.circuits.balanceOf(context, account);
  }

  /**
   * Invokes the `allowance` circuit to query the approved spend limit for a spender.
   *
   * @param context Circuit execution context.
   * @param owner 32-byte token owner address.
   * @param spender 32-byte authorized spender address.
   * @returns Circuit execution results containing approved allowance.
   */
  public allowance(
    context: CircuitContext<PS>,
    owner: Uint8Array,
    spender: Uint8Array
  ): CircuitResults<PS, bigint> {
    this.assertValidAddress(owner, 'owner');
    this.assertValidAddress(spender, 'spender');
    return this.contractInstance.circuits.allowance(context, owner, spender);
  }

  /**
   * Executes a direct transfer of token units from caller to recipient.
   *
   * @param context Circuit execution context.
   * @param caller 32-byte sender address.
   * @param to 32-byte recipient address.
   * @param value Amount of tokens to transfer.
   * @returns Circuit execution results returning true on success.
   */
  public transfer(
    context: CircuitContext<PS>,
    caller: Uint8Array,
    to: Uint8Array,
    value: bigint | number
  ): CircuitResults<PS, boolean> {
    this.assertValidAddress(caller, 'caller');
    this.assertValidAddress(to, 'to');
    const valueBigInt = typeof value === 'number' ? BigInt(value) : value;
    return this.contractInstance.circuits.transfer(context, caller, to, valueBigInt);
  }

  /**
   * Approves a spender to transfer up to a specified allowance from the caller's account.
   *
   * @param context Circuit execution context.
   * @param caller 32-byte owner address granting allowance.
   * @param spender 32-byte spender address.
   * @param value Max amount approved for spending.
   * @returns Circuit execution results returning true on success.
   */
  public approve(
    context: CircuitContext<PS>,
    caller: Uint8Array,
    spender: Uint8Array,
    value: bigint | number
  ): CircuitResults<PS, boolean> {
    this.assertValidAddress(caller, 'caller');
    this.assertValidAddress(spender, 'spender');
    const valueBigInt = typeof value === 'number' ? BigInt(value) : value;
    return this.contractInstance.circuits.approve(context, caller, spender, valueBigInt);
  }

  /**
   * Transfers tokens on behalf of an owner using a pre-approved allowance.
   *
   * @param context Circuit execution context.
   * @param caller 32-byte authorized spender address initiating the transfer.
   * @param fromAccount 32-byte owner address whose tokens will be transferred.
   * @param to 32-byte recipient address.
   * @param value Amount of tokens to transfer.
   * @returns Circuit execution results returning true on success.
   */
  public transferFrom(
    context: CircuitContext<PS>,
    caller: Uint8Array,
    fromAccount: Uint8Array,
    to: Uint8Array,
    value: bigint | number
  ): CircuitResults<PS, boolean> {
    this.assertValidAddress(caller, 'caller');
    this.assertValidAddress(fromAccount, 'fromAccount');
    this.assertValidAddress(to, 'to');
    const valueBigInt = typeof value === 'number' ? BigInt(value) : value;
    return this.contractInstance.circuits.transferFrom(
      context,
      caller,
      fromAccount,
      to,
      valueBigInt
    );
  }

  /**
   * Mints tokens to a designated account.
   *
   * @param context Circuit execution context.
   * @param account 32-byte destination address.
   * @param value Amount of tokens to mint.
   * @returns Circuit execution results returning empty tuple `[]`.
   */
  public mint(
    context: CircuitContext<PS>,
    account: Uint8Array,
    value: bigint | number
  ): CircuitResults<PS, []> {
    this.assertValidAddress(account, 'account');
    const valueBigInt = typeof value === 'number' ? BigInt(value) : value;
    return this.contractInstance.circuits._mint(context, account, valueBigInt);
  }

  /**
   * Burns tokens from a designated account.
   *
   * @param context Circuit execution context.
   * @param account 32-byte account address from which tokens are burned.
   * @param value Amount of tokens to burn.
   * @returns Circuit execution results returning empty tuple `[]`.
   */
  public burn(
    context: CircuitContext<PS>,
    account: Uint8Array,
    value: bigint | number
  ): CircuitResults<PS, []> {
    this.assertValidAddress(account, 'account');
    const valueBigInt = typeof value === 'number' ? BigInt(value) : value;
    return this.contractInstance.circuits._burn(context, account, valueBigInt);
  }

  /**
   * Parses raw serialized on-chain ledger state into a strongly typed FungibleTokenLedgerState.
   *
   * @param rawState Raw StateValue, ChargedState, or state byte object from the indexer or query context.
   * @returns Parsed and typed contract ledger state.
   */
  public queryLedgerStateFromRaw(
    rawState: StateValue | ChargedState | unknown
  ): FungibleTokenLedgerState {
    return ledger(rawState as StateValue | ChargedState);
  }

  /**
   * Helper validator to ensure address bytes match Compact 32-byte key specifications.
   */
  private assertValidAddress(address: Uint8Array, fieldName: string): void {
    if (!address || address.length !== 32) {
      throw new Error(
        `Invalid address length for '${fieldName}'. Expected exactly 32 bytes, received ${
          address ? address.length : 0
        } bytes.`
      );
    }
  }
}
```