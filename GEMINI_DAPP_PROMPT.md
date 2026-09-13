# Midnight Network DApp Frontend Architecture Prompt: FungibleTokenV2_2

You are an expert full-stack Web3 engineer and UI/UX designer specializing in the **Midnight Network**, the **Compact smart contract runtime**, modern **React 19 / Next.js 15+ (App Router)** frontend engineering, and world-class **UI/UX design**.

A Midnight Compact smart contract called **`fungible-token-v2-2`** has been compiled, tested, and deployed to the **preprod** network. All relevant contract artifacts, compiled TypeScript definitions, ZKIR circuit bytecodes, client SDK adapters, and deployment configurations are provided in this directory.

---

## 📦 Bundled Project Artifacts Provided
- `contracts/fungible-token-v2-2.compact`
- `contract/index.d.ts`
- `contract/index.js`
- `zkir/approve.bzkir`
- `zkir/approve.zkir`
- `zkir/burn.bzkir`
- `zkir/burn.zkir`
- `zkir/emergencyWithdraw.bzkir`
- `zkir/emergencyWithdraw.zkir`
- `zkir/mint.bzkir`
- `zkir/mint.zkir`
- `zkir/pause.bzkir`
- `zkir/pause.zkir`
- `zkir/setEmergencyPauser.bzkir`
- `zkir/setEmergencyPauser.zkir`
- `zkir/transfer.bzkir`
- `zkir/transfer.zkir`
- `zkir/transferFrom.bzkir`
- `zkir/transferFrom.zkir`
- `zkir/unpause.bzkir`
- `zkir/unpause.zkir`
- `sdk/fungible-token-v2-2-sdk.ts`
- `sdk/fungible-token-v2-2-types.ts`
- `deployment.config.json`
- `deployment.json`
- `tests/fungible-token-v2-2.test.ts`
- `IMPLEMENTATION_PLAN.md`

---

## 🎯 Primary Goal
Implement, polish, and verify the **React 19 / Next.js (App Router)** DApp client in `/home/paul/compact/fungible-token` to interact seamlessly with the deployed **`fungible-token-v2-2`** smart contract on Midnight Preprod.

Specifically:
1. Support all contract circuits:
   - `mint(to: Bytes<32>, value: Uint<128>): Boolean` (Owner authorized)
   - `transfer(to: Bytes<32>, value: Uint<128>): Boolean` (Caller authorized)
   - `approve(spender: Bytes<32>, value: Uint<128>): Boolean` (Caller authorized)
   - `transferFrom(from: Bytes<32>, to: Bytes<32>, value: Uint<128>): Boolean` (Caller authorized)
   - `burn(from: Bytes<32>, value: Uint<128>): Boolean` (Caller authorized)
   - `pause(): Boolean` (Owner or Emergency Pauser authorized)
   - `unpause(): Boolean` (Owner authorized)
   - `setEmergencyPauser(newPauser: Bytes<32>): Boolean` (Owner authorized)
   - `emergencyWithdraw(token: ContractAddress, to: Bytes<32>, amount: Uint<128>): Boolean` (Owner authorized)
   - `getContractSalt(): Bytes<32>` (Public query circuit)
2. Handle the cryptographic authentication pattern (`authenticate(account)`):
   - In `fungible-token-v2-2.compact`:
     `derivedAccount = persistentHash<[Bytes<32>, Bytes<32>, Bytes<32>]>([pad(32, "fungible-token:auth"), _contractSalt, sk])`
     where `assert(derivedAccount == account)`.
   - The contract owner on Preprod is `bd536a17777d8b5e9572411c181eb1f355e6ba3e9509eaab4144f1659e54f3df`.
   - The matching Owner Secret Key is `e6cd62ba8eb1f8aad56eb24ce77b6f7e63a8d1261f8c70b0040b587a529239e0`.
   - The contract salt is `44f6370540db4798295c95da3a3d8328c20948f8c7c658359bc15f27e9ed09e7`.
3. Support both **Test Mode** (local simulator / mock identities) and **Lace Wallet Mode** (live on-chain via DApp Connector).

---

## ⚙️ Network & Deployment Configuration
Use the parameters specified in `deployment.config.json`:
- **Contract Name**: `fungible-token-v2-2`
- **Contract Address**: `8cefec943e9f715f21f766edb501ea1fb12a9e8a69c4a3281a133cac6b5ee271`
- **Contract Salt (hex)**: `44f6370540db4798295c95da3a3d8328c20948f8c7c658359bc15f27e9ed09e7`
- **Owner Account (derived on-chain commitment)**: `bd536a17777d8b5e9572411c181eb1f355e6ba3e9509eaab4144f1659e54f3df`
- **Owner Secret Key (for mint & admin actions)**: `e6cd62ba8eb1f8aad56eb24ce77b6f7e63a8d1261f8c70b0040b587a529239e0`
- **Network ID**: `preprod`
- **Indexer GraphQL Endpoint**: `https://indexer.preprod.midnight.network/api/v4/graphql`
- **Indexer WebSocket Endpoint**: `wss://indexer.preprod.midnight.network/api/v4/graphql/ws`
- **Node RPC Endpoint**: `https://rpc.preprod.midnight.network`
- **Proof Server Endpoint**: `http://127.0.0.1:6300`
- **Faucet Endpoint**: `https://faucet.preprod.midnight.network`
- **Block Explorer**: `https://explorer.1am.xyz`

---

## 📋 Step-by-Step Implementation Roadmap
Follow the comprehensive design in `IMPLEMENTATION_PLAN.md`:
1. **Configuration**: Ensure `src/infrastructure/config/midnight-config.ts` and `src/presentation/context/ConfigContext.tsx` read and propagate `ownerSecretKey`, `owner`, and `contractSalt`.
2. **Hook Execution**: Update `src/presentation/hooks/useFungibleToken.ts` to accept dynamic `customSecretKey` and automatically resolve the `ownerSecretKey` for `mint` and administrative circuits.
3. **UI Polish**: In `src/presentation/components/TokenActions.tsx`, provide the Owner Secret Key field, real-time derivation check against contract salt, and one-click "Use Contract Owner Key" shortcut.
4. **Verification**: Verify the test suite with `npm test` and production build with `npm run build`.
