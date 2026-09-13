'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import type { NetworkConfig } from '@/src/types/dapp';
import deploymentConfig from '@/deployment.config.json';

export type NetworkPreset = 'preprod' | 'devnet' | 'custom';

export interface ServiceDiagnostic {
  name: string;
  url: string;
  status: 'checking' | 'healthy' | 'unhealthy' | 'unreachable';
  latencyMs?: number;
  httpStatus?: number;
  details?: string;
}

export interface ConfigContextType {
  config: NetworkConfig;
  preset: NetworkPreset;
  isCustom: boolean;
  diagnostics: Record<string, ServiceDiagnostic>;
  isProbing: boolean;
  updateConfig: (newConfig: Partial<NetworkConfig>, preset?: NetworkPreset) => void;
  selectPreset: (preset: NetworkPreset) => void;
  resetToDefaults: () => Promise<NetworkConfig>;
  runDiagnostics: (overrideConfig?: NetworkConfig) => Promise<Record<string, ServiceDiagnostic>>;
  getExplorerTxUrl: (txHash: string) => string;
  getExplorerContractUrl: (contractAddress?: string) => string;
  getExplorerNetworkUrl: () => string;
}

export const PRESET_CONFIGS: Record<'preprod' | 'devnet', NetworkConfig> = {
  preprod: {
    contractName: deploymentConfig.contractName || 'fungible-token',
    contractAddress:
      deploymentConfig.contractAddress ||
      '8cefec943e9f715f21f766edb501ea1fb12a9e8a69c4a3281a133cac6b5ee271',
    contractSalt: (deploymentConfig as any).contractSalt || undefined,
    ownerSecretKey: (deploymentConfig as any).ownerSecretKey || undefined,
    owner: (deploymentConfig as any).owner || 'bd536a17777d8b5e9572411c181eb1f355e6ba3e9509eaab4144f1659e54f3df',
    networkId: 'preprod',
    indexerUrl:
      deploymentConfig.indexerUrl ||
      deploymentConfig.indexer ||
      'https://indexer.preprod.midnight.network/api/v4/graphql',
    indexerWsUrl:
      deploymentConfig.indexerWsUrl ||
      deploymentConfig.indexerWS ||
      'wss://indexer.preprod.midnight.network/api/v4/graphql/ws',
    nodeUrl:
      deploymentConfig.nodeUrl ||
      deploymentConfig.nodeRpc ||
      'https://rpc.preprod.midnight.network',
    proofServerUrl:
      deploymentConfig.proofServerUrl || deploymentConfig.proofServer || 'http://127.0.0.1:6300',
    faucetUrl:
      deploymentConfig.faucetUrl ||
      deploymentConfig.faucet ||
      'https://faucet.preprod.midnight.network',
    explorerUrl:
      deploymentConfig.explorerUrl || deploymentConfig.explorer || 'https://explorer.1am.xyz',
  },
  devnet: {
    contractName: deploymentConfig.contractName || 'fungible-token',
    contractAddress:
      deploymentConfig.contractAddress ||
      '8cefec943e9f715f21f766edb501ea1fb12a9e8a69c4a3281a133cac6b5ee271',
    networkId: 'devnet',
    indexerUrl: 'http://127.0.0.1:8088/api/v4/graphql',
    indexerWsUrl: 'ws://127.0.0.1:8088/api/v4/graphql/ws',
    nodeUrl: 'http://127.0.0.1:9944',
    proofServerUrl: 'http://127.0.0.1:6300',
    faucetUrl: 'http://127.0.0.1:8088/faucet',
    explorerUrl: 'https://explorer.1am.xyz',
  },
};

const STORAGE_KEY = 'midnight_infra_config_override';
const PRESET_KEY = 'midnight_infra_preset_override';

const ConfigContext = createContext<ConfigContextType | undefined>(undefined);

export const ConfigProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [preset, setPreset] = useState<NetworkPreset>('preprod');
  const [config, setConfig] = useState<NetworkConfig>(PRESET_CONFIGS.preprod);
  const [diagnostics, setDiagnostics] = useState<Record<string, ServiceDiagnostic>>({});
  const [isProbing, setIsProbing] = useState<boolean>(false);

  // Load configuration override from localStorage on client mount, and check live deployment from disk
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const savedPreset = localStorage.getItem(PRESET_KEY) as NetworkPreset | null;
        const savedConfig = localStorage.getItem(STORAGE_KEY);

        if (savedPreset && (savedPreset === 'preprod' || savedPreset === 'devnet' || savedPreset === 'custom')) {
          setPreset(savedPreset);
        }

        if (savedConfig) {
          const parsed = JSON.parse(savedConfig);
          if (parsed && typeof parsed === 'object') {
            const activeContractAddr =
              savedPreset !== 'custom' && deploymentConfig.contractAddress
                ? deploymentConfig.contractAddress
                : parsed.contractAddress || deploymentConfig.contractAddress;
            setConfig((prev) => ({ ...prev, ...parsed, contractAddress: activeContractAddr }));
          }
        } else if (savedPreset && savedPreset !== 'custom') {
          setConfig(PRESET_CONFIGS[savedPreset]);
        }

        // Probe /api/deployment dynamically to pick up any changes in deployment.config.json or deployment.json on disk
        fetch('/api/deployment', { cache: 'no-store' })
          .then((res) => (res.ok ? res.json() : null))
          .then((data) => {
            if (data?.success && data?.deployment) {
              const d = data.deployment;
              const liveOverrides: Partial<NetworkConfig> = {};
              if (d.contractAddress) liveOverrides.contractAddress = d.contractAddress;
              if (d.contractSalt) liveOverrides.contractSalt = d.contractSalt;
              if (d.contractName) liveOverrides.contractName = d.contractName;
              if (d.ownerSecretKey) liveOverrides.ownerSecretKey = d.ownerSecretKey;
              if (d.owner) liveOverrides.owner = d.owner;
              if (d.networkId) liveOverrides.networkId = d.networkId;

              Object.assign(PRESET_CONFIGS.preprod, liveOverrides);

              if (savedPreset !== 'custom') {
                setConfig((prev) => ({ ...prev, ...liveOverrides }));
              }
            }
          })
          .catch(() => {});
      } catch (e) {
        console.warn('[ConfigContext] Could not restore config from localStorage:', e);
      }
    }
  }, []);

  // Update configuration
  const updateConfig = useCallback(
    (newFields: Partial<NetworkConfig>, newPreset?: NetworkPreset) => {
      setConfig((prev) => {
        const updated = { ...prev, ...newFields };
        if (typeof window !== 'undefined') {
          try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
            if (newPreset) {
              localStorage.setItem(PRESET_KEY, newPreset);
            }
          } catch {}
        }
        return updated;
      });
      if (newPreset) {
        setPreset(newPreset);
      } else {
        setPreset('custom');
        if (typeof window !== 'undefined') {
          localStorage.setItem(PRESET_KEY, 'custom');
        }
      }
    },
    []
  );

  // Switch to predefined network preset
  const selectPreset = useCallback((targetPreset: NetworkPreset) => {
    setPreset(targetPreset);
    if (typeof window !== 'undefined') {
      localStorage.setItem(PRESET_KEY, targetPreset);
    }

    if (targetPreset === 'preprod' || targetPreset === 'devnet') {
      const presetConfig = PRESET_CONFIGS[targetPreset];
      setConfig(presetConfig);
      if (typeof window !== 'undefined') {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(presetConfig));
      }
    }
  }, []);

  // Reset to deployment.config.json / deployment.json defaults by fetching latest from /api/deployment
  const resetToDefaults = useCallback(async (): Promise<NetworkConfig> => {
    let freshConfig: NetworkConfig = { ...PRESET_CONFIGS.preprod };

    if (typeof window !== 'undefined') {
      try {
        const res = await fetch('/api/deployment', { cache: 'no-store' });
        if (res.ok) {
          const data = await res.json();
          if (data.success && data.deployment) {
            const d = data.deployment;
            freshConfig = {
              contractName: d.contractName || PRESET_CONFIGS.preprod.contractName,
              contractAddress: d.contractAddress || PRESET_CONFIGS.preprod.contractAddress,
              contractSalt: d.contractSalt || (PRESET_CONFIGS.preprod as any).contractSalt,
              ownerSecretKey: d.ownerSecretKey || (PRESET_CONFIGS.preprod as any).ownerSecretKey,
              owner: d.owner || (PRESET_CONFIGS.preprod as any).owner,
              networkId: d.networkId || PRESET_CONFIGS.preprod.networkId,
              indexerUrl: d.indexerUrl || d.indexer || PRESET_CONFIGS.preprod.indexerUrl,
              indexerWsUrl: d.indexerWsUrl || d.indexerWS || PRESET_CONFIGS.preprod.indexerWsUrl,
              nodeUrl: d.nodeUrl || d.nodeRpc || PRESET_CONFIGS.preprod.nodeUrl,
              proofServerUrl: d.proofServerUrl || d.proofServer || PRESET_CONFIGS.preprod.proofServerUrl,
              faucetUrl: d.faucetUrl || d.faucet || PRESET_CONFIGS.preprod.faucetUrl,
              explorerUrl: d.explorerUrl || d.explorer || PRESET_CONFIGS.preprod.explorerUrl,
            };
            Object.assign(PRESET_CONFIGS.preprod, freshConfig);
          }
        }
      } catch (e) {
        console.warn('[ConfigContext] Failed fetching from /api/deployment during reset:', e);
      }

      try {
        localStorage.removeItem(STORAGE_KEY);
        localStorage.removeItem(PRESET_KEY);
      } catch {}
    }

    setPreset('preprod');
    setConfig(freshConfig);
    return freshConfig;
  }, []);

  // Probe services for live latency and availability
  const runDiagnostics = useCallback(
    async (targetConfig?: NetworkConfig): Promise<Record<string, ServiceDiagnostic>> => {
      const c = targetConfig || config;
      setIsProbing(true);

      const results: Record<string, ServiceDiagnostic> = {
        proofServer: {
          name: 'Proof Server',
          url: c.proofServerUrl,
          status: 'checking',
        },
        indexer: {
          name: 'GraphQL Indexer',
          url: c.indexerUrl,
          status: 'checking',
        },
        nodeRpc: {
          name: 'Node RPC',
          url: c.nodeUrl,
          status: 'checking',
        },
        explorer: {
          name: 'Block Explorer',
          url: c.explorerUrl,
          status: 'checking',
        },
      };

      setDiagnostics({ ...results });

      // 1. Proof Server Probe
      try {
        const start = performance.now();
        const res = await fetch(`${c.proofServerUrl.replace(/\/+$/, '')}/health`, {
          method: 'GET',
          signal: AbortSignal.timeout(3000),
        });
        const elapsed = Math.round(performance.now() - start);
        const ok = res.ok || res.status === 404; // responding HTTP
        results.proofServer = {
          name: 'Proof Server',
          url: c.proofServerUrl,
          status: ok ? 'healthy' : 'unhealthy',
          latencyMs: elapsed,
          httpStatus: res.status,
          details: ok ? 'Responding to HTTP probes' : `HTTP Error ${res.status}`,
        };
      } catch (err: any) {
        results.proofServer = {
          name: 'Proof Server',
          url: c.proofServerUrl,
          status: 'unreachable',
          details: err?.message || 'Connection refused / offline',
        };
      }

      // 2. Indexer Probe
      try {
        const start = performance.now();
        const res = await fetch(c.indexerUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: '{ __typename }' }),
          signal: AbortSignal.timeout(3000),
        });
        const elapsed = Math.round(performance.now() - start);
        results.indexer = {
          name: 'GraphQL Indexer',
          url: c.indexerUrl,
          status: res.ok ? 'healthy' : 'unhealthy',
          latencyMs: elapsed,
          httpStatus: res.status,
          details: res.ok ? 'GraphQL endpoint responsive' : `HTTP ${res.status}`,
        };
      } catch (err: any) {
        results.indexer = {
          name: 'GraphQL Indexer',
          url: c.indexerUrl,
          status: 'unreachable',
          details: err?.message || 'Connection timed out',
        };
      }

      // 3. Node RPC Probe
      try {
        const start = performance.now();
        const res = await fetch(c.nodeUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            jsonrpc: '2.0',
            id: 1,
            method: 'system_health',
            params: [],
          }),
          signal: AbortSignal.timeout(3000),
        });
        const elapsed = Math.round(performance.now() - start);
        results.nodeRpc = {
          name: 'Node RPC',
          url: c.nodeUrl,
          status: res.ok ? 'healthy' : 'unhealthy',
          latencyMs: elapsed,
          httpStatus: res.status,
          details: res.ok ? 'RPC endpoint live' : `HTTP ${res.status}`,
        };
      } catch (err: any) {
        results.nodeRpc = {
          name: 'Node RPC',
          url: c.nodeUrl,
          status: 'unreachable',
          details: err?.message || 'Connection timed out',
        };
      }

      // 4. Explorer Probe
      try {
        const start = performance.now();
        await fetch(c.explorerUrl, {
          method: 'HEAD',
          mode: 'no-cors',
          signal: AbortSignal.timeout(3000),
        });
        const elapsed = Math.round(performance.now() - start);
        results.explorer = {
          name: 'Block Explorer',
          url: c.explorerUrl,
          status: 'healthy',
          latencyMs: elapsed,
          details: 'Explorer reachable',
        };
      } catch (err: any) {
        results.explorer = {
          name: 'Block Explorer',
          url: c.explorerUrl,
          status: 'unreachable',
          details: err?.message || 'Network error',
        };
      }

      setDiagnostics({ ...results });
      setIsProbing(false);
      return results;
    },
    [config]
  );

  // Dynamic Explorer link helpers
  const getExplorerTxUrl = useCallback(
    (txHash: string) => {
      const base = config.explorerUrl.replace(/\/+$/, '');
      const cleanTx = txHash.startsWith('0x') ? txHash : `0x${txHash}`;
      return `${base}/tx/${cleanTx}?network=${encodeURIComponent(config.networkId)}`;
    },
    [config.explorerUrl, config.networkId]
  );

  const getExplorerContractUrl = useCallback(
    (contractAddress?: string) => {
      const base = config.explorerUrl.replace(/\/+$/, '');
      const addr = contractAddress || config.contractAddress;
      return `${base}/contract/${addr}?network=${encodeURIComponent(config.networkId)}`;
    },
    [config.explorerUrl, config.networkId, config.contractAddress]
  );

  const getExplorerNetworkUrl = useCallback(() => {
    const base = config.explorerUrl.replace(/\/+$/, '');
    return `${base}/?network=${encodeURIComponent(config.networkId)}`;
  }, [config.explorerUrl, config.networkId]);

  const value = useMemo(
    () => ({
      config,
      preset,
      isCustom: preset === 'custom',
      diagnostics,
      isProbing,
      updateConfig,
      selectPreset,
      resetToDefaults,
      runDiagnostics,
      getExplorerTxUrl,
      getExplorerContractUrl,
      getExplorerNetworkUrl,
    }),
    [
      config,
      preset,
      diagnostics,
      isProbing,
      updateConfig,
      selectPreset,
      resetToDefaults,
      runDiagnostics,
      getExplorerTxUrl,
      getExplorerContractUrl,
      getExplorerNetworkUrl,
    ]
  );

  return <ConfigContext.Provider value={value}>{children}</ConfigContext.Provider>;
};

export function useConfig() {
  const context = useContext(ConfigContext);
  if (!context) {
    throw new Error('useConfig must be used within a ConfigProvider');
  }
  return context;
}
