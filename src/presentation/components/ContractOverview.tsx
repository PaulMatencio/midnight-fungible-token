'use client';

import React, { useState } from 'react';
import {
  Coins,
  Copy,
  Check,
  ExternalLink,
  ShieldCheck,
  Server,
  Layers,
  CircleDot,
  Radio,
  Zap,
  RotateCcw,
} from 'lucide-react';
import { MIDNIGHT_CONFIG, getExplorerContractUrl } from '@/src/infrastructure/config/midnight-config';
import { useWallet } from '@/src/presentation/context/WalletContext';
import type { TokenMetadata } from '@/src/types/dapp';

interface ContractOverviewProps {
  metadata: TokenMetadata;
  userBalance: bigint;
  infraStatus?: { proofServer: boolean; indexer: boolean };
  onResetContractState?: () => void;
}

export const ContractOverview: React.FC<ContractOverviewProps> = ({
  metadata,
  userBalance,
  infraStatus,
  onResetContractState,
}) => {
  const { mode, accountAddress, activeIdentity, isConnected, connectWallet } = useWallet();
  const [copiedAddr, setCopiedAddr] = useState(false);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedAddr(true);
    setTimeout(() => setCopiedAddr(false), 2000);
  };

  const formatUnits = (amount: bigint, decimals: number): string => {
    const divisor = 10n ** BigInt(decimals);
    const whole = amount / divisor;
    const fraction = amount % divisor;
    const fractionStr = fraction.toString().padStart(decimals, '0').slice(0, 4);
    return `${whole.toLocaleString()}.${fractionStr}`;
  };

  return (
    <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-6 backdrop-blur-xl shadow-xl space-y-6">
      {/* Top row: Contract Address, Mode Badge & Network Status */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-800">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Deployed Compact Contract
            </span>

            {/* Active Mode Pill */}
            {mode === 'lace' ? (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-blue-500/10 text-blue-300 border border-blue-500/30">
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
                Lace Wallet Live Mode
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-indigo-500/10 text-indigo-300 border border-indigo-500/30">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                Test Mode (No Wallet)
              </span>
            )}

            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <CircleDot className="w-2.5 h-2.5" />
              {metadata.isInitialized ? 'Initialized' : 'Uninitialized'}
            </span>
          </div>

          <div className="flex items-center gap-2 font-mono text-sm text-slate-200">
            <span className="truncate max-w-xs md:max-w-md" title={MIDNIGHT_CONFIG.contractAddress}>
              {MIDNIGHT_CONFIG.contractAddress}
            </span>
            <button
              type="button"
              onClick={() => copyToClipboard(MIDNIGHT_CONFIG.contractAddress)}
              className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
              title="Copy Address"
            >
              {copiedAddr ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
            <a
              href={getExplorerContractUrl(MIDNIGHT_CONFIG.contractAddress)}
              target="_blank"
              rel="noreferrer"
              className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
              title="View on Block Explorer"
            >
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
            {onResetContractState && (
              <button
                type="button"
                onClick={onResetContractState}
                className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-amber-400 transition-colors"
                title="Reset local contract state / cache (start fresh or re-initialize)"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Infrastructure probes */}
        <div className="flex items-center gap-2.5 flex-wrap">
          <div className="px-3 py-1.5 rounded-xl bg-slate-950/70 border border-slate-800 flex items-center gap-2 text-xs text-slate-300">
            <Radio className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
            <div>
              <div className="font-medium text-white text-[11px]">GraphQL Indexer</div>
              <div className="text-[9px] text-slate-400 font-mono">api/v4/graphql</div>
            </div>
          </div>

          <div className="px-3 py-1.5 rounded-xl bg-slate-950/70 border border-slate-800 flex items-center gap-2 text-xs text-slate-300">
            <Server className="w-3.5 h-3.5 text-cyan-400" />
            <div>
              <div className="font-medium text-white text-[11px]">Proof Server</div>
              <div className="text-[9px] text-slate-400 font-mono">127.0.0.1:6300</div>
            </div>
          </div>
        </div>
      </div>

      {/* Grid: Token Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Token Name & Symbol */}
        <div className="p-4 rounded-xl bg-slate-950/50 border border-slate-800 hover:border-slate-700 transition-colors">
          <div className="text-xs text-slate-400 flex items-center gap-1.5 mb-1">
            <Coins className="w-3.5 h-3.5 text-blue-400" /> Token Collection
          </div>
          <div className="text-lg font-bold text-white tracking-tight flex items-baseline gap-2">
            <span>{metadata.name}</span>
            <span className="text-xs font-mono px-2 py-0.5 rounded bg-blue-500/20 text-blue-300">
              {metadata.symbol}
            </span>
          </div>
          <div className="text-[11px] text-slate-500 mt-1 font-mono">{metadata.decimals} Decimals</div>
        </div>

        {/* Total Circulation */}
        <div className="p-4 rounded-xl bg-slate-950/50 border border-slate-800 hover:border-slate-700 transition-colors">
          <div className="text-xs text-slate-400 flex items-center gap-1.5 mb-1">
            <Layers className="w-3.5 h-3.5 text-indigo-400" /> Total Supply
          </div>
          <div className="text-lg font-bold text-white tracking-tight font-mono">
            {formatUnits(metadata.totalSupply, metadata.decimals)}
          </div>
          <div className="text-[11px] text-slate-500 mt-1 font-mono">
            {metadata.symbol} in circulation
          </div>
        </div>

        {/* Current User Balance */}
        <div className="p-4 rounded-xl bg-slate-950/50 border border-slate-800 hover:border-slate-700 transition-colors">
          <div className="text-xs text-slate-400 flex items-center gap-1.5 mb-1">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" /> Your Balance
          </div>
          <div className="text-lg font-bold text-emerald-400 tracking-tight font-mono">
            {formatUnits(userBalance, metadata.decimals)}
          </div>
          <div className="text-[11px] text-slate-500 mt-1 font-mono truncate flex items-center justify-between">
            <span>
              {activeIdentity
                ? activeIdentity.label
                : accountAddress
                ? `${accountAddress.slice(0, 10)}...`
                : 'Not Connected'}
            </span>
            {!isConnected && (
              <button
                type="button"
                onClick={() => connectWallet()}
                className="text-[11px] font-sans text-cyan-400 hover:text-cyan-300 font-semibold underline ml-2 transition-colors cursor-pointer"
              >
                Connect
              </button>
            )}
          </div>
        </div>

        {/* Protocol Runtime */}
        <div className="p-4 rounded-xl bg-slate-950/50 border border-slate-800 hover:border-slate-700 transition-colors">
          <div className="text-xs text-slate-400 flex items-center gap-1.5 mb-1">
            <Zap className="w-3.5 h-3.5 text-cyan-400" /> Compact Runtime
          </div>
          <div className="text-lg font-bold text-white tracking-tight font-mono">
            v0.16.0
          </div>
          <div className="text-[11px] text-slate-500 mt-1 font-mono">
            Zero-Knowledge SNARKs
          </div>
        </div>
      </div>
    </div>
  );
};
