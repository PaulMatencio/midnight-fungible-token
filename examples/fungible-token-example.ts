/**
 * Quickstart Example: FungibleToken Client SDK
 *
 * How to run:
 *   npx tsx examples/fungible-token-example.ts
 */

import * as CompactRuntime from '@midnight-ntwrk/compact-runtime';
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
  const owner = alice;
  const constructorCtx = CompactRuntime.createConstructorContext(initialPrivateState, coinPublicKey);
  const initResult = client.initialState(constructorCtx, owner);

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

  let result = client.initialize(circuitCtx, owner, 'Midnight USD', 'MUSD', 6n);
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

  const mintResult = client.mint(circuitCtx, owner, alice, 1_000_000n);
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