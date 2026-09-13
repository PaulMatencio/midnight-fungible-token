# Fungible Token v2.3 — Midnight Compact Smart Contract & DApp

[![Midnight Network](https://img.shields.io/badge/Midnight-Network-blue.svg)](https://midnight.network)
[![Compact Language](https://img.shields.io/badge/Compact-%3E%3D0.23-purple.svg)](https://docs.midnight.network)
[![Next.js](https://img.shields.io/badge/Next.js-15.2-black.svg)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19-blue.svg)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue.svg)](https://www.typescriptlang.org/)
[![Tests](https://img.shields.io/badge/Vitest-144%2F144%20Passing-brightgreen.svg)](https://vitest.dev/)

A zero-knowledge confidential smart contract and full-featured decentralized application (DApp) implementing an ERC-20-style Fungible Token on the **Midnight Network**. Built with **Compact** (`pragma language_version >= 0.23`), featuring zero-knowledge proof authentication, cross-contract replay protection, emergency circuit breakers, and administrative token reallocation.

> Built with Compact on Midnight Network.

---

## What's New in Compact v2.3

Fungible Token v2.3 introduces comprehensive operational security, emergency governance controls, and trapped-token rescue capabilities to the Compact smart contract:

### 1. Emergency Stop (Pausable Circuit Breaker)
- **Pause & Unpause**: The contract owner or designated emergency pauser can freeze token operations during security incidents or contract upgrades.
- **Circuit Protection**: Standard token actions (`transfer`, `approve`, `transferFrom`, `mint`, and `burn`) are guarded with the `whenNotPaused()` modifier.
- **Role Delegation**: An optional `_emergencyPauser` address can be configured by the owner (`setEmergencyPauser`), enabling dedicated operations keys without exposing the primary owner key.

### 2. Trapped Token Reallocation (`adminReallocate`)
- In private zero-knowledge contracts, tokens sent to unspendable or legacy derived account keys can become permanently trapped.
- `adminReallocate(caller, trappedAccount, targetSpendableAccount, amount)` enables the contract owner to reallocate blocked balances to a verified spendable address.

### 3. Emergency Contract Withdrawal (`emergencyWithdraw`)
- Allows the owner to recover tokens held directly by the contract's own account (derived deterministically via `kernel.self()`).
- Strictly restricted to execution **only when paused** (`whenPaused()`) and routes recovered funds directly to the registered owner treasury.

### 4. Strict Supply Cap Management
- Configurable `_maxSupply` with arithmetic overflow/underflow checks on `Uint<128>`.
- Real-time supply cap metering and dynamic "Max Mintable" calculation in the user interface.

---

## Smart Contract Architecture

### Ledger State (`fungible-token-v2-3.compact`)

```typescript
// Ledger state declarations
export ledger _balances: Map<Bytes<32>, Uint<128>>;
export ledger _allowances: Map<[Bytes<32>, Bytes<32>], Uint<128>>;
export ledger _totalSupply: Uint<128>;
export ledger _maxSupply: Uint<128>;
export ledger _name: Opaque<"string">;
export ledger _symbol: Opaque<"string">;
export ledger _decimals: Uint<8>;
export ledger owner: Bytes<32>;
export ledger _contractSalt: Bytes<32>;

// Emergency Stop State (v2.3)
export ledger _paused: Boolean;
export ledger _emergencyPauser: Bytes<32>;
```

### Zero-Knowledge Authentication & Replay Protection

Caller authentication does not reveal secret keys on-chain. Callers prove possession of a secret key via a private witness, salted with the contract's unique deployment salt:

```typescript
witness localSecretKey(): Bytes<32>;

circuit authenticate(account: Bytes<32>): [] {
  const sk = localSecretKey();
  const domainTag = pad(32, "fungible-token:auth");
  const derivedAccount = persistentHash<[Bytes<32>, Bytes<32>, Bytes<32>]>([
    domainTag,
    _contractSalt,
    sk
  ]);
  assert(derivedAccount == account, "FungibleToken: caller authorization failed");
}
```

---

## Circuit Reference

| Circuit | Visibility | Guard / Modifiers | Description |
|---|---|---|---|
| `transfer(caller, to, value)` | `export` | `authenticate`, `whenNotPaused` | Transfers `value` tokens from `caller` to `to`. |
| `approve(caller, spender, value)` | `export` | `authenticate`, `whenNotPaused` | Authorizes `spender` to withdraw up to `value` tokens. |
| `transferFrom(caller, fromAccount, to, value)` | `export` | `authenticate`, `whenNotPaused` | Transfers tokens using an existing spender allowance. |
| `mint(to, value)` | `export` | `onlyOwner`, `whenNotPaused` | Mints new tokens to `to` up to `_maxSupply`. |
| `burn(caller, value)` | `export` | `authenticate`, `whenNotPaused` | Burns `value` tokens from `caller`, reducing total supply. |
| `pause(caller)` | `export` | `onlyPauser`, `whenNotPaused` | Halts transfers, mints, burns, and approvals. |
| `unpause(caller)` | `export` | `onlyPauser`, `whenPaused` | Restores normal token operations. |
| `setEmergencyPauser(caller, newPauser)` | `export` | `onlyOwner` | Designates or rotates the emergency pauser role. |
| `adminReallocate(caller, trapped, target, amount)` | `export` | `onlyOwner` | Rescues tokens from an inaccessible account. |
| `emergencyWithdraw(caller, token, amount)` | `export` | `onlyOwner`, `whenPaused` | Withdraws contract-held tokens to the owner. |

---

## Frontend DApp Cockpit

The web interface is built with **Next.js 15**, **React 19**, and **Tailwind CSS**, providing a comprehensive cockpit:

- **Overview Tab**: Live aggregate metrics, minted supply progress meter, percentage cap utilization, and contract identifiers.
- **Circuits & Actions Cockpit**:
  - **Category Cards**: Grouped into *Transfers*, *Mint & Supply*, *Allowances*, and *Emergency & Admin Controls*.
  - **Live Supply Meter**: Visual meter in the Mint card with a 1-click **"Max Mintable"** autofill button.
  - **Dual Mode Support**:
    - **Test Mode**: In-browser simulator with 5 preset identities (Alice, Bob, Charlie, Dave, Eve).
    - **Lace Mode**: Live on-chain interaction with the Midnight Lace wallet extension (Preprod / Preview / Devnet).
- **Ledger & Holders Viewer**: Decodes raw on-chain state, displays token distribution with percentage shares, and provides spendable address derivation.
- **Audit Log / Activity**: Live on-chain transaction history with real transaction hashes and block confirmation metrics.
- **Settings & Appearance**: Adaptive **Dark & Light Theme** system with zero-flash hydration and high-contrast styling.

---

## Project Structure

```
├── contracts/
│   ├── fungible-token-v2-3.compact    # Canonical Compact v2.3 smart contract
│   ├── fungible-token-v2-2.compact    # Previous v2.2 contract reference
│   └── fungible-token.compact         # Active compiler target
├── src/
│   ├── infrastructure/
│   │   └── midnight/
│   │       ├── midnight-dapp-connector.ts  # Lace wallet connector & adapters
│   │       └── midnight-indexer-client.ts  # GraphQL indexer client
│   └── presentation/
│       ├── components/                # UI Cockpit cards, tables, meters & nav
│       ├── context/                   # Wallet, Config, and Theme providers
│       └── hooks/
│           └── useFungibleToken.ts    # Unified contract lifecycle hook
├── app/                               # Next.js App Router root layout & page
├── tests/                             # Vitest test suite (144 unit & integration tests)
├── deployment.config.json             # Network & contract connection parameters
└── package.json
```

---

## Getting Started

### Prerequisites
- **Node.js**: `v20.x` or `v22.x`
- **npm**: `v10.x` or higher
- **Lace Wallet Extension**: Installed in Chrome/Brave (for live on-chain Lace mode)

### 1. Install Dependencies
```bash
npm install
```

### 2. Run the Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

### 3. Run the Test Suite
```bash
npm run test
```
Executes the full test suite with Vitest (144 passing tests):
```bash
npx vitest run
```

### 4. Run TypeScript Type Check
```bash
npm run typecheck
```

### 5. Build for Production
```bash
npm run build
npm run start
```

---

## Connecting Lace Wallet

1. Open your browser with the **Midnight Lace Extension** installed.
2. Select the target network in Lace settings (**Preprod**, **Preview**, or local **Undeployed**).
3. Ensure your wallet holds **tNIGHT** and has generated **tDUST** for transaction fees.
4. Click **"Connect Lace"** in the top navigation bar of the DApp.
5. Authorize the connection when prompted by Lace.

---

## License

This project is licensed under the [MIT License](LICENSE).
