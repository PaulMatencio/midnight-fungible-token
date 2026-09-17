'use client';

import React, { useState, useEffect } from 'react';
import { Search, UserCheck, KeyRound, User, Sparkles } from 'lucide-react';
import { PRESET_IDENTITIES } from '@/src/infrastructure/config/midnight-config';
import { useWallet } from '@/src/presentation/context/WalletContext';
import type { TokenMetadata } from '@/src/types/dapp';
import type { GrantedAllowance } from '@/src/domain/ports/i-token-contract.gateway';
import { formatBalance } from '@/src/presentation/utils/format';

interface QueryViewerProps {
  metadata: TokenMetadata;
  onQueryBalance: (accountHex: string) => bigint;
  onQueryAllowance: (ownerHex: string, spenderHex: string) => bigint;
  onQueryAllowancesForSpender?: (spenderAddress: string) => GrantedAllowance[];
}

export const QueryViewer: React.FC<QueryViewerProps> = ({
  metadata,
  onQueryBalance,
  onQueryAllowance,
  onQueryAllowancesForSpender,
}) => {
  const { mode, accountAddress } = useWallet();

  const [balanceAccount, setBalanceAccount] = useState<string>('');
  const [queriedBalance, setQueriedBalance] = useState<string | null>(null);

  const [allowanceOwner, setAllowanceOwner] = useState<string>('');
  const [allowanceSpender, setAllowanceSpender] = useState<string>('');
  const [queriedAllowance, setQueriedAllowance] = useState<string | null>(null);

  // Sync defaults on mode switch
  useEffect(() => {
    if (mode === 'test') {
      setBalanceAccount(PRESET_IDENTITIES[0].addressHex);
      setAllowanceOwner(PRESET_IDENTITIES[0].addressHex);
      setAllowanceSpender(PRESET_IDENTITIES[1].addressHex);
    } else {
      // In Lace Mode: NO Alice, Bob, or Charlie!
      setBalanceAccount(accountAddress || '');
      setAllowanceOwner(accountAddress || '');
      setAllowanceSpender('');
    }
  }, [mode, accountAddress]);

  const formatUnits = (amount: bigint, decimals: number): string => {
    return formatBalance(amount, decimals, 4);
  };

  const handleLookupBalance = (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const bal = onQueryBalance(balanceAccount.trim());
      setQueriedBalance(formatUnits(bal, metadata.decimals));
    } catch {
      setQueriedBalance('0.0000');
    }
  };

  const handleLookupAllowance = (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const all = onQueryAllowance(allowanceOwner.trim(), allowanceSpender.trim());
      setQueriedAllowance(formatUnits(all, metadata.decimals));
    } catch {
      setQueriedAllowance('0.0000');
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Card 1: BalanceOf Query */}
      <div className="bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800/80 rounded-2xl p-6 shadow-md dark:shadow-xl">
        <div className="flex items-center gap-2.5 mb-4">
          <div className="p-2 rounded-xl bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-500/20">
            <UserCheck className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Query Account Balance</h3>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">circuit balanceOf(account: Bytes&lt;32&gt;)</p>
          </div>
        </div>

        <form onSubmit={handleLookupBalance} className="space-y-4">
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Account 32-byte Address</label>
              {mode === 'test' ? (
                <div className="flex items-center gap-1 text-[11px] text-slate-500 dark:text-slate-400">
                  {PRESET_IDENTITIES.slice(0, 3).map((p) => (
                    <button
                      type="button"
                      key={p.name}
                      onClick={() => setBalanceAccount(p.addressHex)}
                      className="px-1.5 py-0.5 rounded bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-blue-700 dark:text-blue-400 transition-colors font-medium cursor-pointer"
                    >
                      {p.name}
                    </button>
                  ))}
                </div>
              ) : accountAddress ? (
                <button
                  type="button"
                  onClick={() => setBalanceAccount(accountAddress)}
                  className="flex items-center gap-1 text-[11px] text-blue-700 hover:text-blue-900 dark:text-cyan-400 dark:hover:text-cyan-300 transition-colors font-medium cursor-pointer"
                >
                  <User className="w-3 h-3" /> Use My Lace Address
                </button>
              ) : null}
            </div>
            <input
              type="text"
              required
              value={balanceAccount}
              onChange={(e) => setBalanceAccount(e.target.value)}
              placeholder="Midnight address (mn_addr_...) or 64-character hex"
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800 focus:border-blue-500 text-slate-900 dark:text-white font-mono text-xs focus:outline-none transition-colors"
            />
          </div>

          <div className="flex items-center justify-between pt-2">
            <button
              type="submit"
              className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-900 hover:bg-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700 text-white transition-colors flex items-center gap-1.5 cursor-pointer shadow-sm"
            >
              <Search className="w-3.5 h-3.5" /> Lookup Balance
            </button>

            {queriedBalance !== null && (
              <div className="text-right">
                <div className="text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-wider font-semibold">Ledger Balance</div>
                <div className="text-base font-bold text-emerald-700 dark:text-emerald-400 font-mono">
                  {queriedBalance} {metadata.symbol}
                </div>
              </div>
            )}
          </div>
        </form>
      </div>

      {/* Card 2: Allowance Query */}
      <div className="bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800/80 rounded-2xl p-6 shadow-md dark:shadow-xl">
        <div className="flex items-center gap-2.5 mb-4">
          <div className="p-2 rounded-xl bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-500/20">
            <KeyRound className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Query Spender Allowance</h3>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
              circuit allowance(owner, spender)
            </p>
          </div>
        </div>

        <form onSubmit={handleLookupAllowance} className="space-y-4">
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">Owner Address</label>
              {mode === 'lace' && accountAddress && (
                <button
                  type="button"
                  onClick={() => setAllowanceOwner(accountAddress)}
                  className="flex items-center gap-1 text-[11px] text-blue-700 hover:text-blue-900 dark:text-cyan-400 dark:hover:text-cyan-300 transition-colors font-medium cursor-pointer"
                >
                  <User className="w-3 h-3" /> Use My Address
                </button>
              )}
            </div>
            <input
              type="text"
              required
              value={allowanceOwner}
              onChange={(e) => setAllowanceOwner(e.target.value)}
              placeholder="Owner Midnight address (mn_addr_...) or 64 hex chars"
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800 focus:border-indigo-500 text-slate-900 dark:text-white font-mono text-xs focus:outline-none transition-colors"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">Spender Address</label>
              {mode === 'lace' && accountAddress && (
                <button
                  type="button"
                  onClick={() => setAllowanceSpender(accountAddress)}
                  className="flex items-center gap-1 text-[11px] text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 dark:hover:text-indigo-300 transition-colors font-medium cursor-pointer"
                >
                  <User className="w-3 h-3" /> Use My Address
                </button>
              )}
            </div>
            <input
              type="text"
              required
              value={allowanceSpender}
              onChange={(e) => setAllowanceSpender(e.target.value)}
              placeholder="Spender Midnight address (mn_addr_...) or 64 hex chars"
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800 focus:border-indigo-500 text-slate-900 dark:text-white font-mono text-xs focus:outline-none transition-colors"
            />
          </div>

          {/* List of Owners granting allowance to this spender */}
          {(() => {
            if (!onQueryAllowancesForSpender || !allowanceSpender.trim()) return null;
            const granted = onQueryAllowancesForSpender(allowanceSpender.trim());
            if (granted.length === 0) return null;

            return (
              <div className="p-3 rounded-xl border border-indigo-500/20 bg-indigo-50/50 dark:bg-indigo-950/20 space-y-2">
                <div className="text-[11px] font-semibold text-indigo-700 dark:text-indigo-300 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
                    Owners who granted allowance ({granted.length}):
                  </span>
                  <span className="text-[10px] text-slate-400">Click to autofill owner</span>
                </div>
                <div className="space-y-1 max-h-36 overflow-y-auto pr-1">
                  {granted.map((item) => {
                    const isSelected = allowanceOwner.trim().toLowerCase() === item.ownerAccount.toLowerCase();
                    return (
                      <div
                        key={item.ownerAccount}
                        onClick={() => {
                          setAllowanceOwner(item.ownerAccount);
                          setQueriedAllowance(formatUnits(item.allowance, metadata.decimals));
                        }}
                        className={`flex items-center justify-between p-2 rounded-lg border text-xs cursor-pointer transition-colors ${
                          isSelected
                            ? 'bg-indigo-500/20 border-indigo-500 text-indigo-900 dark:text-white font-medium'
                            : 'bg-white dark:bg-slate-900/80 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:border-indigo-400'
                        }`}
                      >
                        <div className="truncate max-w-[190px]">
                          <span className="font-mono">{item.ownerAccount.slice(0, 10)}...{item.ownerAccount.slice(-8)}</span>
                          {item.ownerLabel && (
                            <span className="ml-1.5 text-[10px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500">
                              {item.ownerLabel}
                            </span>
                          )}
                        </div>
                        <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400 shrink-0 ml-2">
                          {formatUnits(item.allowance, metadata.decimals)} {metadata.symbol}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })()}

          <div className="flex items-center justify-between pt-2">
            <button
              type="submit"
              className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-900 hover:bg-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700 text-white transition-colors flex items-center gap-1.5 cursor-pointer shadow-sm"
            >
              <Search className="w-3.5 h-3.5" /> Lookup Allowance
            </button>

            {queriedAllowance !== null && (
              <div className="text-right">
                <div className="text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-wider font-semibold">Approved Cap</div>
                <div className="text-base font-bold text-indigo-700 dark:text-indigo-400 font-mono">
                  {queriedAllowance} {metadata.symbol}
                </div>
              </div>
            )}
          </div>
        </form>
      </div>
    </div>
  );
};
