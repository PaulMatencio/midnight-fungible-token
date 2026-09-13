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
} from 'lucide-react';
import { PRESET_IDENTITIES, MIDNIGHT_CONFIG, getExplorerContractUrl } from '@/src/infrastructure/config/midnight-config';
import { useWallet } from '@/src/presentation/context/WalletContext';
import { bech32m } from '@scure/base';
import { FungibleTokenClient } from '@/src/client/fungible-token-sdk';
import { hexToBytes, bytesToHex, addressToBytes32, addressToHex32 } from '@/src/presentation/hooks/useFungibleToken';
import type { TokenMetadata, TransactionStatus } from '@/src/types/dapp';

interface TokenActionsProps {
  contractAddress?: string;
  onResetContractState?: () => void;
  metadata: TokenMetadata;
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
}

type TabType = 'transfer' | 'approve' | 'transferFrom' | 'mint' | 'burn' | 'reallocate' | 'emergency' | 'init';

export const TokenActions: React.FC<TokenActionsProps> = ({
  contractAddress,
  onResetContractState,
  metadata,
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
}) => {
  const targetContractAddress = contractAddress || MIDNIGHT_CONFIG.contractAddress;
  const [copiedContractAddr, setCopiedContractAddr] = useState(false);
  const copyContractAddress = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedContractAddr(true);
    setTimeout(() => setCopiedContractAddr(false), 2000);
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
    if (!accountAddress) return '';
    try {
      const bytes = hexToBytes(accountAddress);
      const derived = FungibleTokenClient.deriveAccount(bytes, activeSalt);
      return bytesToHex(derived);
    } catch {
      return '';
    }
  }, [accountAddress, activeSalt]);

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
      <div className="p-3.5 rounded-xl bg-slate-950/80 border border-cyan-500/40 space-y-2.5 animate-in fade-in">
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <span className="flex h-2 w-2 relative">
              {txStatus === 'confirmed' ? (
                <span className="rounded-full h-2 w-2 bg-emerald-400" />
              ) : txStatus === 'failed' ? (
                <span className="rounded-full h-2 w-2 bg-rose-400" />
              ) : (
                <>
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-500" />
                </>
              )}
            </span>
            <span className="font-semibold text-white">
              {txStatus === 'confirmed'
                ? 'Transaction Committed On-Chain!'
                : txStatus === 'failed'
                ? 'Transaction Failed'
                : `Step ${Math.min(5, curIdx + 1)} of 5: ${statusMessage || 'Processing...'}`}
            </span>
          </div>
          <span className="text-[11px] font-mono text-cyan-400 font-bold">
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
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                    : isActive
                    ? 'bg-cyan-500/25 text-cyan-200 border border-cyan-400 shadow-sm shadow-cyan-500/20 ring-1 ring-cyan-400/40'
                    : isFailed
                    ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                    : 'bg-slate-900 text-slate-500 border border-slate-800'
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
            className="flex items-center gap-1 px-2 py-0.5 rounded bg-blue-500/10 hover:bg-blue-500/20 text-cyan-400 border border-blue-500/20 transition-colors cursor-pointer"
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
    <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl overflow-hidden backdrop-blur-xl shadow-xl">
      {/* Contract Address & Reset Bar */}
      <div className="bg-slate-950/90 border-b border-slate-800/80 px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-wrap min-w-0">
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider whitespace-nowrap">
            Contract:
          </span>
          <span
            className="font-mono text-xs text-slate-200 truncate max-w-[200px] sm:max-w-xs md:max-w-md bg-slate-900 px-2 py-0.5 rounded border border-slate-800"
            title={targetContractAddress}
          >
            {targetContractAddress}
          </span>
          <button
            type="button"
            onClick={() => copyContractAddress(targetContractAddress)}
            className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
            title="Copy Contract Address"
          >
            {copiedContractAddr ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
          </button>
          <a
            href={getExplorerContractUrl(targetContractAddress)}
            target="_blank"
            rel="noreferrer"
            className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
            title="View on Midnight Explorer"
          >
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 whitespace-nowrap">
            <span className={`w-1.5 h-1.5 rounded-full ${metadata.isInitialized ? 'bg-emerald-400' : 'bg-amber-400 animate-pulse'}`} />
            {metadata.isInitialized ? 'Initialized' : 'Uninitialized'}
          </span>
        </div>

        {onResetContractState && (
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              type="button"
              onClick={onResetContractState}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 hover:text-amber-300 border border-amber-500/30 text-xs font-semibold shadow-sm transition-all"
              title="Reset local contract state / cache (purges cache and re-syncs from on-chain)"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset Cache</span>
            </button>
          </div>
        )}
      </div>

      {/* Test Mode Active Caller Switcher Bar */}
      {mode === 'test' && (
        <div className="bg-slate-950/80 border-b border-slate-800/80 px-4 py-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-blue-500/10 text-blue-400">
              <User className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400 font-medium">Acting Caller:</span>
                <span className="text-xs font-semibold text-white">
                  {activeIdentity?.name || 'Alice'}
                </span>
                {metadata.isInitialized && (
                  metadata.isCallerOwner ? (
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                      Owner
                    </span>
                  ) : (
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                      {activeIdentity?.label || 'Trader'}
                    </span>
                  )
                )}
              </div>
              <p className="text-[10px] font-mono text-slate-500">
                {(accountAddress || PRESET_IDENTITIES[0].addressHex).slice(0, 14)}...{(accountAddress || PRESET_IDENTITIES[0].addressHex).slice(-8)}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-[11px] text-slate-400 mr-1">Switch Caller:</span>
            {PRESET_IDENTITIES.slice(0, 3).map((p) => {
              const isCurrent = (accountAddress || PRESET_IDENTITIES[0].addressHex).toLowerCase() === p.addressHex.toLowerCase();
              const isOwner = Boolean(metadata.isInitialized && metadata.owner && p.addressHex.toLowerCase() === metadata.owner.toLowerCase());
              return (
                <button
                  key={p.name}
                  type="button"
                  onClick={() => {
                    selectPresetIdentity(p);
                    setFormError(null);
                  }}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all flex items-center gap-1 ${
                    isCurrent
                      ? 'bg-blue-600 text-white font-semibold shadow-md shadow-blue-500/20 ring-1 ring-blue-400'
                      : 'bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700/60'
                  }`}
                >
                  <span>{p.name}</span>
                  {metadata.isInitialized && isOwner && (
                    <span className="text-[9px] text-emerald-300 font-semibold">
                      (Owner)
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

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
        </button>

        <button
          onClick={() => { setActiveTab('reallocate'); setFormError(null); }}
          className={`px-4 py-2.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'reallocate'
              ? 'bg-teal-600 text-white shadow-md shadow-teal-500/20'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
          }`}
        >
          <RotateCcw className="w-3.5 h-3.5" /> Reallocate / Recover
          <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">Owner</span>
        </button>

        <button
          onClick={() => { setActiveTab('emergency'); setFormError(null); }}
          className={`px-4 py-2.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'emergency'
              ? 'bg-rose-600 text-white shadow-md shadow-rose-500/20'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
          }`}
        >
          <ShieldAlert className="w-3.5 h-3.5 text-rose-400" /> Emergency
          {metadata.isPaused && (
            <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-rose-500 text-white animate-pulse">
              PAUSED
            </span>
          )}
        </button>

        <button
          onClick={() => { setActiveTab('init'); setFormError(null); }}
          className={`px-4 py-2.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'init'
              ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
          }`}
        >
          <Settings className="w-3.5 h-3.5" /> Deployment Info
        </button>
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
            <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800 text-xs flex items-center justify-between text-slate-400">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span>
                  Circuit: <span className="font-mono text-slate-200">mint(to, value)</span>
                </span>
              </div>
              <span className="text-[11px] font-mono flex items-center gap-1.5 text-slate-400">
                {metadata.isInitialized && metadata.owner ? (
                  <>
                    <span>Owner: {metadata.owner.slice(0, 6)}...{metadata.owner.slice(-4)}</span>
                    {metadata.isCallerOwner ? (
                      <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-semibold text-[10px]">
                        You
                      </span>
                    ) : (
                      <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 font-semibold text-[10px]">
                        Non-Owner
                      </span>
                    )}
                  </>
                ) : (
                  'Pending Init'
                )}
              </span>
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
            <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800 text-xs flex items-center justify-between text-slate-400">
              <div className="flex items-center gap-2">
                <Flame className="w-4 h-4 text-rose-400" />
                <span>
                  Circuit: <span className="font-mono text-slate-200">burn(caller, value)</span>
                </span>
              </div>
              <span className="text-[11px] font-mono text-slate-400">
                Holder-Authorized Circuit
              </span>
            </div>

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
            <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800 text-xs flex items-center justify-between text-slate-400">
              <div className="flex items-center gap-2">
                <RotateCcw className="w-4 h-4 text-teal-400" />
                <span>
                  Circuit: <span className="font-mono text-slate-200">adminReallocate(caller, trappedAccount, targetSpendableAccount, amount)</span>
                </span>
              </div>
              <span className="text-[11px] font-mono flex items-center gap-1.5 text-slate-400">
                {metadata.isInitialized && metadata.owner ? (
                  <>
                    <span>Owner: {metadata.owner.slice(0, 6)}...{metadata.owner.slice(-4)}</span>
                    {metadata.isCallerOwner ? (
                      <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-semibold text-[10px]">
                        You
                      </span>
                    ) : (
                      <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 font-semibold text-[10px]">
                        Non-Owner
                      </span>
                    )}
                  </>
                ) : (
                  'Pending Init'
                )}
              </span>
            </div>

            {renderOwnerAuthCard('reallocating trapped tokens')}

            <div className="p-4 rounded-xl bg-teal-500/10 border border-teal-500/30 text-xs text-teal-200 space-y-1.5">
              <div className="flex items-center gap-2 font-semibold text-teal-300">
                <ShieldCheck className="w-4 h-4 text-teal-400" />
                <span>Trap Recovery Mechanism (v2.3)</span>
              </div>
              <p className="text-slate-300 leading-relaxed text-[11px]">
                Tokens sent directly to an un-hashed raw Lace wallet address reside in <code className="text-white font-mono">_balances[rawAddress]</code> and cannot sign spending circuits because Midnight requires authorization via <code className="text-white font-mono">authenticate(persistentHash([salt, rawAddress]))</code>.
              </p>
              <p className="text-teal-200/90 leading-relaxed text-[11px]">
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
