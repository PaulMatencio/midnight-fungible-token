'use client';

import React, { useState, useMemo } from 'react';
import {
  X,
  Wallet,
  Check,
  Copy,
  ExternalLink,
  Shield,
  ArrowRight,
  AlertTriangle,
  Sparkles,
  Layers,
  Download,
  Loader2,
  Lock,
  RefreshCw,
} from 'lucide-react';
import { useWallet } from '@/src/presentation/context/WalletContext';
import { useConfig } from '@/src/presentation/context/ConfigContext';
import { MIDNIGHT_CONFIG, PRESET_IDENTITIES } from '@/src/infrastructure/config/midnight-config';
import { isWalletLockedError } from '@/src/infrastructure/midnight/midnight-dapp-connector';
import { FungibleTokenClient } from '@/src/client/fungible-token-sdk';
import { addressToBytes32, bytesToHex } from '@/src/presentation/hooks/useFungibleToken';
import type { WalletIdentity } from '@/src/types/dapp';

interface WalletModalProps {
  isOpen: boolean;
  onClose: () => void;
  userDerivedAccountHex?: string | null;
}

export const WalletModal: React.FC<WalletModalProps> = ({ isOpen, onClose, userDerivedAccountHex }) => {
  const { config } = useConfig();
  const {
    mode,
    setMode,
    isConnected,
    isSimulated,
    accountAddress,
    activeIdentity,
    isExtensionInstalled,
    installedWallets,
    isConnecting,
    connectingStatus,
    isWalletLocked,
    walletError,
    cancelConnecting,
    connectWallet,
    reconnectWallet,
    disconnectWallet,
    resetWalletSession,
    selectPresetIdentity,
    refreshBalances,
  } = useWallet();

  const [activeTab, setActiveTab] = useState<'lace' | 'test'>(mode);
  const [connectError, setConnectError] = useState<string | null>(null);
  const [copiedField, setCopiedField] = useState<'wallet' | 'spendable' | null>(null);

  const copyToClipboard = async (text: string, field: 'wallet' | 'spendable') => {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 2000);
    } catch {}
  };

  const derivedSpendable = useMemo(() => {
    if (userDerivedAccountHex) return userDerivedAccountHex;
    if (!accountAddress) return '';
    try {
      const bytes = addressToBytes32(accountAddress);
      const derived = FungibleTokenClient.deriveAccount(bytes, config?.contractSalt || MIDNIGHT_CONFIG.contractSalt);
      return bytesToHex(derived);
    } catch {
      return '';
    }
  }, [userDerivedAccountHex, accountAddress, config?.contractSalt]);

  if (!isOpen) return null;

  const handleConnectLace = async (walletId?: string) => {
    setConnectError(null);
    try {
      await connectWallet(walletId || 'mnLace');
      setMode('lace');
      onClose();
    } catch (err: any) {
      if (isWalletLockedError(err)) {
        setConnectError('Your Lace wallet is locked. Please click the Lace extension icon in your browser toolbar, enter your password, and try again.');
      } else {
        setConnectError(err.message || 'Failed to connect Lace wallet');
      }
    }
  };

  const handleSelectTestIdentity = (ident: WalletIdentity) => {
    selectPresetIdentity(ident);
    setMode('test');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-blue-500/10 text-blue-400">
              <Wallet className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-white">Midnight Wallet & Mode Manager</h3>
              <p className="text-xs text-slate-400">Switch between Lace extension and Test Mode</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-800 bg-slate-950/50">
          <button
            onClick={() => setActiveTab('lace')}
            className={`flex-1 py-3 px-4 text-xs font-semibold flex items-center justify-center gap-2 transition-all border-b-2 ${
              activeTab === 'lace'
                ? 'border-blue-500 text-blue-400 bg-blue-500/5'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-cyan-400" />
            <span>Lace Wallet Mode</span>
            {isExtensionInstalled && (
              <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                Ready
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('test')}
            className={`flex-1 py-3 px-4 text-xs font-semibold flex items-center justify-center gap-2 transition-all border-b-2 ${
              activeTab === 'test'
                ? 'border-indigo-500 text-indigo-400 bg-indigo-500/5'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            <span>Test Mode (No Wallet)</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">
              Offline
            </span>
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* TAB 1: Lace Wallet Mode */}
          {activeTab === 'lace' && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500 via-orange-500 to-amber-600 flex items-center justify-center font-bold text-white text-lg shadow-md">
                      L
                    </div>
                    <div>
                      <h4 className="text-sm font-semibold text-white flex items-center gap-2">
                        Lace Midnight Wallet
                        {isExtensionInstalled ? (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                            Detected in Browser
                          </span>
                        ) : (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-400">
                            Not Detected
                          </span>
                        )}
                      </h4>
                      <p className="text-xs text-slate-400 mt-0.5">
                        Official Midnight DApp Connector extension for Preprod & Devnet
                      </p>
                    </div>
                  </div>
                </div>

                {/* Connection button or not installed prompt */}
                {isExtensionInstalled ? (
                  <div className="mt-4 pt-3 border-t border-slate-800/80 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="text-xs text-slate-400">
                        {isConnected && !isSimulated && accountAddress ? (
                          <div className="flex items-center gap-2 text-emerald-400 font-medium">
                            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                            <span>Lace Connected</span>
                          </div>
                        ) : installedWallets.length > 0 ? (
                          <span className="text-emerald-400 font-medium">
                            {installedWallets[0].name}
                          </span>
                        ) : (
                          <span>Ready to connect</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {isConnecting && (
                          <button
                            type="button"
                            onClick={cancelConnecting}
                            className="px-3 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
                          >
                            Cancel
                          </button>
                        )}
                        {isConnected && !isSimulated ? (
                          <button
                            onClick={() => {
                              disconnectWallet();
                            }}
                            className="px-4 py-2 rounded-xl text-xs font-semibold bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/20 transition-all cursor-pointer"
                          >
                            Disconnect
                          </button>
                        ) : (
                          <button
                            disabled={isConnecting}
                            onClick={() => handleConnectLace(installedWallets[0]?.id)}
                            className="px-4 py-2 rounded-xl text-xs font-semibold bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white transition-all shadow-md shadow-blue-500/20 disabled:opacity-50 flex items-center gap-1.5"
                          >
                            {isConnecting ? (
                              <>
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                <span>Connecting...</span>
                              </>
                            ) : (
                              'Connect Lace'
                            )}
                            {!isConnecting && <ArrowRight className="w-3.5 h-3.5" />}
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Connected Wallet Addresses: My Wallet & Spendable Account with Copy */}
                    {isConnected && !isSimulated && accountAddress && (
                      <div className="p-3 rounded-xl bg-slate-900 border border-slate-800/90 space-y-2 text-xs">
                        {/* 1. My Wallet Address */}
                        <div className="p-2.5 rounded-lg bg-slate-950/80 border border-slate-800 flex items-center justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                              My Wallet Address
                            </div>
                            <div className="font-mono text-xs text-white truncate" title={accountAddress}>
                              {accountAddress}
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => copyToClipboard(accountAddress, 'wallet')}
                            className="px-2.5 py-1 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors flex-shrink-0 flex items-center gap-1.5 text-[11px] cursor-pointer"
                            title="Copy wallet address"
                          >
                            {copiedField === 'wallet' ? (
                              <>
                                <Check className="w-3.5 h-3.5 text-emerald-400" />
                                <span className="text-emerald-400 font-medium">Copied</span>
                              </>
                            ) : (
                              <>
                                <Copy className="w-3.5 h-3.5" />
                                <span>Copy</span>
                              </>
                            )}
                          </button>
                        </div>

                        {/* 2. Spendable Account Address */}
                        {derivedSpendable && (
                          <div className="p-2.5 rounded-lg bg-slate-950/80 border border-slate-800 flex items-center justify-between gap-2">
                            <div className="min-w-0 flex-1">
                              <div className="text-[10px] font-semibold text-cyan-400 uppercase tracking-wider">
                                Spendable Account (Derived)
                              </div>
                              <div className="font-mono text-xs text-cyan-200 truncate" title={derivedSpendable}>
                                {derivedSpendable}
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => copyToClipboard(derivedSpendable, 'spendable')}
                              className="px-2.5 py-1 rounded-md bg-slate-800 hover:bg-slate-700 text-cyan-300 hover:text-white transition-colors flex-shrink-0 flex items-center gap-1.5 text-[11px] cursor-pointer"
                              title="Copy spendable account hex"
                            >
                              {copiedField === 'spendable' ? (
                                <>
                                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                                  <span className="text-emerald-400 font-medium">Copied</span>
                                </>
                              ) : (
                                <>
                                  <Copy className="w-3.5 h-3.5" />
                                  <span>Copy</span>
                                </>
                              )}
                            </button>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Connecting Progress & Instructions */}
                    {isConnecting && (
                      <div className="p-3.5 rounded-xl bg-blue-500/10 border border-blue-500/30 text-xs text-blue-200 space-y-2 animate-in fade-in">
                        <div className="flex items-center gap-2 text-blue-300 font-semibold">
                          <Loader2 className="w-4 h-4 animate-spin text-blue-400 flex-shrink-0" />
                          <span>{connectingStatus || 'Connecting to Lace wallet...'}</span>
                        </div>
                        <p className="text-[11px] text-blue-200/80 leading-relaxed">
                          A Lace extension popup should appear to authorize the connection. If you do not see it:
                        </p>
                        <ul className="list-disc list-inside text-[11px] text-slate-300 space-y-1 pl-1">
                          <li>Check if the popup window opened behind your main browser window.</li>
                          <li>Click the <strong>Lace icon in your browser toolbar</strong> to unlock or approve.</li>
                          <li>Ensure popups are allowed for <code className="text-blue-300">localhost:3000</code>.</li>
                        </ul>
                      </div>
                    )}

                    {installedWallets.length > 1 && (
                      <div className="space-y-1.5 pt-2 border-t border-slate-800/50">
                        <p className="text-[11px] text-slate-400">All Detected Extensions:</p>
                        {installedWallets.map((w) => (
                          <div
                            key={w.id}
                            className="flex items-center justify-between p-2 rounded-lg bg-slate-900/60 border border-slate-800/80"
                          >
                            <div className="flex items-center gap-2">
                              <span className="w-2 h-2 rounded-full bg-cyan-400" />
                              <span className="text-xs text-white font-medium">{w.name}</span>
                              {w.apiVersion && (
                                <span className="text-[10px] text-slate-500">v{w.apiVersion}</span>
                              )}
                            </div>
                            <button
                              onClick={() => handleConnectLace(w.id)}
                              disabled={isConnecting}
                              className="px-2.5 py-1 rounded text-[11px] bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium transition-colors"
                            >
                              Connect
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="mt-4 pt-3 border-t border-slate-800/80 space-y-3">
                    <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-xs text-amber-300 flex items-start gap-2">
                      <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="font-semibold">Lace Extension Not Detected</p>
                        <p className="text-amber-200/80 mt-0.5">
                          To use live Lace mode, install the Midnight Lace extension from Chrome Web Store.
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <a
                        href="https://chromewebstore.google.com"
                        target="_blank"
                        rel="noreferrer"
                        className="flex-1 py-2 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium flex items-center justify-center gap-1.5 transition-colors"
                      >
                        <Download className="w-3.5 h-3.5" />
                        Install Lace Extension
                      </a>

                      <button
                        onClick={() => setActiveTab('test')}
                        className="flex-1 py-2 px-3 rounded-lg bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 text-xs font-medium border border-blue-500/30 flex items-center justify-center gap-1.5 transition-colors"
                      >
                        <Sparkles className="w-3.5 h-3.5 text-blue-400" />
                        Use Test Mode Instead
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {isWalletLocked && (
                <div className="p-4 rounded-xl bg-amber-500/15 border border-amber-500/40 text-xs text-amber-200 space-y-2.5">
                  <div className="flex items-center gap-2 font-semibold text-amber-300">
                    <Lock className="w-4 h-4 text-amber-400 flex-shrink-0" />
                    <span>Lace Wallet is Locked</span>
                  </div>
                  <p className="text-[11px] text-amber-200/90 leading-relaxed">
                    Midnight Lace automatically locks after 30 minutes of inactivity and invalidates connection tokens. Enter your password in the Lace extension toolbar, then click Reconnect.
                  </p>
                  <div className="flex items-center gap-2 pt-1">
                    <button
                      type="button"
                      onClick={async () => {
                        try {
                          await reconnectWallet();
                          onClose();
                        } catch {}
                      }}
                      className="px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs transition-all flex items-center gap-1.5 shadow-md shadow-amber-500/20"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span>Unlock & Reconnect Lace</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => disconnectWallet()}
                      className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs transition-colors"
                    >
                      Disconnect
                    </button>
                  </div>
                </div>
              )}

              {(() => {
                const activeError = connectError || (!isWalletLocked ? walletError : null);
                if (!activeError) return null;

                const isShutdownOrTimeout =
                  activeError.toLowerCase().includes('channel') ||
                  activeError.toLowerCase().includes('shutdown') ||
                  activeError.toLowerCase().includes('closed') ||
                  activeError.toLowerCase().includes('asleep') ||
                  activeError.toLowerCase().includes('timed out');

                if (isShutdownOrTimeout) {
                  return (
                    <div className="p-4 rounded-xl bg-amber-500/15 border border-amber-500/30 text-xs text-amber-200 space-y-3">
                      <div className="flex items-center gap-2 font-semibold text-amber-300">
                        <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0" />
                        <span>Lace Extension Background Channel Closed</span>
                      </div>
                      <p className="text-[11px] text-amber-200/90 leading-relaxed">
                        Chrome closed the background connection to Lace. To restore communication:
                      </p>
                      <ol className="list-decimal list-inside text-[11px] text-slate-300 space-y-1 pl-1">
                        <li>
                          Click the <strong>Lace icon in your browser toolbar</strong> (enter password if locked).
                        </li>
                        <li>Click <strong>Reload Webpage</strong> below.</li>
                      </ol>
                      <div className="flex flex-wrap items-center gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => {
                            if (typeof window !== 'undefined') window.location.reload();
                          }}
                          className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs transition-colors flex items-center gap-1.5 shadow-sm"
                        >
                          <RefreshCw className="w-3 h-3" />
                          <span>Reload Webpage</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            resetWalletSession();
                            setConnectError(null);
                          }}
                          className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs transition-colors"
                        >
                          Reset Stored Session
                        </button>
                        <button
                          type="button"
                          onClick={() => setActiveTab('test')}
                          className="px-3 py-1.5 rounded-lg bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 text-xs transition-colors"
                        >
                          Use Test Mode (No Wallet)
                        </button>
                      </div>
                    </div>
                  );
                }

                return (
                  <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-300 flex items-start justify-between gap-2">
                    <span>{activeError}</span>
                    <button
                      type="button"
                      onClick={() => {
                        resetWalletSession();
                        setConnectError(null);
                      }}
                      className="text-[11px] text-rose-400 hover:text-rose-200 underline whitespace-nowrap"
                    >
                      Reset Session
                    </button>
                  </div>
                );
              })()}

              {/* Troubleshooting Footer */}
              <div className="pt-2 border-t border-slate-800/60 flex items-center justify-between text-[11px] text-slate-500">
                <span>Stuck or unable to connect?</span>
                <button
                  type="button"
                  onClick={() => {
                    resetWalletSession();
                    setConnectError(null);
                  }}
                  className="text-slate-400 hover:text-cyan-400 underline transition-colors"
                >
                  Clear Stored Session
                </button>
              </div>
            </div>
          )}

          {/* TAB 2: Test Mode (No Wallet) */}
          {activeTab === 'test' && (
            <div className="space-y-4">
              <div className="p-3 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-xs text-indigo-300 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Shield className="w-4 h-4 text-indigo-400 flex-shrink-0" />
                  <span>
                    <strong>Zero-Wallet Test Simulator:</strong> Full Compact circuit testing with pre-funded identities.
                  </span>
                </div>
              </div>

              <div className="space-y-2">
                {PRESET_IDENTITIES.map((ident) => {
                  const isCurrent = isConnected && isSimulated && activeIdentity?.name === ident.name;
                  return (
                    <button
                      key={ident.name}
                      onClick={() => handleSelectTestIdentity(ident as WalletIdentity)}
                      className={`w-full text-left p-3.5 rounded-xl border transition-all flex items-center justify-between ${
                        isCurrent
                          ? 'bg-blue-600/10 border-blue-500/50 text-white shadow-sm'
                          : 'bg-slate-950/50 border-slate-800 hover:border-slate-700 text-slate-300'
                      }`}
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-white">{ident.label}</span>
                          {ident.role === 'admin' && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20 font-mono">
                              Deployer / Admin
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] font-mono text-slate-500 mt-1 truncate max-w-xs">
                          {ident.addressHex.slice(0, 18)}...{ident.addressHex.slice(-10)}
                        </p>
                      </div>

                      {isCurrent ? (
                        <div className="w-6 h-6 rounded-full bg-blue-500 flex items-center justify-center text-white">
                          <Check className="w-3.5 h-3.5" />
                        </div>
                      ) : (
                        <span className="text-xs text-blue-400 hover:text-blue-300 font-medium">
                          Switch
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Quick Links & Disconnect */}
          <div className="pt-4 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
            <a
              href={MIDNIGHT_CONFIG.faucetUrl}
              target="_blank"
              rel="noreferrer"
              className="hover:text-blue-400 flex items-center gap-1 transition-colors"
            >
              Get Preprod tNIGHT / DUST Faucet
              <ExternalLink className="w-3 h-3" />
            </a>

            {isConnected && (
              <button
                onClick={() => {
                  disconnectWallet();
                  onClose();
                }}
                className="text-rose-400 hover:text-rose-300 transition-colors"
              >
                Disconnect
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
