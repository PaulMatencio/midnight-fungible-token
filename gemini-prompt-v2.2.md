What is removed and what  is new in fungible-token-v2-2 ?

remove  kernel.self()  from the authenticate circuit 
add  _contractSalt to the authenticate circuit and constructor and ledger 
also add a getContractSalt circuit 


Summary of What Was Updated in this new release v2.2:

1. Compact Smart Contract 
    
# contracts/fungible-token-v2-2.compact

Ledger State: Added export ledger _contractSalt: Bytes<32> to store the unique contract salt on-chain.

Constructor: Updated constructor signature to constructor(salt_: Bytes<32>, initialOwner: Bytes<32>, ...) and initializes _contractSalt = salt_.

authenticate Circuit: Updated to verify the commitment against [domainTag, _contractSalt, sk]:
compact
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

Getter Circuit: Added export circuit contractSalt(): Bytes<32> so any client or explorer can query the contract's salt directly.
Compilation: Successfully recompiled with /home/paul/.local/bin/compact compile contracts/fungible-token-v2-2.compact contracts/managed/fungible-token-v2-2 generating full ZK keys for all 18 circuits.

2. Client SDK 
    
# fungible-token-v2-2/sdk/fungible-token-v2-2-sdk.ts
  
deriveAccount(secretKey: Uint8Array, contractSalt: Uint8Array): Now accepts the contractSalt and hashes [domainTag, contractSalt, secretKey] via persistentHash.
initialState(context, salt, initialOwner, name, symbol, decimals): Updated to accept and pass the 32-byte salt.
contractSalt(context): Added method to query _contractSalt from the deployed contract.
getAuthenticatedCaller & isAuthorized: Updated to utilize the 3-element hash structure ([domainTag, contractSalt, sk]).

3. Deployment Manager 

# Salt Generation: 
Automatically generates a cryptographically secure 32-byte salt (crypto.randomBytes(32)) if none is provided during deployment.

Constructor Parameter Injection: Automatically supplies the salt as the first constructor argument.

# Owner Account Derivation: 
Derives initialOwner using deriveAccount(secretKey, activeContractSalt) before constructing the deploy transaction, eliminating the circular address dependency completely.
Metadata Persistence: Persists contractSalt (hex encoded) alongside contractAddress in the contract deployment record for future client and UI retrieval.

4. Automated Tests 

# fungible-token-v2-2/tests/fungible-token-v2-2.test.ts
Updated all test suites to pass a deterministic TEST_SALT = createKey(42).
Added a dedicated cross-contract replay test:
it("protects against cross-contract replay when a different salt is used")
Result: All 36/36 tests passing cleanly in Vitest.

5. Example Walkthrough         

# fungible-token-v2-2/examples/fungible-token-v2-2-example.ts

Updated to demonstrate:
Generating/defining a 32-byte contractSalt.
Deriving actor accounts (deployerAccount, aliceAccount, bobAccount) with contractSalt.
Initializing and executing operations (mint, transfer, burn, transferOwnership).
Ran and verified end-to-end (npx tsx examples/fungible-token-v2-2-example.ts completed with 0 errors).
6. Documentation & Types


# fungible-token-v2-2/docs/fungible-token-v2-2-sdk.md
: Updated Section 1.5 with full explanation of why contractSalt is used, preventing cross-contract replay attacks, and updated the client quick-start code.


# fungible-token-v2-2/docs/fungible-token-v2-2-api.d.ts
: Updated TypeScript definitions for deriveAccount, initialState, and contractSalt.


