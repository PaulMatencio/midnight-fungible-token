'use client';

import React, { useState, useEffect } from 'react';
import {
  Send,
  CheckSquare,
  Repeat,
  PlusCircle,
  Flame,
  Settings,
  Sparkles,
  ArrowRight,
  AlertCircle,
  User,
  Wallet,
  Lock,
  ShieldCheck,
} from 'lucide-react';
import { PRESET_IDENTITIES } from '@/src/infrastructure/config/midnight-config';
import { useWallet } from '@/src/presentation/context/WalletContext';
import { bech32m } from '@scure/base';
import type { TokenMetadata, TransactionStatus } from '@/src/types/dapp';

interface TokenActionsProps {
  metadata: TokenMetadata;
  txStatus: TransactionStatus;
  callerAddress?: string | null;
  getAllowance?: (ownerHex: string, spenderHex: string) => bigint;
  onTransfer: (toHex: string, amount: bigint) => Promise<any>;
  onApprove: (spenderHex: string, amount: bigint) => Promise<any>;
  onTransferFrom: (fromHex: string, toHex: string, amount: bigint) => Promise<any>;
  onMint: (accountHex: string, amount: bigint) => Promise<any>;
  onBurn: (accountHex: string, amount: bigint) => Promise<any>;
  onInitialize: (name: string, symbol: string, decimals: number) => Promise<any>;
}

type TabType = 'transfer' | 'approve' | 'transferFrom' | 'mint' | 'burn' | 'init';

export const TokenActions: React.FC<TokenActionsProps> = ({
  metadata,
  txStatus,
  callerAddress,
  getAllowance,
  onTransfer,
  onApprove,
  onTransferFrom,
  onMint,
  onBurn,
  onInitialize,
}) => {
  const { mode, accountAddress, isConnected, isWalletLocked, connectWallet } = useWallet();
  const [activeTab, setActiveTab] = useState<TabType>('transfer');

  // Form states initialized depending on mode
  const [transferTo, setTransferTo] = useState<string>('');
  const [transferAmount, setTransferAmount] = useState<string>('500');

  const [approveSpender, setApproveSpender] = useState<string>('');
  const [approveAmount, setApproveAmount] = useState<string>('2000');

  const [fromAccount, setFromAccount] = useState<string>('');
  const [transferFromTo, setTransferFromTo] = useState<string>('');
  const [transferFromAmount, setTransferFromAmount] = useState<string>('250');

  const [mintAccount, setMintAccount] = useState<string>('');
  const [mintAmount, setMintAmount] = useState<string>('10000');

  const [burnAccount, setBurnAccount] = useState<string>('');
  const [burnAmount, setBurnAmount] = useState<string>('1000');

  const [initName, setInitName] = useState<string>('Midnight Fungible Token');
  const [initSymbol, setInitSymbol] = useState<string>('MFT');
  const [initDecimals, setInitDecimals] = useState<number>(6);

  const [formError, setFormError] = useState<string | null>(null);

  // Sync defaults whenever mode or accountAddress changes
  useEffect(() => {
    if (mode === 'test') {
      setTransferTo(PRESET_IDENTITIES[1].addressHex);
      setApproveSpender(PRESET_IDENTITIES[1].addressHex);
      setFromAccount(PRESET_IDENTITIES[0].addressHex);
      setTransferFromTo(PRESET_IDENTITIES[2].addressHex);
      setMintAccount(PRESET_IDENTITIES[0].addressHex);
      setBurnAccount(PRESET_IDENTITIES[0].addressHex);
    } else {
      // In Lace mode: NO Alice, Bob, or Charlie!
      setTransferTo('');
      setApproveSpender('');
      setFromAccount(accountAddress || '');
      setTransferFromTo('');
      setMintAccount(accountAddress || '');
      setBurnAccount(accountAddress || '');
    }
  }, [mode, accountAddress]);

  const isExecuting = txStatus === 'preparing' || txStatus === 'proving' || txStatus === 'submitting';

  const parseUnits = (val: string, decimals: number): bigint => {
    const num = parseFloat(val);
    if (isNaN(num) || num <= 0) {
      throw new Error('Please enter a valid positive numeric amount');
    }
    return BigInt(Math.floor(num * 10 ** decimals));
  };

  const validateAddress = (addr: string, fieldName: string) => {
    if (!addr || !addr.trim()) {
      throw new Error(`Please enter a valid ${fieldName}`);
    }
    const trimmed = addr.trim();

    // 1. Check Bech32m Midnight Address (e.g. mn_addr_... or midnight1...)
    if (
      trimmed.toLowerCase().startsWith('mn_') ||
      trimmed.toLowerCase().startsWith('midnight') ||
      trimmed.toLowerCase().startsWith('mn1')
    ) {
      try {
        const decoded = bech32m.decodeToBytes(trimmed, 200);
        if (decoded.bytes.length >= 32) return;
      } catch (err: any) {
        throw new Error(`Invalid ${fieldName}: Invalid Midnight address (${err?.message || 'checksum error'})`);
      }
    }

    // 2. Check 64-character hex address (32 bytes)
    const clean = trimmed.replace(/^0x/, '');
    if (/^[0-9a-fA-F]{64}$/.test(clean)) {
      return;
    }

    throw new Error(
      `Invalid ${fieldName}: Must be a valid Midnight address (e.g. mn_addr_...) or a 32-byte (64 hex characters) address`
    );
  };

  const handleTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    try {
      validateAddress(transferTo, 'Recipient Address');
      const amount = parseUnits(transferAmount, metadata.decimals);
      await onTransfer(transferTo.trim(), amount);
    } catch (err: any) {
      setFormError(err.message || 'Transfer failed');
    }
  };

  const handleApprove = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    try {
      validateAddress(approveSpender, 'Spender Address');
      const amount = parseUnits(approveAmount, metadata.decimals);
      await onApprove(approveSpender.trim(), amount);
    } catch (err: any) {
      setFormError(err.message || 'Approve failed');
    }
  };

  const handleTransferFrom = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    try {
      validateAddress(fromAccount, 'Source (From) Address');
      validateAddress(transferFromTo, 'Destination (To) Address');
      const amount = parseUnits(transferFromAmount, metadata.decimals);
      await onTransferFrom(fromAccount.trim(), transferFromTo.trim(), amount);
    } catch (err: any) {
      setFormError(err.message || 'TransferFrom failed');
    }
  };

  const handleMint = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    try {
      validateAddress(mintAccount, 'Destination Account');
      const amount = parseUnits(mintAmount, metadata.decimals);
      await onMint(mintAccount.trim(), amount);
    } catch (err: any) {
      setFormError(err.message || 'Mint failed');
    }
  };

  const handleBurn = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    try {
      validateAddress(burnAccount, 'Account to Burn From');
      const amount = parseUnits(burnAmount, metadata.decimals);
      await onBurn(burnAccount.trim(), amount);
    } catch (err: any) {
      setFormError(err.message || 'Burn failed');
    }
  };

  const handleInit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    try {
      if (!initName.trim()) throw new Error('Token name cannot be empty');
      if (!initSymbol.trim()) throw new Error('Token symbol cannot be empty');
      await onInitialize(initName.trim(), initSymbol.trim(), initDecimals);
    } catch (err: any) {
      setFormError(err.message || 'Initialization failed');
    }
  };

  // Render Address Quick Selector Buttons
  const renderQuickSelect = (onSelect: (addr: string) => void) => {
    if (mode === 'test') {
      return (
        <div className="flex items-center gap-1 text-[11px] text-slate-400">
          <span>Test Identity:</span>
          {PRESET_IDENTITIES.slice(0, 3).map((p) => (
            <button
              type="button"
              key={p.name}
              onClick={() => onSelect(p.addressHex)}
              className="px-1.5 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-blue-400 transition-colors"
            >
              {p.name}
            </button>
          ))}
        </div>
      );
    }

    // In Lace mode: Provide "My Lace Address" button
    if (accountAddress) {
      return (
        <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
          <button
            type="button"
            onClick={() => onSelect(accountAddress)}
            className="flex items-center gap-1 px-2 py-0.5 rounded bg-blue-500/10 hover:bg-blue-500/20 text-cyan-400 border border-blue-500/20 transition-colors"
          >
            <User className="w-3 h-3" />
            <span>Use My Lace Address</span>
          </button>
          <button
            type="button"
            onClick={() => onSelect('')}
            className="px-1.5 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
          >
            Clear
          </button>
        </div>
      );
    }

    return null;
  };

  return (
    <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl overflow-hidden backdrop-blur-xl shadow-xl">
      {/* Navigation Tabs */}
      <div className="flex border-b border-slate-800/80 overflow-x-auto bg-slate-950/40 p-2 gap-1.5 scrollbar-none">
        <button
          onClick={() => { setActiveTab('transfer'); setFormError(null); }}
          className={`px-4 py-2.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'transfer'
              ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
          }`}
        >
          <Send className="w-3.5 h-3.5" /> Transfer
        </button>

        <button
          onClick={() => { setActiveTab('approve'); setFormError(null); }}
          className={`px-4 py-2.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'approve'
              ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
          }`}
        >
          <CheckSquare className="w-3.5 h-3.5" /> Approve Spender
        </button>

        <button
          onClick={() => { setActiveTab('transferFrom'); setFormError(null); }}
          className={`px-4 py-2.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'transferFrom'
              ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
          }`}
        >
          <Repeat className="w-3.5 h-3.5" /> Transfer From
        </button>

        <button
          onClick={() => { setActiveTab('mint'); setFormError(null); }}
          className={`px-4 py-2.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'mint'
              ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
          }`}
        >
          <PlusCircle className="w-3.5 h-3.5" /> Mint Tokens
          <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">Owner</span>
        </button>

        <button
          onClick={() => { setActiveTab('burn'); setFormError(null); }}
          className={`px-4 py-2.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'burn'
              ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
          }`}
        >
          <Flame className="w-3.5 h-3.5" /> Burn Tokens
          <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">Owner</span>
        </button>

        <button
          onClick={() => { setActiveTab('init'); setFormError(null); }}
          className={`px-4 py-2.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'init'
              ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
          }`}
        >
          <Settings className="w-3.5 h-3.5" /> Initialize Token
        </button>
      </div>

      {/* Tab Panels */}
      <div className="p-6">
        {formError && (
          <div className="mb-5 p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0 mt-0.5" />
            <div className="leading-relaxed">{formError}</div>
          </div>
        )}

        {mode === 'lace' && isConnected && isWalletLocked && (
          <div className="mb-5 p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-xs flex items-center gap-3">
            <Lock className="w-5 h-5 text-amber-400 flex-shrink-0" />
            <div>
              <p className="font-semibold text-amber-300">Lace Wallet Locked</p>
              <p className="text-amber-200/80 text-[11px] mt-0.5">
                Your Lace wallet is locked. Please unlock it in your browser extension toolbar before executing transactions.
              </p>
            </div>
          </div>
        )}

        {mode === 'lace' && !isConnected && (
          <div className="mb-5 p-4 rounded-xl bg-blue-950/40 border border-blue-800/40 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs text-blue-200">
            <div className="flex items-center gap-2">
              <Wallet className="w-4 h-4 text-cyan-400 flex-shrink-0" />
              <span>Connect your Lace wallet to sign and submit token transactions on Preprod.</span>
            </div>
            <button
              type="button"
              onClick={() => connectWallet()}
              className="px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold transition-colors whitespace-nowrap shadow-sm cursor-pointer"
            >
              Connect Wallet
            </button>
          </div>
        )}

        {/* Tab 1: Transfer */}
        {activeTab === 'transfer' && (
          <form onSubmit={handleTransfer} className="space-y-5">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-semibold text-slate-300">
                  Recipient Account Address
                </label>
                {renderQuickSelect(setTransferTo)}
              </div>
              <input
                type="text"
                required
                value={transferTo}
                onChange={(e) => setTransferTo(e.target.value)}
                placeholder="Midnight address (mn_addr_...) or 64-character hex"
                className="w-full px-4 py-2.5 rounded-xl bg-slate-950/70 border border-slate-800 focus:border-blue-500 text-white font-mono text-xs focus:outline-none transition-colors"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Amount ({metadata.symbol})
              </label>
              <div className="relative">
                <input
                  type="number"
                  step="any"
                  required
                  value={transferAmount}
                  onChange={(e) => setTransferAmount(e.target.value)}
                  placeholder="e.g. 500"
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-950/70 border border-slate-800 focus:border-blue-500 text-white font-mono text-sm focus:outline-none transition-colors"
                />
                <span className="absolute right-4 top-2.5 text-xs text-slate-400 font-mono">
                  {metadata.symbol}
                </span>
              </div>
            </div>

            <button
              type="submit"
              disabled={isExecuting}
              className="w-full py-3 px-4 rounded-xl text-sm font-semibold bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white transition-all shadow-lg shadow-blue-500/20 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isExecuting ? 'Executing Circuit...' : 'Execute Transfer Circuit'}
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>
        )}

        {/* Tab 2: Approve */}
        {activeTab === 'approve' && (
          <form onSubmit={handleApprove} className="space-y-5">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-semibold text-slate-300">
                  Authorized Spender Account Address
                </label>
                {renderQuickSelect(setApproveSpender)}
              </div>
              <input
                type="text"
                required
                value={approveSpender}
                onChange={(e) => setApproveSpender(e.target.value)}
                placeholder="Midnight address (mn_addr_...) or 64-character hex"
                className="w-full px-4 py-2.5 rounded-xl bg-slate-950/70 border border-slate-800 focus:border-blue-500 text-white font-mono text-xs focus:outline-none transition-colors"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Allowance Cap ({metadata.symbol})
              </label>
              <div className="relative">
                <input
                  type="number"
                  step="any"
                  required
                  value={approveAmount}
                  onChange={(e) => setApproveAmount(e.target.value)}
                  placeholder="e.g. 2000"
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-950/70 border border-slate-800 focus:border-blue-500 text-white font-mono text-sm focus:outline-none transition-colors"
                />
                <span className="absolute right-4 top-2.5 text-xs text-slate-400 font-mono">
                  {metadata.symbol}
                </span>
              </div>
            </div>

            <button
              type="submit"
              disabled={isExecuting}
              className="w-full py-3 px-4 rounded-xl text-sm font-semibold bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white transition-all shadow-lg shadow-blue-500/20 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isExecuting ? 'Executing Circuit...' : 'Approve Spender Allowance'}
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>
        )}

        {/* Tab 3: Transfer From */}
        {activeTab === 'transferFrom' && (
          <form onSubmit={handleTransferFrom} className="space-y-5">
            {/* Live Allowance Check Alert */}
            {fromAccount && getAllowance ? (
              (() => {
                const effectiveCaller = callerAddress || accountAddress || '';
                const cleanFrom = fromAccount.replace(/^0x/, '').trim();
                const cleanCaller = effectiveCaller.replace(/^0x/, '').trim();
                if (cleanFrom.length === 64 && cleanCaller.length === 64) {
                  try {
                    const currentAllowance = getAllowance(cleanFrom, cleanCaller);
                    const divisor = 10n ** BigInt(metadata.decimals);
                    const formatted = (Number(currentAllowance) / Number(divisor)).toLocaleString();
                    const req = parseFloat(transferFromAmount) || 0;
                    const isSufficient = Number(currentAllowance) / Number(divisor) >= req && req > 0;

                    return (
                      <div
                        className={`p-3.5 rounded-xl border text-xs flex items-center justify-between ${
                          isSufficient
                            ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300'
                            : 'bg-amber-500/10 border-amber-500/20 text-amber-300'
                        }`}
                      >
                        <div>
                          <div className="font-semibold">Allowance from Owner to Current Caller:</div>
                          <div className="font-mono text-sm mt-0.5">
                            {formatted} {metadata.symbol}
                          </div>
                        </div>
                      </div>
                    );
                  } catch {
                    return null;
                  }
                }
                return null;
              })()
            ) : null}

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-semibold text-slate-300">
                  From Account (Token Owner)
                </label>
                {renderQuickSelect(setFromAccount)}
              </div>
              <input
                type="text"
                required
                value={fromAccount}
                onChange={(e) => setFromAccount(e.target.value)}
                placeholder="Midnight address (mn_addr_...) or 64-character hex"
                className="w-full px-4 py-2.5 rounded-xl bg-slate-950/70 border border-slate-800 focus:border-blue-500 text-white font-mono text-xs focus:outline-none transition-colors"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-semibold text-slate-300">
                  To Account (Recipient)
                </label>
                {renderQuickSelect(setTransferFromTo)}
              </div>
              <input
                type="text"
                required
                value={transferFromTo}
                onChange={(e) => setTransferFromTo(e.target.value)}
                placeholder="Midnight address (mn_addr_...) or 64-character hex"
                className="w-full px-4 py-2.5 rounded-xl bg-slate-950/70 border border-slate-800 focus:border-blue-500 text-white font-mono text-xs focus:outline-none transition-colors"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Amount ({metadata.symbol})
              </label>
              <div className="relative">
                <input
                  type="number"
                  step="any"
                  required
                  value={transferFromAmount}
                  onChange={(e) => setTransferFromAmount(e.target.value)}
                  placeholder="e.g. 250"
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-950/70 border border-slate-800 focus:border-blue-500 text-white font-mono text-sm focus:outline-none transition-colors"
                />
                <span className="absolute right-4 top-2.5 text-xs text-slate-400 font-mono">
                  {metadata.symbol}
                </span>
              </div>
            </div>

            <button
              type="submit"
              disabled={isExecuting}
              className="w-full py-3 px-4 rounded-xl text-sm font-semibold bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white transition-all shadow-lg shadow-blue-500/20 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isExecuting ? 'Executing Circuit...' : 'Execute Delegated Transfer'}
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>
        )}

        {/* Tab 4: Mint */}
        {activeTab === 'mint' && (
          <form onSubmit={handleMint} className="space-y-5">
            {/* Owner Permission Alert */}
            {metadata.owner && !metadata.isCallerOwner && mode !== 'test' ? (
              <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <div className="font-semibold flex items-center gap-1.5">
                    <span>Owner-Only Circuit (FungibleTokenV2)</span>
                  </div>
                  <p className="text-slate-300 leading-relaxed">
                    Only the contract owner ({metadata.ownerBech32 || `${metadata.owner.slice(0, 12)}...`}) has authority to mint new tokens. Your connected wallet is not the owner.
                  </p>
                </div>
              </div>
            ) : (
              <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800 text-xs flex items-center justify-between text-slate-400">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  <span>
                    Owner: <span className="font-mono text-slate-200">{metadata.ownerBech32 ? `${metadata.ownerBech32.slice(0, 14)}...` : metadata.owner ? `${metadata.owner.slice(0, 10)}...` : 'Pending Init'}</span>
                  </span>
                </div>
                {metadata.isCallerOwner && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    You are Owner
                  </span>
                )}
              </div>
            )}

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-semibold text-slate-300">
                  Recipient Account to Receive New Tokens
                </label>
                {renderQuickSelect(setMintAccount)}
              </div>
              <input
                type="text"
                required
                value={mintAccount}
                onChange={(e) => setMintAccount(e.target.value)}
                placeholder="Midnight address (mn_addr_...) or 64-character hex"
                className="w-full px-4 py-2.5 rounded-xl bg-slate-950/70 border border-slate-800 focus:border-blue-500 text-white font-mono text-xs focus:outline-none transition-colors"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Amount to Mint ({metadata.symbol})
              </label>
              <div className="relative">
                <input
                  type="number"
                  step="any"
                  required
                  value={mintAmount}
                  onChange={(e) => setMintAmount(e.target.value)}
                  placeholder="e.g. 10000"
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-950/70 border border-slate-800 focus:border-blue-500 text-white font-mono text-sm focus:outline-none transition-colors"
                />
                <span className="absolute right-4 top-2.5 text-xs text-slate-400 font-mono">
                  {metadata.symbol}
                </span>
              </div>
            </div>

            <button
              type="submit"
              disabled={isExecuting || (Boolean(metadata.owner) && !metadata.isCallerOwner && mode !== 'test')}
              className="w-full py-3 px-4 rounded-xl text-sm font-semibold bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white transition-all shadow-lg shadow-emerald-500/20 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isExecuting ? 'Minting...' : 'Mint Tokens'}
              <PlusCircle className="w-4 h-4" />
            </button>
          </form>
        )}

        {/* Tab 5: Burn */}
        {activeTab === 'burn' && (
          <form onSubmit={handleBurn} className="space-y-5">
            {/* Owner Permission Alert / Info */}
            {metadata.owner && !metadata.isCallerOwner && mode !== 'test' ? (
              <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <div className="font-semibold flex items-center gap-1.5">
                    <span>Owner-Only Circuit (FungibleTokenV2)</span>
                  </div>
                  <p className="text-slate-300 leading-relaxed">
                    Under <span className="font-mono text-amber-300">FungibleTokenV2</span>, only the contract owner ({metadata.ownerBech32 || `${metadata.owner.slice(0, 12)}...`}) can burn tokens.
                  </p>
                </div>
              </div>
            ) : (
              <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800 text-xs space-y-1">
                <div className="font-semibold text-slate-300 flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
                  <span>Owner Token Burning</span>
                </div>
                <p className="text-slate-400 leading-relaxed">
                  Tokens are burned directly from the contract owner&apos;s balance ({metadata.ownerBech32 ? `${metadata.ownerBech32.slice(0, 16)}...` : 'Owner'}).
                </p>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Amount to Burn ({metadata.symbol})
              </label>
              <div className="relative">
                <input
                  type="number"
                  step="any"
                  required
                  value={burnAmount}
                  onChange={(e) => setBurnAmount(e.target.value)}
                  placeholder="e.g. 1000"
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-950/70 border border-slate-800 focus:border-rose-500 text-white font-mono text-sm focus:outline-none transition-colors"
                />
                <span className="absolute right-4 top-2.5 text-xs text-slate-400 font-mono">
                  {metadata.symbol}
                </span>
              </div>
            </div>

            <button
              type="submit"
              disabled={isExecuting || (Boolean(metadata.owner) && !metadata.isCallerOwner && mode !== 'test')}
              className="w-full py-3 px-4 rounded-xl text-sm font-semibold bg-gradient-to-r from-rose-600 to-orange-600 hover:from-rose-500 hover:to-orange-500 text-white transition-all shadow-lg shadow-rose-500/20 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isExecuting ? 'Burning...' : 'Burn Tokens'}
              <Flame className="w-4 h-4" />
            </button>
          </form>
        )}

        {/* Tab 6: Initialize */}
        {activeTab === 'init' && (
          <form onSubmit={handleInit} className="space-y-5">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Token Name
              </label>
              <input
                type="text"
                required
                value={initName}
                onChange={(e) => setInitName(e.target.value)}
                placeholder="e.g. Midnight USD"
                className="w-full px-4 py-2.5 rounded-xl bg-slate-950/70 border border-slate-800 focus:border-blue-500 text-white text-sm focus:outline-none transition-colors"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Token Symbol
                </label>
                <input
                  type="text"
                  required
                  value={initSymbol}
                  onChange={(e) => setInitSymbol(e.target.value.toUpperCase())}
                  placeholder="e.g. MUSD"
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-950/70 border border-slate-800 focus:border-blue-500 text-white font-mono text-sm focus:outline-none transition-colors"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Decimals (0 - 18)
                </label>
                <input
                  type="number"
                  min="0"
                  max="18"
                  required
                  value={initDecimals}
                  onChange={(e) => setInitDecimals(parseInt(e.target.value) || 0)}
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-950/70 border border-slate-800 focus:border-blue-500 text-white font-mono text-sm focus:outline-none transition-colors"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isExecuting}
              className="w-full py-3 px-4 rounded-xl text-sm font-semibold bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white transition-all shadow-lg shadow-blue-500/20 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isExecuting ? 'Initializing...' : 'Initialize FungibleToken Contract'}
              <Settings className="w-4 h-4" />
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
