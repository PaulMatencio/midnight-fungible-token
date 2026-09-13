/**
 * Quickstart Example: FungibleTokenV22 Client SDK
 * How to run: npx tsx examples/fungible-token-v2-2-example.ts
 */
import { randomBytes } from 'node:crypto';
import * as CompactRuntime from '@midnight-ntwrk/compact-runtime';
import {
  FungibleTokenClient,
  type FungibleTokenPrivateState
} from '../src/client/fungible-token-sdk.js';

interface MockContext {
  currentPrivateState: FungibleTokenPrivateState;
  currentContractState: any;
}

function createMockContext(privateState: FungibleTokenPrivateState, contractState: any) {
  const dummyCoinPublicKey = '01'.repeat(32);
  const dummyContractAddress = '00'.repeat(32);
  const ctx = {
    currentPrivateState: privateState,
    currentContractState: contractState
  };

  const getCircuitContext = () =>
    CompactRuntime.createCircuitContext(
      dummyContractAddress,
      dummyCoinPublicKey,
      ctx.currentContractState?.data ?? ctx.currentContractState,
      ctx.currentPrivateState
    );

  const getConstructorContext = () =>
    CompactRuntime.createConstructorContext(ctx.currentPrivateState, dummyCoinPublicKey);

  const applyResult = (res: any) => {
    if (res.context) {
      ctx.currentPrivateState = res.context.currentPrivateState ?? ctx.currentPrivateState;
      ctx.currentContractState = res.context.currentQueryContext?.state ?? ctx.currentContractState;
    }
    return res.result;
  };

  return { ctx, getCircuitContext, getConstructorContext, applyResult };
}

async function main() {
  console.log('================================================================');
  console.log('   Midnight Fungible Token v2.2 - Client SDK Quickstart Demo   ');
  console.log('================================================================\n');

  // 1. Generate keys & contract salt
  const contractSalt = randomBytes(32);
  const ownerSecretKey = randomBytes(32);
  const aliceSecretKey = randomBytes(32);
  const bobSecretKey = randomBytes(32);

  // Derive public addresses
  const ownerAddress = FungibleTokenClient.deriveAccount(ownerSecretKey, contractSalt);
  const aliceAddress = FungibleTokenClient.deriveAccount(aliceSecretKey, contractSalt);
  const bobAddress = FungibleTokenClient.deriveAccount(bobSecretKey, contractSalt);

  console.log('Derived Public Accounts:');
  console.log(`- Contract Salt: ${FungibleTokenClient.toHex(contractSalt)}`);
  console.log(`- Owner Address: ${FungibleTokenClient.toHex(ownerAddress)}`);
  console.log(`- Alice Address: ${FungibleTokenClient.toHex(aliceAddress)}`);
  console.log(`- Bob Address:   ${FungibleTokenClient.toHex(bobAddress)}\n`);

  // Verify authorization helper
  const isOwnerValid = FungibleTokenClient.isAuthorized(ownerSecretKey, ownerAddress, contractSalt);
  console.log(`Owner authorization check passed: ${isOwnerValid}\n`);

  // 2. Initialize SDK Client
  const client = new FungibleTokenClient(ownerSecretKey, contractSalt);

  // 3. Initialize Contract State
  const initialPrivateState: FungibleTokenPrivateState = { secretKey: ownerSecretKey };
  const mock = createMockContext(initialPrivateState, null);

  console.log('Deploying / Initializing Fungible Token Contract...');
  const initResult = client.initialState(mock.getConstructorContext(), {
    salt: contractSalt,
    initialOwner: ownerAddress,
    name: 'Midnight Shield USD',
    symbol: 'msUSD',
    decimals: 6,
    maxSupply: 1_000_000_000_000n // 1,000,000 msUSD
  });
  mock.ctx.currentContractState = initResult.currentContractState.data;
  mock.ctx.currentPrivateState = initResult.context?.currentPrivateState ?? initialPrivateState;

  console.log('Contract Initialized:');
  console.log(`- Token Name:    ${client.getName(mock.ctx.currentContractState)}`);
  console.log(`- Token Symbol:  ${client.getSymbol(mock.ctx.currentContractState)}`);
  console.log(`- Decimals:      ${client.getDecimals(mock.ctx.currentContractState)}`);
  console.log(`- Max Supply:    ${client.getMaxSupply(mock.ctx.currentContractState)}`);
  console.log(`- Initial Paused:${client.isPaused(mock.ctx.currentContractState)}\n`);

  // 4. Mint tokens to Alice
  console.log('--- Step 1: Minting 50,000 units to Alice ---');
  mock.ctx.currentPrivateState = { secretKey: ownerSecretKey };
  const mintRes = await client.mint(mock.getCircuitContext(), aliceAddress, 50_000n);
  mock.applyResult(mintRes);

  console.log(`Alice Balance: ${client.getBalance(mock.ctx.currentContractState, aliceAddress)}`);
  console.log(`Total Supply:  ${client.getTotalSupply(mock.ctx.currentContractState)}\n`);

  // 5. Alice transfers tokens to Bob
  console.log('--- Step 2: Alice transfers 20,000 units to Bob ---');
  mock.ctx.currentPrivateState = { secretKey: aliceSecretKey };
  const transferRes = await client.transfer(
    mock.getCircuitContext(),
    aliceAddress,
    bobAddress,
    20_000n
  );
  mock.applyResult(transferRes);

  console.log(`Alice Balance: ${client.getBalance(mock.ctx.currentContractState, aliceAddress)}`);
  console.log(`Bob Balance:   ${client.getBalance(mock.ctx.currentContractState, bobAddress)}\n`);

  // 6. Bob approves Alice to spend 5,000 units
  console.log('--- Step 3: Bob approves Alice for 5,000 units ---');
  mock.ctx.currentPrivateState = { secretKey: bobSecretKey };
  const approveRes = await client.approve(
    mock.getCircuitContext(),
    bobAddress,
    aliceAddress,
    5_000n
  );
  mock.applyResult(approveRes);

  console.log(`Bob -> Alice Allowance: ${client.getAllowance(mock.ctx.currentContractState, bobAddress, aliceAddress)}\n`);

  // 7. Alice performs transferFrom Bob to Alice (spends 3,000 allowance)
  console.log('--- Step 4: Alice executes transferFrom (3,000 from Bob to Alice) ---');
  mock.ctx.currentPrivateState = { secretKey: aliceSecretKey };
  const transferFromRes = await client.transferFrom(
    mock.getCircuitContext(),
    aliceAddress,
    bobAddress,
    aliceAddress,
    3_000n
  );
  mock.applyResult(transferFromRes);

  console.log(`Alice Balance:          ${client.getBalance(mock.ctx.currentContractState, aliceAddress)}`);
  console.log(`Bob Balance:            ${client.getBalance(mock.ctx.currentContractState, bobAddress)}`);
  console.log(`Remaining Allowance:    ${client.getAllowance(mock.ctx.currentContractState, bobAddress, aliceAddress)}\n`);

  // 8. Emergency Stop: Pause the contract
  console.log('--- Step 5: Owner Pauses the contract ---');
  mock.ctx.currentPrivateState = { secretKey: ownerSecretKey };
  const pauseRes = await client.pause(mock.getCircuitContext(), ownerAddress);
  mock.applyResult(pauseRes);

  console.log(`Contract Paused: ${client.isPaused(mock.ctx.currentContractState)}\n`);

  // 9. Verify pause restriction (Alice attempting transfer while paused)
  console.log('--- Step 6: Testing transaction rejection when paused ---');
  try {
    mock.ctx.currentPrivateState = { secretKey: aliceSecretKey };
    await client.transfer(mock.getCircuitContext(), aliceAddress, bobAddress, 1_000n);
    console.error('ERROR: Transfer should have failed during pause!');
  } catch (err: any) {
    console.log(`Successfully caught expected error: ${err.message || err}\n`);
  }

  // 10. Unpause the contract
  console.log('--- Step 7: Owner Unpauses the contract ---');
  mock.ctx.currentPrivateState = { secretKey: ownerSecretKey };
  const unpauseRes = await client.unpause(mock.getCircuitContext(), ownerAddress);
  mock.applyResult(unpauseRes);

  console.log(`Contract Paused: ${client.isPaused(mock.ctx.currentContractState)}\n`);

  // 11. Burn tokens
  console.log('--- Step 8: Alice burns 2,000 units ---');
  mock.ctx.currentPrivateState = { secretKey: aliceSecretKey };
  const burnRes = await client.burn(mock.getCircuitContext(), aliceAddress, 2_000n);
  mock.applyResult(burnRes);

  console.log(`Alice Balance: ${client.getBalance(mock.ctx.currentContractState, aliceAddress)}`);
  console.log(`Total Supply:  ${client.getTotalSupply(mock.ctx.currentContractState)}\n`);

  console.log('================================================================');
  console.log('   All Fungible Token v2.2 SDK operations completed successfully! ');
  console.log('================================================================');
}

main().catch((err) => {
  console.error('Execution failed:', err);
  process.exit(1);
});