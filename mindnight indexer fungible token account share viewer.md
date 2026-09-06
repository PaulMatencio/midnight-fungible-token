# Implementation Plan: Midnight Indexer Fungible Token & Account Share Viewer

Retrieve fungible token contract information directly from the Midnight Indexer via GraphQL, decode account balances from the on-chain ledger state, and display the token share distribution between accounts with rich visual breakdowns.

## Proposed Changes

### Infrastructure Layer

#### [NEW] [midnight-indexer-client.ts](file:///home/paul/compact/fungible-token/src/infrastructure/midnight/midnight-indexer-client.ts)
- Implement `queryIndexerContractState(contractAddress: string, indexerUrl: string)`:
  - Executes GraphQL query `contractAction(address: $address)` with `state`, `transaction { hash, block { height, hash } }`.
  - Deserializes raw hex state using `@midnight-ntwrk/midnight-js-protocol/compact-runtime` `ContractState.deserialize(toByteArray(state))`.
  - Decodes ledger state with `ledger(contractState.data)`.
  - Iterates through `_balances` (`[Symbol.iterator]()`) to extract every holder account.
  - Formats addresses into Bech32m (`mn_addr_...`) and 64-character hex strings.
  - Matches known identities (Alice, Bob, Charlie, Connected Wallet).
  - Calculates proportional share percentage $\frac{\text{balance}}{\text{totalSupply}} \times 100\%$ for each account.
  - Returns structured `IndexerTokenReport`:
    ```ts
    export interface AccountShare {
      addressHex: string;
      addressBech32: string;
      balance: bigint;
      formattedBalance: string;
      sharePercentage: number; // 0 - 100
      isCurrentUser?: boolean;
      label?: string;
    }
    export interface IndexerTokenReport {
      contractAddress: string;
      blockHeight?: number;
      txHash?: string;
      name: string;
      symbol: string;
      decimals: number;
      totalSupply: bigint;
      isInitialized: boolean;
      holders: AccountShare[];
      fetchedAt: Date;
      source: 'indexer' | 'local_cache' | 'simulated';
    }
    ```

---

### Presentation Layer

#### [NEW] [AccountSharesViewer.tsx](file:///home/paul/compact/fungible-token/src/presentation/components/AccountSharesViewer.tsx)
- Dedicated interactive component to display token distribution and shares between accounts:
  - **Live Indexer Status Header**: Shows indexer URL, block height of last action, deployment/action tx hash with link to Explorer, and a **"Refresh from Indexer"** button with live spinner.
  - **Distribution Summary Metrics**:
    - Circulating Total Supply
    - Total Holders Count
    - Largest Holder Share
    - Top 3 Concentration ratio
  - **Visual Share Breakdown**:
    - Multi-color segmented distribution bar showing relative weight of each holding account.
  - **Holders Table**:
    - Rank (#1, #2, ...)
    - Account Identity (Bech32m address, copy button, hex toggle, "You", "Alice", "Bob" tags)
    - Balance formatted with token symbol and decimals
    - Share percentage with mini progress bar
  - **Mode Toggle & Empty State**:
    - Allows viewing strict on-chain Indexer data, or active synchronized ledger data (including staged test transactions).
    - Clear instructions if the on-chain contract has not yet had tokens minted.

#### [MODIFY] [useFungibleToken.ts](file:///home/paul/compact/fungible-token/src/presentation/hooks/useFungibleToken.ts)
- Integrate `indexerClient`:
  - Provide `fetchIndexerTokenReport(overrideAddress?, overrideUrl?)` method.
  - Compute active `accountShares` from the active `ledgerState` so the UI is continuously updated during transfers/mints.

#### [MODIFY] [app/page.tsx](file:///home/paul/compact/fungible-token/app/page.tsx)
- Incorporate `AccountSharesViewer` into the application:
  - Add tab support or embed within the **Ledger State** tab and provide a dedicated sub-view.
  - Add a quick stat button in the top KPI bar ("Holders Distribution →").

---

### Testing & Verification

#### [MODIFY] [tests/modules.test.ts](file:///home/paul/compact/fungible-token/tests/modules.test.ts)
- Add `Module G: Midnight Indexer Contract Query & Account Share Calculation`:
  - Verify parsing of simulated and indexer contract action responses.
  - Verify calculation of percentage shares across multiple accounts (e.g. 50% / 50% split).
  - Verify Bech32m address formatting for holders.

---

## Verification Plan

### Automated Tests
1. Run `npx tsc --noEmit` to verify type safety.
2. Run `npx vitest run` to verify all unit tests pass.
3. Run integration script testing live query against `https://indexer.preprod.midnight.network/api/v4/graphql`.
4. Run `npm run build` to verify production build succeeds.
