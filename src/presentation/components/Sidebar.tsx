'use client';

import React from 'react';
import {
  Sparkles,
  Zap,
  Layers,
  Database,
  History,
  Server,
  Settings,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  Wallet,
  ShieldCheck,
  Copy,
  Check,
  X,
  Flame,
  Radio,
  Coins,
} from 'lucide-react';
import { useWallet } from '@/src/presentation/context/WalletContext';
import { useConfig } from '@/src/presentation/context/ConfigContext';

export type ActiveNavTab = 'actions' | 'ledger' | 'activity' | 'diagnostics';

interface SidebarProps {
  activeTab: ActiveNavTab;
  onSelectTab: (tab: ActiveNavTab) => void;
  isOpenMobile: boolean;
  onCloseMobile: () => void;
  isCollapsedDesktop: boolean;
  onToggleCollapseDesktop: () => void;
  onOpenSettings: () => void;
  onOpenWalletModal: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  onSelectTab,
  isOpenMobile,
  onCloseMobile,
  isCollapsedDesktop,
  onToggleCollapseDesktop,
  onOpenSettings,
  onOpenWalletModal,
}) => {
  const {
    mode,
    isConnected,
    accountAddress,
    tNightDisplay,
    dustDisplay,
    activeIdentity,
    isWalletLocked,
  } = useWallet();

  const { config, preset, diagnostics, getExplorerNetworkUrl } = useConfig();
  const [copiedAddr, setCopiedAddr] = React.useState(false);

  const copyAddress = async () => {
    if (!accountAddress) return;
    try {
      await navigator.clipboard.writeText(accountAddress);
      setCopiedAddr(true);
      setTimeout(() => setCopiedAddr(false), 2000);
    } catch {}
  };

  const navItems = [
    {
      id: 'actions' as ActiveNavTab,
      label: 'Circuits & Actions',
      subtext: 'Mint, Transfer, Burn',
      icon: Zap,
      color: 'text-amber-400',
      bg: 'group-hover:bg-amber-500/10',
    },
    {
      id: 'ledger' as ActiveNavTab,
      label: 'Ledger & Shares',
      subtext: 'Holders & Account Shares',
      icon: Database,
      color: 'text-blue-400',
      bg: 'group-hover:bg-blue-500/10',
    },
    {
      id: 'activity' as ActiveNavTab,
      label: 'Audit & Activity Log',
      subtext: 'Transaction History',
      icon: History,
      color: 'text-purple-400',
      bg: 'group-hover:bg-purple-500/10',
    },
    {
      id: 'diagnostics' as ActiveNavTab,
      label: 'Infrastructure & Nodes',
      subtext: 'Probes & Indexer Health',
      icon: Server,
      color: 'text-cyan-400',
      bg: 'group-hover:bg-cyan-500/10',
    },
  ];

  const sidebarContent = (
    <div className="flex flex-col h-full bg-slate-950 border-r border-slate-800/80 text-slate-200">
      {/* Brand Header */}
      <div className="p-4 sm:p-5 flex items-center justify-between border-b border-slate-800/70">
        <div className="flex items-center gap-3 overflow-hidden">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 via-blue-500 to-cyan-400 p-0.5 shadow-lg shadow-indigo-500/20 flex-shrink-0">
            <div className="w-full h-full bg-slate-950 rounded-[10px] flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-cyan-400" />
            </div>
          </div>
          {(!isCollapsedDesktop || isOpenMobile) && (
            <div className="overflow-hidden">
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-sm text-white tracking-tight truncate">
                  Midnight Token
                </span>
                <span className="text-[9px] font-semibold px-1.5 py-0.2 rounded bg-blue-500/20 text-blue-300 uppercase">
                  DApp
                </span>
              </div>
              <p className="text-[11px] text-slate-400 truncate">Compact Fungible Token</p>
            </div>
          )}
        </div>

        {/* Mobile Close Button */}
        <button
          type="button"
          onClick={onCloseMobile}
          className="md:hidden p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Desktop Collapse Toggle */}
        <button
          type="button"
          onClick={onToggleCollapseDesktop}
          className="hidden md:flex p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          title={isCollapsedDesktop ? 'Expand Sidebar' : 'Collapse Sidebar'}
        >
          {isCollapsedDesktop ? (
            <ChevronRight className="w-4 h-4" />
          ) : (
            <ChevronLeft className="w-4 h-4" />
          )}
        </button>
      </div>

      {/* Navigation Links */}
      <div className="flex-1 py-4 px-3 space-y-1.5 overflow-y-auto custom-scrollbar">
        {(!isCollapsedDesktop || isOpenMobile) && (
          <div className="px-3 pb-2 text-[10px] font-bold uppercase tracking-wider text-slate-500">
            Navigation
          </div>
        )}

        {navItems.map((item) => {
          const isActive = activeTab === item.id;
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                onSelectTab(item.id);
                onCloseMobile();
              }}
              title={item.label}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all group ${
                isActive
                  ? 'bg-blue-600/15 border border-blue-500/30 text-white shadow-sm shadow-blue-500/10'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900 border border-transparent'
              }`}
            >
              <div
                className={`p-2 rounded-lg transition-colors ${
                  isActive ? 'bg-blue-500/20 text-blue-400' : `${item.color} bg-slate-900 ${item.bg}`
                }`}
              >
                <Icon className="w-4 h-4" />
              </div>

              {(!isCollapsedDesktop || isOpenMobile) && (
                <div className="overflow-hidden flex-1">
                  <div className="font-semibold text-xs text-white group-hover:text-cyan-300 transition-colors truncate">
                    {item.label}
                  </div>
                  <div className="text-[10px] text-slate-500 truncate">{item.subtext}</div>
                </div>
              )}
            </button>
          );
        })}

        {/* Settings Action Button in nav */}
        <button
          type="button"
          onClick={() => {
            onOpenSettings();
            onCloseMobile();
          }}
          title="Infrastructure Settings"
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all text-slate-400 hover:text-slate-200 hover:bg-slate-900 border border-transparent"
        >
          <div className="p-2 rounded-lg bg-slate-900 text-cyan-400 group-hover:bg-cyan-500/10">
            <Settings className="w-4 h-4" />
          </div>
          {(!isCollapsedDesktop || isOpenMobile) && (
            <div className="overflow-hidden flex-1">
              <div className="font-semibold text-xs text-white truncate">Settings & Config</div>
              <div className="text-[10px] text-slate-500 truncate">Endpoints & Live Probes</div>
            </div>
          )}
        </button>
      </div>

      {/* Connected Wallet & Status Card */}
      <div className="p-3 border-t border-slate-800/80 space-y-3">
        {(!isCollapsedDesktop || isOpenMobile) ? (
          <div className="p-3 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-2.5">
            {/* Identity line */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <div
                  className={`w-2 h-2 rounded-full ${
                    isConnected
                      ? isWalletLocked
                        ? 'bg-amber-400 animate-pulse'
                        : 'bg-emerald-400 shadow-sm shadow-emerald-400/50'
                      : 'bg-slate-500'
                  }`}
                />
                <span className="text-[11px] font-bold text-white uppercase tracking-wider">
                  {mode === 'lace' ? 'Lace Wallet' : 'Test Mode'}
                </span>
              </div>
              <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 uppercase">
                {preset}
              </span>
            </div>

            {/* Address */}
            {accountAddress ? (
              <div className="flex items-center justify-between text-[11px] font-mono text-slate-400 bg-slate-950/60 px-2.5 py-1.5 rounded-lg">
                <span className="truncate max-w-[140px]" title={accountAddress}>
                  {accountAddress.slice(0, 8)}...{accountAddress.slice(-6)}
                </span>
                <button
                  type="button"
                  onClick={copyAddress}
                  className="text-slate-400 hover:text-white"
                  title="Copy Address"
                >
                  {copiedAddr ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={onOpenWalletModal}
                className="w-full py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold text-[11px] transition-colors"
              >
                Connect Wallet
              </button>
            )}

            {/* Balance Gauges */}
            {isConnected && (
              <div className="grid grid-cols-2 gap-1.5 text-[10px] font-mono pt-1">
                <div className="bg-slate-950/40 p-1.5 rounded-lg border border-slate-800/60">
                  <div className="text-slate-500 text-[9px] flex items-center gap-1">
                    <Coins className="w-2.5 h-2.5 text-blue-400" /> tNIGHT
                  </div>
                  <div className="font-bold text-slate-200 truncate">{tNightDisplay}</div>
                </div>
                <div className="bg-slate-950/40 p-1.5 rounded-lg border border-slate-800/60">
                  <div className="text-slate-500 text-[9px] flex items-center gap-1">
                    <Flame className="w-2.5 h-2.5 text-amber-400" /> DUST
                  </div>
                  <div className="font-bold text-slate-200 truncate">{dustDisplay}</div>
                </div>
              </div>
            )}
          </div>
        ) : (
          /* Collapsed Desktop Icon */
          <div className="flex flex-col items-center gap-2">
            <button
              type="button"
              onClick={onOpenWalletModal}
              className={`p-2 rounded-xl border transition-colors ${
                isConnected
                  ? 'bg-blue-600/20 border-blue-500/40 text-blue-300'
                  : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
              }`}
              title={isConnected ? `Connected: ${accountAddress}` : 'Connect Wallet'}
            >
              <Wallet className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Live Infrastructure Dot Pill */}
        {(!isCollapsedDesktop || isOpenMobile) && (
          <div className="flex items-center justify-between text-[11px] text-slate-400 px-1 pt-1">
            <div className="flex items-center gap-1.5">
              <Radio className="w-3 h-3 text-emerald-400 animate-pulse" />
              <span>Nodes Live</span>
            </div>
            <a
              href={getExplorerNetworkUrl()}
              target="_blank"
              rel="noreferrer"
              className="text-slate-400 hover:text-cyan-400 transition-colors flex items-center gap-1 text-[10px]"
            >
              <span>Explorer</span>
              <ExternalLink className="w-2.5 h-2.5" />
            </a>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile Slide-over Drawer Backdrop */}
      {isOpenMobile && (
        <div
          className="fixed inset-0 z-40 bg-slate-950/80 backdrop-blur-sm md:hidden transition-opacity"
          onClick={onCloseMobile}
        />
      )}

      {/* Mobile Slide-over Drawer */}
      <div
        className={`fixed inset-y-0 left-0 z-50 w-72 md:hidden transform transition-transform duration-300 ease-in-out ${
          isOpenMobile ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {sidebarContent}
      </div>

      {/* Desktop Fixed Sidebar */}
      <aside
        className={`hidden md:block flex-shrink-0 transition-all duration-300 sticky top-0 h-screen z-30 ${
          isCollapsedDesktop ? 'w-20' : 'w-64'
        }`}
      >
        {sidebarContent}
      </aside>
    </>
  );
};
