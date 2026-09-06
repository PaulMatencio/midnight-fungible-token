# Midnight Network DApp Frontend Architecture Prompt: FungibleToken

You are an expert full-stack Web3 engineer specializing in the **Midnight Network**, the **Compact smart contract runtime**, and modern **React 19 / Next.js (App Router)** frontend engineering.

A Midnight Compact smart contract called **`fungible-token`** has been compiled, tested, and prepared for deployment. All relevant contract artifacts, compiled TypeScript definitions, ZKIR circuit bytecodes, client SDK adapters, and deployment configurations are provided in this bundle.

---

## 📦 Bundled Project Artifacts Provided
- `contracts/fungible-token.compact`
- `contract/index.d.ts`
- `contract/index.js`
- `zkir/_approve.zkir`
- `zkir/_burn.zkir`
- `zkir/_mint.zkir`
- `zkir/_spendAllowance.zkir`
- `zkir/_transfer.zkir`
- `zkir/allowance.zkir`
- `zkir/approve.zkir`
- `zkir/balanceOf.zkir`
- `zkir/decimals.zkir`
- `zkir/initialize.zkir`
- `zkir/name.zkir`
- `zkir/symbol.zkir`
- `zkir/totalSupply.zkir`
- `zkir/transfer.zkir`
- `zkir/transferFrom.zkir`
- `sdk/fungible-token-sdk.ts`
- `docs/fungible-token-sdk.md`
- `examples/fungible-token-example.ts`
- `tests/fungible-token.test.ts`

---

## 🎯 Primary Goal
Scaffold and implement a complete, production-grade **React 19 / Next.js (App Router)** DApp client that interacts with the deployed **`FungibleToken`** smart contract on Midnight.

---

## 🏗️ Architecture Requirements

### 1. Technology Stack
- **Framework**: Next.js 15+ (App Router) / React 19
- **Midnight SDK**:
  - `@midnight-ntwrk/compact-runtime`
  - `@midnight-ntwrk/midnight-js-contracts`
  - `@midnight-ntwrk/midnight-js-fetch-zk-config-provider`
  - `@midnight-ntwrk/midnight-js-http-client-proof-provider`
  - `@midnight-ntwrk/midnight-js-indexer-public-data-provider`
  - `@midnight-ntwrk/midnight-js-level-private-state-provider` (or in-browser IndexedDB / LocalStorage adapter)
  - `@midnight-ntwrk/midnight-js-types`
- **State & Reactivity**: React Context + RxJS observables for live indexer contract state subscriptions.
- **Styling**: Modern dark-mode UI with Tailwind CSS or Vanilla CSS, Lucide React icons, and sleek feedback toasts.

---

### 2. Network & Deployment Configuration
Use the configuration specified in `deployment.config.json` (configured via `infrastructure/config/midnight-config.ts`):
- **Contract Name**: `fungible-token`
- **Contract Address**: `0000000000000000000000000000000000000000000000000000000000000000`
- **Network ID**: `preprod`
- **Indexer GraphQL Endpoint**: `https://indexer.preprod.midnight.network/api/v4/graphql`
- **Indexer WebSocket Endpoint**: `wss://indexer.preprod.midnight.network/api/v4/graphql/ws`
- **Node RPC Endpoint**: `https://rpc.preprod.midnight.network`
- **Proof Server Endpoint**: `http://127.0.0.1:6300`
- **Faucet Endpoint**: `https://faucet.preprod.midnight.network`
- **Block Explorer**: `https://explorer.1am.xyz`

---

### 3. Core Modules to Build

#### Module A: Midnight Wallet Connector (`WalletContext.tsx`)
- Inspects `window.midnight` for installed Midnight wallet extensions (such as Lace Midnight Wallet).
- Provides:
  - `connectWallet(walletName: string): Promise<void>`
  - `disconnectWallet(): void`
  - `isConnected: boolean`
  - `accountAddress: string | null`
  - `dustBalance: bigint | null`
  - `networkId: string`
- Displays a clean wallet connection modal if `window.midnight` is missing or disconnected.

#### Module B: Midnight Provider Assembly (`midnight-providers.ts`)
Assemble the 5 essential Midnight providers into a unified `MidnightProvider`:
1. **WalletProvider**: Derived from the connected Lace wallet instance via the DApp Connector API.
2. **PublicDataProvider**: Configured with `@midnight-ntwrk/midnight-js-indexer-public-data-provider` pointing to the Indexer GraphQL URL to query and subscribe to contract states.
3. **ProofProvider**: Configured with `@midnight-ntwrk/midnight-js-http-client-proof-provider` pointing to the proof server (`http://127.0.0.1:6300`) or delegated proving via Lace.
4. **ZKConfigProvider**: Serves the compiled ZKIR circuit bytecodes from `public/zkir/fungible-token/`.
5. **PrivateStateProvider**: In-browser local private state manager for storing off-chain witness data.

#### Module C: Contract Interaction Hooks (`useFungibleToken.ts`)
- **State Subscription Hook**: Subscribes to the on-chain ledger state via RxJS Observable and decodes it using the compiled `ledger()` function from `contract/index.js`.
- **Circuit Invocation Functions**:
  - Wrapper functions for each circuit declared in `fungible-token.compact`.
  - Automatically manages:
    1. Transaction balancing and fee estimation (DUST).
    2. Zero-Knowledge proof generation (with UI progress indicator).
    3. Block submission and confirmation polling.

#### Module D: UI Components & Dashboard
1. **Contract Overview Card**: Displays deployed contract address, network status, and live ledger fields.
2. **Interactive Circuit Actions**:
   - Clean forms with input validation for every circuit parameter.
   - Real-time feedback indicators:
     - `Preparing Transaction...`
     - `Generating Zero-Knowledge Proof (Client-side / Proof Server)...`
     - `Submitting to Midnight Blockchain...`
     - `Confirmed in Block #...`
3. **Activity & Audit Log**: Shows past interactions, transaction hashes, and error diagnostics.

---

### 4. Implementation Guidelines & Conventions
- **BigInt Safety**: In Compact runtime, all bounded integer parameters (`Uint<8>`, `Uint<32>`, `Uint<64>`) must be passed as `bigint` literals (e.g. `100n`).
- **Return Tuples**: Remember that Compact circuits with no explicit return value return the empty unit tuple `[]`.
- **Witnesses**: Off-chain witness functions in the runtime must strictly adhere to the 2-element tuple pattern `[nextPrivateState, witnessValue]`.
- **Client Artifact Paths**:
  - Place `contract/index.js` and `contract/index.d.ts` in `src/contracts/fungible-token/contract/`.
  - Place `zkir/*.zkir` in `public/zkir/fungible-token/` so they are accessible by HTTP fetch.
  - Import the client SDK adapter from `src/client/fungible-token-sdk.ts`.

Please build a complete, elegant, and fully functional DApp application following this specification!
