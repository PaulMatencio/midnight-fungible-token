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
} from 'lucide-react';
import { MIDNIGHT_CONFIG, getExplorerContractUrl } from '@/src/infrastructure/config/midnight-config';
import { useWallet } from '@/src/presentation/context/WalletContext';
import type { TokenMetadata } from '@/src/types/dapp';

interface ContractOverviewProps {
  contractAddress?: string;
  metadata: TokenMetadata;
  userBalance: bigint;
  lockedRawBalance?: bigint;
  infraStatus?: { proofServer: boolean; indexer: boolean };
  onResetContractState?: () => void;
}

const MAX_UINT128 = 340282366920938463463374607431768211455n;

export const ContractOverview: React.FC<ContractOverviewProps> = ({
  contractAddress,
  metadata,
  userBalance,
  lockedRawBalance = 0n,
  infraStatus,
  onResetContractState,
}) => {
  const targetContractAddress = contractAddress || MIDNIGHT_CONFIG.contractAddress;
  const { mode, accountAddress, activeIdentity, isConnected, connectWallet } = useWallet();
  const [copiedAddr, setCopiedAddr] = useState(false);
  const [copiedSalt, setCopiedSalt] = useState(false);
  const [copiedOwner, setCopiedOwner] = useState(false);
  const [copiedPauser, setCopiedPauser] = useState(false);

  const copyToClipboard = (text: string, type: 'addr' | 'salt' | 'owner' | 'pauser' = 'addr') => {
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
    const divisor = 10n ** BigInt(decimals);
    const whole = amount / divisor;
    const fraction = amount % divisor;
    const fractionStr = fraction.toString().padStart(decimals, '0').slice(0, 4);
    return `${whole.toLocaleString()}.${fractionStr}`;
  };

  const isCapped = metadata.maxSupply && metadata.maxSupply > 0n && metadata.maxSupply < MAX_UINT128;

  return (
    <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-6 backdrop-blur-xl shadow-xl space-y-6">
      {/* Top row: Contract Address, Mode Badge & Network Status */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-800">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Deployed Compact Contract (v2.2)
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

            {/* Contract Status Pill */}
            {metadata.isPaused ? (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-rose-500/15 text-rose-400 border border-rose-500/30 animate-pulse">
                <PauseCircle className="w-3 h-3 text-rose-400" />
                PAUSED (Emergency Stop)
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                <PlayCircle className="w-3 h-3 text-emerald-400" />
                ACTIVE
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 font-mono text-sm text-slate-200">
            <span className="truncate max-w-xs md:max-w-md" title={targetContractAddress}>
              {targetContractAddress}
            </span>
            <button
              type="button"
              onClick={() => copyToClipboard(targetContractAddress, 'addr')}
              className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
              title="Copy Address"
            >
              {copiedAddr ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
            <a
              href={getExplorerContractUrl(targetContractAddress)}
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
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 hover:text-amber-300 border border-amber-500/20 text-xs font-medium transition-all"
                title="Reset local contract state / cache (start fresh or re-initialize)"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset Cache</span>
              </button>
            )}
          </div>

          {metadata.contractSalt && (
            <div className="flex items-center gap-2 font-mono text-xs text-slate-400 flex-wrap">
              <span className="text-slate-500 font-sans text-[11px]">Contract Salt:</span>
              <span
                className="truncate max-w-xs md:max-w-md text-slate-300 font-semibold"
                title={`Contract Salt: 0x${metadata.contractSalt}`}
              >
                0x{metadata.contractSalt.slice(0, 10)}...{metadata.contractSalt.slice(-8)}
              </span>
              <button
                type="button"
                onClick={() => copyToClipboard(metadata.contractSalt || '', 'salt')}
                className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
                title="Copy Contract Salt"
              >
                {copiedSalt ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
              </button>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-indigo-500/15 text-indigo-300 border border-indigo-500/30">
                Cross-Contract Replay Protected
              </span>
            </div>
          )}
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
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {/* 1. Token Name & Symbol */}
        <div className="p-4 rounded-xl bg-slate-950/50 border border-slate-800 hover:border-slate-700 transition-colors">
          <div className="text-xs text-slate-400 flex items-center gap-1.5 mb-1">
            <Coins className="w-3.5 h-3.5 text-blue-400" /> Token Collection
          </div>
          <div className="text-base font-bold text-white tracking-tight flex items-baseline gap-1.5 truncate">
            <span className="truncate">{metadata.name}</span>
            <span className="text-xs font-mono px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-300 flex-shrink-0">
              {metadata.symbol}
            </span>
          </div>
          <div className="text-[11px] text-slate-500 mt-1 font-mono">{metadata.decimals} Decimals</div>
        </div>

        {/* 2. Total Circulation */}
        <div className="p-4 rounded-xl bg-slate-950/50 border border-slate-800 hover:border-slate-700 transition-colors">
          <div className="text-xs text-slate-400 flex items-center gap-1.5 mb-1">
            <Layers className="w-3.5 h-3.5 text-indigo-400" /> Total Supply
          </div>
          <div className="text-base font-bold text-white tracking-tight font-mono truncate">
            {formatUnits(metadata.totalSupply, metadata.decimals)}
          </div>
          <div className="text-[11px] text-slate-500 mt-1 font-mono">
            {metadata.symbol} in circulation
          </div>
        </div>

        {/* 3. Max Supply Cap */}
        <div className="p-4 rounded-xl bg-slate-950/50 border border-slate-800 hover:border-slate-700 transition-colors">
          <div className="text-xs text-slate-400 flex items-center gap-1.5 mb-1">
            <ShieldCheck className="w-3.5 h-3.5 text-teal-400" /> Max Supply Cap
          </div>
          <div className="text-base font-bold text-teal-300 tracking-tight font-mono truncate">
            {isCapped ? formatUnits(metadata.maxSupply!, metadata.decimals) : 'Uncapped'}
          </div>
          <div className="text-[11px] text-slate-500 mt-1 font-mono">
            {isCapped ? 'Hard Supply Ceiling' : 'Max Uint128'}
          </div>
        </div>

        {/* 4. Current User Balance */}
        <div className="p-4 rounded-xl bg-slate-950/50 border border-slate-800 hover:border-slate-700 transition-colors">
          <div className="text-xs text-slate-400 flex items-center justify-between mb-1">
            <span className="flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" /> Spendable Balance
            </span>
            {lockedRawBalance > 0n && (
              <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30" title="Tokens held at raw wallet address cannot authenticate for circuits. Re-mint to spendable account.">
                {formatUnits(lockedRawBalance, metadata.decimals)} Locked
              </span>
            )}
          </div>
          <div className="text-base font-bold text-emerald-400 tracking-tight font-mono truncate">
            {formatUnits(userBalance, metadata.decimals)}
          </div>
          <div className="text-[11px] text-slate-500 mt-1 font-mono truncate flex items-center justify-between">
            <span className="truncate">
              {activeIdentity
                ? activeIdentity.label
                : accountAddress
                ? `${accountAddress.slice(0, 8)}...`
                : 'Not Connected'}
            </span>
            {!isConnected && (
              <button
                type="button"
                onClick={() => connectWallet()}
                className="text-[11px] font-sans text-cyan-400 hover:text-cyan-300 font-semibold underline ml-1 transition-colors cursor-pointer"
              >
                Connect
              </button>
            )}
          </div>
        </div>

        {/* 5. Contract Owner */}
        <div className="p-4 rounded-xl bg-slate-950/50 border border-slate-800 hover:border-slate-700 transition-colors">
          <div className="text-xs text-slate-400 flex items-center justify-between mb-1">
            <span className="flex items-center gap-1.5">
              <Crown className="w-3.5 h-3.5 text-amber-400" /> Owner
            </span>
            {metadata.isInitialized && metadata.isCallerOwner && (
              <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                You
              </span>
            )}
          </div>
          <div className="text-sm font-bold text-white tracking-tight font-mono flex items-center justify-between">
            <span className="truncate max-w-[100px]" title={metadata.isInitialized && metadata.owner ? `Owner Key: 0x${metadata.owner}` : 'Contract Uninitialized'}>
              {metadata.isInitialized && metadata.owner
                ? `${metadata.owner.slice(0, 6)}...${metadata.owner.slice(-4)}`
                : 'Pending Init'}
            </span>
            {metadata.isInitialized && metadata.owner && (
              <button
                type="button"
                onClick={() => copyToClipboard(metadata.owner || '', 'owner')}
                className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
                title="Copy Owner Hex Key"
              >
                {copiedOwner ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
              </button>
            )}
          </div>
          <div className="text-[11px] text-slate-500 mt-1 font-mono truncate">
            {!metadata.isInitialized ? 'Pending Init' : (metadata.isCallerOwner ? 'Exclusive Mint/Burn' : 'FungibleToken Owner')}
          </div>
        </div>

        {/* 6. Emergency Stop & Pauser */}
        <div className="p-4 rounded-xl bg-slate-950/50 border border-slate-800 hover:border-slate-700 transition-colors">
          <div className="text-xs text-slate-400 flex items-center justify-between mb-1">
            <span className="flex items-center gap-1.5">
              <ShieldAlert className="w-3.5 h-3.5 text-rose-400" /> Emergency Pauser
            </span>
            {metadata.isCallerPauser && (
              <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-rose-500/20 text-rose-300 border border-rose-500/30">
                You
              </span>
            )}
          </div>
          <div className="text-sm font-bold text-white tracking-tight font-mono flex items-center justify-between">
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
                className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
                title="Copy Pauser Hex Key"
              >
                {copiedPauser ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
              </button>
            )}
          </div>
          <div className="text-[11px] text-slate-500 mt-1 font-mono truncate">
            {metadata.isPaused ? 'Transfers Paused' : 'Circuit Controls Active'}
          </div>
        </div>
      </div>
    </div>
  );
};
