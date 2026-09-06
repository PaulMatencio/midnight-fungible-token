'use client';

import React, { useState, useEffect } from 'react';
import {
  Users,
  Coins,
  Percent,
  TrendingUp,
  RefreshCw,
  ExternalLink,
  Copy,
  Check,
  Search,
  Server,
  Layers,
  Sparkles,
  Info,
  ShieldCheck,
  Lock,
} from 'lucide-react';
import type { IndexerTokenReport, AccountShare } from '@/src/infrastructure/midnight/midnight-indexer-client';
import { useConfig } from '@/src/presentation/context/ConfigContext';

interface AccountSharesViewerProps {
  report: IndexerTokenReport | null;
  isLoading: boolean;
  onRefresh: () => void;
  contractAddress: string;
  activeNetworkId?: string;
  synchronizedLedgerReport?: IndexerTokenReport | null;
}

const PALETTE = [
  'bg-blue-500',
  'bg-cyan-400',
  'bg-emerald-400',
  'bg-indigo-500',
  'bg-purple-500',
  'bg-amber-400',
  'bg-rose-400',
  'bg-teal-400',
];

export const AccountSharesViewer: React.FC<AccountSharesViewerProps> = ({
  report,
  isLoading,
  onRefresh,
  contractAddress,
  synchronizedLedgerReport,
}) => {
  const { config, getExplorerTxUrl } = useConfig();
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [viewMode, setViewMode] = useState<'indexer' | 'synchronized'>('synchronized');
  const [displayFormat, setDisplayFormat] = useState<'bech32' | 'hex'>('bech32');
  const [searchQuery, setSearchQuery] = useState('');

  // Default to synchronized if indexer is empty or has 0 holders
  const activeReport =
    viewMode === 'indexer'
      ? report || synchronizedLedgerReport
      : synchronizedLedgerReport || report;

  const copyToClipboard = async (text: string, index: number) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedIndex(index);
      setTimeout(() => setCopiedIndex(null), 2000);
    } catch {}
  };

  const filteredHolders = (activeReport?.holders || []).filter((h) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      h.addressBech32.toLowerCase().includes(q) ||
      h.addressHex.toLowerCase().includes(q) ||
      (h.label && h.label.toLowerCase().includes(q))
    );
  });

  return (
    <div className="rounded-2xl bg-gradient-to-b from-slate-900/90 to-slate-950/90 border border-slate-800/80 p-4 sm:p-6 space-y-6 shadow-xl">
      {/* Top Header Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800/80 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-blue-500/10 border border-blue-500/20 text-cyan-400">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold text-white tracking-tight flex items-center gap-2">
                <span>Account Share & Distribution</span>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-300 border border-blue-500/20">
                  Midnight Indexer
                </span>
              </h3>
              <p className="text-xs text-slate-400">
                Holders breakdown and circulating token percentages decoded from on-chain state
              </p>
            </div>
          </div>
        </div>

        {/* View mode toggle & refresh */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Data source switcher */}
          <div className="flex items-center p-1 rounded-xl bg-slate-950 border border-slate-800 text-xs shadow-inner">
            <button
              onClick={() => setViewMode('synchronized')}
              className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
                viewMode === 'synchronized'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="View current synchronized state (including staged session transactions)"
            >
              Active Ledger
            </button>
            <button
              onClick={() => setViewMode('indexer')}
              className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
                viewMode === 'indexer'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Query strict confirmed on-chain state from Midnight Indexer"
            >
              Live Indexer
            </button>
          </div>

          {/* Refresh Button */}
          <button
            onClick={onRefresh}
            disabled={isLoading}
            className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700/60 text-xs text-slate-200 font-medium transition-all shadow-sm active:scale-95 disabled:opacity-60 cursor-pointer"
            title="Fetch fresh contract state from the Midnight Indexer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-cyan-400' : ''}`} />
            <span>{isLoading ? 'Querying Indexer...' : 'Refresh'}</span>
          </button>
        </div>
      </div>

      {/* Indexer Metadata Banner */}
      <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800/80 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs text-slate-400 font-mono">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-1.5">
            <Server className="w-3.5 h-3.5 text-emerald-400" />
            <span>Endpoint:</span>
            <span className="text-slate-200 truncate max-w-[200px]" title={config.indexerUrl}>
              {config.indexerUrl}
            </span>
          </div>

          {activeReport?.blockHeight !== undefined && (
            <div className="flex items-center gap-1.5">
              <span className="text-slate-500">•</span>
              <span>Block:</span>
              <span className="text-cyan-300 font-bold">#{activeReport.blockHeight}</span>
            </div>
          )}

          {activeReport?.txHash && (
            <div className="flex items-center gap-1.5">
              <span className="text-slate-500">•</span>
              <span>Action Tx:</span>
              <a
                href={getExplorerTxUrl(activeReport.txHash)}
                target="_blank"
                rel="noreferrer"
                className="text-blue-400 hover:text-blue-300 flex items-center gap-1 transition-colors"
              >
                <span>{activeReport.txHash.slice(0, 10)}...</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 text-[11px]">
          <span className="text-slate-500">Source:</span>
          <span
            className={`px-2 py-0.5 rounded font-semibold uppercase text-[10px] ${
              activeReport?.source === 'indexer'
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                : 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
            }`}
          >
            {activeReport?.source === 'indexer' ? 'On-Chain Indexer' : 'Active Ledger'}
          </span>
        </div>
      </div>

      {/* 4 Summary Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Metric 1: Circulating Total Supply */}
        <div className="p-3.5 sm:p-4 rounded-xl bg-slate-950/70 border border-slate-800/80">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
            <span>Circulating Supply</span>
            <Coins className="w-4 h-4 text-blue-400" />
          </div>
          <div className="text-lg sm:text-xl font-bold font-mono text-white tracking-tight truncate">
            {activeReport?.formattedTotalSupply || '0'}
          </div>
          <div className="text-[11px] text-slate-400 font-mono mt-0.5">
            {activeReport?.symbol || 'MFT'} ({activeReport?.name || 'Token'})
          </div>
        </div>

        {/* Metric 2: Total Holders */}
        <div className="p-3.5 sm:p-4 rounded-xl bg-slate-950/70 border border-slate-800/80">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
            <span>Holders Count</span>
            <Users className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="text-lg sm:text-xl font-bold font-mono text-cyan-300 tracking-tight">
            {activeReport?.holdersCount || 0}
          </div>
          <div className="text-[11px] text-slate-400 font-mono mt-0.5">
            Unique addresses with balance
          </div>
        </div>

        {/* Metric 3: Largest Holder Share */}
        <div className="p-3.5 sm:p-4 rounded-xl bg-slate-950/70 border border-slate-800/80">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
            <span>Largest Holder</span>
            <Percent className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-lg sm:text-xl font-bold font-mono text-emerald-300 tracking-tight">
            {activeReport?.largestHolderShare ? `${activeReport.largestHolderShare}%` : '0%'}
          </div>
          <div className="text-[11px] text-slate-400 font-mono mt-0.5">
            Max single wallet holding
          </div>
        </div>

        {/* Metric 4: Top 3 Concentration */}
        <div className="p-3.5 sm:p-4 rounded-xl bg-slate-950/70 border border-slate-800/80">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
            <span>Top 3 Concentration</span>
            <TrendingUp className="w-4 h-4 text-purple-400" />
          </div>
          <div className="text-lg sm:text-xl font-bold font-mono text-purple-300 tracking-tight">
            {activeReport?.top3Share ? `${activeReport.top3Share}%` : '0%'}
          </div>
          <div className="text-[11px] text-slate-400 font-mono mt-0.5">
            Combined share of top 3
          </div>
        </div>
      </div>

      {/* Visual Share Breakdown Multi-color Bar */}
      {activeReport && activeReport.holders.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-300">
            <span className="font-semibold">Distribution Ratio</span>
            <span className="text-slate-400 font-mono text-[11px]">
              {activeReport.holders.length} Account{activeReport.holders.length > 1 ? 's' : ''}
            </span>
          </div>

          {/* Segmented Bar */}
          <div className="h-3.5 w-full bg-slate-950 rounded-full overflow-hidden flex border border-slate-800/80 shadow-inner">
            {activeReport.holders.map((holder, idx) => {
              const colorClass = PALETTE[idx % PALETTE.length];
              const pct = holder.sharePercentage;
              if (pct <= 0) return null;
              return (
                <div
                  key={holder.addressHex}
                  style={{ width: `${Math.max(pct, 1)}%` }}
                  className={`h-full ${colorClass} transition-all duration-500 hover:opacity-80`}
                  title={`${holder.label || holder.addressBech32}: ${pct}% (${holder.formattedBalance})`}
                />
              );
            })}
          </div>

          {/* Mini legend */}
          <div className="flex flex-wrap items-center gap-3 pt-1">
            {activeReport.holders.slice(0, 5).map((holder, idx) => (
              <div key={holder.addressHex} className="flex items-center gap-1.5 text-[11px] font-mono">
                <span className={`w-2.5 h-2.5 rounded-full ${PALETTE[idx % PALETTE.length]}`} />
                <span className="text-slate-300 font-medium">
                  {holder.label || `${holder.addressBech32.slice(0, 8)}...`}
                </span>
                <span className="text-slate-400 font-bold">({holder.sharePercentage}%)</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Search & Format Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
        {/* Search */}
        <div className="relative flex-1 max-w-sm">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search address or label..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-blue-500/50 font-mono"
          />
        </div>

        {/* Address Format Switcher (Bech32 vs Hex) */}
        <div className="flex items-center gap-2 self-end sm:self-auto">
          <span className="text-xs text-slate-400">Display:</span>
          <div className="flex items-center p-0.5 rounded-lg bg-slate-950 border border-slate-800 text-[11px]">
            <button
              onClick={() => setDisplayFormat('bech32')}
              className={`px-2.5 py-1 rounded font-medium transition-all ${
                displayFormat === 'bech32'
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Bech32m
            </button>
            <button
              onClick={() => setDisplayFormat('hex')}
              className={`px-2.5 py-1 rounded font-medium transition-all ${
                displayFormat === 'hex'
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Hex (32B)
            </button>
          </div>
        </div>
      </div>

      {/* Holders Table / List */}
      {filteredHolders.length > 0 ? (
        <div className="overflow-x-auto rounded-xl border border-slate-800/80">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/80 text-slate-400 border-b border-slate-800 font-mono text-[11px] uppercase tracking-wider">
              <tr>
                <th className="py-3 px-3.5 w-12 text-center">#</th>
                <th className="py-3 px-4">Account Holder</th>
                <th className="py-3 px-4 text-right">Balance</th>
                <th className="py-3 px-4 w-44 text-right">Share of Supply</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50 bg-slate-950/40">
              {filteredHolders.map((holder, idx) => {
                const addr =
                  displayFormat === 'bech32' ? holder.addressBech32 : holder.addressHex;
                const isCopied = copiedIndex === idx;

                return (
                  <tr key={holder.addressHex} className="hover:bg-slate-900/50 transition-colors">
                    {/* Rank */}
                    <td className="py-3 px-3.5 text-center font-mono font-bold text-slate-400">
                      #{idx + 1}
                    </td>

                    {/* Account */}
                    <td className="py-3 px-4">
                      <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
                        <div className="flex items-center gap-1.5 font-mono text-slate-200">
                          <span
                            className="truncate max-w-[160px] sm:max-w-[240px]"
                            title={addr}
                          >
                            {addr.length > 20
                              ? `${addr.slice(0, 10)}...${addr.slice(-8)}`
                              : addr}
                          </span>
                          <button
                            onClick={() => copyToClipboard(addr, idx)}
                            className="text-slate-400 hover:text-white p-1 rounded hover:bg-slate-800 transition-colors"
                            title="Copy full address"
                          >
                            {isCopied ? (
                              <Check className="w-3.5 h-3.5 text-emerald-400" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </div>

                        {/* Badges */}
                        <div className="flex items-center gap-1">
                          {holder.isCurrentUser && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                              You
                            </span>
                          )}
                          {holder.isOwner && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-1">
                              <ShieldCheck className="w-3 h-3" />
                              Owner
                            </span>
                          )}
                          {holder.label && !holder.isCurrentUser && !holder.isOwner && (
                            <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                              {holder.label}
                            </span>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Balance */}
                    <td className="py-3 px-4 text-right font-mono font-bold text-white">
                      {holder.formattedBalance}{' '}
                      <span className="text-slate-400 font-normal">
                        {activeReport?.symbol || 'MFT'}
                      </span>
                    </td>

                    {/* Share Percentage */}
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <div className="w-20 h-2 bg-slate-900 rounded-full overflow-hidden hidden sm:block">
                          <div
                            style={{ width: `${Math.min(holder.sharePercentage, 100)}%` }}
                            className={`h-full ${PALETTE[idx % PALETTE.length]}`}
                          />
                        </div>
                        <span className="font-mono font-bold text-cyan-300 text-xs min-w-[50px] text-right">
                          {holder.sharePercentage.toFixed(2)}%
                        </span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        /* Empty / Guidance state */
        <div className="p-8 rounded-xl bg-slate-950/60 border border-slate-800/80 text-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center mx-auto">
            <Users className="w-6 h-6" />
          </div>
          <h4 className="text-sm font-bold text-white">No Account Holders Found Yet</h4>
          <p className="text-xs text-slate-400 max-w-md mx-auto leading-relaxed">
            {viewMode === 'indexer'
              ? 'The on-chain contract state indexed on Midnight Preprod currently has no account balances. Once tokens are minted via a confirmed circuit transaction, the indexer will populate holder shares.'
              : 'The active synchronized ledger currently has 0 holders. Initialize the contract and mint tokens in the Actions tab to create an initial distribution.'}
          </p>
          <div className="pt-2 flex justify-center gap-2">
            <button
              onClick={onRefresh}
              className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs transition-colors flex items-center gap-2"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Poll Indexer Again</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
