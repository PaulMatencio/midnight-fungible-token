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
  Crown,
  AlertTriangle,
  PauseCircle,
  PlayCircle,
  ShieldAlert,
  ChevronDown,
  ChevronUp,
  Globe,
  Activity,
} from 'lucide-react';
import { MIDNIGHT_CONFIG, getExplorerContractUrl } from '@/src/infrastructure/config/midnight-config';
import { useWallet } from '@/src/presentation/context/WalletContext';
import { formatBalance } from '@/src/presentation/utils/format';
import type { TokenMetadata } from '@/src/types/dapp';

interface ContractOverviewProps {
  contractAddress?: string;
  metadata: TokenMetadata;
  userBalance: bigint;
  lockedRawBalance?: bigint;
  userDerivedAccountHex?: string | null;
  userDerivedAccountBech32?: string | null;
  infraStatus?: { proofServer: boolean; indexer: boolean };
  onResetContractState?: () => void;
  variant?: 'full' | 'compact';
  network?: string;
}

const MAX_UINT128 = 340282366920938463463374607431768211455n;

export const ContractOverview: React.FC<ContractOverviewProps> = ({
  contractAddress,
  metadata,
  userBalance,
  lockedRawBalance = 0n,
  userDerivedAccountHex,
  userDerivedAccountBech32,
  infraStatus,
  onResetContractState,
  variant = 'full',
  network,
}) => {
  const targetContractAddress = contractAddress || MIDNIGHT_CONFIG.contractAddress;
  const activeNetwork = network || MIDNIGHT_CONFIG.networkId || 'preprod';
  const formattedNetwork = activeNetwork.charAt(0).toUpperCase() + activeNetwork.slice(1);
  const { mode, accountAddress, activeIdentity, isConnected } = useWallet();
  const [copiedAddr, setCopiedAddr] = useState(false);
  const [copiedSalt, setCopiedSalt] = useState(false);
  const [copiedOwner, setCopiedOwner] = useState(false);
  const [copiedPauser, setCopiedPauser] = useState(false);
  const [isCardExpanded, setIsCardExpanded] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('midnight_token_info_expanded');
      if (saved !== null) {
        return saved === 'true';
      }
    }
    return false;
  });

  const toggleCardExpanded = () => {
    setIsCardExpanded((prev) => {
      const next = !prev;
      if (typeof window !== 'undefined') {
        localStorage.setItem('midnight_token_info_expanded', String(next));
      }
      return next;
    });
  };

  const copyToClipboard = (
    text: string,
    type: 'addr' | 'salt' | 'owner' | 'pauser' = 'addr'
  ) => {
    navigator.clipboard.writeText(text);
    if (type === 'owner') {
      setCopiedOwner(true);
      setTimeout(() => setCopiedOwner(false), 2000);
    } else if (type === 'pauser') {
      setCopiedPauser(true);
      setTimeout(() => setCopiedPauser(false), 2000);
    } else if (type === 'salt') {
      setCopiedSalt(true);
      setTimeout(() => setCopiedSalt(false), 2000);
    } else {
      setCopiedAddr(true);
      setTimeout(() => setCopiedAddr(false), 2000);
    }
  };

  const formatUnits = (amount: bigint, decimals: number): string => {
    return formatBalance(amount, decimals, 4);
  };

  const isCapped = metadata.maxSupply && metadata.maxSupply > 0n && metadata.maxSupply < MAX_UINT128;

  if (!isCardExpanded) {
    return (
      <div className="bg-white/90 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800/80 rounded-2xl p-3 px-4 sm:px-5 backdrop-blur-xl shadow-md transition-all duration-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-in fade-in">
        <div className="flex items-center gap-3 flex-wrap justify-center sm:justify-start">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-blue-600 to-cyan-500 flex items-center justify-center font-black text-white text-sm shadow-md shadow-cyan-500/20 flex-shrink-0">
            {metadata.symbol ? metadata.symbol.slice(0, 1) : 'T'}
          </div>
          <div className="flex items-center gap-2 flex-wrap text-xs justify-center sm:justify-start">
            <span className="font-bold text-slate-900 dark:text-white text-sm tracking-tight">{metadata.name}</span>
            <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-blue-50 dark:bg-cyan-500/15 border border-blue-200 dark:border-cyan-500/30 text-blue-900 dark:text-cyan-300">
              {metadata.symbol}
            </span>

            <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-[11px]">
              <span className={`w-2 h-2 rounded-full ${metadata.isInitialized && !metadata.isPaused ? 'bg-green-600 dark:bg-emerald-400 animate-pulse' : metadata.isPaused ? 'bg-rose-500' : 'bg-amber-500'}`} />
              <span className="font-semibold text-slate-700 dark:text-slate-300">
                {metadata.isInitialized ? (metadata.isPaused ? 'Paused' : 'Active') : 'Uninitialized'}
              </span>
            </div>

            <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-[11px]">
              <Globe className="w-3 h-3 text-blue-700 dark:text-cyan-400" />
              <span className="font-semibold text-slate-900 dark:text-white capitalize">{formattedNetwork}</span>
            </div>

            <div className="hidden lg:flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-[11px] font-mono">
              <span className="text-slate-500 dark:text-slate-400 font-sans">Supply:</span>
              <span className="font-bold text-slate-900 dark:text-white">
                {formatUnits(metadata.totalSupply, metadata.decimals)} {metadata.symbol}
              </span>
              {isCapped && metadata.maxSupply && (
                <>
                  <span className="text-slate-400 dark:text-slate-600">•</span>
                  <span className="text-slate-500 dark:text-slate-400 font-sans">Cap:</span>
                  <span className="font-semibold text-slate-700 dark:text-slate-300">
                    {formatUnits(metadata.maxSupply, metadata.decimals)} {metadata.symbol}
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-center sm:justify-end gap-2 w-full sm:w-auto self-center">
          {onResetContractState && (
            <button
              type="button"
              onClick={onResetContractState}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-800 hover:text-amber-950 dark:text-amber-300 dark:hover:text-amber-100 border border-amber-500/30 text-xs font-semibold transition-all shadow-xs cursor-pointer"
              title="Reset Contract State & Local Cache"
            >
              <RotateCcw className="w-3.5 h-3.5 text-amber-700 dark:text-amber-400" />
              <span>Reset Cache</span>
            </button>
          )}

          <button
            type="button"
            onClick={toggleCardExpanded}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 dark:bg-cyan-600 dark:hover:bg-cyan-500 text-white text-xs font-semibold transition-all shadow-xs cursor-pointer"
            title="Expand token information"
          >
            <span>Token Information</span>
            <ChevronDown className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    );
  }

  if (variant === 'compact') {
    return (
      <div className="bg-white dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800/80 rounded-2xl backdrop-blur-xl shadow-xl overflow-hidden transition-all duration-200">
        {/* Top Menu Bar */}
        <div className="bg-slate-50 dark:bg-slate-950/80 px-4 sm:px-5 py-3 border-b border-slate-200 dark:border-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          {/* Left: Token Identity, State of the Contract & The Network */}
          <div className="flex items-center gap-3 flex-wrap justify-center sm:justify-start">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-blue-600 to-cyan-500 flex items-center justify-center font-black text-white text-sm shadow-md shadow-cyan-500/20 flex-shrink-0">
              {metadata.symbol ? metadata.symbol.slice(0, 1) : 'T'}
            </div>
            <div className="flex items-center gap-2 flex-wrap justify-center sm:justify-start">
              <span className="font-bold text-slate-900 dark:text-white text-sm tracking-tight">{metadata.name}</span>
              <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-blue-50 dark:bg-cyan-500/15 border border-blue-200 dark:border-cyan-500/30 text-blue-900 dark:text-cyan-300">
                {metadata.symbol}
              </span>

              {/* State of the Contract Badge */}
              <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-[11px]">
                <span className="text-slate-500 dark:text-slate-400 font-medium">State:</span>
                <span className={`font-semibold flex items-center gap-1 ${metadata.isInitialized ? 'text-green-800 dark:text-emerald-400' : 'text-amber-800 dark:text-amber-400'}`}>
                  <CircleDot className="w-2.5 h-2.5" />
                  {metadata.isInitialized ? 'Initialized' : 'Uninitialized'}
                </span>
                <span className="text-slate-400 dark:text-slate-600">•</span>
                <span className={`font-semibold flex items-center gap-1 ${metadata.isPaused ? 'text-rose-800 dark:text-rose-400' : 'text-green-800 dark:text-emerald-400'}`}>
                  {metadata.isPaused ? <PauseCircle className="w-2.5 h-2.5" /> : <PlayCircle className="w-2.5 h-2.5" />}
                  {metadata.isPaused ? 'Paused' : 'Active'}
                </span>
              </div>

              {/* The Network Badge */}
              <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-[11px]">
                <Globe className="w-3 h-3 text-blue-700 dark:text-cyan-400" />
                <span className="text-slate-500 dark:text-slate-400 font-medium">Network:</span>
                <span className="font-semibold text-slate-900 dark:text-white capitalize">{formattedNetwork}</span>
                <span className="w-1.5 h-1.5 rounded-full bg-green-600 dark:bg-emerald-400 animate-pulse" />
              </div>

              {/* Mode Badge */}
              {mode === 'lace' ? (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-800 dark:text-blue-300 border border-blue-500/20 font-medium">
                  Lace Mode
                </span>
              ) : (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-800 dark:text-indigo-300 border border-indigo-500/20 font-medium">
                  Test Mode ({activeIdentity?.name || 'Alice'})
                </span>
              )}
            </div>
          </div>

          {/* Right: Top Controls */}
          <div className="flex items-center justify-center sm:justify-end gap-2 flex-wrap w-full sm:w-auto self-center">
            {onResetContractState && (
              <button
                type="button"
                onClick={onResetContractState}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-800 hover:text-amber-950 dark:text-amber-300 dark:hover:text-amber-100 border border-amber-500/30 text-xs font-semibold transition-all shadow-xs cursor-pointer"
                title="Reset Contract State & Local Cache"
              >
                <RotateCcw className="w-3.5 h-3.5 text-amber-700 dark:text-amber-400" />
                <span>Reset Cache</span>
              </button>
            )}

            <button
              type="button"
              onClick={toggleCardExpanded}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-700 text-xs font-semibold transition-all shadow-xs cursor-pointer"
              title="Collapse token information"
              aria-expanded={true}
            >
              <span>Token Information</span>
              <ChevronUp className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Compact Body: State of Contract, Supply, Network & Address Overview */}
        <div className="p-4 sm:p-5 space-y-3 animate-in fade-in duration-150">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 text-xs">
            {/* 1. State of the Contract */}
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800/80 flex items-center justify-between">
              <div>
                <div className="text-[10px] text-slate-500 dark:text-slate-400 font-medium uppercase tracking-wider">State of Contract</div>
                <div className="flex items-center gap-1.5 font-bold text-sm text-slate-900 dark:text-white mt-0.5">
                  <span className={`w-2 h-2 rounded-full ${metadata.isInitialized && !metadata.isPaused ? 'bg-green-600 dark:bg-emerald-400 animate-pulse' : metadata.isPaused ? 'bg-rose-500' : 'bg-amber-500'}`} />
                  <span>
                    {metadata.isInitialized
                      ? (metadata.isPaused ? 'Paused (Stop)' : 'Initialized • Active')
                      : 'Uninitialized'}
                  </span>
                </div>
              </div>
            </div>

            {/* 2. Minted Supply & Max Capacity */}
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800/80 flex items-center justify-between">
              <div className="min-w-0 flex-1">
                <div className="text-[10px] text-slate-600 dark:text-slate-400 font-medium uppercase tracking-wider flex items-center justify-between">
                  <span>Minted Supply & Cap</span>
                  {isCapped && metadata.maxSupply && metadata.maxSupply > 0n && (
                    <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-indigo-50 dark:bg-indigo-950/60 text-indigo-900 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                      {Math.min(100, Math.round((Number(metadata.totalSupply) / Number(metadata.maxSupply)) * 100))}% cap
                    </span>
                  )}
                </div>
                <div className="font-mono text-sm font-bold text-slate-950 dark:text-white mt-0.5 truncate">
                  {formatUnits(metadata.totalSupply, metadata.decimals)} <span className="text-xs font-normal text-slate-600 dark:text-slate-400 font-sans">{metadata.symbol}</span>
                </div>
                <div className="text-[11px] font-mono truncate mt-1 flex items-center gap-1.5 flex-wrap">
                  <span className="text-slate-700 dark:text-slate-300 font-semibold">Max Capacity:</span>
                  <span className="font-bold text-slate-950 dark:text-white">
                    {isCapped ? `${formatUnits(metadata.maxSupply!, metadata.decimals)} ${metadata.symbol}` : 'Uncapped'}
                  </span>
                </div>
              </div>
            </div>

            {/* 3. The Network */}
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800/80 flex items-center justify-between">
              <div>
                <div className="text-[10px] text-slate-500 dark:text-slate-400 font-medium uppercase tracking-wider">The Network</div>
                <div className="flex items-center gap-1.5 font-bold text-sm text-blue-900 dark:text-cyan-300 mt-0.5 font-mono">
                  <Globe className="w-3.5 h-3.5 text-blue-700 dark:text-cyan-400" />
                  <span className="capitalize">Midnight {formattedNetwork}</span>
                </div>
              </div>
              <span className="w-2 h-2 rounded-full bg-green-600 dark:bg-emerald-400 animate-pulse" />
            </div>

            {/* 4. Contract Address */}
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800/80 flex items-center justify-between">
              <div className="min-w-0 flex-1 pr-2">
                <div className="text-[10px] text-slate-500 dark:text-slate-400 font-medium uppercase tracking-wider flex items-center justify-between">
                  <span>Contract Address</span>
                  <span className="text-[10px] font-mono text-slate-500">Compact</span>
                </div>
                <div className="font-mono text-xs text-slate-800 dark:text-slate-200 truncate mt-0.5" title={targetContractAddress}>
                  {targetContractAddress}
                </div>
              </div>
              <div className="flex items-center gap-1.5 flex-shrink-0">
                <button
                  type="button"
                  onClick={() => copyToClipboard(targetContractAddress, 'addr')}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white dark:bg-slate-900/90 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white border border-slate-200 dark:border-slate-700/60 text-xs font-medium transition-colors cursor-pointer"
                  title="Copy Contract Address"
                >
                  {copiedAddr ? <Check className="w-3.5 h-3.5 text-green-700 dark:text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />}
                  <span>{copiedAddr ? 'Copied' : 'Copy'}</span>
                </button>
                <a
                  href={getExplorerContractUrl(targetContractAddress)}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white dark:bg-slate-900/90 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white border border-slate-200 dark:border-slate-700/60 text-xs font-medium transition-colors"
                  title="View on Midnight Block Explorer"
                >
                  <ExternalLink className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
                  <span>Explorer</span>
                </a>
              </div>
            </div>
          </div>

          <div className="pt-2 grid grid-cols-1 sm:grid-cols-3 gap-3 animate-in fade-in duration-150">
            {metadata.contractSalt && (
              <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800 text-xs space-y-1">
                <div className="text-[10px] text-slate-500 font-sans flex items-center justify-between">
                  <span>Contract Salt</span>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(metadata.contractSalt || '', 'salt')}
                    className="p-0.5 hover:text-slate-900 dark:hover:text-white text-slate-500 dark:text-slate-400 cursor-pointer"
                  >
                    {copiedSalt ? <Check className="w-3 h-3 text-green-700 dark:text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  </button>
                </div>
                <div className="font-mono text-[11px] text-slate-700 dark:text-slate-300 truncate" title={`0x${metadata.contractSalt}`}>
                  0x{metadata.contractSalt.slice(0, 8)}...{metadata.contractSalt.slice(-6)}
                </div>
              </div>
            )}

            <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800 text-xs space-y-1">
              <div className="text-[10px] text-slate-500 font-sans flex items-center gap-1.5">
                <Radio className="w-3 h-3 text-green-700 dark:text-emerald-400 animate-pulse" />
                <span>GraphQL Indexer</span>
              </div>
              <div className="font-mono text-[11px] text-slate-700 dark:text-slate-300 truncate">api/v4/graphql</div>
            </div>

            <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800 text-xs space-y-1">
              <div className="text-[10px] text-slate-500 font-sans flex items-center gap-1.5">
                <Server className="w-3 h-3 text-blue-700 dark:text-cyan-400" />
                <span>Proof Server</span>
              </div>
              <div className="font-mono text-[11px] text-slate-700 dark:text-slate-300 truncate">127.0.0.1:6300</div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800/80 rounded-2xl backdrop-blur-xl shadow-2xl overflow-hidden transition-all duration-200">
      {/* ============================================================ */}
      {/* Top Menu Bar: Identity, State, Network, Actions & Probes    */}
      {/* ============================================================ */}
      <div className="bg-slate-50 dark:bg-slate-950/90 border-b border-slate-200 dark:border-slate-800/90 px-5 sm:px-6 py-3.5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        {/* Left: Contract Title, Badges, State of Contract & The Network */}
        <div className="flex items-center gap-3.5 flex-wrap">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-cyan-400 flex items-center justify-center font-black text-white text-base shadow-md shadow-blue-500/20 flex-shrink-0">
            {metadata.symbol ? metadata.symbol.slice(0, 1) : 'T'}
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-bold text-slate-900 dark:text-white text-base tracking-tight">
              {metadata.name || 'Fungible Token'}
            </span>
            <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-md bg-blue-50 dark:bg-cyan-500/15 border border-blue-200 dark:border-cyan-500/30 text-blue-900 dark:text-cyan-300">
              {metadata.symbol}
            </span>

            {/* Version & Contract Spec Pill */}
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 font-medium">
              Compact v2.2
            </span>

            {/* State of the Contract Pill */}
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs">
              <span className="text-slate-500 dark:text-slate-400 font-medium">State:</span>
              <span className={`font-semibold flex items-center gap-1 ${metadata.isInitialized ? 'text-green-800 dark:text-emerald-400' : 'text-amber-800 dark:text-amber-400'}`}>
                <CircleDot className="w-2.5 h-2.5" />
                {metadata.isInitialized ? 'Initialized' : 'Uninitialized'}
              </span>
              <span className="text-slate-400 dark:text-slate-600">•</span>
              <span className={`font-semibold flex items-center gap-1 ${metadata.isPaused ? 'text-rose-800 dark:text-rose-400' : 'text-green-800 dark:text-emerald-400'}`}>
                {metadata.isPaused ? <PauseCircle className="w-3 h-3" /> : <PlayCircle className="w-3 h-3" />}
                {metadata.isPaused ? 'PAUSED' : 'ACTIVE'}
              </span>
            </div>

            {/* The Network Pill */}
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs">
              <Globe className="w-3.5 h-3.5 text-blue-700 dark:text-cyan-400" />
              <span className="text-slate-500 dark:text-slate-400 font-medium">Network:</span>
              <span className="font-semibold text-slate-900 dark:text-white capitalize font-mono">{formattedNetwork}</span>
              <span className="w-1.5 h-1.5 rounded-full bg-green-600 dark:bg-emerald-400 animate-pulse" />
            </div>

            {/* Mode Pill */}
            {mode === 'lace' ? (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-blue-500/10 text-blue-800 dark:text-blue-300 border border-blue-500/30">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-600 dark:bg-cyan-400 animate-pulse" />
                Lace Live
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-indigo-500/10 text-indigo-800 dark:text-indigo-300 border border-indigo-500/30">
                <span className="w-1.5 h-1.5 rounded-full bg-green-600 dark:bg-emerald-400" />
                Test ({activeIdentity?.name || 'Alice'})
              </span>
            )}
          </div>
        </div>

        {/* Right: Infrastructure & Cache Services (Separation of Concern) */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-2.5 self-start lg:self-center p-1.5 sm:px-3 sm:py-2 rounded-2xl bg-slate-100 dark:bg-slate-950/90 border border-slate-200 dark:border-slate-800 shadow-sm">
          {/* Section Label: Infrastructure & Cache Services */}
          <div className="flex items-center gap-1.5 px-1 sm:pr-2.5 sm:border-r border-slate-300 dark:border-slate-800/90 text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            <Activity className="w-3.5 h-3.5 text-blue-700 dark:text-cyan-400" />
            <span className="whitespace-nowrap">Infra & Cache</span>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Indexer Status Probe */}
            <div
              className="px-2.5 py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800/80 flex items-center gap-1.5 text-xs text-slate-700 dark:text-slate-300 shadow-2xs"
              title="Midnight GraphQL Indexer Service (v4)"
            >
              <Radio className="w-3 h-3 text-green-700 dark:text-emerald-400 animate-pulse" />
              <div className="text-[11px] font-mono">
                <span className="text-slate-500 dark:text-slate-400">Indexer: </span>
                <span className="text-slate-900 dark:text-slate-200 font-semibold">v4</span>
              </div>
            </div>

            {/* Prover Status Probe */}
            <div
              className="px-2.5 py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800/80 flex items-center gap-1.5 text-xs text-slate-700 dark:text-slate-300 shadow-2xs"
              title="Midnight Zero-Knowledge Proof Server (port 6300)"
            >
              <Server className="w-3 h-3 text-blue-700 dark:text-cyan-400" />
              <div className="text-[11px] font-mono">
                <span className="text-slate-500 dark:text-slate-400">Prover: </span>
                <span className="text-slate-900 dark:text-slate-200 font-semibold">6300</span>
              </div>
            </div>

            {/* Local State & Cache Reset Action */}
            {onResetContractState && (
              <>
                <div className="hidden sm:block w-px h-5 bg-slate-300 dark:bg-slate-800" />
                <button
                  type="button"
                  onClick={onResetContractState}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-800 hover:text-amber-950 dark:text-amber-300 dark:hover:text-amber-100 border border-amber-500/30 text-xs font-semibold transition-all shadow-xs cursor-pointer"
                  title="Reset local contract state & cache (start fresh or re-initialize)"
                >
                  <RotateCcw className="w-3.5 h-3.5 text-amber-700 dark:text-amber-400" />
                  <span>Reset Cache</span>
                </button>
              </>
            )}

            {/* Collapse / Expand Toggle Button */}
            <div className="hidden sm:block w-px h-5 bg-slate-300 dark:bg-slate-800" />
            <button
              type="button"
              onClick={toggleCardExpanded}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-700 text-xs font-semibold transition-all shadow-xs cursor-pointer"
              title="Collapse token information"
              aria-expanded={true}
            >
              <span>Token Information</span>
              <ChevronUp className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* ============================================================ */}
      {/* Card Content: Address Sub-panel & Parameter Metric Grid      */}
      {/* ============================================================ */}
      <div className="p-5 sm:p-6 space-y-6 animate-in fade-in duration-150">
        {/* Contract Address & Salt Inset Sub-panel */}
        <div className="bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800/90 rounded-xl p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          {/* Deployed Contract Address with dedicated On-Chain Actions toolbar */}
          <div className="space-y-1.5 min-w-0 flex-1">
            <div className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-2 flex-wrap">
              <span>Deployed Contract Address</span>
              <span className="text-slate-400 dark:text-slate-600">•</span>
              <span className="text-blue-900 dark:text-cyan-300 font-mono">Midnight {formattedNetwork}</span>
              <span className="text-slate-400 dark:text-slate-600">•</span>
              <span className={metadata.isInitialized ? 'text-green-800 dark:text-emerald-400' : 'text-amber-800 dark:text-amber-400'}>
                {metadata.isInitialized ? (metadata.isPaused ? 'Paused' : 'Initialized & Active') : 'Uninitialized'}
              </span>
            </div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <span className="font-mono text-sm text-blue-950 dark:text-cyan-200 font-semibold truncate max-w-xs sm:max-w-md lg:max-w-lg bg-white dark:bg-slate-900/90 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800" title={targetContractAddress}>
                {targetContractAddress}
              </span>
              <div className="inline-flex items-center gap-1.5 bg-white dark:bg-slate-900/90 p-1 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs">
                <span className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400 px-1.5 hidden sm:inline">Actions:</span>
                <button
                  type="button"
                  onClick={() => copyToClipboard(targetContractAddress, 'addr')}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white text-xs font-medium transition-colors cursor-pointer"
                  title="Copy Contract Address to Clipboard"
                >
                  {copiedAddr ? <Check className="w-3.5 h-3.5 text-green-700 dark:text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />}
                  <span>{copiedAddr ? 'Copied' : 'Copy'}</span>
                </button>
                <a
                  href={getExplorerContractUrl(targetContractAddress)}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white text-xs font-medium transition-colors"
                  title="View on Midnight Block Explorer"
                >
                  <ExternalLink className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
                  <span>Explorer</span>
                </a>
              </div>
            </div>
          </div>

          {/* Contract Salt with dedicated Copy button & Replay Protection Badge */}
          {metadata.contractSalt && (
            <div className="flex items-center gap-3 font-mono text-xs text-slate-500 dark:text-slate-400 flex-wrap border-t lg:border-t-0 lg:border-l border-slate-200 dark:border-slate-800/80 pt-3 lg:pt-0 lg:pl-5">
              <div className="space-y-1.5">
                <div className="text-slate-500 dark:text-slate-400 font-sans text-[10px] uppercase font-semibold tracking-wider flex items-center gap-2">
                  <span>Contract Salt</span>
                  <span className="inline-flex items-center px-1.5 py-0.2 rounded text-[9px] font-semibold bg-indigo-500/15 text-indigo-800 dark:text-indigo-300 border border-indigo-500/30">
                    Replay Protected
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className="font-mono text-xs text-slate-800 dark:text-slate-300 font-semibold truncate max-w-[140px] sm:max-w-[180px] bg-white dark:bg-slate-900/90 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800"
                    title={`Contract Salt: 0x${metadata.contractSalt}`}
                  >
                    0x{metadata.contractSalt.slice(0, 8)}...{metadata.contractSalt.slice(-6)}
                  </span>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(metadata.contractSalt || '', 'salt')}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-900/90 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white border border-slate-200 dark:border-slate-800 text-xs font-medium transition-colors cursor-pointer"
                    title="Copy Contract Salt to Clipboard"
                  >
                    {copiedSalt ? <Check className="w-3.5 h-3.5 text-green-700 dark:text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />}
                    <span>{copiedSalt ? 'Copied' : 'Copy'}</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Grid: Token & Contract Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
          {/* 1. Token Name & Symbol */}
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950/50 border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 transition-colors">
            <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5 mb-1">
              <Coins className="w-3.5 h-3.5 text-blue-700 dark:text-blue-400" /> Token Collection
            </div>
            <div className="text-base font-bold text-slate-900 dark:text-white tracking-tight flex items-baseline gap-1.5 truncate">
              <span className="truncate">{metadata.name}</span>
              <span className="text-xs font-mono px-1.5 py-0.5 rounded bg-blue-50 dark:bg-blue-500/20 text-blue-900 dark:text-blue-300 border border-blue-200 dark:border-blue-500/30 flex-shrink-0">
                {metadata.symbol}
              </span>
            </div>
            <div className="text-[11px] text-slate-500 mt-1 font-mono">{metadata.decimals} Decimals</div>
          </div>

          {/* 2. Total Circulation */}
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950/50 border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 transition-colors">
            <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5 mb-1">
              <Layers className="w-3.5 h-3.5 text-indigo-700 dark:text-indigo-400" /> Total Supply
            </div>
            <div className="text-base font-bold text-slate-900 dark:text-white tracking-tight font-mono truncate">
              {formatUnits(metadata.totalSupply, metadata.decimals)}
            </div>
            <div className="text-[11px] mt-1 font-mono truncate flex items-center gap-1.5 flex-wrap">
              <span className="text-slate-700 dark:text-slate-300 font-semibold">Max Cap:</span>
              <span className="font-bold text-slate-950 dark:text-white">
                {isCapped ? `${formatUnits(metadata.maxSupply!, metadata.decimals)} ${metadata.symbol}` : 'Uncapped'}
              </span>
            </div>
          </div>

          {/* 3. State of the Contract */}
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950/50 border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 transition-colors">
            <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5 mb-1">
              <CircleDot className="w-3.5 h-3.5 text-green-800 dark:text-emerald-400" /> State of Contract
            </div>
            <div className="text-base font-bold text-slate-900 dark:text-white tracking-tight font-mono truncate flex items-center gap-1.5">
              <span className={`w-2 h-2 rounded-full ${metadata.isInitialized && !metadata.isPaused ? 'bg-green-600 dark:bg-emerald-400 animate-pulse' : metadata.isPaused ? 'bg-rose-500' : 'bg-amber-500'}`} />
              <span>
                {metadata.isInitialized
                  ? (metadata.isPaused ? 'PAUSED' : 'ACTIVE')
                  : 'PENDING'}
              </span>
            </div>
            <div className="text-[11px] text-slate-500 mt-1 font-mono truncate">
              {metadata.isInitialized
                ? (metadata.isPaused ? 'Emergency Stop Active' : 'Initialized & Operational')
                : 'Constructor Uninitialized'}
            </div>
          </div>

          {/* 4. The Network */}
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950/50 border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 transition-colors">
            <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5 mb-1">
              <Globe className="w-3.5 h-3.5 text-blue-700 dark:text-cyan-400" /> The Network
            </div>
            <div className="text-base font-bold text-blue-900 dark:text-cyan-300 tracking-tight font-mono truncate flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-green-600 dark:bg-emerald-400 animate-pulse" />
              <span className="capitalize">{formattedNetwork}</span>
            </div>
            <div className="text-[11px] text-slate-500 mt-1 font-mono truncate">
              Midnight Indexer v4
            </div>
          </div>

          {/* 5. Contract Owner */}
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950/50 border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 transition-colors">
            <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center justify-between mb-1">
              <span className="flex items-center gap-1.5">
                <Crown className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" /> Owner
              </span>
              {metadata.isInitialized && metadata.isCallerOwner && (
                <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-800 dark:text-amber-300 border border-amber-500/30">
                  You
                </span>
              )}
            </div>
            <div className="text-sm font-bold text-slate-900 dark:text-white tracking-tight font-mono flex items-center justify-between">
              <span className="truncate max-w-[100px]" title={metadata.isInitialized && metadata.owner ? `Owner Key: 0x${metadata.owner}` : 'Contract Uninitialized'}>
                {metadata.isInitialized && metadata.owner
                  ? `${metadata.owner.slice(0, 6)}...${metadata.owner.slice(-4)}`
                  : 'Pending Init'}
              </span>
              {metadata.isInitialized && metadata.owner && (
                <button
                  type="button"
                  onClick={() => copyToClipboard(metadata.owner || '', 'owner')}
                  className="p-1.5 rounded-lg bg-white dark:bg-slate-900/80 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white border border-slate-200 dark:border-slate-800 transition-colors cursor-pointer"
                  title="Copy Owner Hex Key"
                >
                  {copiedOwner ? <Check className="w-3.5 h-3.5 text-green-700 dark:text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              )}
            </div>
            <div className="text-[11px] text-slate-500 mt-1 font-mono truncate">
              {!metadata.isInitialized ? 'Pending Init' : (metadata.isCallerOwner ? 'Exclusive Mint/Burn' : 'FungibleToken Owner')}
            </div>
          </div>

          {/* 6. Emergency Stop & Pauser */}
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950/50 border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 transition-colors">
            <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center justify-between mb-1">
              <span className="flex items-center gap-1.5">
                <ShieldAlert className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" /> Emergency Pauser
              </span>
              {metadata.isCallerPauser && (
                <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-rose-500/20 text-rose-800 dark:text-rose-300 border border-rose-500/30">
                  You
                </span>
              )}
            </div>
            <div className="text-sm font-bold text-slate-900 dark:text-white tracking-tight font-mono flex items-center justify-between">
              <span
                className="truncate max-w-[100px]"
                title={metadata.emergencyPauser ? `Emergency Pauser Key: 0x${metadata.emergencyPauser}` : (metadata.owner ? `Owner Key: 0x${metadata.owner}` : 'Not configured')}
              >
                {metadata.emergencyPauser
                  ? `${metadata.emergencyPauser.slice(0, 6)}...${metadata.emergencyPauser.slice(-4)}`
                  : (metadata.owner ? `${metadata.owner.slice(0, 6)}...${metadata.owner.slice(-4)}` : 'None')}
              </span>
              {(metadata.emergencyPauser || metadata.owner) && (
                <button
                  type="button"
                  onClick={() => copyToClipboard((metadata.emergencyPauser || metadata.owner) || '', 'pauser')}
                  className="p-1.5 rounded-lg bg-white dark:bg-slate-900/80 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white border border-slate-200 dark:border-slate-800 transition-colors cursor-pointer"
                  title="Copy Pauser Hex Key"
                >
                  {copiedPauser ? <Check className="w-3.5 h-3.5 text-green-700 dark:text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              )}
            </div>
            <div className="text-[11px] text-slate-500 mt-1 font-mono truncate">
              {metadata.isPaused ? 'Transfers Paused' : 'Circuit Controls Active'}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
