'use client';

import React from 'react';
import { History, CheckCircle2, Clock, AlertTriangle, ExternalLink, Code } from 'lucide-react';
import { MIDNIGHT_CONFIG, getExplorerTxUrl } from '@/src/infrastructure/config/midnight-config';
import type { ActivityItem } from '@/src/types/dapp';

interface ActivityLogProps {
  activities: ActivityItem[];
}

export const ActivityLog: React.FC<ActivityLogProps> = ({ activities }) => {
  const formatTime = (ts: number) => {
    const diff = Math.floor((Date.now() - ts) / 1000);
    if (diff < 5) return 'Just now';
    if (diff < 60) return `${diff}s ago`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    return new Date(ts).toLocaleTimeString();
  };

  return (
    <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-6 backdrop-blur-xl shadow-xl">
      <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-800">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-purple-500/10 text-purple-400">
            <History className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white">Activity & Audit Log</h3>
            <p className="text-[11px] text-slate-400">Contract transaction history & diagnostics</p>
          </div>
        </div>

        <span
          className="text-xs px-2.5 py-1 rounded-lg bg-slate-800 text-slate-300 font-mono"
          suppressHydrationWarning
        >
          {activities.length} Recorded
        </span>
      </div>

      {activities.length === 0 ? (
        <div className="text-center py-10 text-slate-500 text-xs">
          <Code className="w-8 h-8 mx-auto mb-2 opacity-30" />
          No transactions recorded yet in this session.
        </div>
      ) : (
        <div className="space-y-3">
          {activities.map((item) => (
            <div
              key={item.id}
              className="p-3.5 rounded-xl bg-slate-950/50 border border-slate-800/80 hover:border-slate-700/80 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3"
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-mono font-bold text-xs text-white px-2 py-0.5 rounded bg-blue-500/20 text-blue-300">
                    {item.circuitName}()
                  </span>

                  {item.status === 'confirmed' && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-medium text-emerald-400">
                      <CheckCircle2 className="w-3 h-3" /> Confirmed
                      {item.blockHeight && ` (#${item.blockHeight})`}
                    </span>
                  )}
                  {item.status === 'pending' && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-medium text-amber-400">
                      <Clock className="w-3 h-3 animate-spin" /> Pending
                    </span>
                  )}
                  {item.status === 'failed' && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-medium text-rose-400">
                      <AlertTriangle className="w-3 h-3" /> Failed
                    </span>
                  )}

                  <span className="text-[10px] text-slate-500 font-mono" suppressHydrationWarning>
                    {formatTime(item.timestamp)}
                  </span>
                </div>

                {/* Parameters summary */}
                <div className="text-[11px] text-slate-400 font-mono flex flex-wrap gap-2">
                  {Object.entries(item.params).map(([k, v]) => (
                    <span key={k} className="bg-slate-900 px-1.5 py-0.5 rounded">
                      <span className="text-slate-500">{k}:</span> {v.length > 18 ? `${v.slice(0, 8)}...${v.slice(-6)}` : v}
                    </span>
                  ))}
                </div>

                {item.error && (
                  <p className="text-[11px] text-rose-400 font-mono pt-1">
                    Error: {item.error}
                  </p>
                )}
              </div>

              {item.txHash && (
                <div className="flex items-center gap-2 sm:self-center">
                  <a
                    href={getExplorerTxUrl(item.txHash)}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 font-mono bg-blue-950/40 border border-blue-500/20 px-2.5 py-1 rounded-lg transition-colors"
                  >
                    <span>{item.txHash.slice(0, 8)}...{item.txHash.slice(-6)}</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
