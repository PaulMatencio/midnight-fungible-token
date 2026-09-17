'use client';

import React, { useEffect, useState } from 'react';
import {
  Loader2,
  CheckCircle2,
  ShieldCheck,
  Radio,
  ExternalLink,
  AlertCircle,
  Clock,
  FileCode2,
  KeyRound,
  Check,
  X,
  Copy,
  Sparkles,
} from 'lucide-react';
import { getExplorerTxUrl } from '@/src/infrastructure/config/midnight-config';
import type { TransactionStatus } from '@/src/types/dapp';

interface TransactionStepperProps {
  status: TransactionStatus;
  statusMessage: string;
  txHash: string | null;
  blockHeight: number | null;
  actionName?: string | null;
  onDismiss?: () => void;
}

export const TransactionStepper: React.FC<TransactionStepperProps> = ({
  status,
  statusMessage,
  txHash,
  blockHeight,
  actionName,
  onDismiss,
}) => {
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [copiedTxHash, setCopiedTxHash] = useState(false);

  // Timer tracking active transaction duration
  useEffect(() => {
    if (status === 'idle') {
      setElapsedSeconds(0);
      return;
    }

    if (status === 'confirmed' || status === 'failed') {
      return;
    }

    const timer = setInterval(() => {
      setElapsedSeconds((prev) => prev + 1);
    }, 1000);

    return () => clearInterval(timer);
  }, [status]);

  if (status === 'idle') return null;

  const steps = [
    {
      key: 'preparing',
      stepNum: 1,
      label: 'Building Transaction',
      subtext: 'Witness resolution & Compact circuit intent',
      icon: FileCode2,
    },
    {
      key: 'proving',
      stepNum: 2,
      label: 'Zero-Knowledge Proof',
      subtext: 'Generating PLONK proof via Proof Server',
      icon: ShieldCheck,
    },
    {
      key: 'signing',
      stepNum: 3,
      label: 'Wallet Signature',
      subtext: 'Lace fee balancing & transaction authorization',
      icon: KeyRound,
    },
    {
      key: 'submitting',
      stepNum: 4,
      label: 'Submitting Extrinsic',
      subtext: 'Broadcasting signed transaction to Midnight node',
      icon: Radio,
    },
    {
      key: 'confirmed',
      stepNum: 5,
      label: 'Committed On-Chain',
      subtext: blockHeight
        ? `Consensus verified in Block #${blockHeight}`
        : 'State transition confirmed on-chain',
      icon: CheckCircle2,
    },
  ];

  const order: TransactionStatus[] = ['preparing', 'proving', 'signing', 'submitting', 'confirmed'];
  const currentIndex = order.indexOf(status);

  // Calculate percentage of lifecycle completion
  const getProgressPercent = () => {
    if (status === 'failed') {
      return Math.max(10, (currentIndex + 1) * 20);
    }
    if (status === 'confirmed') return 100;
    if (currentIndex >= 0) {
      return (currentIndex + 1) * 20;
    }
    return 10;
  };

  const getStepState = (stepKey: string) => {
    const stepIndex = order.indexOf(stepKey as TransactionStatus);

    if (status === 'failed') {
      if (stepIndex === currentIndex) return 'failed';
      if (stepIndex < currentIndex) return 'done';
      return 'pending';
    }
    if (status === 'confirmed') {
      return 'done';
    }
    if (stepIndex < currentIndex) {
      return 'done';
    }
    if (stepIndex === currentIndex) {
      return 'active';
    }
    return 'pending';
  };

  const formatTime = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const remaining = secs % 60;
    return `${mins.toString().padStart(2, '0')}:${remaining.toString().padStart(2, '0')}`;
  };

  const copyHash = (hash: string) => {
    navigator.clipboard.writeText(hash);
    setCopiedTxHash(true);
    setTimeout(() => setCopiedTxHash(false), 2000);
  };

  const displayActionTitle = actionName
    ? `${actionName.toUpperCase()} Transaction Lifecycle`
    : 'Midnight Transaction Lifecycle';

  return (
    <div className="relative overflow-hidden rounded-2xl bg-white dark:bg-gradient-to-b dark:from-slate-900/95 dark:via-slate-900/90 dark:to-slate-950/95 border border-slate-200 dark:border-cyan-500/30 p-5 sm:p-6 backdrop-blur-2xl shadow-xl dark:shadow-2xl dark:shadow-cyan-950/30 animate-in fade-in slide-in-from-top-4 duration-300">
      {/* Background Decorative Glow */}
      <div className="absolute -top-24 -right-24 w-64 h-64 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-24 -left-24 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Top Header Row */}
      <div className="relative flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-5 border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-start sm:items-center gap-3.5">
          <div className="p-2.5 rounded-xl bg-blue-50 dark:bg-gradient-to-br dark:from-cyan-500/20 dark:to-blue-500/20 border border-blue-200 dark:border-cyan-500/30 text-blue-700 dark:text-cyan-400 shadow-inner flex-shrink-0 mt-0.5 sm:mt-0">
            {status === 'confirmed' ? (
              <Sparkles className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            ) : status === 'failed' ? (
              <AlertCircle className="w-5 h-5 text-rose-600 dark:text-rose-400" />
            ) : (
              <Loader2 className="w-5 h-5 animate-spin text-blue-600 dark:text-cyan-400" />
            )}
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white tracking-tight">
                {displayActionTitle}
              </h3>
              {actionName && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-blue-100 dark:bg-cyan-500/15 text-blue-900 dark:text-cyan-300 border border-blue-200 dark:border-cyan-500/30 uppercase">
                  Circuit: {actionName}
                </span>
              )}
              {status === 'confirmed' && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 dark:bg-emerald-500/20 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-500/30">
                  Committed On-Chain
                </span>
              )}
              {status === 'failed' && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 dark:bg-rose-500/20 text-rose-800 dark:text-rose-300 border border-rose-200 dark:border-rose-500/30">
                  Execution Stopped
                </span>
              )}
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-300 mt-1 flex items-center gap-2">
              <span className="inline-block w-2 h-2 rounded-full bg-blue-600 dark:bg-cyan-400 animate-ping" />
              <span>{statusMessage || 'Processing transaction...'}</span>
            </p>
          </div>
        </div>

        {/* Right Info Details: Timer, Tx Hash, Dismiss Button */}
        <div className="flex items-center gap-2 self-start lg:self-center flex-wrap">
          {/* Elapsed Duration Pill */}
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/60 text-xs font-mono text-slate-700 dark:text-slate-300 shadow-xs">
            <Clock className="w-3.5 h-3.5 text-blue-700 dark:text-cyan-400" />
            <span>{formatTime(elapsedSeconds)}</span>
          </div>

          {/* On-Chain Block Height Badge */}
          {blockHeight && (
            <div className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30 text-xs font-mono text-emerald-800 dark:text-emerald-300 font-semibold shadow-xs">
              <span>Block #{blockHeight}</span>
            </div>
          )}

          {/* Transaction Explorer Link */}
          {txHash && (
            <div className="flex items-center gap-1">
              <a
                href={getExplorerTxUrl(txHash)}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-xs font-mono text-blue-700 dark:text-cyan-400 hover:text-blue-900 dark:hover:text-cyan-300 transition-colors shadow-xs"
                title="View in Midnight Block Explorer"
              >
                <span>{txHash.slice(0, 10)}...</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
              <button
                onClick={() => copyHash(txHash)}
                className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white border border-slate-200 dark:border-slate-700 transition-colors"
                title="Copy Transaction Hash"
              >
                {copiedTxHash ? <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>
          )}

          {/* Dismiss / Cancel Button */}
          {onDismiss && (
            <button
              onClick={onDismiss}
              className="px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800/80 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white border border-slate-200 dark:border-slate-700 transition-colors cursor-pointer flex items-center gap-1.5 text-xs font-semibold shadow-xs"
              title={
                status === 'confirmed' || status === 'failed'
                  ? 'Dismiss status banner'
                  : 'Abort / Dismiss transaction lifecycle banner'
              }
            >
              <X className="w-3.5 h-3.5 text-rose-500 dark:text-rose-400" />
              <span>
                {status === 'confirmed' || status === 'failed' ? 'Dismiss' : 'Cancel / Dismiss'}
              </span>
            </button>
          )}
        </div>
      </div>

      {/* Progress Bar Track */}
      <div className="mt-4 mb-5">
        <div className="flex items-center justify-between text-[11px] font-mono text-slate-600 dark:text-slate-400 mb-1.5">
          <span>
            {status === 'confirmed'
              ? 'All 5 Steps Completed Successfully'
              : `Step ${Math.min(5, Math.max(1, currentIndex + 1))} of 5 in progress`}
          </span>
          <span className="font-semibold text-blue-900 dark:text-cyan-400">{getProgressPercent()}%</span>
        </div>
        <div className="w-full h-1.5 rounded-full bg-slate-200 dark:bg-slate-800/80 overflow-hidden relative">
          <div
            className={`h-full transition-all duration-500 ease-out rounded-full ${
              status === 'confirmed'
                ? 'bg-gradient-to-r from-blue-600 via-teal-500 to-emerald-600 dark:from-cyan-400 dark:via-teal-400 dark:to-emerald-400'
                : status === 'failed'
                ? 'bg-gradient-to-r from-blue-600 to-rose-600 dark:from-cyan-400 dark:to-rose-500'
                : 'bg-gradient-to-r from-blue-600 via-indigo-600 to-teal-600 dark:from-blue-500 dark:via-cyan-400 dark:to-teal-400'
            }`}
            style={{ width: `${getProgressPercent()}%` }}
          />
        </div>
      </div>

      {/* 5 Distinct Transaction Steps */}
      <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
        {steps.map((s) => {
          const state = getStepState(s.key);
          const StepIcon = s.icon;

          return (
            <div
              key={s.key}
              className={`relative rounded-xl p-3.5 border transition-all duration-300 flex flex-col justify-between ${
                state === 'active'
                  ? 'bg-blue-50/90 border-blue-400/80 dark:bg-gradient-to-b dark:from-cyan-950/60 dark:to-blue-950/40 dark:border-cyan-400/80 shadow-md ring-2 ring-blue-400/30 dark:ring-cyan-400/30'
                  : state === 'done'
                  ? 'bg-emerald-50 border-emerald-300 text-emerald-900 dark:bg-emerald-950/25 dark:border-emerald-500/40 dark:text-emerald-200'
                  : state === 'failed'
                  ? 'bg-rose-50 border-rose-300 text-rose-900 dark:bg-rose-950/30 dark:border-rose-500/60 dark:text-rose-200'
                  : 'bg-slate-50 border-slate-200 text-slate-600 dark:bg-slate-950/40 dark:border-slate-800/80 opacity-70 dark:opacity-60 dark:text-slate-400'
              }`}
            >
              {/* Step Header */}
              <div>
                <div className="flex items-center justify-between gap-2 mb-2">
                  <div
                    className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs ${
                      state === 'active'
                        ? 'bg-blue-600 text-white dark:bg-cyan-500 dark:text-slate-950 shadow-md shadow-blue-500/20 dark:shadow-cyan-500/30'
                        : state === 'done'
                        ? 'bg-emerald-100 text-emerald-800 border border-emerald-300 dark:bg-emerald-500/20 dark:text-emerald-400 dark:border-emerald-500/40'
                        : state === 'failed'
                        ? 'bg-rose-100 text-rose-800 border border-rose-300 dark:bg-rose-500/20 dark:text-rose-400 dark:border-rose-500/40'
                        : 'bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-500 font-mono'
                    }`}
                  >
                    {state === 'done' ? (
                      <Check className="w-4 h-4 stroke-[3]" />
                    ) : state === 'failed' ? (
                      <X className="w-4 h-4" />
                    ) : state === 'active' ? (
                      <Loader2 className="w-4 h-4 animate-spin text-white dark:text-slate-950" />
                    ) : (
                      s.stepNum
                    )}
                  </div>

                  <span
                    className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                      state === 'active'
                        ? 'bg-blue-100 text-blue-900 border border-blue-300 dark:bg-cyan-500/20 dark:text-cyan-300 dark:border-cyan-500/40 animate-pulse'
                        : state === 'done'
                        ? 'bg-emerald-100 text-emerald-800 border border-emerald-300 dark:bg-emerald-500/15 dark:text-emerald-300 dark:border-emerald-500/30'
                        : state === 'failed'
                        ? 'bg-rose-100 text-rose-800 border border-rose-300 dark:bg-rose-500/15 dark:text-rose-300 dark:border-rose-500/30'
                        : 'bg-slate-200 text-slate-600 dark:bg-slate-800/60 dark:text-slate-500'
                    }`}
                  >
                    {state === 'active'
                      ? 'In Progress'
                      : state === 'done'
                      ? 'Completed'
                      : state === 'failed'
                      ? 'Failed'
                      : 'Pending'}
                  </span>
                </div>

                <div className="flex items-center gap-1.5 mb-1">
                  <StepIcon
                    className={`w-3.5 h-3.5 flex-shrink-0 ${
                      state === 'active'
                        ? 'text-blue-700 dark:text-cyan-400'
                        : state === 'done'
                        ? 'text-emerald-700 dark:text-emerald-400'
                        : state === 'failed'
                        ? 'text-rose-700 dark:text-rose-400'
                        : 'text-slate-500'
                    }`}
                  />
                  <h4
                    className={`text-xs font-bold truncate ${
                      state === 'active'
                        ? 'text-slate-900 dark:text-white'
                        : state === 'done'
                        ? 'text-emerald-950 dark:text-emerald-100'
                        : state === 'failed'
                        ? 'text-rose-950 dark:text-rose-100'
                        : 'text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    {s.label}
                  </h4>
                </div>

                <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-snug">{s.subtext}</p>
              </div>

              {/* Active Pulsing Indicator Line */}
              {state === 'active' && (
                <div className="mt-3 pt-2 border-t border-blue-200 dark:border-cyan-500/30 flex items-center justify-between text-[10px] font-mono text-blue-900 dark:text-cyan-300">
                  <span className="flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-600 dark:bg-cyan-400 animate-ping" />
                    Executing...
                  </span>
                  <span>{formatTime(elapsedSeconds)}</span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
