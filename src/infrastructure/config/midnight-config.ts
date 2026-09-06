import type { NetworkConfig } from '../../types/dapp';
import deploymentConfig from '../../../deployment.config.json';

export const MIDNIGHT_CONFIG: NetworkConfig = {
  contractName: deploymentConfig.contractName || 'fungible-token',
  contractAddress: deploymentConfig.contractAddress || '6764022acd5b9fbff2b5baeb84f3082cf51f6d8b2dc978df9778b93c0005983c',
  networkId: deploymentConfig.networkId || 'preprod',
  indexerUrl: deploymentConfig.indexerUrl || deploymentConfig.indexer || 'https://indexer.preprod.midnight.network/api/v4/graphql',
  indexerWsUrl: deploymentConfig.indexerWsUrl || deploymentConfig.indexerWS || 'wss://indexer.preprod.midnight.network/api/v4/graphql/ws',
  nodeUrl: deploymentConfig.nodeUrl || deploymentConfig.nodeRpc || 'https://rpc.preprod.midnight.network',
  proofServerUrl: deploymentConfig.proofServerUrl || deploymentConfig.proofServer || 'http://127.0.0.1:6300',
  faucetUrl: deploymentConfig.faucetUrl || deploymentConfig.faucet || 'https://faucet.preprod.midnight.network',
  explorerUrl: deploymentConfig.explorerUrl || deploymentConfig.explorer || 'https://explorer.1am.xyz',
};

export const PRESET_IDENTITIES = [
  {
    name: 'alice',
    label: 'Alice (Treasury Admin)',
    addressHex: 'aaaa'.repeat(16),
    role: 'admin' as const,
  },
  {
    name: 'bob',
    label: 'Bob (Trader)',
    addressHex: 'bbbb'.repeat(16),
    role: 'user' as const,
  },
  {
    name: 'charlie',
    label: 'Charlie (Liquidity Provider)',
    addressHex: 'cccc'.repeat(16),
    role: 'user' as const,
  },
  {
    name: 'deployer',
    label: 'Deployer Account',
    addressHex: '0101'.repeat(16),
    role: 'admin' as const,
  },
];

/**
 * Formats a block explorer URL for a transaction hash.
 * E.g. https://explorer.1am.xyz/tx/0x35ba7ab88de5861474803e447b8a1adfeca4aa24948bc0b2b5da965d52f4816c?network=preprod
 */
export function getExplorerTxUrl(txHash: string, networkId: string = MIDNIGHT_CONFIG.networkId): string {
  const base = MIDNIGHT_CONFIG.explorerUrl.replace(/\/+$/, '');
  const cleanTx = txHash.startsWith('0x') ? txHash : `0x${txHash}`;
  return `${base}/tx/${cleanTx}?network=${encodeURIComponent(networkId)}`;
}

/**
 * Formats a block explorer URL for a contract address.
 * E.g. https://explorer.1am.xyz/contract/6764022acd5b9fbff2b5baeb84f3082cf51f6d8b2dc978df9778b93c0005983c?network=preprod
 */
export function getExplorerContractUrl(
  contractAddress: string = MIDNIGHT_CONFIG.contractAddress,
  networkId: string = MIDNIGHT_CONFIG.networkId
): string {
  const base = MIDNIGHT_CONFIG.explorerUrl.replace(/\/+$/, '');
  return `${base}/contract/${contractAddress}?network=${encodeURIComponent(networkId)}`;
}

/**
 * Formats the base block explorer URL with the network query param.
 * E.g. https://explorer.1am.xyz/?network=preprod
 */
export function getExplorerNetworkUrl(networkId: string = MIDNIGHT_CONFIG.networkId): string {
  const base = MIDNIGHT_CONFIG.explorerUrl.replace(/\/+$/, '');
  return `${base}/?network=${encodeURIComponent(networkId)}`;
}
