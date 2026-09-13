'use client';

import React, { useState, useMemo } from 'react';
import {
  History,
  CheckCircle2,
  Clock,
  AlertTriangle,
  ExternalLink,
  Code,
  Download,
  Trash2,
  Search,
  Filter,
  Copy,
  Check,
  PlusCircle,
  Flame,
  Send,
  Repeat,
  CheckSquare,
  ShieldAlert,
  ShieldCheck,
  ArrowDownToLine,
  RotateCcw,
  ChevronDown,
  ChevronUp,
  Database,
  FileJson,
  FileSpreadsheet,
  User,
  Terminal,
  RefreshCw,
} from 'lucide-react';
import { getExplorerTxUrl, getExplorerContractUrl } from '@/src/infrastructure/config/midnight-config';
import { queryTransactionOnChain, type OnChainTxVerification } from '@/src/infrastructure/midnight/midnight-indexer-client';
import type { ActivityItem } from '@/src/types/dapp';

interface ActivityLogProps {
  activities: ActivityItem[];
  activeContractAddress?: string;
  onClearActivities?: () => void;
}

export const ActivityLog: React.FC<ActivityLogProps> = ({
  activities,
  activeContractAddress,
  onClearActivities,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'confirmed' | 'pending' | 'failed'>('all');
  const [scopeFilter, setScopeFilter] = useState<'current' | 'all'>('current');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  // Live On-Chain Verification State
  const [verifyingId, setVerifyingId] = useState<string | null>(null);
  const [verifications, setVerifications] = useState<Record<string, OnChainTxVerification>>({});
  const [manualHashInput, setManualHashInput] = useState('');
  const [isManualChecking, setIsManualChecking] = useState(false);
  const [manualResult, setManualResult] = useState<OnChainTxVerification | null>(null);

  const formatRelativeTime = (ts: number) => {
    const diff = Math.floor((Date.now() - ts) / 1000);
    if (diff < 5) return 'Just now';
    if (diff < 60) return `${diff}s ago`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return new Date(ts).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatFullTimestamp = (ts: number) => {
    return new Date(ts).toISOString().replace('T', ' ').replace(/\..+/, ' UTC');
  };

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleVerify = async (item: ActivityItem) => {
    if (!item.txHash) return;

    if (item.mode === 'test') {
      setVerifications((prev) => ({
        ...prev,
        [item.id]: {
          hash: item.txHash!,
          verified: false,
          error:
            'Simulated Mode: This transaction ran locally in browser memory and was never broadcast to the Midnight Preprod blockchain. Connect Lace Wallet and switch to Lace mode to submit transactions to the blockchain.',
          checkedAt: new Date().toISOString(),
        },
      }));
      return;
    }

    setVerifyingId(item.id);
    try {
      const res = await queryTransactionOnChain(item.txHash);
      setVerifications((prev) => ({ ...prev, [item.id]: res }));
    } catch (e: any) {
      setVerifications((prev) => ({
        ...prev,
        [item.id]: {
          hash: item.txHash!,
          verified: false,
          error: e?.message || 'Verification failed',
          checkedAt: new Date().toISOString(),
        },
      }));
    } finally {
      setVerifyingId(null);
    }
  };

  const handleManualCheck = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualHashInput.trim()) return;
    setIsManualChecking(true);
    try {
      const res = await queryTransactionOnChain(manualHashInput.trim());
      setManualResult(res);
    } catch (err: any) {
      setManualResult({
        hash: manualHashInput.trim(),
        verified: false,
        error: err?.message || 'Check failed',
        checkedAt: new Date().toISOString(),
      });
    } finally {
      setIsManualChecking(false);
    }
  };

  // Scope filter: filter by current contract address if active
  const scopedActivities = useMemo(() => {
    if (scopeFilter === 'all' || !activeContractAddress) {
      return activities;
    }
    return activities.filter(
      (a) => !a.contractAddress || a.contractAddress.toLowerCase() === activeContractAddress.toLowerCase()
    );
  }, [activities, scopeFilter, activeContractAddress]);

  // Search and status filter
  const filteredActivities = useMemo(() => {
    return scopedActivities.filter((item) => {
      if (statusFilter !== 'all' && item.status !== statusFilter) {
        return false;
      }
      if (!searchQuery.trim()) return true;

      const q = searchQuery.toLowerCase().trim();
      const inCircuit = item.circuitName?.toLowerCase().includes(q);
      const inHash = item.txHash?.toLowerCase().includes(q);
      const inCaller = item.caller?.toLowerCase().includes(q);
      const inBlock = item.blockHeight?.toString().includes(q);
      const inError = item.error?.toLowerCase().includes(q);
      const inParams = Object.entries(item.params || {}).some(
        ([k, v]) => k.toLowerCase().includes(q) || String(v).toLowerCase().includes(q)
      );

      return inCircuit || inHash || inCaller || inBlock || inError || inParams;
    });
  }, [scopedActivities, statusFilter, searchQuery]);

  const stats = useMemo(() => {
    const confirmed = scopedActivities.filter((a) => a.status === 'confirmed').length;
    const pending = scopedActivities.filter((a) => a.status === 'pending').length;
    const failed = scopedActivities.filter((a) => a.status === 'failed').length;
    return { total: scopedActivities.length, confirmed, pending, failed };
  }, [scopedActivities]);

  const exportAsJson = () => {
    const exportData = {
      exportedAt: new Date().toISOString(),
      contractAddress: activeContractAddress || 'all',
      totalRecords: scopedActivities.length,
      auditLog: scopedActivities,
    };
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `midnight-audit-log-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportAsCsv = () => {
    const headers = [
      'ID',
      'Timestamp_UTC',
      'Circuit',
      'Status',
      'Block_Height',
      'Transaction_Hash',
      'Caller',
      'Contract_Address',
      'Mode',
      'Duration_Sec',
      'Parameters',
      'Error',
    ];

    const escapeCsv = (val: any) => {
      if (val === null || val === undefined) return '';
      const str = String(val).replace(/"/g, '""');
      return `"${str}"`;
    };

    const rows = scopedActivities.map((item) => [
      escapeCsv(item.id),
      escapeCsv(new Date(item.timestamp).toISOString()),
      escapeCsv(item.circuitName),
      escapeCsv(item.status),
      escapeCsv(item.blockHeight || ''),
      escapeCsv(item.txHash || ''),
      escapeCsv(item.caller || ''),
      escapeCsv(item.contractAddress || ''),
      escapeCsv(item.mode || ''),
      escapeCsv(item.durationMs ? (item.durationMs / 1000).toFixed(1) : ''),
      escapeCsv(JSON.stringify(item.params || {})),
      escapeCsv(item.error || ''),
    ]);

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `midnight-audit-log-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const getCircuitBadge = (circuitName: string) => {
    switch (circuitName.toLowerCase()) {
      case 'mint':
        return {
          icon: <PlusCircle className="w-3.5 h-3.5 text-emerald-400" />,
          bg: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
        };
      case 'burn':
        return {
          icon: <Flame className="w-3.5 h-3.5 text-rose-400" />,
          bg: 'bg-rose-500/15 text-rose-300 border-rose-500/30',
        };
      case 'transfer':
        return {
          icon: <Send className="w-3.5 h-3.5 text-blue-400" />,
          bg: 'bg-blue-500/15 text-blue-300 border-blue-500/30',
        };
      case 'transferfrom':
        return {
          icon: <Repeat className="w-3.5 h-3.5 text-indigo-400" />,
          bg: 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30',
        };
      case 'approve':
        return {
          icon: <CheckSquare className="w-3.5 h-3.5 text-purple-400" />,
          bg: 'bg-purple-500/15 text-purple-300 border-purple-500/30',
        };
      case 'pause':
      case 'unpause':
        return {
          icon: <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />,
          bg: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
        };
      case 'emergencywithdraw':
        return {
          icon: <ArrowDownToLine className="w-3.5 h-3.5 text-rose-400" />,
          bg: 'bg-rose-500/15 text-rose-300 border-rose-500/30',
        };
      case 'adminreallocate':
        return {
          icon: <RotateCcw className="w-3.5 h-3.5 text-teal-400" />,
          bg: 'bg-teal-500/15 text-teal-300 border-teal-500/30',
        };
      default:
        return {
          icon: <Code className="w-3.5 h-3.5 text-cyan-400" />,
          bg: 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30',
        };
    }
  };

  return (
    <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-5 sm:p-6 backdrop-blur-xl shadow-xl space-y-5">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800/80">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-purple-500/15 text-purple-400 border border-purple-500/20 shadow-md shadow-purple-500/10">
            <History className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-white">Activity & Audit Trail</h3>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                <Database className="w-2.5 h-2.5" /> Persistent Storage
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Immutable local transaction history, cryptographic proof records & live on-chain verification
            </p>
          </div>
        </div>

        {/* Export & Actions Toolbar */}
        <div className="flex items-center gap-2 self-end sm:self-auto">
          <div className="flex items-center gap-1.5 bg-slate-950/80 border border-slate-800 p-1 rounded-xl">
            <button
              onClick={exportAsJson}
              disabled={scopedActivities.length === 0}
              className="px-2.5 py-1.5 rounded-lg text-xs font-semibold text-slate-300 hover:text-white hover:bg-slate-800/80 transition-colors disabled:opacity-40 flex items-center gap-1.5 cursor-pointer"
              title="Export complete audit trail as JSON"
            >
              <FileJson className="w-3.5 h-3.5 text-blue-400" />
              <span>JSON</span>
            </button>
            <button
              onClick={exportAsCsv}
              disabled={scopedActivities.length === 0}
              className="px-2.5 py-1.5 rounded-lg text-xs font-semibold text-slate-300 hover:text-white hover:bg-slate-800/80 transition-colors disabled:opacity-40 flex items-center gap-1.5 cursor-pointer"
              title="Export complete audit trail as CSV spreadsheet"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
              <span>CSV</span>
            </button>
          </div>

          {onClearActivities && (
            <button
              onClick={() => setShowClearConfirm(true)}
              disabled={activities.length === 0}
              className="p-2 rounded-xl text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 border border-slate-800 hover:border-rose-500/30 transition-all disabled:opacity-30 cursor-pointer"
              title="Clear stored audit history"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Clear Confirmation Prompt */}
      {showClearConfirm && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-in fade-in">
          <div className="flex items-center gap-2.5 text-xs text-rose-200">
            <AlertTriangle className="w-4 h-4 text-rose-400 flex-shrink-0" />
            <span>Are you sure you want to clear all {activities.length} persistent audit log entries?</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowClearConfirm(false)}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-300 hover:bg-slate-800/80 border border-slate-700/80 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={() => {
                onClearActivities?.();
                setShowClearConfirm(false);
              }}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-rose-600 hover:bg-rose-500 text-white shadow-sm shadow-rose-600/30 transition-colors cursor-pointer"
            >
              Yes, Clear Audit Trail
            </button>
          </div>
        </div>
      )}

      {/* Direct Live Indexer Verification Banner */}
      <div className="p-4 rounded-xl bg-gradient-to-r from-blue-950/40 via-purple-950/30 to-slate-950/50 border border-blue-500/30 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-xs font-semibold text-blue-200">
            <ShieldCheck className="w-4 h-4 text-blue-400" />
            <span>Direct Midnight Preprod Indexer Verifier</span>
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-500/30">
              Zero Sync Lag
            </span>
          </div>
          <span className="text-[11px] text-slate-400">
            Queries <code className="font-mono text-slate-300">indexer.preprod.midnight.network</code> directly
          </span>
        </div>

        <form onSubmit={handleManualCheck} className="flex flex-col sm:flex-row items-center gap-2">
          <input
            type="text"
            value={manualHashInput}
            onChange={(e) => setManualHashInput(e.target.value)}
            placeholder="Paste any Transaction Hash (64-char hex) or click 'Verify Live' on any card below..."
            className="flex-1 w-full px-3.5 py-2 rounded-xl bg-slate-950/90 border border-slate-800 focus:border-blue-500 text-xs font-mono text-white placeholder-slate-500 focus:outline-none transition-colors"
          />
          <button
            type="submit"
            disabled={isManualChecking || !manualHashInput.trim()}
            className="w-full sm:w-auto px-4 py-2 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white flex items-center justify-center gap-1.5 transition-colors shadow-md shadow-blue-500/20 disabled:opacity-50 cursor-pointer whitespace-nowrap"
          >
            {isManualChecking ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <ShieldCheck className="w-3.5 h-3.5" />}
            <span>{isManualChecking ? 'Querying Indexer...' : 'Verify Hash On-Chain'}</span>
          </button>
        </form>

        {manualResult && (
          <div
            className={`p-3 rounded-xl border text-xs font-mono space-y-1.5 animate-in fade-in ${
              manualResult.verified
                ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-200'
                : 'bg-amber-950/40 border-amber-500/40 text-amber-200'
            }`}
          >
            <div className="flex items-center justify-between font-bold">
              <span className="flex items-center gap-1.5">
                {manualResult.verified ? (
                  <>
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    Transaction Confirmed on Midnight Preprod!
                  </>
                ) : (
                  <>
                    <AlertTriangle className="w-4 h-4 text-amber-400" />
                    Transaction Not Found on Indexer
                  </>
                )}
              </span>
              <span className="text-[10px] text-slate-400">
                Checked: {new Date(manualResult.checkedAt).toLocaleTimeString()}
              </span>
            </div>

            {manualResult.verified && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] pt-1 border-t border-emerald-500/20">
                <div>
                  <span className="text-slate-400">Block Height:</span>{' '}
                  <strong className="text-white">#{manualResult.blockHeight}</strong>
                </div>
                <div>
                  <span className="text-slate-400">Protocol Version:</span>{' '}
                  <span className="text-white">{manualResult.protocolVersion}</span>
                </div>
                <div className="sm:col-span-2 break-all">
                  <span className="text-slate-400">Block Hash:</span>{' '}
                  <span className="text-slate-300">{manualResult.blockHash}</span>
                </div>
                {manualResult.contractActions && manualResult.contractActions.length > 0 && (
                  <div className="sm:col-span-2 break-all">
                    <span className="text-slate-400">Target Contract:</span>{' '}
                    <span className="text-blue-300">{manualResult.contractActions[0].address}</span>
                  </div>
                )}
              </div>
            )}

            {manualResult.error && (
              <p className="text-[11px] text-rose-300 pt-1">
                {manualResult.error}
              </p>
            )}
          </div>
        )}
      </div>

      {/* Scope, Filter, & Search Bar */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        {/* Status Filter Chips */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0 text-xs">
          <button
            onClick={() => setStatusFilter('all')}
            className={`px-3 py-1.5 rounded-xl font-semibold transition-all cursor-pointer whitespace-nowrap ${
              statusFilter === 'all'
                ? 'bg-blue-600 text-white shadow-sm shadow-blue-600/30'
                : 'text-slate-400 hover:text-white bg-slate-950/60 border border-slate-800'
            }`}
          >
            All ({stats.total})
          </button>
          <button
            onClick={() => setStatusFilter('confirmed')}
            className={`px-3 py-1.5 rounded-xl font-semibold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
              statusFilter === 'confirmed'
                ? 'bg-emerald-600 text-white shadow-sm shadow-emerald-600/30'
                : 'text-slate-400 hover:text-white bg-slate-950/60 border border-slate-800'
            }`}
          >
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            Confirmed ({stats.confirmed})
          </button>
          <button
            onClick={() => setStatusFilter('pending')}
            className={`px-3 py-1.5 rounded-xl font-semibold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
              statusFilter === 'pending'
                ? 'bg-amber-600 text-white shadow-sm shadow-amber-600/30'
                : 'text-slate-400 hover:text-white bg-slate-950/60 border border-slate-800'
            }`}
          >
            <Clock className="w-3.5 h-3.5 text-amber-400" />
            Pending ({stats.pending})
          </button>
          <button
            onClick={() => setStatusFilter('failed')}
            className={`px-3 py-1.5 rounded-xl font-semibold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
              statusFilter === 'failed'
                ? 'bg-rose-600 text-white shadow-sm shadow-rose-600/30'
                : 'text-slate-400 hover:text-white bg-slate-950/60 border border-slate-800'
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
            Failed ({stats.failed})
          </button>
        </div>

        {/* Right side: Search & Scope */}
        <div className="flex items-center gap-2">
          {activeContractAddress && (
            <div className="flex items-center bg-slate-950/80 border border-slate-800 rounded-xl p-1 text-[11px] font-semibold">
              <button
                onClick={() => setScopeFilter('current')}
                className={`px-2 py-1 rounded-lg transition-colors cursor-pointer ${
                  scopeFilter === 'current'
                    ? 'bg-purple-600 text-white shadow-sm shadow-purple-600/30'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Current Contract
              </button>
              <button
                onClick={() => setScopeFilter('all')}
                className={`px-2 py-1 rounded-lg transition-colors cursor-pointer ${
                  scopeFilter === 'all'
                    ? 'bg-purple-600 text-white shadow-sm shadow-purple-600/30'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                All History
              </button>
            </div>
          )}

          <div className="relative flex-1 sm:w-60">
            <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search circuit, hash, address..."
              className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-slate-950/80 border border-slate-800 focus:border-blue-500 text-xs text-white placeholder-slate-500 focus:outline-none transition-colors"
            />
          </div>
        </div>
      </div>

      {/* Activity List */}
      {filteredActivities.length === 0 ? (
        <div className="text-center py-12 rounded-xl bg-slate-950/40 border border-dashed border-slate-800/80 text-slate-500 text-xs space-y-2">
          <Code className="w-8 h-8 mx-auto opacity-30 text-slate-400" />
          <p className="font-semibold text-slate-400">No matching transactions or audit events</p>
          <p className="text-[11px] text-slate-500">
            {searchQuery || statusFilter !== 'all'
              ? 'Try adjusting your search query or status filter.'
              : 'Execute a circuit (Mint, Transfer, Burn) to record persistent on-chain transactions.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredActivities.map((item) => {
            const badge = getCircuitBadge(item.circuitName);
            const isExpanded = expandedId === item.id;
            const verification = verifications[item.id];
            const isVerifying = verifyingId === item.id;

            return (
              <div
                key={item.id}
                className="p-4 rounded-xl bg-slate-950/70 border border-slate-800/80 hover:border-slate-700 transition-all space-y-3 shadow-md"
              >
                {/* Card Top Row */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <span
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-mono font-bold border ${badge.bg}`}
                    >
                      {badge.icon}
                      {item.circuitName}()
                    </span>

                    {item.status === 'confirmed' && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-md">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Confirmed
                        {item.blockHeight && (
                          <span className="font-mono text-[10px] text-emerald-300">
                            (Block #{item.blockHeight})
                          </span>
                        )}
                      </span>
                    )}
                    {item.status === 'pending' && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-md">
                        <Clock className="w-3.5 h-3.5 animate-spin" /> In Progress
                      </span>
                    )}
                    {item.status === 'failed' && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-400 bg-rose-500/10 border border-rose-500/20 px-2 py-0.5 rounded-md">
                        <AlertTriangle className="w-3.5 h-3.5" /> Failed
                      </span>
                    )}

                    {item.mode && (
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-slate-400">
                        {item.mode === 'lace' ? 'Lace Preprod' : 'Simulated'}
                      </span>
                    )}

                    {item.durationMs && (
                      <span className="text-[10px] font-mono text-slate-400">
                        ⏱ {(item.durationMs / 1000).toFixed(1)}s
                      </span>
                    )}
                  </div>

                  {/* Timing */}
                  <div
                    className="text-[11px] text-slate-400 font-mono sm:text-right"
                    title={formatFullTimestamp(item.timestamp)}
                  >
                    <span>{formatRelativeTime(item.timestamp)}</span>
                    <span className="hidden sm:inline text-slate-600 ml-1.5">•</span>
                    <span className="hidden sm:inline text-slate-500 ml-1.5 text-[10px]">
                      {new Date(item.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                </div>

                {/* Parameters & Caller Summary */}
                <div className="flex flex-wrap items-center gap-2 text-xs font-mono">
                  {item.caller && (
                    <span className="bg-slate-900/90 border border-slate-800 px-2 py-1 rounded-lg text-slate-400 flex items-center gap-1.5">
                      <User className="w-3 h-3 text-slate-500" />
                      <span className="text-slate-500">Caller:</span>
                      <span className="text-slate-200">
                        {item.caller.length > 18
                          ? `${item.caller.slice(0, 8)}...${item.caller.slice(-6)}`
                          : item.caller}
                      </span>
                    </span>
                  )}

                  {Object.entries(item.params || {}).map(([k, v]) => (
                    <span
                      key={k}
                      className="bg-slate-900/90 border border-slate-800 px-2 py-1 rounded-lg text-slate-400 flex items-center gap-1"
                    >
                      <span className="text-slate-500">{k}:</span>
                      <span className="text-slate-200">
                        {String(v).length > 22
                          ? `${String(v).slice(0, 10)}...${String(v).slice(-6)}`
                          : String(v)}
                      </span>
                    </span>
                  ))}
                </div>

                {/* Error Banner */}
                {item.error && (
                  <div className="p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs font-mono flex items-start gap-2">
                    <AlertTriangle className="w-3.5 h-3.5 text-rose-400 flex-shrink-0 mt-0.5" />
                    <div className="break-all">{item.error}</div>
                  </div>
                )}

                {/* Live On-Chain Verification Card */}
                {verification && (
                  <div
                    className={`p-3 rounded-xl border text-xs font-mono space-y-1.5 animate-in fade-in ${
                      verification.verified
                        ? 'bg-emerald-950/30 border-emerald-500/40 text-emerald-200'
                        : item.mode === 'test'
                        ? 'bg-purple-950/30 border-purple-500/40 text-purple-200'
                        : 'bg-amber-950/30 border-amber-500/40 text-amber-200'
                    }`}
                  >
                    <div className="flex items-center justify-between font-bold">
                      <span className="flex items-center gap-1.5">
                        {verification.verified ? (
                          <>
                            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                            Confirmed On-Chain (Midnight Preprod Indexer)
                          </>
                        ) : item.mode === 'test' ? (
                          <>
                            <AlertTriangle className="w-4 h-4 text-purple-400" />
                            Simulated (Local Memory Only)
                          </>
                        ) : verification.error?.includes('Invalid') ? (
                          <>
                            <AlertTriangle className="w-4 h-4 text-rose-400" />
                            Invalid Hash Format
                          </>
                        ) : (
                          <>
                            <AlertTriangle className="w-4 h-4 text-amber-400" />
                            Not Yet Indexed (Pending Inclusion / Lag)
                          </>
                        )}
                      </span>
                      <span className="text-[10px] text-slate-400">
                        Checked: {new Date(verification.checkedAt).toLocaleTimeString()}
                      </span>
                    </div>

                    {verification.verified && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] pt-1 border-t border-emerald-500/20">
                        <div>
                          <span className="text-slate-400">Block Height:</span>{' '}
                          <strong className="text-white">#{verification.blockHeight}</strong>
                        </div>
                        <div>
                          <span className="text-slate-400">Protocol Version:</span>{' '}
                          <span className="text-white">{verification.protocolVersion}</span>
                        </div>
                        <div className="sm:col-span-2 break-all">
                          <span className="text-slate-400">Block Hash:</span>{' '}
                          <span className="text-slate-300">{verification.blockHash}</span>
                        </div>
                      </div>
                    )}

                    {verification.error && (
                      <p className="text-[11px] text-rose-300 pt-1">
                        {verification.error}
                      </p>
                    )}
                  </div>
                )}

                {/* Bottom Row: Explorer Link, Copy, Live Verify, and Raw JSON expander */}
                <div className="flex flex-wrap items-center justify-between pt-2 border-t border-slate-900 text-xs gap-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    {item.txHash ? (
                      <>
                        <div className="flex items-center gap-1.5">
                          <a
                            href={getExplorerTxUrl(item.txHash)}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300 font-mono bg-blue-950/40 border border-blue-500/30 px-2.5 py-1 rounded-lg transition-colors cursor-pointer"
                            title="View on Midnight Explorer"
                          >
                            <span>{item.txHash.slice(0, 10)}...{item.txHash.slice(-6)}</span>
                            <ExternalLink className="w-3 h-3" />
                          </a>
                          <button
                            onClick={() => handleCopy(item.txHash!, item.id)}
                            className="p-1 rounded-md text-slate-500 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
                            title="Copy transaction hash"
                          >
                            {copiedId === item.id ? (
                              <Check className="w-3.5 h-3.5 text-emerald-400" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </div>

                        {/* Live Verify Button */}
                        <button
                          onClick={() => handleVerify(item)}
                          disabled={isVerifying}
                          className="inline-flex items-center gap-1.5 text-xs font-semibold text-purple-300 hover:text-white bg-purple-950/40 hover:bg-purple-900/50 border border-purple-500/30 px-2.5 py-1 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
                          title="Query live Midnight Preprod Indexer to verify this transaction"
                        >
                          <ShieldCheck className={`w-3.5 h-3.5 text-purple-400 ${isVerifying ? 'animate-spin' : ''}`} />
                          <span>{isVerifying ? 'Verifying...' : 'Verify Live'}</span>
                        </button>
                      </>
                    ) : (
                      <span className="text-[11px] text-slate-500 font-mono">
                        {item.status === 'failed' ? 'Extrinsic not finalized' : 'Broadcasting transaction...'}
                      </span>
                    )}
                  </div>

                  <button
                    onClick={() => setExpandedId(isExpanded ? null : item.id)}
                    className="text-[11px] text-slate-500 hover:text-slate-300 font-mono flex items-center gap-1 transition-colors cursor-pointer"
                  >
                    <span>{isExpanded ? 'Hide Record' : 'Audit Data'}</span>
                    {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                  </button>
                </div>

                {/* Expandable Raw Audit Record */}
                {isExpanded && (
                  <div className="pt-2 space-y-2">
                    <pre className="p-3 rounded-lg bg-slate-950 border border-slate-900 text-[10px] font-mono text-slate-400 overflow-x-auto leading-relaxed">
                      {JSON.stringify(item, null, 2)}
                    </pre>

                    {item.txHash && (
                      <div className="p-2.5 rounded-lg bg-slate-950/80 border border-slate-800 text-[10px] font-mono text-slate-400 space-y-1">
                        <div className="flex items-center gap-1.5 text-slate-300 font-bold">
                          <Terminal className="w-3 h-3 text-cyan-400" />
                          <span>Independent Terminal Verification Command (cURL):</span>
                        </div>
                        <div className="flex items-center justify-between gap-2 bg-slate-900 p-2 rounded">
                          <code className="text-cyan-300 truncate">
                            {`curl -s -X POST https://indexer.preprod.midnight.network/api/v4/graphql -H "Content-Type: application/json" -d '{"query":"query { transactions(offset: { hash: \\"${item.txHash.replace(/^0x/, '')}\\" }) { id hash block { height hash } } }"}' | jq .`}
                          </code>
                          <button
                            onClick={() =>
                              handleCopy(
                                `curl -s -X POST https://indexer.preprod.midnight.network/api/v4/graphql -H "Content-Type: application/json" -d '{"query":"query { transactions(offset: { hash: \\"${item.txHash!.replace(/^0x/, '')}\\" }) { id hash block { height hash } } }"}' | jq .`,
                                `curl-${item.id}`
                              )
                            }
                            className="p-1 rounded text-slate-400 hover:text-white cursor-pointer"
                            title="Copy cURL command"
                          >
                            {copiedId === `curl-${item.id}` ? (
                              <Check className="w-3.5 h-3.5 text-emerald-400" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
