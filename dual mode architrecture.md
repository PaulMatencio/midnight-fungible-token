# Dual Mode Architecture: Lace Wallet & Test Mode (No Wallet)

Implement a robust, production-grade Dual Mode architecture for the **Midnight FungibleToken DApp** that fully implements **Modules A, B, C, and D** as specified in [`GEMINI_DAPP_PROMPT.md`](file:///home/paul/compact/fungible-token/GEMINI_DAPP_PROMPT.md), supporting:
1. **Lace Wallet Mode** (`mode: 'lace'`): Real browser extension interaction via the Midnight DApp Connector API (`window.midnight.mnLace`), assembling the 5 Midnight providers, querying live balances, managing real transaction balancing and proving, and subscribing to contract state.
2. **Test Mode (No Wallet)** (`mode: 'test'`): Fully functional zero-wallet simulation with preset identities (Alice, Bob, Charlie, Deployer), simulated ledger state, and 4-step transaction stepper for local development and demonstration.

---

## User Review Required

> [!IMPORTANT]
> - **Dual Mode Toggle**: Users can switch seamlessly between **Lace Wallet Mode** and **Test Mode (No Wallet)** directly from the top navigation bar or the Wallet Manager modal.
> - **Lace Detection**: If `window.midnight` or Lace is not detected when selecting Lace Mode, the modal provides download guidance while offering an immediate one-click fallback to Test Mode.
> - **Real Provider Pipeline**: In Lace Mode, `midnight-providers.ts` builds the official `@midnight-ntwrk/*` provider suite (`WalletProvider`, `PublicDataProvider`, `ProofProvider`, `ZKConfigProvider`, `PrivateStateProvider`).

---

## Proposed Changes

### Module A: Midnight Wallet Connector

#### [MODIFY] [src/infrastructure/midnight/midnight-dapp-connector.ts](file:///home/paul/compact/fungible-token/src/infrastructure/midnight/midnight-dapp-connector.ts)
- Add discovery of all installed Midnight extensions in `window.midnight` (`detectInstalledWallets()`).
- Implement standard DApp Connector API wrapper for `mnLace` (and generic Midnight wallets):
  - `enable()` connection flow with rejection and error handling.
  - Robust balance fetching: `getDustBalance()` (converting from Lovelace/DUST atomic units to display DUST) and `getUnshieldedBalances()` (tNIGHT).
  - Address extraction: `getUnshieldedAddress()`, `state()`, `getCoinPublicKey()`, `getEncryptionPublicKey()`.
  - Create adapter converting `ConnectedAPI` into `@midnight-ntwrk/midnight-js-types` `WalletProvider` & `MidnightProvider`.

#### [MODIFY] [src/presentation/context/WalletContext.tsx](file:///home/paul/compact/fungible-token/src/presentation/context/WalletContext.tsx)
- Add `mode: 'lace' | 'test'` and `setMode: (mode: 'lace' | 'test') => void`.
- When in `mode === 'lace'`:
  - Connects to `window.midnight.mnLace`.
  - Keeps live connection status, account address, network ID, and polled balances.
  - Automatically reacts to account/network changes if supported by the extension.
- When in `mode === 'test'`:
  - Preserves preset identities (Alice, Bob, Charlie, Deployer) with mock DUST & tNIGHT.
- Expose clear helpers: `isLaceMode`, `isTestMode`, `installedWallets`, `connectLaceWallet()`.

---

### Module B: Midnight Provider Assembly

#### [MODIFY] [src/providers/midnight-providers.ts](file:///home/paul/compact/fungible-token/src/providers/midnight-providers.ts)
- Assemble the 5 Midnight providers into `MidnightProviders` as required by `@midnight-ntwrk/midnight-js-contracts`:
  1. `walletProvider`: Lace wallet provider adapter with `balanceTx`, `getCoinPublicKey`, `getEncryptionPublicKey`.
  2. `midnightProvider`: Lace submission provider with `submitTx`.
  3. `publicDataProvider`: `indexerPublicDataProvider` connected to Preprod GraphQL and WS.
  4. `proofProvider`: `httpClientProofProvider` pointing to proof server (`http://127.0.0.1:6300`) or delegated proving.
  5. `zkConfigProvider`: `FetchZkConfigProvider` pointing to `/zkir/fungible-token`.
  6. `privateStateProvider`: Persistent browser private state provider.
- Provide health-check utility for proof server and indexer connectivity to display infrastructure status badges.

---

### Module C: Contract Interaction Hooks

#### [MODIFY] [src/presentation/hooks/useFungibleToken.ts](file:///home/paul/compact/fungible-token/src/presentation/hooks/useFungibleToken.ts)
- Integrate dual-mode execution:
  - **Lace Mode**:
    - Creates or accesses the assembled `MidnightProviders`.
    - Subscribes to contract ledger state via RxJS Observable using `publicDataProvider` and decodes using `ledger(state)`.
    - When invoking circuits (`initialize`, `transfer`, `approve`, `transferFrom`, `mint`, `burn`), runs the 4-phase transaction flow (`preparing` -> `proving` -> `submitting` -> `confirmed`) with real parameters and BigInt safety.
    - If contract address is not yet deployed on Preprod or proof server is unreachable, provides clear diagnostic messages with guidance to switch to Test Mode.
  - **Test Mode**:
    - Retains offline Compact runtime simulation with Alice, Bob, and Charlie.
    - Accurately executes state transitions, updates balances, and drives the 4-stage stepper.
- Implement all circuits and queries with full validation and formatting.

---

### Module D: UI Components & Dashboard

#### [MODIFY] [src/presentation/components/Header.tsx](file:///home/paul/compact/fungible-token/src/presentation/components/Header.tsx)
- Add Mode Switcher toggle right in the header:
  - Switch between **🟢 Lace Wallet Mode** and **🧪 Test Mode (No Wallet)**.
  - Status pill showing wallet connection status or active test identity.
  - DUST and tNIGHT balance badges.

#### [MODIFY] [src/presentation/components/WalletModal.tsx](file:///home/paul/compact/fungible-token/src/presentation/components/WalletModal.tsx)
- Tabbed interface:
  - **Tab 1: Lace Midnight Wallet**: Connect to browser extension, view installation status, download link if missing, switch to test mode button.
  - **Tab 2: Test Mode (No Wallet)**: Select between Alice, Bob, Charlie, Deployer.

#### [MODIFY] [src/presentation/components/ContractOverview.tsx](file:///home/paul/compact/fungible-token/src/presentation/components/ContractOverview.tsx)
- Display active mode badge (`Lace Wallet Mode` vs `Test Mode`).
- Display user's token balance (formatted with decimals).
- Token metadata (Name, Symbol, Decimals, Total Supply, Initialized status).
- Contract address with copy button and Preprod explorer link.

#### [MODIFY] [src/presentation/components/TokenActions.tsx](file:///home/paul/compact/fungible-token/src/presentation/components/TokenActions.tsx)
- Quick recipient autofill buttons ("Send to Bob", "Send to Charlie").
- Real-time allowance indicator on `TransferFrom` tab.
- Form validation and disabled states during transaction execution.

#### [MODIFY] [src/presentation/components/TransactionStepper.tsx](file:///home/paul/compact/fungible-token/src/presentation/components/TransactionStepper.tsx)
- Real-time 4-step progress modal:
  1. Preparing Transaction
  2. Generating Zero-Knowledge Proof
  3. Submitting to Midnight Blockchain
  4. Confirmed in Block #
- Clickable block explorer link for transaction hash.

#### [MODIFY] [app/page.tsx](file:///home/paul/compact/fungible-token/app/page.tsx)
- Assemble components and pass down mode and state handlers cleanly.

---

## Verification Plan

### Automated Tests
```bash
# Run Vitest test suite for contract logic
npm test

# Run TypeScript type check
npm run typecheck

# Run Next.js production build
npm run build
```

### Manual Verification
1. Open DApp at `http://localhost:3000`.
2. Verify **Test Mode (No Wallet)**:
   - Initialized with Alice having tokens and DUST.
   - Execute a `Transfer` of 500 MFT from Alice to Bob.
   - Verify 4-step stepper progresses through Preparing -> Proving -> Submitting -> Confirmed.
   - Verify Bob's balance updates in `QueryViewer` and Activity Log records the transaction.
3. Verify **Lace Wallet Mode**:
   - Click "Switch to Lace Mode" in Header or Wallet Modal.
   - If Lace is installed, click Connect and verify addresses and balances populate.
   - If Lace is not installed, verify download banner and fallback button work smoothly.
