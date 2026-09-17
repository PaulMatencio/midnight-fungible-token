'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { addressToHex32 } from '@/src/domain/entities/address.vo';
import { Header } from '@/src/presentation/components/Header';
import { Sidebar, ActiveNavTab } from '@/src/presentation/components/Sidebar';
import { MobileBottomNav } from '@/src/presentation/components/MobileBottomNav';
import { InfrastructureSettingsModal } from '@/src/presentation/components/InfrastructureSettingsModal';
import { WalletModal } from '@/src/presentation/components/WalletModal';
import { ContractOverview } from '@/src/presentation/components/ContractOverview';
import { TokenActions, TabType as ActionTabType } from '@/src/presentation/components/TokenActions';
import { DashboardView } from '@/src/presentation/components/DashboardView';
import { QueryViewer } from '@/src/presentation/components/QueryViewer';
import { AccountSharesViewer } from '@/src/presentation/components/AccountSharesViewer';
import { TransactionStepper } from '@/src/presentation/components/TransactionStepper';
import { ActivityLog, isActivityForUser } from '@/src/presentation/components/ActivityLog';
import { useFungibleToken } from '@/src/presentation/hooks/useFungibleToken';
import { useWallet } from '@/src/presentation/context/WalletContext';
import { useConfig } from '@/src/presentation/context/ConfigContext';
import { MIDNIGHT_CONFIG } from '@/src/infrastructure/config/midnight-config';
import { formatBalance } from '@/src/presentation/utils/format';
import {
  ShieldCheck,
  Loader2,
  Lock,
  RefreshCw,
  ExternalLink,
  CheckCircle2,
  XCircle,
} from 'lucide-react';

export default function HomePage() {
  const [activeTab, setActiveTab] = useState<ActiveNavTab>('dashboard');
  const [activeActionTab, setActiveActionTab] = useState<ActionTabType>('transfer');
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [isDesktopCollapsed, setIsDesktopCollapsed] = useState(false);
  const [isWalletModalOpen, setIsWalletModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);

  const handleNavigateTab = (tab: ActiveNavTab, actionFocus?: string) => {
    if (actionFocus) {
      setActiveActionTab(actionFocus as ActionTabType);
    }
    setActiveTab(tab);
  };

  const {
    accountAddress,
    mode,
    setMode,
    isConnected,
    isWalletLocked,
    connectWallet,
    reconnectWallet,
    disconnectWallet,
    isConnecting,
    activeIdentity,
    dustBalance,
    dustDisplay,
  } = useWallet();

  const {
    config,
    preset,
    diagnostics,
    isProbing,
    runDiagnostics,
    getExplorerContractUrl,
  } = useConfig();

  const {
    metadata,
    txStatus,
    currentTxHash,
    currentBlock,
    statusMessage,
    activityLog,
    infraStatus,
    indexerReport,
    isQueryingIndexer,
    synchronizedLedgerReport,
    fetchIndexerReport,
    initialize,
    transfer,
    approve,
    transferFrom,
    mint,
    burn,
    pause,
    unpause,
    setEmergencyPauser,
    emergencyWithdraw,
    adminReallocate,
    getBalanceOf,
    getRawLockedBalanceOf,
    getAllowance,
    getAllowancesForSpender,
    resetContractCache,
    clearActivityLog,
    dismissActivity,
    clearPendingActivities,
    activeActionName,
    dismissTxStatus,
    userDerivedAccountHex,
    userDerivedAccountBech32,
  } = useFungibleToken();

  // Current connected user's spendable and locked token balance
  const userBalance = accountAddress ? getBalanceOf(accountAddress) : 0n;
  const lockedRawBalance = accountAddress ? getRawLockedBalanceOf(accountAddress) : 0n;

  // Determine if the current active caller is the contract owner
  const isOwner = useMemo(() => {
    if (mode === 'test') {
      return activeIdentity?.name === 'Alice' || Boolean(metadata.isCallerOwner);
    }
    if (metadata.isCallerOwner) return true;
    if (!metadata.owner) return false;

    const cleanOwner = metadata.owner.toLowerCase().replace(/^0x/, '');
    const cleanDerived = (userDerivedAccountHex || '').toLowerCase().replace(/^0x/, '');
    if (cleanDerived && cleanDerived === cleanOwner) return true;

    if (accountAddress) {
      try {
        const rawHex = addressToHex32(accountAddress).toLowerCase().replace(/^0x/, '');
        if (rawHex === cleanOwner) return true;
      } catch {}
    }
    return false;
  }, [mode, activeIdentity, metadata.isCallerOwner, metadata.owner, userDerivedAccountHex, accountAddress]);

  // Automatically redirect non-owners away from the Executive Dashboard
  useEffect(() => {
    if (!isOwner && activeTab === 'dashboard') {
      setActiveTab('actions');
    }
  }, [isOwner, activeTab]);

  // Compute activities count strictly belonging to the connected wallet
  const userActivityCount = useMemo(() => {
    if (!accountAddress && !userDerivedAccountHex) return 0;
    return activityLog.filter((a) =>
      isActivityForUser(a, accountAddress, userDerivedAccountHex)
    ).length;
  }, [activityLog, accountAddress, userDerivedAccountHex]);

  return (
    <div className="min-h-screen flex bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100 selection:bg-blue-600 selection:text-white transition-colors duration-200">
      {/* Responsive Collapsible Sidebar */}
      <Sidebar
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        isOpenMobile={isMobileSidebarOpen}
        onCloseMobile={() => setIsMobileSidebarOpen(false)}
        isCollapsedDesktop={isDesktopCollapsed}
        onToggleCollapseDesktop={() => setIsDesktopCollapsed((prev) => !prev)}
        onOpenSettings={() => setIsSettingsModalOpen(true)}
        onOpenWalletModal={() => setIsWalletModalOpen(true)}
        isOwner={isOwner}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 min-h-screen">
        {/* Top Navbar */}
        <Header
          onOpenWalletModal={() => setIsWalletModalOpen(true)}
          onOpenSettings={isOwner ? () => setIsSettingsModalOpen(true) : undefined}
          onToggleMobileSidebar={() => setIsMobileSidebarOpen(true)}
        />

        {/* Main Workspace Body (padded bottom on mobile & tablets for sticky bottom bar) */}
        <main className="flex-1 w-full max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-6 space-y-6 pb-24 lg:pb-8">

          {/* Lace Wallet Locked Alert Banner */}
          {mode === 'lace' && isConnected && isWalletLocked && (
            <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-amber-950/70 via-amber-900/40 to-amber-950/70 border border-amber-500/50 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 text-xs text-amber-200 shadow-xl shadow-amber-950/40 animate-in fade-in">
              <div className="flex items-start sm:items-center gap-3.5">
                <div className="p-3 rounded-xl bg-amber-500/20 border border-amber-500/30 text-amber-400 flex-shrink-0 mt-0.5 sm:mt-0">
                  <Lock className="w-5 h-5" />
                </div>
                <div className="space-y-1">
                  <h4 className="font-bold text-amber-100 text-sm sm:text-base flex items-center gap-2">
                    Lace Wallet is Locked
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                      Session Inactive &gt; 30m
                    </span>
                  </h4>
                  <p className="text-amber-200/90 text-xs leading-relaxed">
                    Lace automatically revokes active connection sessions when locked. Balances and transaction signing are suspended until unlocked.
                  </p>
                  <div className="text-amber-300 font-medium text-xs pt-1 flex flex-wrap items-center gap-2">
                    <span>Step 1: Open <strong>Lace in browser toolbar</strong> and enter your password.</span>
                    <span className="text-amber-400 font-bold">→</span>
                    <span>Step 2: Click <strong>Reconnect Lace</strong> below to restore your session.</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 self-stretch sm:self-end lg:self-center flex-shrink-0">
                <button
                  onClick={async () => {
                    try {
                      await reconnectWallet();
                    } catch {}
                  }}
                  disabled={isConnecting}
                  className="flex-1 sm:flex-initial px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-slate-950 font-bold flex items-center justify-center gap-2 transition-all shadow-lg shadow-amber-500/25 active:scale-95 text-xs disabled:opacity-60 cursor-pointer"
                >
                  {isConnecting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin text-slate-950" />
                      <span>Reconnecting...</span>
                    </>
                  ) : (
                    <>
                      <RefreshCw className="w-4 h-4" />
                      <span>Reconnect Lace</span>
                    </>
                  )}
                </button>

                <button
                  onClick={() => disconnectWallet()}
                  className="px-3.5 py-2.5 rounded-xl bg-slate-900/80 hover:bg-slate-800 text-slate-300 hover:text-white font-medium border border-slate-700/60 transition-colors text-xs cursor-pointer"
                  title="Disconnect wallet session"
                >
                  Disconnect
                </button>
              </div>
            </div>
          )}



          {mode === 'test' && !isConnected && (
            <div className="p-4 rounded-2xl bg-indigo-950/20 border border-indigo-800/40 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs text-indigo-200 shadow-sm">
              <div className="flex items-center gap-2.5">
                <ShieldCheck className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                <span>
                  <strong>Test Mode Disconnected:</strong> Select a test identity (Alice, Bob, or Charlie) to simulate transactions with zero wallet requirements.
                </span>
              </div>
              <button
                onClick={() => setIsWalletModalOpen(true)}
                className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold transition-colors whitespace-nowrap shadow-md text-xs self-stretch sm:self-auto text-center cursor-pointer"
              >
                Select Test Identity
              </button>
            </div>
          )}

          {/* Stepper Status Banner */}
          <TransactionStepper
            status={txStatus}
            statusMessage={statusMessage}
            txHash={currentTxHash}
            blockHeight={currentBlock}
            actionName={activeActionName}
            onDismiss={dismissTxStatus}
          />

          {/* Tab 0: Executive Dashboard */}
          {activeTab === 'dashboard' && (
            <DashboardView
              contractAddress={config.contractAddress}
              metadata={metadata}
              userBalance={userBalance}
              lockedRawBalance={lockedRawBalance}
              accountAddress={accountAddress}
              userDerivedAccountHex={userDerivedAccountHex}
              isConnected={isConnected}
              isWalletLocked={isWalletLocked}
              synchronizedLedgerReport={synchronizedLedgerReport}
              indexerReport={indexerReport}
              activityLog={activityLog}
              infraStatus={infraStatus}
              preset={preset}
              onNavigateTab={handleNavigateTab}
              onRefreshLedger={() => fetchIndexerReport(config.contractAddress, config.indexerUrl)}
              onOpenSettings={() => setIsSettingsModalOpen(true)}
              onOpenWalletModal={() => setIsWalletModalOpen(true)}
            />
          )}

          {/* Tab 1: Interactive Circuit Actions */}
          {activeTab === 'actions' && (
            <div className="space-y-6 animate-in fade-in duration-200">
              <ContractOverview
                contractAddress={config.contractAddress}
                metadata={metadata}
                userBalance={userBalance}
                lockedRawBalance={lockedRawBalance}
                userDerivedAccountHex={userDerivedAccountHex}
                userDerivedAccountBech32={userDerivedAccountBech32}
                infraStatus={infraStatus}
                network={preset}
                onResetContractState={resetContractCache}
                variant="compact"
              />

              <TokenActions
                contractAddress={config.contractAddress}
                onResetContractState={resetContractCache}
                metadata={metadata}
                userBalance={userBalance}
                lockedRawBalance={lockedRawBalance}
                userDerivedAccountHex={userDerivedAccountHex}
                userDerivedAccountBech32={userDerivedAccountBech32}
                dustBalance={dustBalance}
                dustDisplay={dustDisplay}
                txStatus={txStatus}
                statusMessage={statusMessage}
                currentTxHash={currentTxHash}
                currentBlock={currentBlock}
                activeActionName={activeActionName}
                callerAddress={accountAddress}
                getAllowance={getAllowance}
                getAllowancesForSpender={getAllowancesForSpender}
                onTransfer={transfer}
                onApprove={approve}
                onTransferFrom={transferFrom}
                onMint={mint}
                onBurn={burn}
                onInitialize={initialize}
                onPause={pause}
                onUnpause={unpause}
                onSetEmergencyPauser={setEmergencyPauser}
                onEmergencyWithdraw={emergencyWithdraw}
                onAdminReallocate={adminReallocate}
                initialActionTab={activeActionTab}
                isOwner={isOwner}
              />
            </div>
          )}

          {/* Tab 2: Ledger State Inspection & Contract Overview */}
          {activeTab === 'ledger' && (
            <div className="space-y-6 animate-in fade-in duration-200">
              <ContractOverview
                contractAddress={config.contractAddress}
                metadata={metadata}
                userBalance={userBalance}
                lockedRawBalance={lockedRawBalance}
                infraStatus={infraStatus}
                network={preset}
                onResetContractState={resetContractCache}
              />

              {/* Midnight Indexer & Account Token Distribution */}
              <AccountSharesViewer
                report={indexerReport}
                isLoading={isQueryingIndexer}
                onRefresh={() => fetchIndexerReport(config.contractAddress, config.indexerUrl)}
                contractAddress={config.contractAddress}
                synchronizedLedgerReport={synchronizedLedgerReport}
                currentUserAddress={accountAddress}
                userDerivedAddressHex={userDerivedAccountHex}
              />

              <div className="border-t border-slate-900 pt-6">
                <div className="mb-4">
                  <h2 className="text-lg sm:text-xl font-bold text-white tracking-tight">Direct Ledger Queries</h2>
                  <p className="text-xs text-slate-400">
                    Non-state-modifying off-chain queries against current synchronized contract ledger state
                  </p>
                </div>

                <QueryViewer
                  metadata={metadata}
                  onQueryBalance={getBalanceOf}
                  onQueryAllowance={getAllowance}
                  onQueryAllowancesForSpender={getAllowancesForSpender}
                />
              </div>
            </div>
          )}

          {/* Tab 3: Activity & Audit Log */}
          {activeTab === 'activity' && (
            <div className="space-y-6 animate-in fade-in duration-200">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg sm:text-xl font-bold text-white tracking-tight">Activity & Audit Trail</h2>
                  <p className="text-xs text-slate-400">
                    Chronological ledger executions, transactions, and state updates
                  </p>
                </div>
                <span className="text-xs text-slate-400 font-mono">
                  {accountAddress ? `${userActivityCount} events for wallet` : 'No connected account'}
                </span>
              </div>

              <ActivityLog
                activities={activityLog}
                activeContractAddress={config?.contractAddress || MIDNIGHT_CONFIG.contractAddress}
                currentUserAddress={accountAddress}
                userDerivedAddressHex={userDerivedAccountHex}
                isOwner={isOwner}
                onClearActivities={clearActivityLog}
                onDismissActivity={dismissActivity}
                onClearPendingActivities={clearPendingActivities}
              />
            </div>
          )}

          {/* Tab 4: Infrastructure & Diagnostics */}
          {activeTab === 'diagnostics' && (
            <div className="space-y-6 animate-in fade-in duration-200">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg sm:text-xl font-bold text-white tracking-tight">Midnight Infrastructure Health</h2>
                  <p className="text-xs text-slate-400">
                    Real-time connectivity and latency probes to Midnight services
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => runDiagnostics()}
                    disabled={isProbing}
                    className="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-medium text-xs flex items-center gap-2 transition-colors shadow-md shadow-blue-500/20 disabled:opacity-60"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isProbing ? 'animate-spin' : ''}`} />
                    <span>{isProbing ? 'Testing Probes...' : 'Test All Services'}</span>
                  </button>
                  <button
                    onClick={() => setIsSettingsModalOpen(true)}
                    className="px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 text-xs font-medium transition-colors"
                  >
                    Edit Endpoints
                  </button>
                </div>
              </div>

              {/* Service Probe Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Proof Server */}
                <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800/80 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-400 font-medium">Proof Server</span>
                    {diagnostics.proofServer?.status === 'checking' && (
                      <Loader2 className="w-4 h-4 text-blue-400 animate-spin" />
                    )}
                    {diagnostics.proofServer?.status === 'healthy' && (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    )}
                    {diagnostics.proofServer?.status === 'unreachable' && (
                      <XCircle className="w-4 h-4 text-rose-400" />
                    )}
                  </div>
                  <div className="text-sm font-bold text-white">
                    {diagnostics.proofServer?.latencyMs !== undefined
                      ? `${diagnostics.proofServer.latencyMs}ms latency`
                      : diagnostics.proofServer?.status || 'Ready'}
                  </div>
                  <p className="text-[11px] font-mono text-slate-400 truncate" title={config.proofServerUrl}>
                    {config.proofServerUrl}
                  </p>
                </div>

                {/* Indexer HTTP */}
                <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800/80 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-400 font-medium">Indexer GraphQL</span>
                    {diagnostics.indexer?.status === 'checking' && (
                      <Loader2 className="w-4 h-4 text-blue-400 animate-spin" />
                    )}
                    {diagnostics.indexer?.status === 'healthy' && (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    )}
                    {diagnostics.indexer?.status === 'unreachable' && (
                      <XCircle className="w-4 h-4 text-rose-400" />
                    )}
                  </div>
                  <div className="text-sm font-bold text-white">
                    {diagnostics.indexer?.latencyMs !== undefined
                      ? `${diagnostics.indexer.latencyMs}ms latency`
                      : diagnostics.indexer?.status || 'Ready'}
                  </div>
                  <p className="text-[11px] font-mono text-slate-400 truncate" title={config.indexerUrl}>
                    {config.indexerUrl}
                  </p>
                </div>

                {/* Node RPC */}
                <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800/80 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-400 font-medium">Node RPC</span>
                    {diagnostics.nodeRpc?.status === 'checking' && (
                      <Loader2 className="w-4 h-4 text-blue-400 animate-spin" />
                    )}
                    {diagnostics.nodeRpc?.status === 'healthy' && (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    )}
                    {diagnostics.nodeRpc?.status === 'unreachable' && (
                      <XCircle className="w-4 h-4 text-rose-400" />
                    )}
                  </div>
                  <div className="text-sm font-bold text-white">
                    {diagnostics.nodeRpc?.latencyMs !== undefined
                      ? `${diagnostics.nodeRpc.latencyMs}ms latency`
                      : diagnostics.nodeRpc?.status || 'Ready'}
                  </div>
                  <p className="text-[11px] font-mono text-slate-400 truncate" title={config.nodeUrl}>
                    {config.nodeUrl}
                  </p>
                </div>

                {/* Explorer */}
                <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800/80 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-400 font-medium">Block Explorer</span>
                    <a
                      href={config.explorerUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-slate-400 hover:text-cyan-400 transition-colors"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </div>
                  <div className="text-sm font-bold text-white">
                    {diagnostics.explorer?.latencyMs !== undefined
                      ? `${diagnostics.explorer.latencyMs}ms latency`
                      : diagnostics.explorer?.status || 'Ready'}
                  </div>
                  <p className="text-[11px] font-mono text-slate-400 truncate" title={config.explorerUrl}>
                    {config.explorerUrl}
                  </p>
                </div>
              </div>

              {/* Deployment Details & Explorer links */}
              <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800/80 space-y-3">
                <h3 className="text-sm font-bold text-white">Contract Deployment Info</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div>
                    <span className="text-slate-400 block mb-1">Contract Address:</span>
                    <div className="flex items-center gap-2">
                      <code className="font-mono text-cyan-300 bg-slate-950 px-2 py-1 rounded-lg border border-slate-800 break-all text-[11px]">
                        {config.contractAddress}
                      </code>
                      <a
                        href={getExplorerContractUrl(config.contractAddress)}
                        target="_blank"
                        rel="noreferrer"
                        className="p-1.5 rounded-lg bg-slate-800 text-slate-300 hover:text-white transition-colors"
                        title="View on Explorer"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    </div>
                  </div>

                  <div>
                    <span className="text-slate-400 block mb-1">Active Preset:</span>
                    <div className="flex items-center gap-2">
                      <span className="px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 capitalize font-mono text-[11px]">
                        {preset}
                      </span>
                      {config.faucetUrl && (
                        <a
                          href={config.faucetUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="px-2.5 py-1 rounded-lg bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border border-blue-500/30 font-medium text-[11px] flex items-center gap-1 transition-colors"
                        >
                          <span>Faucet</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </main>

        {/* Footer */}
        <footer className="border-t border-slate-900 bg-slate-950/80 py-5 text-center text-xs text-slate-500 font-mono hidden lg:block">
          <p>Midnight Network • Compact Runtime • Progressive React 19 / Next.js DApp Client</p>
        </footer>
      </div>

      {/* Mobile Sticky Bottom Navigation */}
      <MobileBottomNav
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        onOpenSettings={() => setIsSettingsModalOpen(true)}
        isOwner={isOwner}
      />

      {/* Infrastructure Configuration Modal */}
      <InfrastructureSettingsModal
        isOpen={isSettingsModalOpen}
        onClose={() => setIsSettingsModalOpen(false)}
      />

      {/* Wallet Connection Modal */}
      <WalletModal
        isOpen={isWalletModalOpen}
        onClose={() => setIsWalletModalOpen(false)}
        userDerivedAccountHex={userDerivedAccountHex}
      />
    </div>
  );
}

