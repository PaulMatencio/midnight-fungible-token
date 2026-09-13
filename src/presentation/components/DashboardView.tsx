'use client';

import React, { useMemo } from 'react';
import {
  Coins,
  TrendingUp,
  PieChart,
  BarChart3,
  Activity,
  ShieldCheck,
  AlertTriangle,
  ArrowUpRight,
  Zap,
  Database,
  RefreshCw,
  ExternalLink,
  Lock,
  Unlock,
  Users,
  CheckCircle2,
  Clock,
  Sparkles,
  Layers,
  Flame,
  ArrowRight,
  ShieldAlert,
  Server,
  Wallet,
  Copy,
  Check,
  Send,
  RotateCcw,
  Cpu,
} from 'lucide-react';
import type { TokenMetadata, ActivityItem } from '@/src/types/dapp';
import type { IndexerTokenReport } from '@/src/infrastructure/midnight/midnight-indexer-client';
import type { ActiveNavTab } from './Sidebar';
import { getExplorerTxUrl, getExplorerContractUrl } from '@/src/infrastructure/config/midnight-config';
import { formatBalance } from '@/src/presentation/utils/format';

interface DashboardViewProps {
  contractAddress: string;
  metadata: TokenMetadata;
  userBalance: bigint;
  lockedRawBalance?: bigint;
  accountAddress: string | null;
  userDerivedAccountHex?: string | null;
  isConnected: boolean;
  isWalletLocked: boolean;
  synchronizedLedgerReport?: IndexerTokenReport | null;
  indexerReport?: IndexerTokenReport | null;
  activityLog: ActivityItem[];
  infraStatus?: {
    proofServer: boolean;
    indexer: boolean;
  };
  preset: string;
  onNavigateTab: (tab: ActiveNavTab, actionFocus?: string) => void;
  onRefreshLedger: () => void;
  onOpenSettings: () => void;
  onOpenWalletModal: () => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  contractAddress,
  metadata,
  userBalance,
  lockedRawBalance = 0n,
  accountAddress,
  userDerivedAccountHex,
  isConnected,
  isWalletLocked,
  synchronizedLedgerReport,
  indexerReport,
  activityLog,
  infraStatus,
  preset,
  onNavigateTab,
  onRefreshLedger,
  onOpenSettings,
  onOpenWalletModal,
}) => {
  const [copiedAddr, setCopiedAddr] = React.useState(false);
  const [isRefreshing, setIsRefreshing] = React.useState(false);

  const activeReport = synchronizedLedgerReport || indexerReport;

  const copyContractAddress = () => {
    navigator.clipboard.writeText(contractAddress);
    setCopiedAddr(true);
    setTimeout(() => setCopiedAddr(false), 2000);
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await onRefreshLedger();
    } finally {
      setTimeout(() => setIsRefreshing(false), 600);
    }
  };

  // Calculations
  const MAX_UINT128 = 340282366920938463463374607431768211455n;
  const isCapped = Boolean(metadata.maxSupply && metadata.maxSupply > 0n && metadata.maxSupply < MAX_UINT128);
  const maxSupplyBig = isCapped ? metadata.maxSupply! : (10_000_000n * (10n ** BigInt(metadata.decimals)));
  const remainingCapacityBig = maxSupplyBig > metadata.totalSupply ? maxSupplyBig - metadata.totalSupply : 0n;

  const totalSupplyNum = Number(metadata.totalSupply);
  const maxSupplyNum = Number(maxSupplyBig);
  const circulatingPct = maxSupplyNum > 0 ? Math.min(100, (totalSupplyNum / maxSupplyNum) * 100) : 0;
  const remainingPct = Math.max(0, 100 - circulatingPct);

  const userBalanceNum = Number(userBalance);
  const userSharePct = totalSupplyNum > 0 ? ((userBalanceNum / totalSupplyNum) * 100).toFixed(2) : '0.00';

  // Activity analytics
  const circuitBreakdown = useMemo(() => {
    const counts: Record<string, number> = {};
    let confirmedCount = 0;
    let failedCount = 0;

    for (const item of activityLog) {
      counts[item.circuitName] = (counts[item.circuitName] || 0) + 1;
      if (item.status === 'confirmed') confirmedCount++;
      if (item.status === 'failed') failedCount++;
    }

    const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
    const total = activityLog.length;

    return {
      counts: sorted,
      total,
      confirmedCount,
      failedCount,
      successRate: total > 0 ? Math.round((confirmedCount / total) * 100) : 100,
    };
  }, [activityLog]);

  // Top holders sorted
  const topHolders = useMemo(() => {
    if (!activeReport?.holders || activeReport.holders.length === 0) {
      return [];
    }
    return [...activeReport.holders]
      .sort((a, b) => (b.balance > a.balance ? 1 : b.balance < a.balance ? -1 : 0))
      .slice(0, 5);
  }, [activeReport]);

  // Donut SVG parameters
  const radius = 60;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (circulatingPct / 100) * circumference;

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* 1. Executive Panoramic Header */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-slate-950 to-slate-900 border border-slate-800/80 p-6 sm:p-8 shadow-2xl backdrop-blur-xl">
        <div className="absolute top-0 right-0 -mt-8 -mr-8 w-72 h-72 rounded-full bg-cyan-500/10 blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/3 -mb-12 w-64 h-64 rounded-full bg-blue-600/10 blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2 sm:gap-3">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-cyan-500/10 text-cyan-300 border border-cyan-500/25 shadow-sm">
                <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                <span>Midnight Compact v2.3</span>
              </span>

              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-slate-800/90 text-slate-300 border border-slate-700/60">
                <Server className="w-3.5 h-3.5 text-emerald-400" />
                <span className="capitalize">{preset} Network</span>
              </span>

              {metadata.isPaused ? (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-rose-500/15 text-rose-300 border border-rose-500/30">
                  <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />
                  <span>Protocol Paused</span>
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span>Circuits Live & Operational</span>
                </span>
              )}
            </div>

            <div className="flex items-baseline gap-3 pt-1">
              <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-white tracking-tight">
                {metadata.name || 'Fungible Token'}{' '}
                <span className="text-cyan-400 font-mono">({metadata.symbol || 'FT'})</span>
              </h1>
            </div>

            <div className="flex flex-wrap items-center gap-2 pt-1 text-xs text-slate-400">
              <span className="text-slate-400">Contract Address:</span>
              <code className="px-2.5 py-1 rounded-lg bg-slate-950/80 border border-slate-800 font-mono text-cyan-300 select-all">
                {contractAddress ? `${contractAddress.slice(0, 14)}...${contractAddress.slice(-10)}` : 'Not Set'}
              </code>
              <button
                type="button"
                onClick={copyContractAddress}
                className="p-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
                title="Copy full contract address"
              >
                {copiedAddr ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
              <a
                href={getExplorerContractUrl(contractAddress, preset)}
                target="_blank"
                rel="noreferrer"
                className="p-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-cyan-300 transition-colors flex items-center gap-1"
                title="View in Midnight Explorer"
              >
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 self-start lg:self-center">
            <button
              type="button"
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="px-4 py-2.5 rounded-xl bg-slate-800/90 hover:bg-slate-700/90 border border-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-2 transition-all shadow-md active:scale-95 disabled:opacity-50 cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-cyan-400 ${isRefreshing ? 'animate-spin' : ''}`} />
              <span>{isRefreshing ? 'Syncing...' : 'Sync Ledger'}</span>
            </button>

            <button
              type="button"
              onClick={() => onNavigateTab('actions', 'mint')}
              className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white text-xs font-bold flex items-center gap-2 transition-all shadow-lg shadow-cyan-500/20 active:scale-95 cursor-pointer"
            >
              <Zap className="w-3.5 h-3.5 text-white" />
              <span>Quick Mint</span>
            </button>

            <button
              type="button"
              onClick={() => onNavigateTab('actions', 'transfer')}
              className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs font-bold flex items-center gap-2 transition-all shadow-lg shadow-blue-500/20 active:scale-95 cursor-pointer"
            >
              <Send className="w-3.5 h-3.5 text-white" />
              <span>Transfer</span>
            </button>
          </div>
        </div>
      </div>

      {/* 2. Critical Alert Banner if Trapped / Raw Tokens Exist */}
      {lockedRawBalance > 0 && (
        <div className="p-5 rounded-2xl bg-amber-950/40 border border-amber-500/50 shadow-lg shadow-amber-950/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 animate-in slide-in-from-top duration-300">
          <div className="flex items-start gap-3.5">
            <div className="p-2.5 rounded-xl bg-amber-500/20 border border-amber-500/30 text-amber-400 flex-shrink-0">
              <Lock className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-amber-200">
                  {formatBalance(lockedRawBalance, metadata.decimals)} {metadata.symbol} Locked in Raw Address
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  Action Required
                </span>
              </div>
              <p className="text-xs text-amber-300/80 mt-1 max-w-2xl leading-relaxed">
                Tokens were minted or sent directly to an unshielded raw Lace wallet address rather than its derived spendable contract account.
                Use <strong>Admin Reallocate</strong> to safely move these tokens into your spendable balance.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => onNavigateTab('actions', 'reallocate')}
            className="whitespace-nowrap px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center gap-2 shadow-md transition-all active:scale-95 self-stretch sm:self-auto justify-center cursor-pointer"
          >
            <span>Rescue with Admin Reallocate</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* 3. Executive KPI Cards (6 Grid Layout) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3 sm:gap-4">
        {/* KPI 1: Circulating Total Supply */}
        <div className="p-4 rounded-2xl bg-slate-900/80 hover:bg-slate-900 border border-slate-800/80 shadow-md transition-all flex flex-col justify-between group">
          <div>
            <div className="flex items-center justify-between text-xs text-slate-400 mb-1.5">
              <span className="font-medium">Total Supply</span>
              <Coins className="w-4 h-4 text-cyan-400 group-hover:scale-110 transition-transform" />
            </div>
            <div className="text-xl sm:text-2xl font-black font-mono text-white tracking-tight truncate">
              {formatBalance(metadata.totalSupply, metadata.decimals)}
            </div>
            <div className="text-[11px] text-slate-400 font-mono mt-0.5">
              {metadata.symbol || 'FT'}
            </div>
          </div>
          <div className="mt-3 pt-2 border-t border-slate-800/60">
            <div className="flex justify-between text-[10px] text-slate-400 font-mono mb-1">
              <span>Circulating</span>
              <span>{circulatingPct.toFixed(1)}% of Cap</span>
            </div>
            <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-cyan-500 to-blue-500 rounded-full transition-all duration-500"
                style={{ width: `${Math.max(2, circulatingPct)}%` }}
              />
            </div>
          </div>
        </div>

        {/* KPI 2: Minting Capacity Reserve */}
        <div className="p-4 rounded-2xl bg-slate-900/80 hover:bg-slate-900 border border-slate-800/80 shadow-md transition-all flex flex-col justify-between group">
          <div>
            <div className="flex items-center justify-between text-xs text-slate-400 mb-1.5">
              <span className="font-medium">Remaining Cap</span>
              <TrendingUp className="w-4 h-4 text-emerald-400 group-hover:scale-110 transition-transform" />
            </div>
            <div className="text-xl sm:text-2xl font-black font-mono text-emerald-300 tracking-tight truncate">
              {formatBalance(remainingCapacityBig, metadata.decimals)}
            </div>
            <div className="text-[11px] text-slate-400 font-mono mt-0.5">
              Hard Cap: {isCapped ? formatBalance(metadata.maxSupply!, metadata.decimals) : 'Uncapped'}
            </div>
          </div>
          <div className="mt-3 pt-2 border-t border-slate-800/60 flex items-center justify-between text-[11px]">
            <span className="text-slate-400">Available</span>
            <span className="font-semibold text-emerald-400 font-mono">{remainingPct.toFixed(1)}%</span>
          </div>
        </div>

        {/* KPI 3: Your Spendable Balance */}
        <div className="p-4 rounded-2xl bg-slate-900/80 hover:bg-slate-900 border border-slate-800/80 shadow-md transition-all flex flex-col justify-between group">
          <div>
            <div className="flex items-center justify-between text-xs text-slate-400 mb-1.5">
              <span className="font-medium">Spendable Balance</span>
              <Wallet className="w-4 h-4 text-blue-400 group-hover:scale-110 transition-transform" />
            </div>
            <div className="text-xl sm:text-2xl font-black font-mono text-cyan-300 tracking-tight truncate">
              {formatBalance(userBalance, metadata.decimals)}
            </div>
            <div className="text-[11px] text-slate-400 font-mono mt-0.5">
              {metadata.symbol} ({userSharePct}% of Supply)
            </div>
          </div>
          <div className="mt-3 pt-2 border-t border-slate-800/60 flex items-center justify-between text-[11px]">
            <span className="text-slate-400">Status</span>
            <span className="font-semibold text-cyan-400 flex items-center gap-1">
              <Unlock className="w-3 h-3" />
              <span>Spendable</span>
            </span>
          </div>
        </div>

        {/* KPI 4: Raw / Locked Balance */}
        <div
          className={`p-4 rounded-2xl border shadow-md transition-all flex flex-col justify-between group ${
            lockedRawBalance > 0
              ? 'bg-amber-950/20 border-amber-500/40 hover:border-amber-500/60'
              : 'bg-slate-900/80 hover:bg-slate-900 border-slate-800/80'
          }`}
        >
          <div>
            <div className="flex items-center justify-between text-xs text-slate-400 mb-1.5">
              <span className="font-medium">Locked in Raw</span>
              <Lock
                className={`w-4 h-4 group-hover:scale-110 transition-transform ${
                  lockedRawBalance > 0 ? 'text-amber-400 animate-pulse' : 'text-slate-500'
                }`}
              />
            </div>
            <div
              className={`text-xl sm:text-2xl font-black font-mono tracking-tight truncate ${
                lockedRawBalance > 0 ? 'text-amber-300' : 'text-slate-400'
              }`}
            >
              {formatBalance(lockedRawBalance, metadata.decimals)}
            </div>
            <div className="text-[11px] text-slate-400 font-mono mt-0.5">
              {metadata.symbol}
            </div>
          </div>
          <div className="mt-3 pt-2 border-t border-slate-800/60 flex items-center justify-between text-[11px]">
            <span className="text-slate-400">Status</span>
            {lockedRawBalance > 0 ? (
              <button
                type="button"
                onClick={() => onNavigateTab('actions', 'reallocate')}
                className="font-bold text-amber-400 hover:text-amber-300 flex items-center gap-0.5 transition-colors"
              >
                <span>Reallocate</span>
                <span>→</span>
              </button>
            ) : (
              <span className="font-semibold text-emerald-400 flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" />
                <span>0 Locked</span>
              </span>
            )}
          </div>
        </div>

        {/* KPI 5: Active Holders Count */}
        <div className="p-4 rounded-2xl bg-slate-900/80 hover:bg-slate-900 border border-slate-800/80 shadow-md transition-all flex flex-col justify-between group">
          <div>
            <div className="flex items-center justify-between text-xs text-slate-400 mb-1.5">
              <span className="font-medium">Active Holders</span>
              <Users className="w-4 h-4 text-purple-400 group-hover:scale-110 transition-transform" />
            </div>
            <div className="text-xl sm:text-2xl font-black font-mono text-purple-300 tracking-tight">
              {activeReport?.holdersCount ?? topHolders.length ?? 0}
            </div>
            <div className="text-[11px] text-slate-400 font-mono mt-0.5">
              Accounts on-chain
            </div>
          </div>
          <div className="mt-3 pt-2 border-t border-slate-800/60 flex items-center justify-between text-[11px]">
            <span className="text-slate-400">Concentration</span>
            <button
              type="button"
              onClick={() => onNavigateTab('ledger')}
              className="text-purple-400 hover:text-purple-300 font-medium transition-colors flex items-center gap-0.5"
            >
              <span>View Shares</span>
              <span>→</span>
            </button>
          </div>
        </div>

        {/* KPI 6: Security & Protocol State */}
        <div className="p-4 rounded-2xl bg-slate-900/80 hover:bg-slate-900 border border-slate-800/80 shadow-md transition-all flex flex-col justify-between group">
          <div>
            <div className="flex items-center justify-between text-xs text-slate-400 mb-1.5">
              <span className="font-medium">Security & Guard</span>
              <ShieldCheck className="w-4 h-4 text-emerald-400 group-hover:scale-110 transition-transform" />
            </div>
            <div className="text-base sm:text-lg font-bold text-white tracking-tight flex items-center gap-1.5">
              <span
                className={`w-2.5 h-2.5 rounded-full ${
                  metadata.isPaused ? 'bg-rose-400' : 'bg-emerald-400 animate-pulse'
                }`}
              />
              <span>{metadata.isPaused ? 'Paused' : 'Guarded'}</span>
            </div>
            <div className="text-[11px] text-slate-400 font-mono mt-0.5 truncate">
              {metadata.owner ? `Owner: ${metadata.owner.slice(0, 8)}...` : 'Owner Configured'}
            </div>
          </div>
          <div className="mt-3 pt-2 border-t border-slate-800/60 flex items-center justify-between text-[11px]">
            <span className="text-slate-400">Infra Nodes</span>
            <span className="text-emerald-400 font-mono text-[10px]">
              {infraStatus?.indexer && infraStatus?.proofServer ? 'Operational' : 'Syncing'}
            </span>
          </div>
        </div>
      </div>

      {/* 4. Rich Analytical Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Chart A: Donut Chart - Circulating vs Remaining Capacity (5 cols) */}
        <div className="lg:col-span-5 p-6 rounded-3xl bg-slate-900/70 border border-slate-800/80 shadow-xl flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <PieChart className="w-4 h-4 text-cyan-400" />
                <h3 className="text-sm font-bold text-white tracking-tight">Token Supply Allocation</h3>
              </div>
              <span className="text-xs text-slate-400 font-mono">{metadata.symbol}</span>
            </div>

            {/* Responsive SVG Donut */}
            <div className="relative flex items-center justify-center my-4 py-2">
              <svg className="w-44 h-44 -rotate-90 transform" viewBox="0 0 160 160">
                {/* Background Ring */}
                <circle
                  cx="80"
                  cy="80"
                  r={radius}
                  stroke="currentColor"
                  strokeWidth="16"
                  className="text-slate-800/70"
                  fill="transparent"
                />
                {/* Circulating Ring */}
                <circle
                  cx="80"
                  cy="80"
                  r={radius}
                  stroke="url(#donutGradient)"
                  strokeWidth="16"
                  strokeDasharray={circumference}
                  strokeDashoffset={strokeDashoffset}
                  strokeLinecap="round"
                  className="transition-all duration-1000 ease-out"
                  fill="transparent"
                />
                <defs>
                  <linearGradient id="donutGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#06b6d4" />
                    <stop offset="100%" stopColor="#3b82f6" />
                  </linearGradient>
                </defs>
              </svg>

              {/* Center Metrics */}
              <div className="absolute flex flex-col items-center justify-center text-center pointer-events-none">
                <span className="text-2xl font-black font-mono text-white tracking-tight">
                  {circulatingPct.toFixed(1)}%
                </span>
                <span className="text-[10px] text-cyan-300 font-medium tracking-wide uppercase">
                  Circulating
                </span>
              </div>
            </div>

            {/* Legend */}
            <div className="space-y-2 mt-4 pt-4 border-t border-slate-800/60 text-xs">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-md bg-gradient-to-r from-cyan-500 to-blue-500" />
                  <span className="text-slate-300">Circulating Supply</span>
                </div>
                <span className="font-mono font-bold text-white">
                  {formatBalance(metadata.totalSupply, metadata.decimals)} ({circulatingPct.toFixed(2)}%)
                </span>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-md bg-slate-800" />
                  <span className="text-slate-400">Available Minting Reserve</span>
                </div>
                <span className="font-mono font-bold text-slate-300">
                  {formatBalance(remainingCapacityBig, metadata.decimals)} ({remainingPct.toFixed(2)}%)
                </span>
              </div>

              <div className="flex items-center justify-between pt-1 text-[11px] text-slate-400 border-t border-slate-800/30">
                <span>Hard Cap Maximum</span>
                <span className="font-mono font-semibold text-slate-200">
                  {isCapped ? formatBalance(metadata.maxSupply!, metadata.decimals) : 'Uncapped'} {metadata.symbol}
                </span>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => onNavigateTab('actions', 'mint')}
            className="w-full mt-5 py-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-cyan-300 hover:text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors border border-slate-700/60 cursor-pointer"
          >
            <span>Mint More Tokens</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Chart B: Top Account Holder Concentration (7 cols) */}
        <div className="lg:col-span-7 p-6 rounded-3xl bg-slate-900/70 border border-slate-800/80 shadow-xl flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-purple-400" />
                <h3 className="text-sm font-bold text-white tracking-tight">Top Account Shares & Distribution</h3>
              </div>
              <button
                type="button"
                onClick={() => onNavigateTab('ledger')}
                className="text-xs text-purple-400 hover:text-purple-300 font-medium transition-colors flex items-center gap-1"
              >
                <span>Full Ledger</span>
                <span>→</span>
              </button>
            </div>

            {topHolders.length > 0 ? (
              <div className="space-y-3.5 mt-2">
                {topHolders.map((holder, idx) => {
                  const sharePct = holder.sharePercentage ?? 0;
                  const isCurrent = Boolean(
                    holder.isCurrentUser ||
                    (userDerivedAccountHex && holder.addressHex?.toLowerCase() === userDerivedAccountHex.toLowerCase()) ||
                    (accountAddress &&
                      (holder.addressHex?.toLowerCase().includes(accountAddress.toLowerCase().replace(/^0x/, '')) ||
                        holder.addressBech32?.toLowerCase() === accountAddress.toLowerCase()))
                  );
                  const isOwner =
                    holder.isOwner ||
                    (metadata.owner && holder.addressHex?.toLowerCase() === metadata.owner.toLowerCase());

                  return (
                    <div key={holder.addressHex || idx} className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="w-4 text-[11px] font-mono text-slate-400 font-bold">#{idx + 1}</span>
                          <span className="font-mono text-slate-300">
                            {holder.label || `${holder.addressHex?.slice(0, 10)}...${holder.addressHex?.slice(-6)}`}
                          </span>
                          {isCurrent && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 flex items-center gap-1 shadow-sm">
                              <Sparkles className="w-2.5 h-2.5 text-cyan-400" />
                              You
                            </span>
                          )}
                          {isOwner && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                              Owner
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="font-mono font-bold text-white">
                            {formatBalance(holder.balance, metadata.decimals)} {metadata.symbol}
                          </span>
                          <span className="font-mono text-[11px] text-slate-400 w-12 text-right">
                            {sharePct.toFixed(1)}%
                          </span>
                        </div>
                      </div>

                      {/* Mapping subtitle when holder is current user */}
                      {isCurrent && accountAddress && (
                        <div className="text-[10px] text-cyan-400/80 font-mono flex items-center gap-1.5 pl-6">
                          <span>↳ Mapped to Lace:</span>
                          <span className="text-slate-300 truncate max-w-[200px] sm:max-w-[320px]" title={accountAddress}>
                            {accountAddress.length > 22
                              ? `${accountAddress.slice(0, 12)}...${accountAddress.slice(-8)}`
                              : accountAddress}
                          </span>
                        </div>
                      )}

                      {/* Bar visual */}
                      <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${
                            isCurrent
                              ? 'bg-gradient-to-r from-cyan-400 to-blue-500 shadow-[0_0_8px_rgba(6,182,212,0.5)]'
                              : isOwner
                              ? 'bg-gradient-to-r from-amber-400 to-amber-500'
                              : 'bg-gradient-to-r from-purple-500 to-indigo-500'
                          }`}
                          style={{ width: `${Math.max(3, Math.min(100, sharePct))}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="p-8 rounded-2xl bg-slate-950/50 border border-slate-800 text-center text-slate-400 text-xs">
                <Users className="w-8 h-8 mx-auto mb-2 text-slate-600" />
                <p>No token holders recorded yet. Synchronize with the indexer or perform a mint action.</p>
              </div>
            )}
          </div>

          <div className="mt-5 pt-4 border-t border-slate-800/60 flex items-center justify-between text-xs text-slate-400">
            <span>Synchronized from on-chain state</span>
            <span className="font-mono text-[11px] text-slate-300">
              {activeReport?.holdersCount || topHolders.length} active wallets holding {metadata.symbol}
            </span>
          </div>
        </div>
      </div>

      {/* 5. Circuit Execution Breakdown & Recent Activity Feed */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Circuit Execution Frequency & Health (4 cols) */}
        <div className="lg:col-span-4 p-6 rounded-3xl bg-slate-900/70 border border-slate-800/80 shadow-xl flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-emerald-400" />
                <h3 className="text-sm font-bold text-white tracking-tight">Circuit Execution Volume</h3>
              </div>
              <span className="text-xs font-mono text-emerald-400 font-semibold">
                {circuitBreakdown.successRate}% Success
              </span>
            </div>

            {/* Total calls & success rate bar */}
            <div className="p-3.5 rounded-2xl bg-slate-950/60 border border-slate-800/60 mb-4">
              <div className="flex items-center justify-between text-xs mb-1.5">
                <span className="text-slate-400">Total Invocations:</span>
                <span className="font-mono font-bold text-white">{circuitBreakdown.total}</span>
              </div>
              <div className="flex items-center justify-between text-xs mb-2">
                <span className="text-emerald-400 font-semibold flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" />
                  <span>{circuitBreakdown.confirmedCount} Confirmed</span>
                </span>
                {circuitBreakdown.failedCount > 0 && (
                  <span className="text-rose-400 font-semibold flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" />
                    <span>{circuitBreakdown.failedCount} Failed</span>
                  </span>
                )}
              </div>
              <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden flex">
                <div
                  className="bg-emerald-400 h-full transition-all"
                  style={{
                    width: `${
                      circuitBreakdown.total > 0
                        ? (circuitBreakdown.confirmedCount / circuitBreakdown.total) * 100
                        : 100
                    }%`,
                  }}
                />
                <div
                  className="bg-rose-500 h-full transition-all"
                  style={{
                    width: `${
                      circuitBreakdown.total > 0
                        ? (circuitBreakdown.failedCount / circuitBreakdown.total) * 100
                        : 0
                    }%`,
                  }}
                />
              </div>
            </div>

            {/* Circuit Mix List */}
            <div className="space-y-2.5">
              <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                Circuits Invoked
              </div>
              {circuitBreakdown.counts.length > 0 ? (
                circuitBreakdown.counts.map(([name, count]) => {
                  const pct = circuitBreakdown.total > 0 ? (count / circuitBreakdown.total) * 100 : 0;
                  return (
                    <div key={name} className="space-y-1">
                      <div className="flex items-center justify-between text-xs font-mono">
                        <span className="text-slate-200 capitalize">{name}</span>
                        <span className="text-slate-400">
                          {count} ({pct.toFixed(0)}%)
                        </span>
                      </div>
                      <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-cyan-400 rounded-full"
                          style={{ width: `${Math.max(5, pct)}%` }}
                        />
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="py-4 text-center text-slate-400 text-xs">
                  No circuits executed yet in this session.
                </div>
              )}
            </div>
          </div>

          <button
            type="button"
            onClick={() => onNavigateTab('activity')}
            className="w-full mt-4 py-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors border border-slate-700/60 cursor-pointer"
          >
            <span>View Full Audit Log</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Recent Activity Timeline Stream (8 cols) */}
        <div className="lg:col-span-8 p-6 rounded-3xl bg-slate-900/70 border border-slate-800/80 shadow-xl flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-blue-400" />
                <h3 className="text-sm font-bold text-white tracking-tight">Recent On-Chain Activity Stream</h3>
              </div>
              <button
                type="button"
                onClick={() => onNavigateTab('activity')}
                className="text-xs text-blue-400 hover:text-blue-300 font-medium transition-colors flex items-center gap-1"
              >
                <span>All Events ({activityLog.length})</span>
                <span>→</span>
              </button>
            </div>

            {activityLog.length > 0 ? (
              <div className="space-y-3">
                {activityLog.slice(0, 5).map((item) => {
                  const isConfirmed = item.status === 'confirmed';
                  const isFailed = item.status === 'failed';
                  const isPending = item.status === 'pending';

                  let badgeColor = 'bg-blue-500/10 text-blue-300 border-blue-500/20';
                  if (item.circuitName.toLowerCase().includes('mint')) {
                    badgeColor = 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20';
                  } else if (item.circuitName.toLowerCase().includes('reallocate')) {
                    badgeColor = 'bg-amber-500/10 text-amber-300 border-amber-500/20';
                  } else if (item.circuitName.toLowerCase().includes('burn')) {
                    badgeColor = 'bg-rose-500/10 text-rose-300 border-rose-500/20';
                  }

                  const timeStr = new Date(item.timestamp).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                  });

                  return (
                    <div
                      key={item.id}
                      className="p-3.5 rounded-2xl bg-slate-950/60 hover:bg-slate-950 border border-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex-shrink-0">
                          {isConfirmed ? (
                            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                          ) : isFailed ? (
                            <AlertTriangle className="w-4 h-4 text-rose-400" />
                          ) : (
                            <Clock className="w-4 h-4 text-amber-400 animate-spin" />
                          )}
                        </div>

                        <div>
                          <div className="flex items-center gap-2">
                            <span
                              className={`px-2 py-0.5 rounded-md text-[11px] font-mono font-semibold border ${badgeColor}`}
                            >
                              {item.circuitName}
                            </span>

                            {item.blockHeight && (
                              <span className="text-[11px] font-mono text-slate-400">
                                Block #{item.blockHeight}
                              </span>
                            )}
                          </div>

                          {item.params && Object.keys(item.params).length > 0 && (
                            <div className="text-[11px] text-slate-400 font-mono mt-1 truncate max-w-md">
                              {Object.entries(item.params)
                                .map(([k, v]) => `${k}: ${v}`)
                                .join(' • ')}
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center justify-between sm:justify-end gap-3 text-xs self-end sm:self-center">
                        <span className="text-[11px] text-slate-400 font-mono">{timeStr}</span>
                        {item.txHash && (
                          <a
                            href={getExplorerTxUrl(item.txHash, preset)}
                            target="_blank"
                            rel="noreferrer"
                            className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-cyan-400 hover:text-cyan-300 font-mono text-[11px] flex items-center gap-1 transition-colors border border-slate-800"
                            title="View in Midnight Explorer"
                          >
                            <span>{item.txHash.slice(0, 8)}...</span>
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="p-8 rounded-2xl bg-slate-950/50 border border-slate-800 text-center text-slate-400 text-xs">
                <Activity className="w-8 h-8 mx-auto mb-2 text-slate-600" />
                <p>No transaction activity logged yet.</p>
              </div>
            )}
          </div>

          <div className="mt-5 pt-4 border-t border-slate-800/60 flex items-center justify-between text-xs text-slate-400">
            <span>Zero-Knowledge Proofs Executed Locally</span>
            <button
              type="button"
              onClick={() => onNavigateTab('activity')}
              className="text-cyan-400 hover:text-cyan-300 font-medium transition-colors"
            >
              Export JSON / CSV →
            </button>
          </div>
        </div>
      </div>

      {/* 6. Quick Action Shortcuts Launchpad */}
      <div className="p-6 rounded-3xl bg-gradient-to-br from-slate-900/90 to-slate-950/90 border border-slate-800/80 shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-cyan-400" />
            <h3 className="text-sm font-bold text-white tracking-tight">Quick Action Launchpad</h3>
          </div>
          <span className="text-xs text-slate-400">Directly trigger contract circuits</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Action 1: Mint */}
          <button
            type="button"
            onClick={() => onNavigateTab('actions', 'mint')}
            className="p-4 rounded-2xl bg-slate-900/80 hover:bg-slate-850 hover:border-cyan-500/40 border border-slate-800 transition-all text-left group cursor-pointer"
          >
            <div className="flex items-center justify-between mb-2">
              <div className="p-2 rounded-xl bg-cyan-500/10 text-cyan-400 group-hover:scale-110 transition-transform">
                <Coins className="w-4 h-4" />
              </div>
              <ArrowRight className="w-4 h-4 text-slate-500 group-hover:text-cyan-400 group-hover:translate-x-0.5 transition-all" />
            </div>
            <div className="text-sm font-bold text-white group-hover:text-cyan-300 transition-colors">
              Mint Tokens
            </div>
            <p className="text-xs text-slate-400 mt-1 leading-relaxed">
              Create new {metadata.symbol} tokens to an account address.
            </p>
          </button>

          {/* Action 2: Transfer */}
          <button
            type="button"
            onClick={() => onNavigateTab('actions', 'transfer')}
            className="p-4 rounded-2xl bg-slate-900/80 hover:bg-slate-850 hover:border-blue-500/40 border border-slate-800 transition-all text-left group cursor-pointer"
          >
            <div className="flex items-center justify-between mb-2">
              <div className="p-2 rounded-xl bg-blue-500/10 text-blue-400 group-hover:scale-110 transition-transform">
                <Send className="w-4 h-4" />
              </div>
              <ArrowRight className="w-4 h-4 text-slate-500 group-hover:text-blue-400 group-hover:translate-x-0.5 transition-all" />
            </div>
            <div className="text-sm font-bold text-white group-hover:text-blue-300 transition-colors">
              Transfer Tokens
            </div>
            <p className="text-xs text-slate-400 mt-1 leading-relaxed">
              Send tokens with zero-knowledge private witness proof.
            </p>
          </button>

          {/* Action 3: Admin Reallocate */}
          <button
            type="button"
            onClick={() => onNavigateTab('actions', 'reallocate')}
            className={`p-4 rounded-2xl transition-all text-left group cursor-pointer border ${
              lockedRawBalance > 0
                ? 'bg-amber-950/20 border-amber-500/50 hover:border-amber-400'
                : 'bg-slate-900/80 hover:bg-slate-850 hover:border-amber-500/40 border-slate-800'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400 group-hover:scale-110 transition-transform">
                <RotateCcw className="w-4 h-4" />
              </div>
              <ArrowRight className="w-4 h-4 text-slate-500 group-hover:text-amber-400 group-hover:translate-x-0.5 transition-all" />
            </div>
            <div className="text-sm font-bold text-white group-hover:text-amber-300 transition-colors flex items-center gap-1.5">
              <span>Admin Reallocate</span>
              {lockedRawBalance > 0 && <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />}
            </div>
            <p className="text-xs text-slate-400 mt-1 leading-relaxed">
              Rescue unshielded tokens trapped in raw wallet addresses.
            </p>
          </button>

          {/* Action 4: Inspect Ledger */}
          <button
            type="button"
            onClick={() => onNavigateTab('ledger')}
            className="p-4 rounded-2xl bg-slate-900/80 hover:bg-slate-850 hover:border-purple-500/40 border border-slate-800 transition-all text-left group cursor-pointer"
          >
            <div className="flex items-center justify-between mb-2">
              <div className="p-2 rounded-xl bg-purple-500/10 text-purple-400 group-hover:scale-110 transition-transform">
                <Database className="w-4 h-4" />
              </div>
              <ArrowRight className="w-4 h-4 text-slate-500 group-hover:text-purple-400 group-hover:translate-x-0.5 transition-all" />
            </div>
            <div className="text-sm font-bold text-white group-hover:text-purple-300 transition-colors">
              Inspect Ledger
            </div>
            <p className="text-xs text-slate-400 mt-1 leading-relaxed">
              Examine account balances, allowances, and distribution shares.
            </p>
          </button>
        </div>
      </div>
    </div>
  );
};
