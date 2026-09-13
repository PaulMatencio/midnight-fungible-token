import { indexerPublicDataProvider } from '@midnight-ntwrk/midnight-js-indexer-public-data-provider';
import { ledger } from '../contract/index.js';

async function main() {
  const contractAddress = "8cefec943e9f715f21f766edb501ea1fb12a9e8a69c4a3281a133cac6b5ee271";
  const publicDataProvider = indexerPublicDataProvider(
    "https://indexer.preprod.midnight.network/api/v4/graphql",
    "wss://indexer.preprod.midnight.network/api/v4/graphql/ws"
  );
  const onChainState = await publicDataProvider.queryContractState(contractAddress);
  if (!onChainState || !onChainState.data) {
    console.log("No on-chain state data found");
    return;
  }
  console.log("onChainState keys:", Object.keys(onChainState));
  console.log("onChainState.data operations:", (onChainState.data as any).operations ? Object.keys((onChainState.data as any).operations) : null);
  const circuits = ['mint', 'transfer', 'approve', 'transferFrom', 'burn', 'pause', 'unpause', 'setEmergencyPauser', 'emergencyWithdraw'];
  for (const c of circuits) {
    const op = (onChainState as any).operation?.(c);
    console.log(`Circuit '${c}': has op?`, Boolean(op), 'vk length:', op?.verifierKey?.length);
  }
  const decoded = ledger(onChainState.data);
  console.log("Decoded ledger keys:", Object.keys(decoded));
  console.log("_name:", decoded._name);
  console.log("_symbol:", decoded._symbol);
  console.log("_decimals:", decoded._decimals);
  console.log("_totalSupply:", decoded._totalSupply?.toString());
  console.log("_maxSupply:", decoded._maxSupply?.toString());
  console.log("owner:", decoded.owner ? Buffer.from(decoded.owner).toString('hex') : null);
  console.log("_contractSalt:", decoded._contractSalt ? Buffer.from(decoded._contractSalt).toString('hex') : null);
  console.log("_paused:", decoded._paused);
  console.log("_emergencyPauser:", decoded._emergencyPauser ? Buffer.from(decoded._emergencyPauser).toString('hex') : null);
  
  if (decoded._balances) {
    console.log("_balances size():", decoded._balances.size());
    console.log("_balances entries:", Array.from(decoded._balances.entries?.() || []));
  }
  process.exit(0);
}

main().catch(console.error);
