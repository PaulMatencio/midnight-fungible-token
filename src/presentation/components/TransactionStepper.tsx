'use client';

import React from 'react';
import { Loader2, CheckCircle2, Shield, Send, Check, ExternalLink, AlertCircle } from 'lucide-react';
import { MIDNIGHT_CONFIG, getExplorerTxUrl } from '@/src/infrastructure/config/midnight-config';
import type { TransactionStatus } from '@/src/types/dapp';

interface TransactionStepperProps {
  status: TransactionStatus;
  statusMessage: string;
  txHash: string | null;
  blockHeight: number | null;
}

export const TransactionStepper: React.FC<TransactionStepperProps> = ({
  status,
  statusMessage,
  txHash,
  blockHeight,
}) => {
  if (status === 'idle') return null;

  const steps = [
    { key: 'preparing', label: 'Preparing Transaction', subtext: 'Balancing DUST fee & inputs' },
    { key: 'proving', label: 'Zero-Knowledge Proof', subtext: 'Generating PLONK circuit proof' },
    { key: 'submitting', label: 'Submitting Extrinsic', subtext: 'Broadcasting to Midnight node' },
    { key: 'confirmed', label: 'Block Finalization', subtext: blockHeight ? `Block #${blockHeight}` : 'State transition confirmed' },
  ];

  const getStepState = (stepKey: string) => {
    const order = ['preparing', 'proving', 'submitting', 'confirmed'];
    const currentIndex = order.indexOf(status);
    const stepIndex = order.indexOf(stepKey);

    if (status === 'failed') {
      return 'failed';
    }
    if (stepIndex < currentIndex || status === 'confirmed') {
      return 'done';
    }
    if (stepIndex === currentIndex) {
      return 'active';
    }
    return 'pending';
  };

  return (
    <div className="bg-slate-900/90 border border-slate-700/80 rounded-2xl p-6 backdrop-blur-2xl shadow-2xl animate-in fade-in slide-in-from-top-4">
      {/* Title */}
      <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-blue-500/10 text-blue-400">
            <Shield className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white">Midnight Transaction Lifecycle</h3>
            <p className="text-xs text-slate-400">{statusMessage}</p>
          </div>
        </div>

        {txHash && (
          <a
            href={getExplorerTxUrl(txHash)}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-mono text-blue-400 transition-colors"
          >
            <span>{txHash.slice(0, 10)}...</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        )}
      </div>

      {/* 4 Steps */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        {steps.map((s, idx) => {
          const state = getStepState(s.key);
          return (
            <div
              key={s.key}
              className={`p-3.5 rounded-xl border transition-all ${
                state === 'active'
                  ? 'bg-blue-950/40 border-blue-500/60 shadow-lg shadow-blue-500/10 ring-1 ring-blue-500/30'
                  : state === 'done'
                  ? 'bg-emerald-950/20 border-emerald-500/40 text-emerald-300'
                  : state === 'failed'
                  ? 'bg-rose-950/20 border-rose-500/40 text-rose-300'
                  : 'bg-slate-950/40 border-slate-800/80 opacity-50'
              }`}
            >
              <div className="flex items-center gap-2 mb-1.5">
                {state === 'done' && (
                  <div className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                    <Check className="w-3.5 h-3.5" />
                  </div>
                )}
                {state === 'active' && (
                  <Loader2 className="w-5 h-5 text-blue-400 animate-spin" />
                )}
                {state === 'pending' && (
                  <div className="w-5 h-5 rounded-full bg-slate-800 text-slate-500 text-xs font-mono flex items-center justify-center">
                    {idx + 1}
                  </div>
                )}
                {state === 'failed' && (
                  <AlertCircle className="w-5 h-5 text-rose-400" />
                )}

                <h4 className="text-xs font-semibold text-white truncate">{s.label}</h4>
              </div>
              <p className="text-[11px] text-slate-400">{s.subtext}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
};
