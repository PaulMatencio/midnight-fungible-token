'use client';

import React, { useState, useEffect } from 'react';
import { Search, UserCheck, KeyRound, User } from 'lucide-react';
import { PRESET_IDENTITIES } from '@/src/infrastructure/config/midnight-config';
import { useWallet } from '@/src/presentation/context/WalletContext';
import type { TokenMetadata } from '@/src/types/dapp';

interface QueryViewerProps {
  metadata: TokenMetadata;
  onQueryBalance: (accountHex: string) => bigint;
  onQueryAllowance: (ownerHex: string, spenderHex: string) => bigint;
}

export const QueryViewer: React.FC<QueryViewerProps> = ({
  metadata,
  onQueryBalance,
  onQueryAllowance,
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
    const divisor = 10n ** BigInt(decimals);
    const whole = amount / divisor;
    const fraction = amount % divisor;
    const fractionStr = fraction.toString().padStart(decimals, '0').slice(0, 4);
    return `${whole.toLocaleString()}.${fractionStr}`;
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
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {/* Card 1: BalanceOf Query */}
      <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-6 backdrop-blur-xl shadow-xl">
        <div className="flex items-center gap-2.5 mb-4">
          <div className="p-2 rounded-xl bg-blue-500/10 text-blue-400">
            <UserCheck className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white">Query Account Balance</h3>
            <p className="text-[11px] text-slate-400 font-mono">circuit balanceOf(account: Bytes&lt;32&gt;)</p>
          </div>
        </div>

        <form onSubmit={handleLookupBalance} className="space-y-4">
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-slate-300">Account 32-byte Address</label>
              {mode === 'test' ? (
                <div className="flex items-center gap-1 text-[11px] text-slate-400">
                  {PRESET_IDENTITIES.slice(0, 3).map((p) => (
                    <button
                      type="button"
                      key={p.name}
                      onClick={() => setBalanceAccount(p.addressHex)}
                      className="px-1.5 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-blue-400 transition-colors"
                    >
                      {p.name}
                    </button>
                  ))}
                </div>
              ) : accountAddress ? (
                <button
                  type="button"
                  onClick={() => setBalanceAccount(accountAddress)}
                  className="flex items-center gap-1 text-[11px] text-cyan-400 hover:text-cyan-300 transition-colors"
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
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950/70 border border-slate-800 focus:border-blue-500 text-white font-mono text-xs focus:outline-none transition-colors"
            />
          </div>

          <div className="flex items-center justify-between pt-2">
            <button
              type="submit"
              className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-white transition-colors flex items-center gap-1.5"
            >
              <Search className="w-3.5 h-3.5" /> Lookup Balance
            </button>

            {queriedBalance !== null && (
              <div className="text-right">
                <div className="text-[10px] text-slate-400 uppercase tracking-wider">Ledger Balance</div>
                <div className="text-base font-bold text-emerald-400 font-mono">
                  {queriedBalance} {metadata.symbol}
                </div>
              </div>
            )}
          </div>
        </form>
      </div>

      {/* Card 2: Allowance Query */}
      <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-6 backdrop-blur-xl shadow-xl">
        <div className="flex items-center gap-2.5 mb-4">
          <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400">
            <KeyRound className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white">Query Spender Allowance</h3>
            <p className="text-[11px] text-slate-400 font-mono">
              circuit allowance(owner, spender)
            </p>
          </div>
        </div>

        <form onSubmit={handleLookupAllowance} className="space-y-4">
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-semibold text-slate-300">Owner Address</label>
              {mode === 'lace' && accountAddress && (
                <button
                  type="button"
                  onClick={() => setAllowanceOwner(accountAddress)}
                  className="flex items-center gap-1 text-[11px] text-cyan-400 hover:text-cyan-300 transition-colors"
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
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950/70 border border-slate-800 focus:border-indigo-500 text-white font-mono text-xs focus:outline-none transition-colors"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">Spender Address</label>
            <input
              type="text"
              required
              value={allowanceSpender}
              onChange={(e) => setAllowanceSpender(e.target.value)}
              placeholder="Spender Midnight address (mn_addr_...) or 64 hex chars"
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950/70 border border-slate-800 focus:border-indigo-500 text-white font-mono text-xs focus:outline-none transition-colors"
            />
          </div>

          <div className="flex items-center justify-between pt-2">
            <button
              type="submit"
              className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-white transition-colors flex items-center gap-1.5"
            >
              <Search className="w-3.5 h-3.5" /> Lookup Allowance
            </button>

            {queriedAllowance !== null && (
              <div className="text-right">
                <div className="text-[10px] text-slate-400 uppercase tracking-wider">Approved Cap</div>
                <div className="text-base font-bold text-indigo-400 font-mono">
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
