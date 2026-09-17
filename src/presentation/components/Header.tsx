'use client';

import React, { useState } from 'react';
import {
  Wallet,
  Sparkles,
  ExternalLink,
  Flame,
  Coins,
  Copy,
  Check,
  RefreshCw,
  SlidersHorizontal,
  LogOut,
  Loader2,
  Lock,
  Menu,
  Settings,
  Sun,
  Moon,
  X,
} from 'lucide-react';
import { useWallet } from '@/src/presentation/context/WalletContext';
import { useConfig } from '@/src/presentation/context/ConfigContext';
import { useTheme } from '@/src/presentation/context/ThemeContext';
import { PRESET_IDENTITIES } from '@/src/infrastructure/config/midnight-config';

interface HeaderProps {
  onOpenWalletModal: () => void;
  onOpenSettings?: () => void;
  onToggleMobileSidebar?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  onOpenWalletModal,
  onOpenSettings,
  onToggleMobileSidebar,
}) => {
  const {
    mode,
    setMode,
    isConnected,
    isConnecting,
    isExtensionInstalled,
    isWalletLocked,
    accountAddress,
    dustDisplay,
    tNightDisplay,
    activeIdentity,
    isSimulated,
    refreshBalances,
    connectWallet,
    reconnectWallet,
    disconnectWallet,
    resetWalletSession,
    cancelConnecting,
    selectPresetIdentity,
  } = useWallet();

  const { preset, getExplorerNetworkUrl, config } = useConfig();
  const { resolvedTheme, toggleTheme } = useTheme();

  const [copied, setCopied] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const truncateAddress = (addr: string | null) => {
    if (!addr) return '';
    if (addr.length <= 14) return addr;
    return `${addr.slice(0, 8)}...${addr.slice(-6)}`;
  };

  const copyAddress = async () => {
    if (!accountAddress) return;
    try {
      await navigator.clipboard.writeText(accountAddress);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await refreshBalances();
    setTimeout(() => setRefreshing(false), 600);
  };

  const handleDirectConnect = async () => {
    if (mode === 'lace') {
      if (!isExtensionInstalled) {
        onOpenWalletModal();
        return;
      }
      try {
        await connectWallet();
      } catch {
        onOpenWalletModal();
      }
    } else {
      selectPresetIdentity(activeIdentity || PRESET_IDENTITIES[0]);
    }
  };

  return (
    <header className="border-b border-slate-200/80 bg-white/80 dark:border-slate-800/80 dark:bg-slate-950/80 backdrop-blur-xl sticky top-0 z-40 transition-colors duration-200">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-2 sm:gap-4">
        {/* Brand & Mobile Hamburger */}
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          {onToggleMobileSidebar && (
            <button
              onClick={onToggleMobileSidebar}
              className="lg:hidden p-2 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-slate-200 dark:text-slate-400 dark:hover:text-slate-100 dark:hover:bg-slate-900 dark:border-slate-800 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500/50 flex-shrink-0"
              aria-label="Open sidebar navigation"
            >
              <Menu className="w-5 h-5" />
            </button>
          )}

          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-tr from-indigo-600 via-blue-500 to-cyan-400 p-0.5 shadow-lg shadow-indigo-500/20 shrink-0">
            <div className="w-full h-full bg-slate-50 dark:bg-slate-950 rounded-[10px] flex items-center justify-center">
              <Sparkles className="w-4 h-4 sm:w-5 sm:h-5 text-cyan-500 dark:text-cyan-400" />
            </div>
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 sm:gap-2">
              <span className="font-bold text-sm sm:text-base lg:text-lg text-slate-900 dark:text-white tracking-tight truncate">
                Midnight
              </span>
              <span className="text-[10px] sm:text-xs px-1.5 sm:px-2 py-0.5 rounded-full font-medium bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 flex-shrink-0">
                <span className="xs:hidden">ESCT</span>
                <span className="hidden xs:inline">FungibleToken</span>
              </span>
            </div>
            <p className="text-[10px] sm:text-[11px] text-slate-500 dark:text-slate-400 font-mono hidden lg:block">
              Compact ZK Smart Contract
            </p>
          </div>
        </div>

        {/* Mode Switcher & Network & Wallet Controls */}
        <div className="flex items-center gap-1.5 sm:gap-3 flex-shrink-0">
          {/* Dual Mode Switcher Pill (Desktop/Tablet; on mobile available in sidebar) */}
          <div className="hidden sm:flex items-center p-1 rounded-xl bg-slate-100 border border-slate-200 dark:bg-slate-900 dark:border-slate-800 text-xs shadow-inner">
            <button
              onClick={() => setMode('lace')}
              className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1 rounded-lg font-medium transition-all ${
                mode === 'lace'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
              }`}
              title="Switch to real Midnight Lace wallet extension mode"
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  mode === 'lace' ? 'bg-cyan-300 animate-pulse' : 'bg-slate-400 dark:bg-slate-500'
                }`}
              />
              <span className="hidden sm:inline">Lace Wallet</span>
              <span className="sm:hidden">Lace</span>
            </button>
            <button
              onClick={() => setMode('test')}
              className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1 rounded-lg font-medium transition-all ${
                mode === 'test'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
              }`}
              title="Switch to zero-wallet simulated test mode (Alice, Bob, Charlie)"
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  mode === 'test' ? 'bg-emerald-300' : 'bg-slate-400 dark:bg-slate-500'
                }`}
              />
              <span className="hidden sm:inline">Test Mode</span>
              <span className="sm:hidden">Test</span>
            </button>
          </div>

          {/* Network Badge (Clickable to open settings) */}
          <button
            onClick={onOpenSettings}
            className="hidden lg:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200/80 border border-slate-200 text-slate-700 dark:bg-slate-900/90 dark:hover:bg-slate-800/90 dark:border-slate-800 dark:text-slate-300 text-xs transition-colors group cursor-pointer"
            title="Configure Midnight Infrastructure & Endpoints"
          >
            <div
              className={`w-2 h-2 rounded-full ${
                preset === 'devnet' ? 'bg-amber-400' : 'bg-emerald-400'
              }`}
            />
            <span className="font-medium capitalize">
              {preset === 'preprod'
                ? 'Preprod'
                : preset === 'devnet'
                ? 'Devnet'
                : 'Custom'}
            </span>
            <span className="text-[10px] text-slate-400 dark:text-slate-500 group-hover:text-cyan-500 dark:group-hover:text-cyan-400 transition-colors">
              ⚙
            </span>
          </button>

          {/* Explorer Link */}
          <a
            href={getExplorerNetworkUrl()}
            target="_blank"
            rel="noreferrer"
            className="hidden xl:flex items-center p-2 rounded-xl bg-slate-100 border border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-200 dark:bg-slate-900 dark:border-slate-800 dark:text-slate-400 dark:hover:text-slate-200 dark:hover:bg-slate-800 transition-colors"
            title="Midnight Block Explorer"
          >
            <ExternalLink className="w-3.5 h-3.5" />
          </a>

          {/* Settings Trigger Icon (Hidden on mobile; accessible via Bottom Nav & Sidebar) */}
          {onOpenSettings && (
            <button
              onClick={onOpenSettings}
              className="hidden sm:flex p-2 rounded-xl bg-slate-100 border border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-200 dark:bg-slate-900 dark:border-slate-800 dark:text-slate-400 dark:hover:text-slate-200 dark:hover:bg-slate-800 transition-colors"
              title="Midnight Infrastructure Settings"
              aria-label="Infrastructure Settings"
            >
              <Settings className="w-4 h-4" />
            </button>
          )}

          {/* Theme Toggle Button */}
          <button
            onClick={toggleTheme}
            className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 dark:bg-slate-900 dark:border-slate-800 dark:text-slate-400 dark:hover:text-slate-200 dark:hover:bg-slate-800 transition-colors"
            title={`Switch to ${resolvedTheme === 'dark' ? 'Light' : 'Dark'} mode`}
            aria-label="Toggle Theme"
          >
            {resolvedTheme === 'dark' ? (
              <Sun className="w-4 h-4 text-amber-400 transition-transform hover:rotate-45 duration-300" />
            ) : (
              <Moon className="w-4 h-4 text-indigo-600 transition-transform hover:-rotate-12 duration-300" />
            )}
          </button>

          {/* Balances */}
          {isConnected && (
            <div className="hidden lg:flex items-center gap-2">
              {mode === 'lace' && isWalletLocked ? (
                <div
                  className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-amber-500/15 border border-amber-500/30 text-xs text-amber-600 dark:text-amber-300 font-medium shadow-sm"
                  title="Lace wallet is locked. Please unlock the Lace extension in your browser toolbar, then click Reconnect."
                >
                  <Lock className="w-3.5 h-3.5 text-amber-500 dark:text-amber-400" />
                  <span>Lace Locked</span>
                  <button
                    onClick={async () => {
                      try {
                        await reconnectWallet();
                      } catch {}
                    }}
                    disabled={isConnecting}
                    className="ml-1 px-2.5 py-0.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-[11px] transition-colors flex items-center gap-1 shadow-sm disabled:opacity-50"
                    title="Reconnect fresh session after unlocking Lace"
                  >
                    {isConnecting ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <RefreshCw className="w-3 h-3" />
                    )}
                    <span>Reconnect</span>
                  </button>
                </div>
              ) : (
                <>
                  <div
                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-700 dark:text-amber-300"
                    title="DUST Resource Balance"
                  >
                    <Flame className="w-3.5 h-3.5 text-amber-500 dark:text-amber-400" />
                    <span className="font-mono font-medium">{dustDisplay} DUST</span>
                  </div>

                  <div
                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-xs text-cyan-700 dark:text-cyan-300"
                    title="tNIGHT Unshielded Token Balance"
                  >
                    <Coins className="w-3.5 h-3.5 text-cyan-500 dark:text-cyan-400" />
                    <span className="font-mono font-medium">{tNightDisplay} tNIGHT</span>
                  </div>

                  {mode === 'lace' && (tNightDisplay === '0.00' || tNightDisplay === '0') && (
                    <a
                      href={config?.faucetUrl || 'https://faucet.preprod.midnight.network'}
                      target="_blank"
                      rel="noreferrer"
                      className="hidden xl:flex items-center gap-1 px-2 py-1 rounded-lg bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-500/30 text-[11px] text-cyan-700 dark:text-cyan-300 font-medium transition-colors"
                      title="Request testnet tNIGHT tokens from Midnight faucet"
                    >
                      <span>Get Faucet</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  )}

                  <button
                    onClick={handleRefresh}
                    className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-200 dark:text-slate-400 dark:hover:text-slate-200 dark:hover:bg-slate-800 transition-colors"
                    title="Refresh Balances"
                  >
                    <RefreshCw
                      className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin text-cyan-500 dark:text-cyan-400' : ''}`}
                    />
                  </button>
                </>
              )}
            </div>
          )}

          {/* Wallet Actions (Connect / Disconnect) */}
          {isConnected ? (
            <div className="flex items-center gap-2">
              {/* Account details badge / Modal trigger */}
              <div className="flex items-center bg-slate-100 border border-slate-200 dark:bg-slate-900 dark:border-slate-700/80 rounded-xl overflow-hidden shadow-sm dark:shadow-md">
                <button
                  onClick={onOpenWalletModal}
                  className="flex items-center gap-2 px-3 py-1.5 hover:bg-slate-200/80 dark:hover:bg-slate-800/80 text-slate-800 dark:text-slate-200 transition-all text-xs"
                  title="Click to view wallet details and network status"
                >
                  <Wallet className="w-3.5 h-3.5 text-cyan-500 dark:text-cyan-400" />
                  <span className="font-mono font-medium">
                    {truncateAddress(accountAddress)}
                  </span>
                  {isSimulated ? (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-500/15 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300 font-medium">
                      {activeIdentity?.name || 'Test'}
                    </span>
                  ) : isWalletLocked ? (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300 font-medium flex items-center gap-1">
                      <Lock className="w-2.5 h-2.5 text-amber-500 dark:text-amber-400" />
                      Locked
                    </span>
                  ) : (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300 font-medium flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 dark:bg-emerald-400 animate-pulse" />
                      Lace
                    </span>
                  )}
                </button>

                {accountAddress && (
                  <button
                    onClick={copyAddress}
                    className="p-1.5 border-l border-slate-200 dark:border-slate-800 text-slate-500 hover:text-slate-800 hover:bg-slate-200 dark:text-slate-400 dark:hover:text-slate-200 dark:hover:bg-slate-800 transition-colors"
                    title={copied ? 'Copied address!' : 'Copy address'}
                  >
                    {copied ? (
                      <Check className="w-3.5 h-3.5 text-emerald-500 dark:text-emerald-400" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                  </button>
                )}

                {/* Quick Disconnect Action in Pill */}
                <button
                  type="button"
                  onClick={disconnectWallet}
                  className="p-1.5 border-l border-slate-200 dark:border-slate-800 text-rose-500 hover:text-rose-700 hover:bg-rose-500/10 transition-colors"
                  title="Disconnect wallet"
                  aria-label="Disconnect wallet"
                >
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Dedicated Disconnect Button (Hidden on mobile; quick logout icon inside pill is used) */}
              <button
                type="button"
                onClick={disconnectWallet}
                className="hidden sm:flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-semibold text-rose-600 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 dark:text-rose-300 transition-all shadow-xs active:scale-95 flex-shrink-0"
                title="Disconnect wallet"
              >
                <LogOut className="w-3.5 h-3.5 text-rose-500 dark:text-rose-400" />
                <span className="hidden lg:inline">Disconnect</span>
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 sm:gap-2">
              {/* Primary Connect Wallet Button */}
              <button
                onClick={handleDirectConnect}
                disabled={isConnecting}
                className="flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-4 py-1.5 sm:py-2 rounded-xl text-xs sm:text-sm font-semibold bg-gradient-to-r from-blue-600 via-indigo-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-white shadow-lg shadow-blue-500/25 transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-60 flex-shrink-0"
              >
                {isConnecting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-white" />
                    <span className="hidden xs:inline">Connecting...</span>
                    <span className="xs:hidden">...</span>
                  </>
                ) : (
                  <>
                    <Wallet className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-cyan-200" />
                    <span className="hidden xs:inline">{mode === 'lace' ? 'Connect Wallet' : 'Connect Test'}</span>
                    <span className="xs:hidden">Connect</span>
                  </>
                )}
              </button>

              {isConnecting && (
                <button
                  type="button"
                  onClick={cancelConnecting}
                  className="p-2 rounded-xl bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-700 transition-colors"
                  title="Cancel connecting attempt"
                  aria-label="Cancel connecting"
                >
                  <X className="w-4 h-4" />
                </button>
              )}

              {/* Options / Settings Trigger */}
              <button
                onClick={onOpenWalletModal}
                className="p-2 rounded-xl bg-slate-100 border border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-200 dark:bg-slate-900 dark:border-slate-800 dark:text-slate-400 dark:hover:text-slate-200 dark:hover:bg-slate-800 transition-colors"
                title="Wallet connection settings & test identities"
              >
                <SlidersHorizontal className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

