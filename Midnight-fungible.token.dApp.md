# Implementation Plan - Midnight FungibleToken DApp

Scaffold and build a complete, production-grade **React 19 / Next.js (App Router)** DApp client for the **`FungibleToken`** Compact smart contract on Midnight Network, strictly fulfilling all requirements in [`GEMINI_DAPP_PROMPT.md`](file:///home/paul/compact/fungible-token/GEMINI_DAPP_PROMPT.md).

---

## User Review Required

> [!IMPORTANT]
> - **SDK & Runtime Versions**: We will use Next.js 15+ / React 19 alongside Midnight JS 4.1.1 and `@midnight-ntwrk/compact-runtime` (compatible with the compiled `contract/index.js` and `zkir/*.zkir` artifacts).
> - **Dual Wallet Mode**: In addition to standard `window.midnight` Lace wallet injection via the DApp Connector API, we will provide an integrated **Interactive Dev/Simulated Wallet Mode** with pre-funded identities (Alice, Bob, Charlie, Deployer) so the DApp can be fully experienced, previewed, and tested directly in browsers without requiring Lace installed locally.
> - **Artifact Relocation**: Per prompt specifications, contract definitions will be located at `src/contracts/fungible-token/contract/` and circuit bytecodes served statically at `public/zkir/fungible-token/*.zkir`.

---

## Proposed Architecture & Directory Structure

```
fungible-token/
├── public/
│   └── zkir/
│       └── fungible-token/       # All 15 .zkir circuit bytecodes served for FetchZkConfigProvider
├── src/
│   ├── contracts/
│   │   └── fungible-token/
│   │       └── contract/
│   │           ├── index.js      # Compiled Compact JavaScript runtime contract definition
│   │           └── index.d.ts    # Compact TypeScript types (Ledger, Circuits, Contract)
│   ├── client/
│   │   └── fungible-token-sdk.ts # Strongly-typed FungibleTokenClient adapter
│   ├── infrastructure/
│   │   └── config/
│   │       └── midnight-config.ts# Centralized network endpoints, contract addresses, & explorer URLs
│   ├── presentation/
│   │   ├── context/
│   │   │   ├── WalletContext.tsx # Lace browser extension & simulated wallet state provider
│   │   │   └── ToastContext.tsx  # Sleek feedback notifications
│   │   ├── hooks/
│   │   │   ├── useFungibleToken.ts # Contract state subscription (RxJS) & circuit invocation handlers
│   │   │   └── useClipboard.ts
│   │   └── components/
│   │       ├── Header.tsx        # Top navbar with network status, DUST balance, wallet modal toggle
│   │       ├── ContractOverview.tsx # Metadata cards, total supply, address badges, explorer link
│   │       ├── WalletModal.tsx   # Lace connection & test identity selector modal
│   │       ├── TokenActions.tsx  # Tabs for Transfer, Approve, TransferFrom, Mint, Burn, Queries
│   │       ├── QueryViewer.tsx   # BalanceOf & Allowance dynamic lookup tool
│   │       ├── TransactionStepper.tsx # Real-time 4-step progress modal (Balancing -> Proving -> Submitting -> Confirmed)
│   │       └── ActivityLog.tsx   # Interactive audit trail of executed circuits and hashes
│   ├── providers/
│   │   ├── midnight-providers.ts # 5-part Midnight provider assembly (Wallet, PublicData, Proof, ZKConfig, PrivateState)
│   │   └── in-memory-private-state-provider.ts # In-browser local private state store
│   └── types/
│       └── dapp.ts               # Transaction, Wallet, and Circuit DTO definitions
├── app/
│   ├── layout.tsx                # Dark-mode root layout with Toast & Wallet Providers
│   ├── page.tsx                  # Primary FungibleToken DApp dashboard
│   └── globals.css               # Modern glassmorphism dark-theme styling
├── next.config.mjs               # WebAssembly, topLevelAwait, and external server package configuration
├── tailwind.config.mjs
├── tsconfig.json
├── package.json
└── deployment.config.json
```

---

## Proposed Changes

### Configuration & Package Infrastructure

#### [NEW] [package.json](file:///home/paul/compact/fungible-token/package.json)
Configure dependencies matching `@midnight-ntwrk/*` 4.1.1, `compact-runtime`, `next`, `react 19`, `rxjs`, `lucide-react`, `tailwindcss`, `vitest`.

#### [NEW] [next.config.mjs](file:///home/paul/compact/fungible-token/next.config.mjs)
Enable `asyncWebAssembly`, `topLevelAwait`, Webpack fallbacks (`fs`, `crypto`, etc. disabled on client), and `serverExternalPackages` for Midnight packages.

#### [NEW] [tailwind.config.mjs](file:///home/paul/compact/fungible-token/tailwind.config.mjs) & [postcss.config.mjs](file:///home/paul/compact/fungible-token/postcss.config.mjs)
Set up modern dark theme palette (Midnight blue/slate/emerald/cyan).

#### [NEW] [tsconfig.json](file:///home/paul/compact/fungible-token/tsconfig.json)
TypeScript configuration targeting ES2022 with bundler module resolution and `@/*` path aliases.

---

### Module A: Wallet & DApp Connector (`WalletContext.tsx`)

#### [NEW] [src/presentation/context/WalletContext.tsx](file:///home/paul/compact/fungible-token/src/presentation/context/WalletContext.tsx)
- Inspects `window.midnight` for installed Midnight extensions (Lace).
- Provides `connectWallet`, `disconnectWallet`, `isConnected`, `accountAddress`, `dustBalance`, `networkId`.
- Includes fallback Simulated/Dev wallet identities (Alice, Bob, Charlie) with valid 32-byte Bech32/Hex keys so the entire DApp is 100% testable out-of-the-box.
- Periodic balance & DUST sync.

#### [NEW] [src/infrastructure/midnight/midnight-dapp-connector.ts](file:///home/paul/compact/fungible-token/src/infrastructure/midnight/midnight-dapp-connector.ts)
- DApp Connector API v4 bridge handling `getUnshieldedBalances`, `getDustBalance`, `getShieldedBalances`, `state`, and formatting to human-readable DUST and tNIGHT.

---

### Module B: Midnight Provider Assembly (`midnight-providers.ts`)

#### [NEW] [src/providers/midnight-providers.ts](file:///home/paul/compact/fungible-token/src/providers/midnight-providers.ts)
Assemble the 5 essential Midnight providers into `MidnightProviders`:
1. `WalletProvider`: Lace wallet instance with `balanceTx`, `submitTx`, `getCoinPublicKey`, `getEncryptionPublicKey` (or simulated provider).
2. `PublicDataProvider`: Configured with `@midnight-ntwrk/midnight-js-indexer-public-data-provider` pointing to Preprod GraphQL & WS URLs.
3. `ProofProvider`: Configured with `@midnight-ntwrk/midnight-js-http-client-proof-provider` pointing to `http://127.0.0.1:6300` (or delegated proving).
4. `ZKConfigProvider`: Configured with `FetchZkConfigProvider` fetching compiled `.zkir` from `/zkir/fungible-token/`.
5. `PrivateStateProvider`: In-browser localStorage / IndexedDB provider for persistent client witness states.

#### [NEW] [src/infrastructure/config/midnight-config.ts](file:///home/paul/compact/fungible-token/src/infrastructure/config/midnight-config.ts)
Reads and exposes endpoints from `deployment.config.json`.

---

### Module C: Contract Interaction Hooks (`useFungibleToken.ts`)

#### [NEW] [src/presentation/hooks/useFungibleToken.ts](file:///home/paul/compact/fungible-token/src/presentation/hooks/useFungibleToken.ts)
- Subscribes to live contract ledger state via RxJS Observable and decodes it using `ledger(state)`.
- Implements circuit invocation handlers with comprehensive parameter validation and BigInt safety:
  - `initialize(name, symbol, decimals)`
  - `transfer(toHex, amount)`
  - `approve(spenderHex, amount)`
  - `transferFrom(fromHex, toHex, amount)`
  - `mint(accountHex, amount)`
  - `burn(accountHex, amount)`
  - `balanceOf(accountHex)`
  - `allowance(ownerHex, spenderHex)`
- Tracks multi-phase transaction execution status:
  - `idle` -> `preparing` -> `proving` -> `submitting` -> `confirmed` (or `error`).

#### [NEW] [src/client/fungible-token-sdk.ts](file:///home/paul/compact/fungible-token/src/client/fungible-token-sdk.ts)
Client SDK adapted to import from local contract artifacts with full typing.

#### [NEW] [src/contracts/fungible-token/contract/index.js](file:///home/paul/compact/fungible-token/src/contracts/fungible-token/contract/index.js) & [index.d.ts](file:///home/paul/compact/fungible-token/src/contracts/fungible-token/contract/index.d.ts)
Copied and placed in client path.

#### [NEW] [public/zkir/fungible-token/*.zkir](file:///home/paul/compact/fungible-token/public/zkir/fungible-token/)
All 15 compiled `.zkir` circuit files copied into public static directory.

---

### Module D: UI Components & Dashboard

#### [NEW] [src/presentation/components/Header.tsx](file:///home/paul/compact/fungible-token/src/presentation/components/Header.tsx)
Top navigation with Midnight Preprod indicator, DUST balance pill, address copy button, and wallet connect trigger.

#### [NEW] [src/presentation/components/ContractOverview.tsx](file:///home/paul/compact/fungible-token/src/presentation/components/ContractOverview.tsx)
Displays Token Name, Symbol, Decimals, Total Supply, Initialization state, Contract Address with block explorer link.

#### [NEW] [src/presentation/components/TokenActions.tsx](file:///home/paul/compact/fungible-token/src/presentation/components/TokenActions.tsx)
Tabbed interface for:
- **Transfer**: Direct P2P transfer
- **Approve**: Set spender allowances
- **TransferFrom**: Delegated transfer execution
- **Mint & Burn**: Administrative supply management
- **Initialize**: First-time initialization widget

#### [NEW] [src/presentation/components/QueryViewer.tsx](file:///home/paul/compact/fungible-token/src/presentation/components/QueryViewer.tsx)
Read-only queries for querying arbitrary account balances and owner-spender allowances.

#### [NEW] [src/presentation/components/TransactionStepper.tsx](file:///home/paul/compact/fungible-token/src/presentation/components/TransactionStepper.tsx)
Real-time modal stepper visualizing the 4 stages of Midnight ZK-SNARK transactions.

#### [NEW] [src/presentation/components/ActivityLog.tsx](file:///home/paul/compact/fungible-token/src/presentation/components/ActivityLog.tsx)
Audit log tracking circuit invocations, transaction hashes, timestamps, and status with block explorer link.

#### [NEW] [app/page.tsx](file:///home/paul/compact/fungible-token/app/page.tsx) & [app/layout.tsx](file:///home/paul/compact/fungible-token/app/layout.tsx)
Assembles the complete dark-mode, responsive Web3 application.

---

## Verification Plan

### Automated Verification
1. **Dependency Installation & Typecheck**:
   ```bash
   npm install
   npx tsc --noEmit
   ```
2. **Contract Logic Unit Tests**:
   Run Vitest to verify all circuits and simulated flows pass:
   ```bash
   npx vitest run
   ```
3. **Next.js Production Build**:
   ```bash
   npm run build
   ```

### Manual / Browser Verification
1. Launch development server:
   ```bash
   npm run dev
   ```
2. Verify:
   - DApp loads cleanly on `http://localhost:3000` with dark-mode aesthetic.
   - Wallet connection modal works in both extension and test identity modes.
   - Static ZKIR circuits are accessible via HTTP fetch at `/zkir/fungible-token/initialize.zkir` etc.
   - Circuit parameter forms perform input validation (32-byte hex addresses, positive integer amounts).
   - Transaction stepper displays the 4-phase lifecycle on circuit invocation.
   - Ledger state queries display correctly.
