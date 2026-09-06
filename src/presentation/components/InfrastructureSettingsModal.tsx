'use client';

import React, { useState, useEffect } from 'react';
import {
  Server,
  X,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Copy,
  Check,
  ExternalLink,
  ShieldCheck,
  Radio,
  Sliders,
  RotateCcw,
  Zap,
  Activity,
  Globe,
  Database,
  Cpu,
} from 'lucide-react';
import { useConfig, type NetworkPreset, PRESET_CONFIGS } from '@/src/presentation/context/ConfigContext';
import { useToast } from '@/src/presentation/context/ToastContext';
import type { NetworkConfig } from '@/src/types/dapp';

interface InfrastructureSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const InfrastructureSettingsModal: React.FC<InfrastructureSettingsModalProps> = ({
  isOpen,
  onClose,
}) => {
  const {
    config,
    preset,
    isCustom,
    diagnostics,
    isProbing,
    updateConfig,
    selectPreset,
    resetToDefaults,
    runDiagnostics,
    getExplorerContractUrl,
  } = useConfig();

  const { showToast } = useToast();

  // Local form state
  const [formData, setFormData] = useState<NetworkConfig>(config);
  const [selectedPreset, setSelectedPreset] = useState<NetworkPreset>(preset);
  const [copiedContract, setCopiedContract] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  // Sync form data with active config when modal opens or config changes
  useEffect(() => {
    if (isOpen) {
      setFormData(config);
      setSelectedPreset(preset);
      setHasChanges(false);
      // Auto-run diagnostics when modal opens
      runDiagnostics(config).catch(() => {});
    }
  }, [isOpen, config, preset, runDiagnostics]);

  if (!isOpen) return null;

  const handlePresetClick = (p: NetworkPreset) => {
    setSelectedPreset(p);
    if (p === 'preprod' || p === 'devnet') {
      const presetData = PRESET_CONFIGS[p];
      setFormData(presetData);
      setHasChanges(true);
    } else {
      setHasChanges(true);
    }
  };

  const handleFieldChange = (field: keyof NetworkConfig, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setSelectedPreset('custom');
    setHasChanges(true);
  };

  const handleCopyContract = () => {
    navigator.clipboard.writeText(formData.contractAddress);
    setCopiedContract(true);
    setTimeout(() => setCopiedContract(false), 2000);
  };

  const handleResetContractToDefault = () => {
    const defaultAddr = PRESET_CONFIGS.preprod.contractAddress;
    setFormData((prev) => ({ ...prev, contractAddress: defaultAddr }));
    setHasChanges(true);
  };

  const handleSave = () => {
    // Basic validation
    if (!formData.contractAddress || formData.contractAddress.trim().length < 10) {
      showToast('error', 'Invalid Contract Address', 'Please provide a valid Midnight contract address.');
      return;
    }
    if (!formData.indexerUrl || !formData.indexerUrl.startsWith('http')) {
      showToast('error', 'Invalid Indexer URL', 'Indexer URL must be a valid HTTP/HTTPS endpoint.');
      return;
    }

    updateConfig(formData, selectedPreset);
    setHasChanges(false);
    showToast(
      'success',
      'Settings Updated',
      `Active infrastructure configuration saved (${selectedPreset.toUpperCase()}).`
    );
    onClose();
  };

  const handleResetAll = () => {
    resetToDefaults();
    setFormData(PRESET_CONFIGS.preprod);
    setSelectedPreset('preprod');
    setHasChanges(false);
    showToast('info', 'Reset to Defaults', 'Restored default Preprod infrastructure endpoints.');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-3xl bg-slate-900 border border-slate-800 rounded-2xl sm:rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="flex items-center justify-between p-5 sm:p-6 border-b border-slate-800 bg-slate-950/60 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400">
              <Server className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-bold text-white tracking-tight flex items-center gap-2">
                Midnight Infrastructure & Settings
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700 uppercase font-mono">
                  {selectedPreset}
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Configure proof server, GraphQL indexer, node RPC, and target contract parameters.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800/80 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body - Scrollable */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-6 flex-1 custom-scrollbar text-xs sm:text-sm">
          {/* Network Preset Selector */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
              Network Preset
            </label>
            <div className="grid grid-cols-3 gap-2.5">
              <button
                type="button"
                onClick={() => handlePresetClick('preprod')}
                className={`p-3 rounded-xl border text-left transition-all flex flex-col gap-1 ${
                  selectedPreset === 'preprod'
                    ? 'bg-blue-600/20 border-blue-500/60 text-blue-200 shadow-md shadow-blue-500/10'
                    : 'bg-slate-950/40 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-xs">Preprod Testnet</span>
                  {selectedPreset === 'preprod' && <Check className="w-3.5 h-3.5 text-blue-400" />}
                </div>
                <span className="text-[10px] text-slate-500">Public Midnight Network</span>
              </button>

              <button
                type="button"
                onClick={() => handlePresetClick('devnet')}
                className={`p-3 rounded-xl border text-left transition-all flex flex-col gap-1 ${
                  selectedPreset === 'devnet'
                    ? 'bg-indigo-600/20 border-indigo-500/60 text-indigo-200 shadow-md shadow-indigo-500/10'
                    : 'bg-slate-950/40 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-xs">Local Devnet</span>
                  {selectedPreset === 'devnet' && <Check className="w-3.5 h-3.5 text-indigo-400" />}
                </div>
                <span className="text-[10px] text-slate-500">Docker (8088 / 9944)</span>
              </button>

              <button
                type="button"
                onClick={() => handlePresetClick('custom')}
                className={`p-3 rounded-xl border text-left transition-all flex flex-col gap-1 ${
                  selectedPreset === 'custom'
                    ? 'bg-purple-600/20 border-purple-500/60 text-purple-200 shadow-md shadow-purple-500/10'
                    : 'bg-slate-950/40 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-xs">Custom Setup</span>
                  {selectedPreset === 'custom' && <Check className="w-3.5 h-3.5 text-purple-400" />}
                </div>
                <span className="text-[10px] text-slate-500">Custom Endpoints</span>
              </button>
            </div>
          </div>

          {/* Live Infrastructure Diagnostics Panel */}
          <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800/90 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-cyan-400" />
                <h3 className="font-bold text-white text-xs uppercase tracking-wider">
                  Live Service Diagnostics
                </h3>
              </div>
              <button
                type="button"
                onClick={() => runDiagnostics(formData)}
                disabled={isProbing}
                className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-medium flex items-center gap-1.5 transition-colors disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isProbing ? 'animate-spin' : ''}`} />
                <span>{isProbing ? 'Probing...' : 'Test All Services'}</span>
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
              {Object.entries(diagnostics).map(([key, diag]) => {
                const isOk = diag.status === 'healthy';
                const isChecking = diag.status === 'checking';
                return (
                  <div
                    key={key}
                    className="p-2.5 rounded-lg bg-slate-900/90 border border-slate-800 space-y-1"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-semibold text-slate-300 truncate">
                        {diag.name}
                      </span>
                      <span
                        className={`w-2 h-2 rounded-full ${
                          isChecking
                            ? 'bg-amber-400 animate-ping'
                            : isOk
                            ? 'bg-emerald-400 shadow-sm shadow-emerald-400/50'
                            : 'bg-rose-500'
                        }`}
                      />
                    </div>
                    <div className="flex items-center justify-between text-[10px]">
                      <span
                        className={`font-mono ${
                          isOk ? 'text-emerald-400' : isChecking ? 'text-amber-400' : 'text-rose-400'
                        }`}
                      >
                        {isChecking ? 'Checking...' : isOk ? 'Online' : 'Offline'}
                      </span>
                      {diag.latencyMs !== undefined && (
                        <span className="font-mono text-slate-500">{diag.latencyMs}ms</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Form Endpoints */}
          <div className="space-y-4">
            <h3 className="font-bold text-white text-xs uppercase tracking-wider text-slate-400">
              Configurable Endpoints & Contract
            </h3>

            {/* Contract Address */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-slate-300">Target Contract Address</label>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleCopyContract}
                    className="text-[11px] text-blue-400 hover:text-blue-300 flex items-center gap-1"
                  >
                    {copiedContract ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    <span>{copiedContract ? 'Copied' : 'Copy'}</span>
                  </button>
                  <a
                    href={getExplorerContractUrl(formData.contractAddress)}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[11px] text-slate-400 hover:text-slate-200 flex items-center gap-1"
                  >
                    <ExternalLink className="w-3 h-3" />
                    <span>Explorer</span>
                  </a>
                  <button
                    type="button"
                    onClick={handleResetContractToDefault}
                    className="text-[11px] text-amber-400 hover:text-amber-300"
                    title="Reset to default deployment address"
                  >
                    Reset Default
                  </button>
                </div>
              </div>
              <input
                type="text"
                value={formData.contractAddress}
                onChange={(e) => handleFieldChange('contractAddress', e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950/80 border border-slate-800 text-slate-200 font-mono text-xs focus:outline-none focus:border-blue-500 transition-colors"
                placeholder="6764022acd5b9fbff2b5baeb84f3082cf51f6d8b2dc978df9778b93c0005983c"
              />
            </div>

            {/* Two-column inputs */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Proof Server URL */}
              <div className="space-y-1.5">
                <div className="flex items-center gap-1.5">
                  <Cpu className="w-3.5 h-3.5 text-cyan-400" />
                  <label className="text-xs font-semibold text-slate-300">Proof Server URL</label>
                </div>
                <input
                  type="text"
                  value={formData.proofServerUrl}
                  onChange={(e) => handleFieldChange('proofServerUrl', e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-950/80 border border-slate-800 text-slate-200 font-mono text-xs focus:outline-none focus:border-blue-500 transition-colors"
                  placeholder="http://127.0.0.1:6300"
                />
              </div>

              {/* Node RPC URL */}
              <div className="space-y-1.5">
                <div className="flex items-center gap-1.5">
                  <Database className="w-3.5 h-3.5 text-indigo-400" />
                  <label className="text-xs font-semibold text-slate-300">Node RPC URL</label>
                </div>
                <input
                  type="text"
                  value={formData.nodeUrl}
                  onChange={(e) => handleFieldChange('nodeUrl', e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-950/80 border border-slate-800 text-slate-200 font-mono text-xs focus:outline-none focus:border-blue-500 transition-colors"
                  placeholder="https://rpc.preprod.midnight.network"
                />
              </div>

              {/* GraphQL Indexer HTTP URL */}
              <div className="space-y-1.5">
                <div className="flex items-center gap-1.5">
                  <Radio className="w-3.5 h-3.5 text-emerald-400" />
                  <label className="text-xs font-semibold text-slate-300">GraphQL Indexer (HTTP)</label>
                </div>
                <input
                  type="text"
                  value={formData.indexerUrl}
                  onChange={(e) => handleFieldChange('indexerUrl', e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-950/80 border border-slate-800 text-slate-200 font-mono text-xs focus:outline-none focus:border-blue-500 transition-colors"
                  placeholder="https://indexer.preprod.midnight.network/api/v4/graphql"
                />
              </div>

              {/* GraphQL Indexer WS URL */}
              <div className="space-y-1.5">
                <div className="flex items-center gap-1.5">
                  <Radio className="w-3.5 h-3.5 text-teal-400" />
                  <label className="text-xs font-semibold text-slate-300">GraphQL WebSocket (WS)</label>
                </div>
                <input
                  type="text"
                  value={formData.indexerWsUrl}
                  onChange={(e) => handleFieldChange('indexerWsUrl', e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-950/80 border border-slate-800 text-slate-200 font-mono text-xs focus:outline-none focus:border-blue-500 transition-colors"
                  placeholder="wss://indexer.preprod.midnight.network/api/v4/graphql/ws"
                />
              </div>

              {/* Block Explorer URL */}
              <div className="space-y-1.5">
                <div className="flex items-center gap-1.5">
                  <Globe className="w-3.5 h-3.5 text-blue-400" />
                  <label className="text-xs font-semibold text-slate-300">Block Explorer Base URL</label>
                </div>
                <input
                  type="text"
                  value={formData.explorerUrl}
                  onChange={(e) => handleFieldChange('explorerUrl', e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-950/80 border border-slate-800 text-slate-200 font-mono text-xs focus:outline-none focus:border-blue-500 transition-colors"
                  placeholder="https://explorer.1am.xyz"
                />
              </div>

              {/* Faucet URL */}
              <div className="space-y-1.5">
                <div className="flex items-center gap-1.5">
                  <Zap className="w-3.5 h-3.5 text-amber-400" />
                  <label className="text-xs font-semibold text-slate-300">Faucet URL</label>
                </div>
                <input
                  type="text"
                  value={formData.faucetUrl}
                  onChange={(e) => handleFieldChange('faucetUrl', e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-950/80 border border-slate-800 text-slate-200 font-mono text-xs focus:outline-none focus:border-blue-500 transition-colors"
                  placeholder="https://faucet.preprod.midnight.network"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer - Sticky Actions */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-t border-slate-800 bg-slate-950/90 flex-shrink-0">
          <button
            type="button"
            onClick={handleResetAll}
            className="px-3.5 py-2 rounded-xl text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors text-xs font-medium flex items-center gap-1.5"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset Defaults</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="px-5 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-xs transition-all shadow-lg shadow-blue-600/25 active:scale-95"
            >
              Save Configuration
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
