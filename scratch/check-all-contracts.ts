import { indexerPublicDataProvider } from '@midnight-ntwrk/midnight-js-indexer-public-data-provider';
import { ledger } from '../contract/index.js';

const addresses = [
  "8cefec943e9f715f21f766edb501ea1fb12a9e8a69c4a3281a133cac6b5ee271",
  "853b1938397aac46e0fff9a100d248cc5101d0a6449e9a164a4ea9d25572dc3e",
  "14f654c7f13a204cb6365fde37b4b6b35cc838b0ab20ec076dc074705494a6a2",
  "6764022acd5b9fbff2b5baeb84f3082cf51f6d8b2dc978df9778b93c0005983c"
];

async function checkAll() {
  const publicDataProvider = indexerPublicDataProvider(
    "https://indexer.preprod.midnight.network/api/v4/graphql",
    "wss://indexer.preprod.midnight.network/api/v4/graphql/ws"
  );

  for (const addr of addresses) {
    console.log("\n=================================");
    console.log("Checking contract:", addr);
    try {
      const onChainState = await publicDataProvider.queryContractState(addr);
      if (!onChainState || !onChainState.data) {
        console.log("-> State not found on preprod");
        continue;
      }
      const decoded = ledger(onChainState.data);
      console.log("-> Name:", decoded._name);
      console.log("-> TotalSupply:", decoded._totalSupply?.toString());
      if (decoded._balances) {
        const size = decoded._balances.size?.() ?? 0n;
        console.log("-> Balances count:", size.toString());
        const entries = Array.from(decoded._balances.entries?.() || []);
        for (const [k, v] of entries) {
          console.log("   Holder:", Buffer.from(k).toString('hex'), "=> Balance:", v.toString());
        }
      }
    } catch (err: any) {
      console.log("-> Error decoding state:", err.message);
    }
  }
  process.exit(0);
}

checkAll().catch(console.error);
