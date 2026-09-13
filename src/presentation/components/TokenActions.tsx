'use client';

import React, { useState, useEffect, useMemo } from 'react';
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
  RotateCcw,
  Copy,
  Check,
  ExternalLink,
  ShieldAlert,
  PauseCircle,
  PlayCircle,
  ArrowDownToLine,
  Eye,
  EyeOff,
  Key,
  CheckCircle2,
  Loader2,
  Coins,
  Zap,
  Crown,
} from 'lucide-react';
import { PRESET_IDENTITIES, MIDNIGHT_CONFIG, getExplorerContractUrl } from '@/src/infrastructure/config/midnight-config';
import { useWallet } from '@/src/presentation/context/WalletContext';
import { bech32m } from '@scure/base';
import { FungibleTokenClient } from '@/src/client/fungible-token-sdk';
import { hexToBytes, bytesToHex, addressToBytes32, addressToHex32 } from '@/src/presentation/hooks/useFungibleToken';
import { formatBalance } from '@/src/presentation/utils/format';
import type { TokenMetadata, TransactionStatus } from '@/src/types/dapp';

interface TokenActionsProps {
  contractAddress?: string;
  onResetContractState?: () => void;
  metadata: TokenMetadata;
  userBalance?: bigint;
  lockedRawBalance?: bigint;
  userDerivedAccountHex?: string | null;
  userDerivedAccountBech32?: string | null;
  txStatus: TransactionStatus;
  statusMessage?: string;
  currentTxHash?: string | null;
  currentBlock?: number | null;
  activeActionName?: string | null;
  callerAddress?: string | null;
  getAllowance?: (ownerHex: string, spenderHex: string) => bigint;
  onTransfer: (toHex: string, amount: bigint) => Promise<any>;
  onApprove: (spenderHex: string, amount: bigint) => Promise<any>;
  onTransferFrom: (fromHex: string, toHex: string, amount: bigint) => Promise<any>;
  onMint: (accountHex: string, amount: bigint, ownerSecretKey?: string) => Promise<any>;
  onBurn: (accountHex: string, amount: bigint) => Promise<any>;
  onInitialize: (name: string, symbol: string, decimals: number) => Promise<any>;
  onPause?: (ownerSecretKey?: string) => Promise<any>;
  onUnpause?: (ownerSecretKey?: string) => Promise<any>;
  onSetEmergencyPauser?: (newPauserHex: string, ownerSecretKey?: string) => Promise<any>;
  onEmergencyWithdraw?: (amount: bigint, tokenAddress?: string, ownerSecretKey?: string) => Promise<any>;
  onAdminReallocate?: (
    trappedAccountHexOrAddress: string,
    targetSpendableAccountHexOrAddress: string,
    amount: bigint,
    ownerSecretKey?: string
  ) => Promise<any>;
  initialActionTab?: TabType;
}

export type TabType = 'transfer' | 'approve' | 'transferFrom' | 'mint' | 'burn' | 'reallocate' | 'emergency' | 'init';
export type ActionCategory = 'transfers' | 'supply' | 'admin';

const TAB_CATEGORY: Record<TabType, ActionCategory> = {
  transfer: 'transfers',
  approve: 'transfers',
  transferFrom: 'transfers',
  mint: 'supply',
  burn: 'supply',
  emergency: 'admin',
  reallocate: 'admin',
  init: 'admin',
};

const DEFAULT_TAB_FOR_CATEGORY: Record<ActionCategory, TabType> = {
  transfers: 'transfer',
  supply: 'mint',
  admin: 'emergency',
};

const TAB_CIRCUIT_SIGNATURES: Record<TabType, string> = {
  transfer: 'transfer(caller, to, value)',
  approve: 'approve(caller, spender, value)',
  transferFrom: 'transferFrom(caller, from, to, value)',
  mint: 'mint(caller, to, value)',
  burn: 'burn(caller, from, value)',
  emergency: 'pause(caller) / unpause(caller)',
  reallocate: 'adminReallocate(caller, trapped, target, value)',
  init: 'constructor(name, symbol, decimals)',
};

export const TokenActions: React.FC<TokenActionsProps> = ({
  contractAddress,
  onResetContractState,
  metadata,
  userBalance = 0n,
  lockedRawBalance = 0n,
  userDerivedAccountHex: propUserDerivedAccountHex,
  userDerivedAccountBech32,
  txStatus,
  statusMessage,
  currentTxHash,
  currentBlock,
  activeActionName,
  callerAddress,
  getAllowance,
  onTransfer,
  onApprove,
  onTransferFrom,
  onMint,
  onBurn,
  onInitialize,
  onPause,
  onUnpause,
  onSetEmergencyPauser,
  onEmergencyWithdraw,
  onAdminReallocate,
  initialActionTab,
}) => {
  const targetContractAddress = contractAddress || MIDNIGHT_CONFIG.contractAddress;
  const [copiedContractAddr, setCopiedContractAddr] = useState(false);
  const copyContractAddress = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedContractAddr(true);
    setTimeout(() => setCopiedContractAddr(false), 2000);
  };

  const MAX_UINT128 = 340282366920938463463374607431768211455n;
  const isCapped = Boolean(metadata.maxSupply && metadata.maxSupply > 0n && metadata.maxSupply < MAX_UINT128);
  const remainingCap = isCapped && metadata.maxSupply
    ? (metadata.maxSupply > metadata.totalSupply ? metadata.maxSupply - metadata.totalSupply : 0n)
    : null;

  const formatUnits = (amount: bigint, decimals: number): string => {
    return formatBalance(amount, decimals, 4);
  };
  const {
    mode,
    accountAddress,
    isConnected,
    isWalletLocked,
    connectWallet,
    activeIdentity,
    selectPresetIdentity,
  } = useWallet();
  const [activeTab, setActiveTab] = useState<TabType>(initialActionTab || 'transfer');
  const [activeCategory, setActiveCategory] = useState<ActionCategory>(() => TAB_CATEGORY[initialActionTab || 'transfer'] || 'transfers');

  useEffect(() => {
    if (initialActionTab) {
      setActiveTab(initialActionTab);
      setActiveCategory(TAB_CATEGORY[initialActionTab] || 'transfers');
    }
  }, [initialActionTab]);

  const handleCategorySwitch = (cat: ActionCategory) => {
    setActiveCategory(cat);
    if (TAB_CATEGORY[activeTab] !== cat) {
      setActiveTab(DEFAULT_TAB_FOR_CATEGORY[cat]);
    }
  };

  const handleTabSwitch = (tab: TabType) => {
    setActiveTab(tab);
    setActiveCategory(TAB_CATEGORY[tab]);
  };

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

  // Reallocate / Recover form states
  const [trappedAccount, setTrappedAccount] = useState<string>('');
  const [reallocateTarget, setReallocateTarget] = useState<string>('');
  const [reallocateAmount, setReallocateAmount] = useState<string>('200');

  const [initName, setInitName] = useState<string>('Midnight Fungible Token');
  const [initSymbol, setInitSymbol] = useState<string>('MFT');
  const [initDecimals, setInitDecimals] = useState<number>(6);

  // Emergency actions form states
  const [newPauserAddress, setNewPauserAddress] = useState<string>('');
  const [emergencyWithdrawAmount, setEmergencyWithdrawAmount] = useState<string>('1000');
  const [emergencyWithdrawToken, setEmergencyWithdrawToken] = useState<string>('');

  const defaultOwnerKey = (MIDNIGHT_CONFIG as any).ownerSecretKey || "";
  const [ownerSecretKey, setOwnerSecretKey] = useState<string>('');
  const [showOwnerKey, setShowOwnerKey] = useState<boolean>(false);

  const [formError, setFormError] = useState<string | null>(null);

  // Initialize and persist Owner Secret Key
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(`midnight_owner_sk_${targetContractAddress}`);
      if (saved && saved.trim()) {
        setOwnerSecretKey(saved.trim());
        return;
      }
    }
    if (mode === 'test') {
      setOwnerSecretKey(PRESET_IDENTITIES[0].addressHex);
    } else {
      setOwnerSecretKey(defaultOwnerKey);
    }
  }, [mode, targetContractAddress, defaultOwnerKey]);

  const activeSalt = useMemo(() => {
    if (metadata.contractSalt) return hexToBytes(metadata.contractSalt);
    if (MIDNIGHT_CONFIG.contractSalt) return hexToBytes(MIDNIGHT_CONFIG.contractSalt);
    return new Uint8Array(32).fill(42);
  }, [metadata.contractSalt]);

  const derivedOwnerAccountHex = useMemo(() => {
    if (!ownerSecretKey.trim()) return '';
    try {
      const bytes = hexToBytes(ownerSecretKey.trim());
      const derived = FungibleTokenClient.deriveAccount(bytes, activeSalt);
      return bytesToHex(derived);
    } catch {
      return '';
    }
  }, [ownerSecretKey, activeSalt]);

  const isOwnerKeyVerified = useMemo(() => {
    if (!metadata.owner || !derivedOwnerAccountHex) return false;
    return derivedOwnerAccountHex.toLowerCase() === metadata.owner.toLowerCase();
  }, [metadata.owner, derivedOwnerAccountHex]);

  const userDerivedAccountHex = useMemo(() => {
    if (propUserDerivedAccountHex) return propUserDerivedAccountHex;
    if (!accountAddress) return '';
    try {
      const bytes = addressToBytes32(accountAddress);
      const derived = FungibleTokenClient.deriveAccount(bytes, activeSalt);
      return bytesToHex(derived);
    } catch {
      return '';
    }
  }, [propUserDerivedAccountHex, accountAddress, activeSalt]);

  const isWalletOwner = useMemo(() => {
    if (metadata.isCallerOwner) return true;
    if (!metadata.owner) return false;
    if (userDerivedAccountHex && userDerivedAccountHex.toLowerCase() === metadata.owner.toLowerCase()) return true;
    if (accountAddress && addressToHex32(accountAddress).toLowerCase() === metadata.owner.toLowerCase()) return true;
    return false;
  }, [metadata.isCallerOwner, metadata.owner, userDerivedAccountHex, accountAddress]);

  // Auto-populate mint destination with caller's spendable account in Lace mode
  useEffect(() => {
    if (mode === 'lace' && userDerivedAccountHex && !mintAccount) {
      setMintAccount(userDerivedAccountHex);
    }
  }, [mode, userDerivedAccountHex, mintAccount]);

  // Auto-populate reallocate target with caller's spendable account in Lace mode
  useEffect(() => {
    if (mode === 'lace' && userDerivedAccountHex && !reallocateTarget) {
      setReallocateTarget(userDerivedAccountHex);
    }
  }, [mode, userDerivedAccountHex, reallocateTarget]);

  const handleOwnerKeyChange = (val: string) => {
    setOwnerSecretKey(val);
    if (typeof window !== 'undefined' && val.trim().length === 64) {
      try {
        localStorage.setItem(`midnight_owner_sk_${targetContractAddress}`, val.trim());
      } catch {}
    }
  };

  const renderOwnerAuthCard = (actionLabel: string = 'this action') => {
    if (isWalletOwner) {
      return (
        <div className="p-4 rounded-2xl bg-emerald-950/20 border border-emerald-500/30 space-y-2 shadow-inner">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span className="text-xs font-bold text-white">Owner Authorization Verified</span>
            </div>
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
              <CheckCircle2 className="w-3 h-3 text-emerald-400" />
              Connected Lace Wallet is Owner
            </span>
          </div>
          <p className="text-[11px] text-slate-400 leading-relaxed">
            Your connected Lace wallet ({accountAddress ? `${accountAddress.slice(0, 8)}...${accountAddress.slice(-6)}` : 'Connected'}) authorizes owner circuits natively (<code className="font-mono text-slate-300">authenticate(owner)</code>) via your spendable owner account ({metadata.owner ? `${metadata.owner.slice(0, 8)}...${metadata.owner.slice(-6)}` : 'Owner'}). No separate secret key required.
          </p>
        </div>
      );
    }

    return (
      <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800/90 space-y-3 shadow-inner">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <Key className="w-4 h-4 text-amber-400" />
            <span className="text-xs font-bold text-white">Owner Authorization (Secret Key)</span>
          </div>
          {isOwnerKeyVerified ? (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
              <CheckCircle2 className="w-3 h-3 text-emerald-400" />
              Verified Contract Owner
            </span>
          ) : derivedOwnerAccountHex ? (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/30">
              <AlertCircle className="w-3 h-3 text-amber-400" />
              Unmatched Key
            </span>
          ) : (
            <span className="text-[10px] text-slate-500 font-mono">32-Byte Hex Required</span>
          )}
        </div>

        <p className="text-[11px] text-slate-400 leading-relaxed">
          The circuit enforces on-chain <code className="font-mono text-slate-300">authenticate(owner)</code>. Provide the 32-byte secret key that hashes to the contract owner with the contract salt to authorize {actionLabel}.
        </p>

        <div className="relative">
          <input
            type={showOwnerKey ? 'text' : 'password'}
            value={ownerSecretKey}
            onChange={(e) => handleOwnerKeyChange(e.target.value)}
            placeholder="Enter 64-character hex Owner Secret Key"
            className={`w-full pr-10 pl-3.5 py-2 rounded-xl bg-slate-900 border text-white font-mono text-xs focus:outline-none transition-colors ${
              isOwnerKeyVerified
                ? 'border-emerald-500/50 focus:border-emerald-500'
                : derivedOwnerAccountHex
                ? 'border-amber-500/50 focus:border-amber-500'
                : 'border-slate-800 focus:border-blue-500'
            }`}
          />
          <button
            type="button"
            onClick={() => setShowOwnerKey(!showOwnerKey)}
            className="absolute right-3 top-2.5 text-slate-400 hover:text-white transition-colors"
            title={showOwnerKey ? 'Hide Secret Key' : 'Show Secret Key'}
          >
            {showOwnerKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
          </button>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-[11px]">
          <div className="flex items-center gap-2">
            <span className="text-slate-500">Derived:</span>
            <span className="font-mono text-[10px] text-slate-300">
              {derivedOwnerAccountHex ? `${derivedOwnerAccountHex.slice(0, 10)}...${derivedOwnerAccountHex.slice(-6)}` : '---'}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            {defaultOwnerKey ? (
              <button
                type="button"
                onClick={() => handleOwnerKeyChange(defaultOwnerKey)}
                className="px-2 py-0.5 rounded bg-blue-500/10 hover:bg-blue-500/20 text-blue-300 border border-blue-500/20 text-[10px] font-medium transition-colors"
              >
                Use Config Key
              </button>
            ) : null}
            {mode === 'test' && (
              <button
                type="button"
                onClick={() => handleOwnerKeyChange(PRESET_IDENTITIES[0].addressHex)}
                className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] font-medium transition-colors"
              >
                Use Alice (Test)
              </button>
            )}
            {ownerSecretKey ? (
              <button
                type="button"
                onClick={() => handleOwnerKeyChange('')}
                className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white text-[10px] transition-colors"
              >
                Clear
              </button>
            ) : null}
          </div>
        </div>
      </div>
    );
  };

  // In v2.2, contract is initialized upon construction during deployment


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
      // In Lace mode: Default to the user's spendable on-chain account
      const spendableAccount = userDerivedAccountHex || accountAddress || '';
      setTransferTo('');
      setApproveSpender('');
      setFromAccount(spendableAccount);
      setTransferFromTo('');
      setMintAccount(spendableAccount);
      setBurnAccount(spendableAccount);
    }
  }, [mode, accountAddress, userDerivedAccountHex]);

  const isExecuting =
    txStatus === 'preparing' ||
    txStatus === 'proving' ||
    txStatus === 'signing' ||
    txStatus === 'submitting';

  const getButtonStepLabel = (defaultLabel: string) => {
    switch (txStatus) {
      case 'preparing':
        return '1/5 Building Transaction...';
      case 'proving':
        return '2/5 Generating ZK Proof...';
      case 'signing':
        return '3/5 Waiting for Lace Signature...';
      case 'submitting':
        return '4/5 Submitting to Midnight...';
      case 'confirmed':
        return '5/5 Committed on Chain!';
      default:
        return defaultLabel;
    }
  };

  const renderStepIndicator = () => {
    if (txStatus === 'idle') return null;

    const steps = [
      { key: 'preparing', num: 1, label: 'Building' },
      { key: 'proving', num: 2, label: 'ZK Proof' },
      { key: 'signing', num: 3, label: 'Signature' },
      { key: 'submitting', num: 4, label: 'Submitting' },
      { key: 'confirmed', num: 5, label: 'Committed' },
    ];
    const order: TransactionStatus[] = ['preparing', 'proving', 'signing', 'submitting', 'confirmed'];
    const curIdx = order.indexOf(txStatus);

    return (
      <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950/80 border border-slate-200 dark:border-cyan-500/40 space-y-2.5 animate-in fade-in shadow-xs">
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <span className="flex h-2 w-2 relative">
              {txStatus === 'confirmed' ? (
                <span className="rounded-full h-2 w-2 bg-emerald-600 dark:bg-emerald-400" />
              ) : txStatus === 'failed' ? (
                <span className="rounded-full h-2 w-2 bg-rose-600 dark:bg-rose-400" />
              ) : (
                <>
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 dark:bg-cyan-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-600 dark:bg-cyan-500" />
                </>
              )}
            </span>
            <span className="font-semibold text-slate-900 dark:text-white">
              {txStatus === 'confirmed'
                ? 'Transaction Committed On-Chain!'
                : txStatus === 'failed'
                ? 'Transaction Failed'
                : `Step ${Math.min(5, curIdx + 1)} of 5: ${statusMessage || 'Processing...'}`}
            </span>
          </div>
          <span className="text-[11px] font-mono text-blue-900 dark:text-cyan-400 font-bold">
            {txStatus === 'confirmed' ? '100%' : txStatus === 'failed' ? 'Error' : `${(curIdx + 1) * 20}%`}
          </span>
        </div>

        {/* 5-step horizontal chips */}
        <div className="grid grid-cols-5 gap-1.5">
          {steps.map((s, idx) => {
            const isDone = curIdx > idx || txStatus === 'confirmed';
            const isActive = curIdx === idx && txStatus !== 'confirmed' && txStatus !== 'failed';
            const isFailed = txStatus === 'failed' && curIdx === idx;

            return (
              <div
                key={s.key}
                className={`py-1.5 px-1 rounded-lg text-center text-[10px] font-mono font-semibold transition-all ${
                  isDone
                    ? 'bg-emerald-50 text-emerald-900 border border-emerald-300 dark:bg-emerald-500/20 dark:text-emerald-300 dark:border-emerald-500/40'
                    : isActive
                    ? 'bg-blue-50 text-blue-900 border border-blue-400 shadow-xs dark:bg-cyan-500/25 dark:text-cyan-200 dark:border-cyan-400 dark:shadow-cyan-500/20 ring-1 ring-blue-400/40 dark:ring-cyan-400/40'
                    : isFailed
                    ? 'bg-rose-50 text-rose-900 border border-rose-300 dark:bg-rose-500/20 dark:text-rose-300 dark:border-rose-500/40'
                    : 'bg-slate-100 text-slate-600 border border-slate-200 dark:bg-slate-900 dark:text-slate-500 dark:border-slate-800'
                }`}
              >
                <div className="truncate">
                  {isDone ? '✓ ' : `${s.num}. `}{s.label}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

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
      if (mode === 'lace' && !isConnected) {
        throw new Error('Please connect your Lace wallet first using the "Connect Lace" button in the top bar.');
      }
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
      if (mode === 'lace' && !isConnected) {
        throw new Error('Please connect your Lace wallet first using the "Connect Lace" button in the top bar.');
      }
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
      if (mode === 'lace' && !isConnected) {
        throw new Error('Please connect your Lace wallet first using the "Connect Lace" button in the top bar.');
      }
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
      if (mode === 'lace' && !isConnected) {
        throw new Error('Please connect your Lace wallet first using the "Connect Lace" button in the top bar.');
      }
      if (mode === 'lace' && !isWalletOwner && !ownerSecretKey.trim()) {
        throw new Error('Only the contract owner can mint tokens. Your connected wallet is not the owner. Please connect the owner wallet or enter the Owner Secret Key.');
      }
      validateAddress(mintAccount, 'Destination Account');
      const amount = parseUnits(mintAmount, metadata.decimals);
      await onMint(mintAccount.trim(), amount, isWalletOwner ? undefined : (ownerSecretKey.trim() || undefined));
    } catch (err: any) {
      setFormError(err.message || 'Mint failed');
    }
  };

  const handleBurn = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    try {
      if (mode === 'lace' && !isConnected) {
        throw new Error('Please connect your Lace wallet first using the "Connect Lace" button in the top bar.');
      }
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

  const handlePauseToggle = async () => {
    setFormError(null);
    try {
      if (mode === 'lace' && !isWalletOwner && !ownerSecretKey.trim()) {
        throw new Error('Only the contract owner or pauser can toggle pause state. Your connected wallet is not authorized.');
      }
      const sk = isWalletOwner ? undefined : (ownerSecretKey.trim() || undefined);
      if (metadata.isPaused) {
        if (!onUnpause) throw new Error('Unpause action not available');
        await onUnpause(sk);
      } else {
        if (!onPause) throw new Error('Pause action not available');
        await onPause(sk);
      }
    } catch (err: any) {
      setFormError(err.message || (metadata.isPaused ? 'Unpause failed' : 'Pause failed'));
    }
  };

  const handleSetEmergencyPauser = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    try {
      if (mode === 'lace' && !isWalletOwner && !ownerSecretKey.trim()) {
        throw new Error('Only the contract owner can set the emergency pauser.');
      }
      if (!onSetEmergencyPauser) throw new Error('Set Emergency Pauser action not available');
      validateAddress(newPauserAddress, 'New Pauser Address');
      const sk = isWalletOwner ? undefined : (ownerSecretKey.trim() || undefined);
      await onSetEmergencyPauser(newPauserAddress.trim(), sk);
      setNewPauserAddress('');
    } catch (err: any) {
      setFormError(err.message || 'Failed to update emergency pauser');
    }
  };

  const handleEmergencyWithdraw = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    try {
      if (mode === 'lace' && !isWalletOwner && !ownerSecretKey.trim()) {
        throw new Error('Only the contract owner can perform emergency withdrawal.');
      }
      if (!onEmergencyWithdraw) throw new Error('Emergency Withdraw action not available');
      const amount = parseUnits(emergencyWithdrawAmount, metadata.decimals);
      if (emergencyWithdrawToken.trim()) {
        validateAddress(emergencyWithdrawToken.trim(), 'Token Contract Address');
      }
      const sk = isWalletOwner ? undefined : (ownerSecretKey.trim() || undefined);
      await onEmergencyWithdraw(amount, emergencyWithdrawToken.trim() || undefined, sk);
    } catch (err: any) {
      setFormError(err.message || 'Emergency withdrawal failed');
    }
  };

  const handleAdminReallocate = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    try {
      if (mode === 'lace' && !isConnected) {
        throw new Error('Please connect your Lace wallet first using the "Connect Lace" button in the top bar.');
      }
      if (mode === 'lace' && !isWalletOwner && !ownerSecretKey.trim()) {
        throw new Error('Only the contract owner can reallocate trapped tokens. Your connected wallet is not the owner. Please connect the owner wallet or enter the Owner Secret Key.');
      }
      if (!onAdminReallocate) {
        throw new Error('Admin Reallocate action not supported or not wired.');
      }
      validateAddress(trappedAccount, 'Trapped Source Account');
      validateAddress(reallocateTarget, 'Target Spendable Account');
      const amount = parseUnits(reallocateAmount, metadata.decimals);
      const sk = isWalletOwner ? undefined : (ownerSecretKey.trim() || undefined);
      await onAdminReallocate(
        trappedAccount.trim(),
        reallocateTarget.trim(),
        amount,
        sk
      );
    } catch (err: any) {
      setFormError(err.message || 'Admin reallocation failed');
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

    // In Lace mode: Provide "My Spendable Account" and "My Lace Address" buttons
    if (accountAddress) {
      return (
        <div className="flex items-center gap-1.5 text-[11px] text-slate-400 flex-wrap">
          {userDerivedAccountHex && (
            <button
              type="button"
              onClick={() => onSelect(userDerivedAccountHex)}
              className="flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 transition-colors cursor-pointer"
              title="Your spendable on-chain account derived from your Lace wallet and contract salt"
            >
              <ShieldCheck className="w-3 h-3 text-emerald-400" />
              <span>Spendable Account ({userDerivedAccountHex.slice(0, 6)}...{userDerivedAccountHex.slice(-4)})</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => onSelect(accountAddress)}
            className="flex items-center gap-1 px-2 py-0.5 rounded bg-blue-50 dark:bg-blue-500/10 hover:bg-blue-100 dark:hover:bg-blue-500/20 text-blue-800 dark:text-cyan-400 border border-blue-200 dark:border-blue-500/20 transition-colors cursor-pointer font-medium"
            title="Your raw Lace wallet address"
          >
            <User className="w-3 h-3" />
            <span>Lace Address</span>
          </button>
          {metadata.owner && (
            <button
              type="button"
              onClick={() => onSelect(metadata.owner!)}
              className="flex items-center gap-1 px-2 py-0.5 rounded bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 transition-colors cursor-pointer"
              title={`Contract Owner account: ${metadata.owner}`}
            >
              <span>👑 Owner ({metadata.owner.slice(0, 6)}...{metadata.owner.slice(-4)})</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => onSelect('')}
            className="px-1.5 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            Clear
          </button>
        </div>
      );
    }

    return null;
  };

  return (
    <div className="bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800/80 rounded-2xl overflow-hidden backdrop-blur-xl shadow-xl">
      {/* Cockpit Top Gradient Accent Line */}
      <div className="h-1.5 w-full bg-gradient-to-r from-blue-600 via-indigo-600 via-purple-600 to-emerald-500" />

      {/* Lace Mode Active Connected Wallet & Token Balance Bar */}
      {mode === 'lace' && (
        <div className="bg-slate-50 dark:bg-slate-950/90 border-b border-slate-200 dark:border-slate-800/80 px-4 py-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-blue-50 dark:bg-cyan-500/15 text-blue-700 dark:text-cyan-400 border border-blue-200 dark:border-cyan-500/30">
              <Wallet className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">Acting Caller:</span>
                {isConnected ? (
                  isWalletLocked ? (
                    <span className="text-xs font-semibold text-amber-800 dark:text-amber-300 flex items-center gap-1">
                      <Lock className="w-3 h-3 text-amber-700 dark:text-amber-400" />
                      Lace Wallet (Locked)
                    </span>
                  ) : (
                    <span className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-green-600 dark:bg-emerald-400 animate-pulse" />
                      You (Lace Wallet)
                    </span>
                  )
                ) : (
                  <span className="text-xs font-medium text-slate-500 dark:text-slate-400 italic">
                    Not connected
                  </span>
                )}
              </div>
              {accountAddress && userDerivedAccountHex && (
                <div className="text-[11px] text-slate-600 dark:text-slate-400 font-mono mt-0.5 flex items-center gap-1.5 flex-wrap">
                  <span>Owner: <code className="font-mono text-slate-700 dark:text-slate-300">{accountAddress.slice(0, 8)}...{accountAddress.slice(-6)}</code></span>
                  <span className="text-slate-400 dark:text-slate-600">•</span>
                  <span>
                    → Spendable: <code className="font-mono text-blue-800 dark:text-cyan-400 font-semibold">{userDerivedAccountHex.slice(0, 6)}...{userDerivedAccountHex.slice(-4)}</code>
                  </span>
                </div>
              )}
            </div>
          </div>

          {isConnected && (
            <div className="flex items-center gap-3 ml-auto sm:ml-0">
              <div className="text-right">
                <div className="text-[10px] text-blue-900 dark:text-cyan-400 font-medium uppercase tracking-wider">
                  Spendable Balance
                </div>
                <div className="text-sm sm:text-base font-black font-mono text-blue-950 dark:text-cyan-300 tracking-tight">
                  {formatUnits(userBalance, metadata.decimals)} <span className="text-xs text-slate-500 dark:text-slate-400 font-sans font-normal">{metadata.symbol}</span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Test Mode Active Identity Bar */}
      {mode === 'test' && (
        <div className="bg-slate-50 dark:bg-slate-950/80 border-b border-slate-200 dark:border-slate-800/80 px-4 py-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-500/20 text-indigo-700 dark:text-indigo-300 border border-indigo-500/30 flex items-center justify-center font-bold text-xs">
              {activeIdentity?.name ? activeIdentity.name.slice(0, 2).toUpperCase() : 'ID'}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-900 dark:text-white">{activeIdentity?.name || 'Alice'}</span>
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border border-slate-300 dark:border-slate-700">
                  Acting Signer
                </span>
                {metadata.isInitialized && metadata.isCallerOwner && (
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-800 dark:text-amber-300 border border-amber-500/30">
                    Contract Owner
                  </span>
                )}
              </div>
              <div className="text-[11px] font-mono text-slate-500 dark:text-slate-400 truncate max-w-xs sm:max-w-md">
                Spendable: 0x{activeIdentity?.addressHex ? `${activeIdentity.addressHex.slice(0, 10)}...${activeIdentity.addressHex.slice(-8)}` : '---'}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-900/90 p-1 rounded-xl border border-slate-200 dark:border-slate-800">
              {PRESET_IDENTITIES.slice(0, 3).map((id) => (
                <button
                  key={id.name}
                  type="button"
                  onClick={() => selectPresetIdentity(id)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                    activeIdentity?.name === id.name
                      ? 'bg-indigo-600 text-white font-semibold shadow-xs'
                      : 'bg-transparent hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                  }`}
                  title={`Switch to ${id.name}`}
                >
                  {id.name}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Categorized Cockpit Action Navigation */}
      <div className="border-b border-slate-200 dark:border-slate-800/90 bg-slate-50/90 dark:bg-slate-950/70 p-4 space-y-3.5">
        {/* Tier 1: 3 High-Impact Category Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          {/* Card 1: Send & Allowances */}
          <button
            type="button"
            onClick={() => handleCategorySwitch('transfers')}
            className={`group relative p-3.5 rounded-xl border text-left transition-all duration-200 cursor-pointer flex items-center justify-between ${
              activeCategory === 'transfers'
                ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white border-blue-500 shadow-md shadow-blue-500/25 ring-2 ring-blue-500/30'
                : 'bg-white dark:bg-slate-900/80 hover:bg-slate-100/90 dark:hover:bg-slate-800/80 text-slate-800 dark:text-slate-200 border-slate-200 dark:border-slate-800 hover:border-blue-300 dark:hover:border-blue-500/40 shadow-xs'
            }`}
          >
            <div className="flex items-center gap-3">
              <div
                className={`p-2 rounded-lg transition-colors ${
                  activeCategory === 'transfers'
                    ? 'bg-white/20 text-white'
                    : 'bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-400 group-hover:bg-blue-200 dark:group-hover:bg-blue-500/30'
                }`}
              >
                <Send className="w-4 h-4" />
              </div>
              <div>
                <div className={`text-xs font-bold ${activeCategory === 'transfers' ? 'text-white' : 'text-slate-900 dark:text-white'}`}>
                  Send & Allowances
                </div>
                <div className={`text-[11px] ${activeCategory === 'transfers' ? 'text-blue-100' : 'text-slate-500 dark:text-slate-400'}`}>
                  Transfer, approve & spend
                </div>
              </div>
            </div>
            <span
              className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                activeCategory === 'transfers'
                  ? 'bg-white/20 text-white border border-white/30'
                  : 'bg-blue-50 dark:bg-blue-950/60 text-blue-800 dark:text-blue-300 border border-blue-200 dark:border-blue-800'
              }`}
            >
              3 circuits
            </span>
          </button>

          {/* Card 2: Token Supply */}
          <button
            type="button"
            onClick={() => handleCategorySwitch('supply')}
            className={`group relative p-3.5 rounded-xl border text-left transition-all duration-200 cursor-pointer flex items-center justify-between ${
              activeCategory === 'supply'
                ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white border-emerald-500 shadow-md shadow-emerald-500/25 ring-2 ring-emerald-500/30'
                : 'bg-white dark:bg-slate-900/80 hover:bg-slate-100/90 dark:hover:bg-slate-800/80 text-slate-800 dark:text-slate-200 border-slate-200 dark:border-slate-800 hover:border-emerald-300 dark:hover:border-emerald-500/40 shadow-xs'
            }`}
          >
            <div className="flex items-center gap-3 min-w-0 pr-2">
              <div
                className={`p-2 rounded-lg transition-colors flex-shrink-0 ${
                  activeCategory === 'supply'
                    ? 'bg-white/20 text-white'
                    : 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 group-hover:bg-emerald-200 dark:group-hover:bg-emerald-500/30'
                }`}
              >
                <Coins className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className={`text-xs font-bold ${activeCategory === 'supply' ? 'text-white' : 'text-slate-900 dark:text-white'}`}>
                    Token Supply
                  </span>
                  <Crown className={`w-3 h-3 flex-shrink-0 ${activeCategory === 'supply' ? 'text-amber-200' : 'text-amber-600 dark:text-amber-400'}`} />
                </div>
                <div className={`text-[11px] font-mono truncate mt-0.5 ${activeCategory === 'supply' ? 'text-emerald-100' : 'text-slate-700 dark:text-slate-300'}`}>
                  <span>{formatUnits(metadata.totalSupply, metadata.decimals)} {metadata.symbol}</span>
                  <span className="opacity-60"> / </span>
                  <strong className={`font-bold ${activeCategory === 'supply' ? 'text-white' : 'text-slate-950 dark:text-white'}`}>
                    {isCapped && metadata.maxSupply ? `${formatUnits(metadata.maxSupply, metadata.decimals)}` : 'Uncapped'}
                  </strong>
                </div>
              </div>
            </div>
            <span
              className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0 ${
                activeCategory === 'supply'
                  ? 'bg-white/20 text-white border border-white/30'
                  : 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
              }`}
            >
              {isCapped && metadata.maxSupply && metadata.maxSupply > 0n
                ? `${Math.min(100, Math.round((Number(metadata.totalSupply) / Number(metadata.maxSupply)) * 100))}% Cap`
                : 'Owner'}
            </span>
          </button>

          {/* Card 3: Security & Admin */}
          <button
            type="button"
            onClick={() => handleCategorySwitch('admin')}
            className={`group relative p-3.5 rounded-xl border text-left transition-all duration-200 cursor-pointer flex items-center justify-between ${
              activeCategory === 'admin'
                ? 'bg-gradient-to-r from-rose-600 to-amber-600 text-white border-rose-500 shadow-md shadow-rose-500/25 ring-2 ring-rose-500/30'
                : 'bg-white dark:bg-slate-900/80 hover:bg-slate-100/90 dark:hover:bg-slate-800/80 text-slate-800 dark:text-slate-200 border-slate-200 dark:border-slate-800 hover:border-rose-300 dark:hover:border-rose-500/40 shadow-xs'
            }`}
          >
            <div className="flex items-center gap-3">
              <div
                className={`p-2 rounded-lg transition-colors ${
                  activeCategory === 'admin'
                    ? 'bg-white/20 text-white'
                    : 'bg-rose-100 dark:bg-rose-500/20 text-rose-700 dark:text-rose-400 group-hover:bg-rose-200 dark:group-hover:bg-rose-500/30'
                }`}
              >
                <ShieldAlert className="w-4 h-4" />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <span className={`text-xs font-bold ${activeCategory === 'admin' ? 'text-white' : 'text-slate-900 dark:text-white'}`}>
                    Security & Admin
                  </span>
                  {metadata.isPaused && (
                    <span className="w-2 h-2 rounded-full bg-rose-400 animate-ping" />
                  )}
                </div>
                <div className={`text-[11px] ${activeCategory === 'admin' ? 'text-rose-100' : 'text-slate-500 dark:text-slate-400'}`}>
                  Pause, traps & config
                </div>
              </div>
            </div>
            {metadata.isPaused ? (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-500 text-white animate-pulse border border-rose-400">
                PAUSED
              </span>
            ) : (
              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                  activeCategory === 'admin'
                    ? 'bg-white/20 text-white border border-white/30'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
                }`}
              >
                3 circuits
              </span>
            )}
          </button>
        </div>

        {/* Tier 2: Sub-Action Toolbar + Live Compact ZK Circuit Indicator */}
        <div className="pt-2 border-t border-slate-200/80 dark:border-slate-800/80 flex flex-col md:flex-row md:items-center justify-between gap-2.5">
          {/* Sub-action Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none py-0.5">
            {activeCategory === 'transfers' && (
              <>
                <button
                  type="button"
                  onClick={() => handleTabSwitch('transfer')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
                    activeTab === 'transfer'
                      ? 'bg-blue-600 text-white shadow-xs shadow-blue-500/40 ring-1 ring-blue-500'
                      : 'bg-white dark:bg-slate-900/80 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700/80'
                  }`}
                >
                  <Send className="w-3.5 h-3.5" /> Send Tokens
                </button>
                <button
                  type="button"
                  onClick={() => handleTabSwitch('approve')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
                    activeTab === 'approve'
                      ? 'bg-indigo-600 text-white shadow-xs shadow-indigo-500/40 ring-1 ring-indigo-500'
                      : 'bg-white dark:bg-slate-900/80 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700/80'
                  }`}
                >
                  <CheckSquare className="w-3.5 h-3.5" /> Approve Spender
                </button>
                <button
                  type="button"
                  onClick={() => handleTabSwitch('transferFrom')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
                    activeTab === 'transferFrom'
                      ? 'bg-indigo-700 text-white shadow-xs shadow-indigo-600/40 ring-1 ring-indigo-600'
                      : 'bg-white dark:bg-slate-900/80 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700/80'
                  }`}
                >
                  <Repeat className="w-3.5 h-3.5" /> Use Allowance
                </button>
              </>
            )}

            {activeCategory === 'supply' && (
              <>
                <button
                  type="button"
                  onClick={() => handleTabSwitch('mint')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
                    activeTab === 'mint'
                      ? 'bg-emerald-600 text-white shadow-xs shadow-emerald-500/40 ring-1 ring-emerald-500'
                      : 'bg-white dark:bg-slate-900/80 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700/80'
                  }`}
                >
                  <PlusCircle className="w-3.5 h-3.5" /> Mint New Tokens
                </button>
                <button
                  type="button"
                  onClick={() => handleTabSwitch('burn')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
                    activeTab === 'burn'
                      ? 'bg-rose-600 text-white shadow-xs shadow-rose-500/40 ring-1 ring-rose-500'
                      : 'bg-white dark:bg-slate-900/80 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700/80'
                  }`}
                >
                  <Flame className="w-3.5 h-3.5" /> Burn Tokens
                </button>
              </>
            )}

            {activeCategory === 'admin' && (
              <>
                <button
                  type="button"
                  onClick={() => handleTabSwitch('emergency')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
                    activeTab === 'emergency'
                      ? 'bg-rose-600 text-white shadow-xs shadow-rose-500/40 ring-1 ring-rose-500'
                      : 'bg-white dark:bg-slate-900/80 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700/80'
                  }`}
                >
                  <ShieldAlert className="w-3.5 h-3.5" /> Emergency Controls
                </button>
                <button
                  type="button"
                  onClick={() => handleTabSwitch('reallocate')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
                    activeTab === 'reallocate'
                      ? 'bg-teal-700 text-white shadow-xs shadow-teal-600/40 ring-1 ring-teal-600'
                      : 'bg-white dark:bg-slate-900/80 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700/80'
                  }`}
                >
                  <RotateCcw className="w-3.5 h-3.5" /> Reallocate Trapped
                </button>
                <button
                  type="button"
                  onClick={() => handleTabSwitch('init')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
                    activeTab === 'init'
                      ? 'bg-blue-600 text-white shadow-xs shadow-blue-500/40 ring-1 ring-blue-500'
                      : 'bg-white dark:bg-slate-900/80 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700/80'
                  }`}
                >
                  <Settings className="w-3.5 h-3.5" /> Contract Setup
                </button>
              </>
            )}
          </div>

          {/* Live Compact ZK Circuit Indicator */}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 shadow-xs self-start md:self-auto">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <Zap className="w-3 h-3 text-amber-500" />
              <span className="text-[10px] uppercase font-bold tracking-wider text-slate-600 dark:text-slate-400">
                ZK Circuit:
              </span>
            </div>
            <code className="text-xs font-mono font-bold text-blue-900 dark:text-cyan-300 bg-blue-50 dark:bg-cyan-950/50 px-2 py-0.5 rounded border border-blue-200 dark:border-cyan-800/60">
              {TAB_CIRCUIT_SIGNATURES[activeTab]}
            </code>
          </div>
        </div>
      </div>

      {/* Tab Panels */}
      <div className="p-6">
        {metadata.isPaused && (
          <div className="mb-5 p-4 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-200 text-xs flex items-start gap-3 shadow-lg shadow-rose-950/30">
            <AlertCircle className="w-5 h-5 text-rose-400 flex-shrink-0 mt-0.5 animate-pulse" />
            <div className="space-y-1">
              <p className="font-semibold text-rose-300 flex items-center gap-2">
                Contract is currently PAUSED (Emergency Stop Active)
              </p>
              <p className="text-rose-200/80 text-[11px] leading-relaxed">
                Transfers, approvals, minting, and burning circuits are temporarily suspended on-chain. Only designated emergency pausers or contract owner can unpause or execute emergency withdrawal.
              </p>
            </div>
          </div>
        )}

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
          <div className="mb-5 p-4 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800/40 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs text-blue-900 dark:text-blue-200">
            <div className="flex items-center gap-2">
              <Wallet className="w-4 h-4 text-blue-700 dark:text-cyan-400 flex-shrink-0" />
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
            {/* Action Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-800/80 gap-2">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Send className="w-4 h-4 text-blue-400" />
                  Send Tokens
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Transfer tokens directly from your spendable balance to another Midnight address.
                </p>
              </div>
              <div className="self-start sm:self-auto">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-800 font-mono text-[11px] text-slate-400">
                  <span className="text-slate-500">circuit</span> transfer(caller, to, value)
                </span>
              </div>
            </div>

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
              <div className="flex items-center justify-between mb-1.5 flex-wrap gap-1">
                <label className="block text-xs font-semibold text-slate-300">
                  Amount to Transfer ({metadata.symbol})
                </label>
                <div className="flex items-center gap-1.5 text-xs">
                  <span className="text-slate-400">Available:</span>
                  <span className="font-mono text-blue-950 dark:text-cyan-300 font-bold">
                    {formatUnits(userBalance, metadata.decimals)} {metadata.symbol}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      const whole = userBalance / (10n ** BigInt(metadata.decimals));
                      setTransferAmount(whole.toString());
                    }}
                    className="px-1.5 py-0.5 rounded bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 text-[10px] font-semibold transition-colors cursor-pointer"
                    title="Set maximum spendable balance"
                  >
                    Max
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const half = (userBalance / 2n) / (10n ** BigInt(metadata.decimals));
                      setTransferAmount(half.toString());
                    }}
                    className="px-1.5 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] font-semibold transition-colors cursor-pointer"
                    title="Set 50% of spendable balance"
                  >
                    50%
                  </button>
                </div>
              </div>
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

            {renderStepIndicator()}

            <button
              type="submit"
              disabled={isExecuting}
              className="w-full py-3 px-4 rounded-xl text-sm font-semibold bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white transition-all shadow-lg shadow-blue-500/20 disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
            >
              {isExecuting && <Loader2 className="w-4 h-4 animate-spin text-white" />}
              {getButtonStepLabel('Execute Transfer Circuit')}
              {!isExecuting && <ArrowRight className="w-4 h-4" />}
            </button>
          </form>
        )}

        {/* Tab 2: Approve */}
        {activeTab === 'approve' && (
          <form onSubmit={handleApprove} className="space-y-5">
            {/* Action Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-800/80 gap-2">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <CheckSquare className="w-4 h-4 text-blue-400" />
                  Approve Spender Allowance
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Authorize a smart contract or third-party address to spend up to a set amount from your account.
                </p>
              </div>
              <div className="self-start sm:self-auto">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-800 font-mono text-[11px] text-slate-400">
                  <span className="text-slate-500">circuit</span> approve(caller, spender, value)
                </span>
              </div>
            </div>

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

            {renderStepIndicator()}

            <button
              type="submit"
              disabled={isExecuting}
              className="w-full py-3 px-4 rounded-xl text-sm font-semibold bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white transition-all shadow-lg shadow-blue-500/20 disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
            >
              {isExecuting && <Loader2 className="w-4 h-4 animate-spin text-white" />}
              {getButtonStepLabel('Approve Spender Allowance')}
              {!isExecuting && <ArrowRight className="w-4 h-4" />}
            </button>
          </form>
        )}

        {/* Tab 3: Transfer From */}
        {activeTab === 'transferFrom' && (
          <form onSubmit={handleTransferFrom} className="space-y-5">
            {/* Action Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-800/80 gap-2">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Repeat className="w-4 h-4 text-blue-400" />
                  Use Delegated Allowance (TransferFrom)
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Transfer tokens out of another account that has previously granted you an approved spending allowance.
                </p>
              </div>
              <div className="self-start sm:self-auto">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-800 font-mono text-[11px] text-slate-400">
                  <span className="text-slate-500">circuit</span> transferFrom(caller, from, to, value)
                </span>
              </div>
            </div>

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
                    const formatted = formatBalance(currentAllowance, metadata.decimals);
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

            {renderStepIndicator()}

            <button
              type="submit"
              disabled={isExecuting}
              className="w-full py-3 px-4 rounded-xl text-sm font-semibold bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white transition-all shadow-lg shadow-blue-500/20 disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
            >
              {isExecuting && <Loader2 className="w-4 h-4 animate-spin text-white" />}
              {getButtonStepLabel('Execute Delegated Transfer')}
              {!isExecuting && <ArrowRight className="w-4 h-4" />}
            </button>
          </form>
        )}

        {/* Tab 4: Mint */}
        {activeTab === 'mint' && (
          <form onSubmit={handleMint} className="space-y-5">
            {/* Action Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-800/80 gap-2">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <PlusCircle className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    Mint New Tokens
                  </h3>
                  <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-800 dark:text-amber-300 border border-amber-500/30">
                    Owner Only
                  </span>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                  Create new tokens and deposit them into any recipient address. Total supply cannot exceed the maximum cap.
                </p>
              </div>
              <div className="self-start sm:self-auto flex items-center gap-2">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 font-mono text-[11px] text-slate-600 dark:text-slate-400">
                  <span className="text-slate-500">circuit</span> mint(to, value)
                </span>
              </div>
            </div>

            {/* Supply & Mint Capacity Meter */}
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800/80 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-lg bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/30">
                    <Coins className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-2">
                      <span>Supply & Mint Capacity</span>
                      {isCapped && metadata.maxSupply && metadata.maxSupply > 0n && (
                        <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                          {Math.min(100, Math.round((Number(metadata.totalSupply) / Number(metadata.maxSupply)) * 100))}% Minted
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-slate-600 dark:text-slate-400 font-mono mt-0.5">
                      Minted: <strong className="text-slate-900 dark:text-white">{formatUnits(metadata.totalSupply, metadata.decimals)}</strong> / {isCapped && metadata.maxSupply ? `${formatUnits(metadata.maxSupply, metadata.decimals)} ${metadata.symbol}` : 'Uncapped'}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2.5 self-start sm:self-center">
                  {isCapped && remainingCap !== null ? (
                    <div className="text-left sm:text-right">
                      <div className="text-[10px] text-slate-500 uppercase tracking-wider font-medium">Remaining Cap</div>
                      <div className="text-xs font-mono font-bold text-emerald-800 dark:text-emerald-300">
                        {formatUnits(remainingCap, metadata.decimals)} {metadata.symbol}
                      </div>
                    </div>
                  ) : (
                    <span className="text-xs font-semibold text-slate-600 dark:text-slate-400 px-2.5 py-1 rounded-lg bg-slate-200/60 dark:bg-slate-800">
                      Uncapped Max Supply
                    </span>
                  )}

                  {isCapped && remainingCap !== null && remainingCap > 0n && (
                    <button
                      type="button"
                      onClick={() => {
                        const divisor = 10n ** BigInt(metadata.decimals);
                        const whole = remainingCap / divisor;
                        const frac = remainingCap % divisor;
                        const formatted = frac === 0n ? whole.toString() : `${whole}.${frac.toString().padStart(metadata.decimals, '0').replace(/0+$/, '')}`;
                        setMintAmount(formatted);
                      }}
                      className="px-2.5 py-1.5 rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-xs cursor-pointer transition-colors whitespace-nowrap"
                      title="Pre-fill input with all remaining mintable capacity"
                    >
                      Max Mintable
                    </button>
                  )}
                </div>
              </div>

              {/* Visual Progress Bar (when capped) */}
              {isCapped && metadata.maxSupply && metadata.maxSupply > 0n && (
                <div className="space-y-1 pt-1">
                  <div className="h-2 w-full rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-emerald-500 to-teal-500 rounded-full transition-all duration-300"
                      style={{
                        width: `${Math.min(100, Math.max(2, Math.round((Number(metadata.totalSupply) / Number(metadata.maxSupply)) * 100)))}%`
                      }}
                    />
                  </div>
                </div>
              )}
            </div>

            {renderOwnerAuthCard('minting new tokens')}

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

            {renderStepIndicator()}

            <button
              type="submit"
              disabled={isExecuting}
              className="w-full py-3 px-4 rounded-xl text-sm font-semibold bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white transition-all shadow-lg shadow-emerald-500/20 disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
            >
              {isExecuting && <Loader2 className="w-4 h-4 animate-spin text-white" />}
              {getButtonStepLabel('Mint Tokens')}
              {!isExecuting && <PlusCircle className="w-4 h-4" />}
            </button>
          </form>
        )}

        {/* Tab 5: Burn */}
        {activeTab === 'burn' && (
          <form onSubmit={handleBurn} className="space-y-5">
            {/* Action Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-800/80 gap-2">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Flame className="w-4 h-4 text-rose-600 dark:text-rose-400" />
                  Burn Tokens
                </h3>
                <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                  Permanently destroy tokens from your spendable balance, reducing circulating supply.
                </p>
              </div>
              <div className="self-start sm:self-auto">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 font-mono text-[11px] text-slate-600 dark:text-slate-400">
                  <span className="text-slate-500">circuit</span> burn(caller, value)
                </span>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5 flex-wrap gap-1">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Amount to Burn ({metadata.symbol})
                </label>
                <div className="flex items-center gap-2 text-xs flex-wrap">
                  <span className="text-slate-500 dark:text-slate-400">Total Minted:</span>
                  <span className="font-mono text-slate-800 dark:text-slate-200 font-medium">
                    {formatUnits(metadata.totalSupply, metadata.decimals)} {metadata.symbol}
                  </span>
                  <span className="text-slate-300 dark:text-slate-700">•</span>
                  <span className="text-slate-500 dark:text-slate-400">Available:</span>
                  <span className="font-mono text-rose-700 dark:text-rose-300 font-bold">
                    {formatUnits(userBalance, metadata.decimals)} {metadata.symbol}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      const whole = userBalance / (10n ** BigInt(metadata.decimals));
                      setBurnAmount(whole.toString());
                    }}
                    className="px-1.5 py-0.5 rounded bg-rose-500/20 hover:bg-rose-500/30 text-rose-800 dark:text-rose-300 text-[10px] font-semibold transition-colors cursor-pointer"
                    title="Set maximum burn amount"
                  >
                    Max
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const half = (userBalance / 2n) / (10n ** BigInt(metadata.decimals));
                      setBurnAmount(half.toString());
                    }}
                    className="px-1.5 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] font-semibold transition-colors cursor-pointer"
                    title="Set 50% of spendable balance"
                  >
                    50%
                  </button>
                </div>
              </div>
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

            {renderStepIndicator()}

            <button
              type="submit"
              disabled={isExecuting}
              className="w-full py-3 px-4 rounded-xl text-sm font-semibold bg-gradient-to-r from-rose-600 to-orange-600 hover:from-rose-500 hover:to-orange-500 text-white transition-all shadow-lg shadow-rose-500/20 disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
            >
              {isExecuting && <Loader2 className="w-4 h-4 animate-spin text-white" />}
              {getButtonStepLabel('Burn Tokens')}
              {!isExecuting && <Flame className="w-4 h-4" />}
            </button>
          </form>
        )}

        {/* Tab: Reallocate / Recover Trapped Tokens */}
        {activeTab === 'reallocate' && (
          <form onSubmit={handleAdminReallocate} className="space-y-5">
            {/* Action Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-800/80 gap-2">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <RotateCcw className="w-4 h-4 text-teal-700 dark:text-teal-400" />
                    Recover Trapped Tokens
                  </h3>
                  <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-amber-50 dark:bg-amber-500/20 text-amber-900 dark:text-amber-300 border border-amber-300 dark:border-amber-500/30">
                    Owner Only
                  </span>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                  Rescue tokens accidentally sent to raw un-hashed Lace wallet addresses and transfer them to spendable accounts.
                </p>
              </div>
              <div className="self-start sm:self-auto">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 font-mono text-[11px] text-slate-700 dark:text-slate-400">
                  <span className="text-slate-500">circuit</span> adminReallocate(...)
                </span>
              </div>
            </div>

            {renderOwnerAuthCard('reallocating trapped tokens')}

            <div className="p-4 rounded-xl bg-teal-50 border border-teal-200 dark:bg-teal-500/10 dark:border-teal-500/30 text-xs space-y-1.5 shadow-xs">
              <div className="flex items-center gap-2 font-semibold text-teal-900 dark:text-teal-300">
                <ShieldCheck className="w-4 h-4 text-teal-700 dark:text-teal-400" />
                <span>Trap Recovery Mechanism (v2.3)</span>
              </div>
              <p className="text-slate-700 dark:text-slate-300 leading-relaxed text-[11px]">
                Tokens sent directly to an un-hashed raw Lace wallet address reside in <code className="text-slate-900 dark:text-white font-mono bg-slate-200/70 dark:bg-slate-900 px-1 py-0.5 rounded">_balances[rawAddress]</code> and cannot sign spending circuits because Midnight requires authorization via <code className="text-slate-900 dark:text-white font-mono bg-slate-200/70 dark:bg-slate-900 px-1 py-0.5 rounded">authenticate(persistentHash([salt, rawAddress]))</code>.
              </p>
              <p className="text-teal-950 dark:text-teal-200/90 leading-relaxed text-[11px] font-medium">
                This admin circuit allows the contract owner to rescue trapped balances and transfer them directly into the recipient&apos;s verified spendable account without requiring the trapped address to authenticate.
              </p>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-semibold text-slate-300">
                  Trapped Source Account (Non-Spendable Address or Hex)
                </label>
                {renderQuickSelect(setTrappedAccount)}
              </div>
              <input
                type="text"
                required
                value={trappedAccount}
                onChange={(e) => setTrappedAccount(e.target.value)}
                placeholder="Midnight address (mn_addr_...) or 64-character hex key holding the trapped balance"
                className="w-full px-4 py-2.5 rounded-xl bg-slate-950/70 border border-slate-800 focus:border-teal-500 text-white font-mono text-xs focus:outline-none transition-colors"
              />
              <p className="mt-1 text-[11px] text-slate-500">
                Source account in <code className="text-slate-400 font-mono">_balances</code>. Use &ldquo;Lace Address&rdquo; if tokens were sent to your raw wallet address.
              </p>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-semibold text-slate-300">
                  Target Spendable Account (Destination)
                </label>
                {renderQuickSelect(setReallocateTarget)}
              </div>
              <input
                type="text"
                required
                value={reallocateTarget}
                onChange={(e) => setReallocateTarget(e.target.value)}
                placeholder="Spendable account hex or Lace address (auto-resolved with salt)"
                className="w-full px-4 py-2.5 rounded-xl bg-slate-950/70 border border-slate-800 focus:border-teal-500 text-white font-mono text-xs focus:outline-none transition-colors"
              />
              <p className="mt-1 text-[11px] text-slate-500">
                Destination account. Selecting &ldquo;Spendable Account&rdquo; fills your spendable hash required to spend these tokens.
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Amount to Reallocate ({metadata.symbol})
              </label>
              <div className="relative">
                <input
                  type="number"
                  step="any"
                  required
                  value={reallocateAmount}
                  onChange={(e) => setReallocateAmount(e.target.value)}
                  placeholder="e.g. 200"
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-950/70 border border-slate-800 focus:border-teal-500 text-white font-mono text-sm focus:outline-none transition-colors"
                />
                <span className="absolute right-4 top-2.5 text-xs text-slate-400 font-mono">
                  {metadata.symbol}
                </span>
              </div>
            </div>

            {renderStepIndicator()}

            <button
              type="submit"
              disabled={isExecuting}
              className="w-full py-3 px-4 rounded-xl text-sm font-semibold bg-gradient-to-r from-teal-600 to-cyan-600 hover:from-teal-500 hover:to-cyan-500 text-white transition-all shadow-lg shadow-teal-500/20 disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
            >
              {isExecuting && <Loader2 className="w-4 h-4 animate-spin text-white" />}
              {getButtonStepLabel('Reallocate Trapped Tokens')}
              {!isExecuting && <RotateCcw className="w-4 h-4" />}
            </button>
          </form>
        )}

        {/* Tab 6: Emergency Controls */}
        {activeTab === 'emergency' && (
          <div className="space-y-8">
            {/* Action Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-800/80 gap-2">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <ShieldAlert className="w-4 h-4 text-rose-400" />
                    Security & Emergency Controls
                  </h3>
                  <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-rose-500/20 text-rose-300 border border-rose-500/30">
                    Restricted
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-0.5">
                  Pause on-chain activity during security incidents, manage pauser privileges, or recover treasury reserves.
                </p>
              </div>
              <div className="self-start sm:self-auto">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-800 font-mono text-[11px] text-slate-400">
                  <span className="text-slate-500">circuits</span> pause / unpause / withdraw
                </span>
              </div>
            </div>

            {renderOwnerAuthCard('emergency actions')}
            {/* Section A: Pause / Unpause Circuit */}
            <div className="p-5 rounded-2xl bg-slate-950/70 border border-slate-800 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800/80">
                <div className="flex items-center gap-2.5">
                  <div className={`p-2 rounded-xl ${metadata.isPaused ? 'bg-rose-500/20 text-rose-400' : 'bg-emerald-500/20 text-emerald-400'}`}>
                    <ShieldAlert className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-white">Emergency Breaker (Pause / Unpause)</h4>
                    <p className="text-xs text-slate-400">
                      Circuit: <code className="font-mono text-slate-300">{metadata.isPaused ? 'unpause(caller)' : 'pause(caller)'}</code>
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${
                    metadata.isPaused
                      ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30 animate-pulse'
                      : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                  }`}>
                    {metadata.isPaused ? (
                      <>
                        <PauseCircle className="w-3.5 h-3.5" />
                        CONTRACT PAUSED
                      </>
                    ) : (
                      <>
                        <PlayCircle className="w-3.5 h-3.5" />
                        CONTRACT ACTIVE
                      </>
                    )}
                  </span>
                </div>
              </div>

              <p className="text-xs text-slate-400 leading-relaxed">
                When paused, all token transfers, approvals, minting, and burning circuits are blocked on-chain.
                Only the registered <strong className="text-slate-200">contract owner</strong> or designated <strong className="text-slate-200">emergency pauser</strong> can pause or unpause.
              </p>

              {renderStepIndicator()}

              <button
                type="button"
                onClick={handlePauseToggle}
                disabled={isExecuting}
                className={`w-full py-3 px-4 rounded-xl text-sm font-semibold transition-all shadow-lg flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer ${
                  metadata.isPaused
                    ? 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-emerald-500/20'
                    : 'bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 text-white shadow-rose-500/20'
                }`}
              >
                {isExecuting && <Loader2 className="w-4 h-4 animate-spin text-white" />}
                {isExecuting ? (
                  getButtonStepLabel('Executing Circuit...')
                ) : metadata.isPaused ? (
                  <>
                    <PlayCircle className="w-4 h-4" />
                    Unpause Contract (Resume All Operations)
                  </>
                ) : (
                  <>
                    <PauseCircle className="w-4 h-4" />
                    Pause Contract (Emergency Stop)
                  </>
                )}
              </button>
            </div>

            {/* Section B: Set Emergency Pauser */}
            <form onSubmit={handleSetEmergencyPauser} className="p-5 rounded-2xl bg-slate-950/70 border border-slate-800 space-y-4">
              <div className="flex items-center gap-2.5 pb-3 border-b border-slate-800/80">
                <div className="p-2 rounded-xl bg-blue-500/20 text-blue-400">
                  <User className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-white">Designate Emergency Pauser</h4>
                  <p className="text-xs text-slate-400">
                    Circuit: <code className="font-mono text-slate-300">setEmergencyPauser(caller, newPauser)</code>
                  </p>
                </div>
              </div>

              <div className="text-xs text-slate-400 flex items-center justify-between">
                <span>Current Pauser:</span>
                <span className="font-mono text-slate-200">
                  {metadata.emergencyPauser
                    ? `${metadata.emergencyPauser.slice(0, 10)}...${metadata.emergencyPauser.slice(-8)}`
                    : (metadata.owner ? `Default (Owner: ${metadata.owner.slice(0, 8)}...)` : 'None')}
                </span>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-semibold text-slate-300">
                    New Pauser Account Address
                  </label>
                  {renderQuickSelect(setNewPauserAddress)}
                </div>
                <input
                  type="text"
                  required
                  value={newPauserAddress}
                  onChange={(e) => setNewPauserAddress(e.target.value)}
                  placeholder="Midnight address (mn_addr_...) or 64-character hex"
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-800 focus:border-blue-500 text-white font-mono text-xs focus:outline-none transition-colors"
                />
              </div>

              <button
                type="submit"
                disabled={isExecuting}
                className="w-full py-2.5 px-4 rounded-xl text-xs font-semibold bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white transition-all shadow-md shadow-blue-500/20 disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
              >
                {isExecuting ? 'Executing Circuit...' : 'Update Emergency Pauser'}
                <User className="w-3.5 h-3.5" />
              </button>
            </form>

            {/* Section C: Emergency Withdrawal */}
            <form onSubmit={handleEmergencyWithdraw} className="p-5 rounded-2xl bg-slate-950/70 border border-slate-800 space-y-4">
              <div className="flex items-center gap-2.5 pb-3 border-b border-slate-800/80">
                <div className="p-2 rounded-xl bg-amber-500/20 text-amber-400">
                  <ArrowDownToLine className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-white">Emergency Withdrawal to Owner</h4>
                  <p className="text-xs text-slate-400">
                    Circuit: <code className="font-mono text-slate-300">emergencyWithdraw(caller, token, amount)</code>
                  </p>
                </div>
              </div>

              <p className="text-xs text-slate-400 leading-relaxed">
                Transfers tokens held in the contract account to the registered owner treasury. 
                <span className="text-amber-300 font-semibold ml-1">Circuit requires the contract to be PAUSED.</span>
              </p>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-semibold text-slate-300">
                    Token Contract Address (Optional)
                  </label>
                  <button
                    type="button"
                    onClick={() => setEmergencyWithdrawToken(targetContractAddress)}
                    className="text-[11px] text-blue-400 hover:text-blue-300 underline"
                  >
                    Use This Contract
                  </button>
                </div>
                <input
                  type="text"
                  value={emergencyWithdrawToken}
                  onChange={(e) => setEmergencyWithdrawToken(e.target.value)}
                  placeholder={`Leave empty to withdraw this token (${targetContractAddress.slice(0, 16)}...)`}
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-800 focus:border-amber-500 text-white font-mono text-xs focus:outline-none transition-colors"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Amount to Withdraw ({metadata.symbol})
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="any"
                    required
                    value={emergencyWithdrawAmount}
                    onChange={(e) => setEmergencyWithdrawAmount(e.target.value)}
                    placeholder="e.g. 1000"
                    className="w-full px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-800 focus:border-amber-500 text-white font-mono text-sm focus:outline-none transition-colors"
                  />
                  <span className="absolute right-4 top-2.5 text-xs text-slate-400 font-mono">
                    {metadata.symbol}
                  </span>
                </div>
              </div>

              <button
                type="submit"
                disabled={isExecuting}
                className="w-full py-3 px-4 rounded-xl text-sm font-semibold bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white transition-all shadow-lg shadow-amber-500/20 disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
              >
                {isExecuting ? 'Executing Circuit...' : 'Execute Emergency Withdrawal'}
                <ArrowDownToLine className="w-4 h-4" />
              </button>
            </form>
          </div>
        )}

        {/* Tab 7: Initialize (Informative in v2.2) */}
        {activeTab === 'init' && (
          <div className="space-y-5">
            {/* Action Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-800/80 gap-2">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Settings className="w-4 h-4 text-blue-400" />
                  Contract Setup & Genesis Parameters
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Immutable metadata and configuration parameters established during contract deployment.
                </p>
              </div>
              <div className="self-start sm:self-auto">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-800 font-mono text-[11px] text-slate-400">
                  <span className="text-slate-500">constructor</span> Genesis State
                </span>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-blue-500/10 border border-blue-500/30 text-xs text-blue-200">
              <div className="flex items-center gap-2 mb-2 font-semibold text-blue-300">
                <Settings className="w-4 h-4 text-blue-400" />
                <span>Constructor Initialized (v2.2 Architecture)</span>
              </div>
              <p className="text-slate-300 leading-relaxed">
                In Midnight Compact v2.2, smart contracts are initialized <span className="font-semibold text-white">on-chain during deployment</span> via the contract constructor:
              </p>
              <code className="block my-2 p-2 rounded bg-slate-950 font-mono text-[11px] text-emerald-400">
                constructor(initialOwner, name, symbol, decimals, maxSupply)
              </code>
              <p className="text-slate-400">
                There is no standalone <code className="text-slate-200 font-mono">initialize(...)</code> circuit to call post-deployment. The contract state was established when the transaction was accepted at genesis.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4 text-xs">
              <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800">
                <span className="text-slate-400 block mb-1">Token Name</span>
                <span className="text-white font-medium text-sm">{metadata.name}</span>
              </div>
              <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800">
                <span className="text-slate-400 block mb-1">Ticker Symbol</span>
                <span className="text-white font-mono text-sm">{metadata.symbol}</span>
              </div>
              <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800">
                <span className="text-slate-400 block mb-1">Decimals</span>
                <span className="text-white font-mono text-sm">{metadata.decimals}</span>
              </div>
              <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800">
                <span className="text-slate-400 block mb-1">Contract Status</span>
                <span className="text-emerald-400 font-semibold text-sm">Deployed & Active</span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setActiveTab('transfer')}
              className="w-full py-3 px-4 rounded-xl text-sm font-semibold bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white transition-all shadow-lg shadow-blue-500/20 flex items-center justify-center gap-2 cursor-pointer"
            >
              <span>Go to Token Transfers</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
