# Walkthrough: Upgrading DApp to FungibleTokenV22 (v2.2) with Emergency Stop & Persistent Authentication

We have upgraded the Midnight Fungible Token DApp to **FungibleTokenV22** (`fungible-token-v2-2.compact`), incorporating:
1. **Contract Initialization via Constructor**: Includes `maxSupply` hard cap and initial owner assignment.
2. **Persistent Domain-Separated Cryptographic Authentication**: Prover validates possession of `localSecretKey()` witness matching the caller address via `persistentHash(['fungible-token:auth', kernel.self(), sk])`.
3. **Emergency Stop System**: `pause(caller)`, `unpause(caller)`, `paused()`, `setEmergencyPauser(caller, newPauser)`, and `emergencyWithdraw(caller, token, amount)` circuits.
4. **Composite Allowance Keys**: `_allowances: Map<[Bytes<32>, Bytes<32>], Uint<128>>`.
5. **Live Preprod Integration**: Connected to deployed contract `14f654c7f13a204cb6365fde37b4b6b35cc838b0ab20ec076dc074705494a6a2` on Midnight Preprod (Euro Token `EUT`).
6. **Full Test Suite & Zero TypeScript Errors**: 62/62 vitest tests passing; 0 TypeScript errors.

---

## Key Highlights & Changes

### 1. Contract Artifacts & Deployed Configuration
- **Contract Name**: `fungible-token-v2-2`
- **Contract Address**: `14f654c7f13a204cb6365fde37b4b6b35cc838b0ab20ec076dc074705494a6a2`
- **On-Chain Token Info**:
  - Name: `Euro Token`
  - Symbol: `EUT`
  - Decimals: `6`
  - Max Supply: `2,000,000` EUT (`2,000,000,000,000n`)
  - Owner: `2a226a5a9646c3cb7f71a4b1a648afba3bc09cb29f566f4216d88299917f3489` (matches user's wallet address `mn_addr_preprod19g3x5k5kgmpuklm35jc6vj90hgaup89jnatx7sskmzpfnytlxjysw0wln8`)
- **Artifacts Installed**:
  - `contracts/fungible-token-v2-2.compact` & `contracts/fungible-token.compact`
  - `zkir/` and `public/zkir/fungible-token/`: all 16 `.zkir` and `.bzkir` circuit files (`allowance`, `approve`, `balanceOf`, `burn`, `decimals`, `emergencyWithdraw`, `maxSupply`, `mint`, `name`, `pause`, `paused`, `setEmergencyPauser`, `symbol`, `totalSupply`, `transfer`, `transferFrom`, `unpause`)
  - `contract/` and `src/contracts/fungible-token/contract/`: compiled Compact JS/TS definitions with backward-compatible safe accessors for `_paused` and `_emergencyPauser`.
  - [deployment.config.json](file:///home/paul/compact/fungible-token/deployment.config.json) updated with the new contract address and name.

---

### 2. Client SDK & Hook Upgrades

- **[fungible-token-sdk.ts](file:///home/paul/compact/fungible-token/src/client/fungible-token-sdk.ts)** & **[sdk/fungible-token-sdk.ts](file:///home/paul/compact/fungible-token/sdk/fungible-token-sdk.ts)**:
  - Added default `localSecretKey(ctx)` witness reading caller's secret key from private state.
  - Implemented client wrappers for new circuits: `maxSupply`, `paused`, `pause`, `unpause`, `setEmergencyPauser`, and `emergencyWithdraw`.
  - Updated `initialState(context, initialOwner, name, symbol, decimals, maxSupply)`.
- **[useFungibleToken.ts](file:///home/paul/compact/fungible-token/src/presentation/hooks/useFungibleToken.ts)**:
  - Updated metadata extraction to include `maxSupply`, `isPaused`, `emergencyPauser`, and `isCallerPauser`.
  - Updated composite key allowance query `[ownerBytes, spenderBytes]`.
  - Added `pause()`, `unpause()`, `setEmergencyPauser(newPauser)`, and `emergencyWithdraw(amount, token)` callbacks.
  - Removed client-side preemptive blocking on all circuits so the Compact smart contract itself rejects unauthorized or invalid operations on-chain.

---

### 3. UI Presentation Layer Enhancements

- **[ContractOverview.tsx](file:///home/paul/compact/fungible-token/src/presentation/components/ContractOverview.tsx)**:
  - Added **Max Supply Cap** stat card displaying formatted supply ceiling (`2,000,000.0000 EUT`) or `Uncapped`.
  - Added **Contract Status Badge** in the top bar: `ACTIVE` in emerald or `PAUSED (Emergency Stop)` in rose with pulse animation.
  - Added **Emergency Pauser** card with Bech32/Hex display, quick copy button, and `"You"` badge when the connected wallet holds the pauser role.
- **[TokenActions.tsx](file:///home/paul/compact/fungible-token/src/presentation/components/TokenActions.tsx)**:
  - Added a dedicated **Emergency** tab with 3 sub-panels:
    1. **Emergency Breaker (Pause / Unpause)**: Shows real-time pause status with toggle button to execute `pause(caller)` or `unpause(caller)`.
    2. **Designate Emergency Pauser**: Allows contract owner to designate or rotate the emergency pauser address (`setEmergencyPauser(caller, newPauser)`).
    3. **Emergency Withdrawal to Owner**: Allows owner to withdraw tokens from the contract to the owner's treasury when the contract is paused (`emergencyWithdraw(caller, token, amount)`).
  - Added a prominent amber/rose banner whenever `metadata.isPaused` is true, informing users that transfer, approval, mint, and burn circuits are suspended by the contract.
  - Updated the `mint` tab circuit label to `mint(to, value)`.
- **[app/page.tsx](file:///home/paul/compact/fungible-token/app/page.tsx)**:
  - Wired `pause`, `unpause`, `setEmergencyPauser`, and `emergencyWithdraw` from `useFungibleToken()` into `<TokenActions>`.

---

## Verification Results

### 1. Vitest Test Suite (62/62 Tests Passed)
Ran `npm test`:
```
 ✓ tests/fungible-token.test.ts (35 tests) 917ms
 ✓ tests/modules.test.ts (27 tests) 212ms

 Test Files  2 passed (2)
      Tests  62 passed (62)
   Duration  1.41s
```
- **35/35** tests in [tests/fungible-token.test.ts](file:///home/paul/compact/fungible-token/tests/fungible-token.test.ts) covering:
  - Contract initialization & metadata (`name`, `symbol`, `decimals`, `maxSupply`, `totalSupply`, `paused`).
  - Cryptographic authentication failure when secret key does not match caller account.
  - Minting permissions, zero-address checks, and maxSupply cap overflow enforcement.
  - Token transfers, self-transfers, insufficient balance rejections.
  - Approvals & allowances.
  - Delegated `transferFrom` with allowance reduction and `MAX_UINT128` infinite allowance.
  - Token burning by token holders.
  - Emergency Pause/Unpause transitions and operation blocking when paused.
  - Emergency Pauser role delegation.
  - Emergency withdrawal constraints (enforced only when paused).
- **27/27** tests in [tests/modules.test.ts](file:///home/paul/compact/fungible-token/tests/modules.test.ts) covering:
  - DApp connector wallet detection, locked state handling, channel shutdown recovery.
  - LocalStorage state serialization and deserialization across browser reloads.
  - Direct circuit access control and rejection on unauthorized callers.

### 2. TypeScript Compilation
Ran `npx tsc --noEmit`:
- **0 errors** across all project source files.

### 3. Live Dev Server
- Dev server is running and hot-reloading at `http://localhost:3000` (HTTP 200 OK).
