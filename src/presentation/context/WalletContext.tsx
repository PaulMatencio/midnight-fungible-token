'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import {
  isMidnightExtensionInstalled,
  detectInstalledWallets,
  connectLaceWallet,
  fetchExtensionWalletBalances,
  getLaceAccountAddress,
  withTimeout,
  isWalletLockedError,
  isChannelShutdownError,
  type InstalledWallet,
  type ExtensionWalletBalances,
} from '@/src/infrastructure/midnight/midnight-dapp-connector';
import { MIDNIGHT_CONFIG, PRESET_IDENTITIES } from '@/src/infrastructure/config/midnight-config';
import type { WalletIdentity } from '@/src/types/dapp';

export type AppMode = 'lace' | 'test';

export interface WalletContextType {
  mode: AppMode;
  setMode: (mode: AppMode) => void;
  isConnected: boolean;
  isExtensionInstalled: boolean;
  installedWallets: InstalledWallet[];
  isSimulated: boolean;
  accountAddress: string | null;
  dustBalance: bigint | null;
  dustDisplay: string;
  tNightBalance: bigint | null;
  tNightDisplay: string;
  networkId: string;
  activeIdentity: WalletIdentity | null;
  extensionApi: any | null;
  isConnecting: boolean;
  connectingStatus: string | null;
  isWalletLocked: boolean;
  walletError: string | null;
  cancelConnecting: () => void;
  connectWallet: (walletName?: string) => Promise<void>;
  reconnectWallet: (walletName?: string) => Promise<void>;
  disconnectWallet: () => void;
  selectPresetIdentity: (identity: WalletIdentity) => void;
  refreshBalances: () => Promise<void>;
}

const WalletContext = createContext<WalletContextType | undefined>(undefined);

const STORAGE_KEYS = {
  MODE: 'midnight_app_mode',
  CONNECTED: 'midnight_wallet_connected',
  WALLET_ID: 'midnight_connected_wallet_id',
  IDENTITY_NAME: 'midnight_active_identity_name',
  LAST_ADDRESS: 'midnight_last_address',
} as const;

const getStorageItem = (key: string): string | null => {
  if (typeof window === 'undefined' || !window.localStorage) return null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
};

const setStorageItem = (key: string, val: string): void => {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    window.localStorage.setItem(key, val);
  } catch {}
};

const removeStorageItem = (key: string): void => {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    window.localStorage.removeItem(key);
  } catch {}
};

export const WalletProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Mode: 'lace' for real Lace Midnight wallet, 'test' for zero-wallet simulated test identities
  const [mode, setModeState] = useState<AppMode>('lace');
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [isExtensionInstalled, setIsExtensionInstalled] = useState<boolean>(false);
  const [installedWallets, setInstalledWallets] = useState<InstalledWallet[]>([]);
  const [accountAddress, setAccountAddress] = useState<string | null>(null);
  const [dustBalance, setDustBalance] = useState<bigint | null>(null);
  const [dustDisplay, setDustDisplay] = useState<string>('0.00');
  const [tNightBalance, setTNightBalance] = useState<bigint | null>(null);
  const [tNightDisplay, setTNightDisplay] = useState<string>('0.00');
  const [networkId, setNetworkId] = useState<string>(MIDNIGHT_CONFIG.networkId);
  const [activeIdentity, setActiveIdentity] = useState<WalletIdentity | null>(null);
  const [isConnecting, setIsConnecting] = useState<boolean>(false);
  const [connectingStatus, setConnectingStatus] = useState<string | null>(null);
  const [isWalletLocked, setIsWalletLocked] = useState<boolean>(false);
  const [walletError, setWalletError] = useState<string | null>(null);

  const extensionApiRef = useRef<any | null>(null);
  const isCancelledRef = useRef<boolean>(false);
  const isAutoReconnectingRef = useRef<boolean>(false);

  const cancelConnecting = useCallback(() => {
    isCancelledRef.current = true;
    setIsConnecting(false);
    setConnectingStatus(null);
  }, []);

  // Background auto-reconnect function for returning users
  const performAutoReconnect = useCallback(async (walletId: string) => {
    if (isAutoReconnectingRef.current) return;
    isAutoReconnectingRef.current = true;

    try {
      // Allow up to 1.8s for extension injection if page just loaded
      let attempts = 0;
      while (!isMidnightExtensionInstalled() && attempts < 6) {
        await new Promise((r) => setTimeout(r, 300));
        attempts++;
      }

      if (!isMidnightExtensionInstalled()) {
        console.log('[WalletContext] Lace extension not present for auto-reconnect.');
        isAutoReconnectingRef.current = false;
        return;
      }

      const targetNetwork = MIDNIGHT_CONFIG.networkId || 'preprod';
      console.log(`[WalletContext] Silently reconnecting to Lace wallet (${walletId})...`);

      const api = await connectLaceWallet(walletId, targetNetwork, undefined, { timeoutMs: 5000 });
      if (api) {
        extensionApiRef.current = api;
        setIsConnected(true);
        setModeState('lace');

        // Resolve and update address
        const resolvedAddress = await getLaceAccountAddress(api);
        if (resolvedAddress) {
          setAccountAddress(resolvedAddress);
          setStorageItem(STORAGE_KEYS.LAST_ADDRESS, resolvedAddress);
          setActiveIdentity({
            name: 'Lace Midnight Wallet',
            label: 'Connected via Lace Extension',
            addressHex: resolvedAddress,
            role: 'user',
          });
        }

        // Fetch balances
        const balances = await fetchExtensionWalletBalances(api);
        const locked = Boolean(balances.isLocked);
        setIsWalletLocked(locked);
        if (locked) {
          setWalletError(balances.errorMessage || 'Lace wallet is locked. Please click the Lace extension icon in your browser toolbar to unlock it.');
        } else {
          setWalletError(null);
          setDustBalance(BigInt(balances.dustBalance || '0'));
          setDustDisplay(balances.dustDisplay);
          setTNightBalance(BigInt(balances.tNightBalance || '0'));
          setTNightDisplay(balances.tNightDisplay);
        }
        console.log('[WalletContext] Auto-reconnected to Lace successfully!');
      }
    } catch (err: any) {
      console.warn('[WalletContext] Auto-reconnect notice:', err?.message || err);
      if (isWalletLockedError(err)) {
        setIsWalletLocked(true);
        setWalletError('Lace wallet is locked. Please click the Lace extension icon in your browser toolbar to unlock it.');
      } else if (
        isChannelShutdownError(err) ||
        err?.message?.toLowerCase().includes('context invalidated')
      ) {
        setWalletError('Lace extension was reloaded in Chrome. Please refresh this browser tab (F5) to reconnect.');
      } else if (
        err?.name === 'PermissionRejected' ||
        err?.message?.toLowerCase().includes('reject') ||
        err?.message?.toLowerCase().includes('denied')
      ) {
        setIsConnected(false);
        setStorageItem(STORAGE_KEYS.CONNECTED, 'false');
      }
    } finally {
      isAutoReconnectingRef.current = false;
    }
  }, []);

  // Restore persisted session & check extensions on mount
  useEffect(() => {
    const scanExtensions = () => {
      const installed = isMidnightExtensionInstalled();
      setIsExtensionInstalled(installed);
      const wallets = detectInstalledWallets();
      setInstalledWallets(wallets);
      return installed;
    };

    scanExtensions();

    // Check saved mode & connection status from previous session
    const savedMode = getStorageItem(STORAGE_KEYS.MODE) as AppMode | null;
    const wasConnected = getStorageItem(STORAGE_KEYS.CONNECTED) === 'true';
    const savedWalletId = getStorageItem(STORAGE_KEYS.WALLET_ID) || 'mnLace';
    const savedAddress = getStorageItem(STORAGE_KEYS.LAST_ADDRESS);
    const savedIdentityName = getStorageItem(STORAGE_KEYS.IDENTITY_NAME);

    if (savedMode === 'lace') {
      setModeState('lace');
      if (wasConnected) {
        setIsConnected(true);
        if (savedAddress) {
          setAccountAddress(savedAddress);
          setActiveIdentity({
            name: 'Lace Midnight Wallet',
            label: 'Connected via Lace Extension',
            addressHex: savedAddress,
            role: 'user',
          });
        }
        // Seamlessly re-establish API in the background
        performAutoReconnect(savedWalletId);
      } else {
        setIsConnected(false);
        setAccountAddress(null);
        setActiveIdentity(null);
      }
    } else if (savedMode === 'test') {
      setModeState('test');
      if (wasConnected) {
        setIsConnected(true);
        const matched =
          PRESET_IDENTITIES.find((p) => p.name === savedIdentityName) || PRESET_IDENTITIES[0];
        setActiveIdentity(matched);
        setAccountAddress(matched.addressHex);
      } else {
        setIsConnected(false);
        setAccountAddress(null);
        setActiveIdentity(null);
      }
    } else {
      // First visit: Default to Lace mode, disconnected
      setModeState('lace');
      setIsConnected(false);
      setAccountAddress(null);
      setActiveIdentity(null);
    }

    // Secondary scan after extension finishes asynchronous script injection
    const t1 = setTimeout(scanExtensions, 500);
    const t2 = setTimeout(scanExtensions, 1500);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [performAutoReconnect]);

  // Refresh balances based on active mode
  // If the wallet was locked or channel was shut down, automatically tries to re-acquire fresh API from Lace
  const refreshBalances = useCallback(async () => {
    if (mode === 'lace') {
      const walletId = getStorageItem(STORAGE_KEYS.WALLET_ID) || 'mnLace';
      const targetNetwork = MIDNIGHT_CONFIG.networkId || 'preprod';
      let api = extensionApiRef.current;

      // If marked locked or no API exists, attempt silent re-acquisition of fresh ConnectedAPI
      if (!api || isWalletLocked) {
        try {
          console.log('[WalletContext] Attempting silent re-acquisition of Lace API...');
          const freshApi = await connectLaceWallet(walletId, targetNetwork, undefined, { timeoutMs: 3500 });
          if (freshApi) {
            api = freshApi;
            extensionApiRef.current = freshApi;
            const resolvedAddress = await getLaceAccountAddress(freshApi);
            if (resolvedAddress) setAccountAddress(resolvedAddress);
          }
        } catch (connErr: any) {
          if (isWalletLockedError(connErr)) {
            setIsWalletLocked(true);
            setWalletError('Lace wallet is locked. Please enter your password in the Lace extension toolbar, then click Reconnect.');
            return;
          }
          if (isChannelShutdownError(connErr)) {
            console.warn('[WalletContext] Lace channel shutdown during API re-acquisition.');
            return;
          }
        }
      }

      if (!api) return;

      try {
        let balances: ExtensionWalletBalances = await fetchExtensionWalletBalances(api);

        // Handle channel shutdown: previous background channel closed (e.g. idle service worker)
        if (balances.isChannelShutdown) {
          console.log('[WalletContext] Detected Lace channel shutdown during balance query; re-acquiring fresh ConnectedAPI...');
          extensionApiRef.current = null;
          try {
            const freshApi = await connectLaceWallet(walletId, targetNetwork, undefined, { timeoutMs: 3500 });
            if (freshApi) {
              api = freshApi;
              extensionApiRef.current = freshApi;
              balances = await fetchExtensionWalletBalances(freshApi);
            }
          } catch (reconnErr: any) {
            if (isChannelShutdownError(reconnErr)) {
              console.warn('[WalletContext] Channel still shut down on re-acquisition attempt.');
              return;
            }
          }
        }

        // If query failed with locked, previous session handle was invalidated. Try re-acquiring fresh API once:
        if (balances.isLocked) {
          try {
            console.log('[WalletContext] Existing API handle reported locked; requesting fresh ConnectedAPI...');
            const freshApi = await connectLaceWallet(walletId, targetNetwork, undefined, { timeoutMs: 3500 });
            if (freshApi) {
              api = freshApi;
              extensionApiRef.current = freshApi;
              balances = await fetchExtensionWalletBalances(freshApi);
            }
          } catch (reconnErr: any) {
            if (isWalletLockedError(reconnErr)) {
              setIsWalletLocked(true);
              setWalletError('Lace wallet is locked. Please click the Lace extension icon in your browser toolbar, enter your password, then click Reconnect.');
              return;
            }
          }
        }

        const locked = Boolean(balances.isLocked);
        setIsWalletLocked(locked);
        if (locked) {
          setWalletError(balances.errorMessage || 'Lace wallet is locked. Please click the Lace extension icon in your browser toolbar to unlock it.');
        } else if (!balances.isChannelShutdown) {
          setWalletError(null);
          setDustBalance(BigInt(balances.dustBalance || '0'));
          setDustDisplay(balances.dustDisplay);
          setTNightBalance(BigInt(balances.tNightBalance || '0'));
          setTNightDisplay(balances.tNightDisplay);
        }
      } catch (err: any) {
        console.warn('[WalletContext] Failed to refresh Lace balances:', err);
        if (isChannelShutdownError(err)) {
          console.warn('[WalletContext] Caught channel shutdown error in refreshBalances; resetting stale API handle.');
          extensionApiRef.current = null;
          const walletId = getStorageItem(STORAGE_KEYS.WALLET_ID) || 'mnLace';
          performAutoReconnect(walletId);
        } else if (isWalletLockedError(err)) {
          setIsWalletLocked(true);
          setWalletError('Lace wallet is locked. Please click the Lace extension icon in your browser toolbar to unlock it.');
        }
      }
    } else if (mode === 'test' && activeIdentity) {
      setIsWalletLocked(false);
      setWalletError(null);
      setDustBalance(50_000_000_000_000_000n);
      setDustDisplay('50.00');
      setTNightBalance(1_000_000_000n);
      setTNightDisplay('1,000.00');
    }
  }, [mode, isWalletLocked, activeIdentity, performAutoReconnect]);

  // Explicit Reconnect Wallet
  // Cleanly drops any stale session and requests a fresh authorization from Lace
  const reconnectWallet = useCallback(
    async (walletName: string = getStorageItem(STORAGE_KEYS.WALLET_ID) || 'mnLace') => {
      isCancelledRef.current = false;
      setIsConnecting(true);
      setConnectingStatus('Reconnecting to Lace extension...');
      setWalletError(null);

      try {
        const targetNetwork = MIDNIGHT_CONFIG.networkId || 'preprod';
        console.log(`[WalletContext] Re-acquiring fresh session for Lace (${walletName})...`);

        const api = await connectLaceWallet(walletName, targetNetwork, (st) => {
          if (!isCancelledRef.current) setConnectingStatus(st);
        }, { timeoutMs: 15000 });

        if (isCancelledRef.current) return;

        extensionApiRef.current = api;
        setIsConnected(true);
        setModeState('lace');
        setStorageItem(STORAGE_KEYS.MODE, 'lace');
        setStorageItem(STORAGE_KEYS.CONNECTED, 'true');
        setStorageItem(STORAGE_KEYS.WALLET_ID, walletName);

        const resolvedAddress = await getLaceAccountAddress(api);
        if (resolvedAddress && !isCancelledRef.current) {
          setAccountAddress(resolvedAddress);
          setStorageItem(STORAGE_KEYS.LAST_ADDRESS, resolvedAddress);
          setActiveIdentity({
            name: 'Lace Midnight Wallet',
            label: 'Connected via Lace Extension',
            addressHex: resolvedAddress,
            role: 'user',
          });
        }

        const balances = await fetchExtensionWalletBalances(api);
        const locked = Boolean(balances.isLocked);
        setIsWalletLocked(locked);
        if (locked) {
          setWalletError(balances.errorMessage || 'Lace wallet is still locked. Please unlock it in the Lace extension toolbar.');
        } else {
          setWalletError(null);
          setDustBalance(BigInt(balances.dustBalance || '0'));
          setDustDisplay(balances.dustDisplay);
          setTNightBalance(BigInt(balances.tNightBalance || '0'));
          setTNightDisplay(balances.tNightDisplay);
        }
        setIsConnecting(false);
        setConnectingStatus(null);
      } catch (err: any) {
        console.error('[WalletContext] Lace reconnect error:', err);
        setIsConnecting(false);
        setConnectingStatus(null);
        if (isWalletLockedError(err)) {
          setIsWalletLocked(true);
          setWalletError('Your Lace wallet is locked. Please click the Lace extension icon in your browser toolbar, enter your password, then click Reconnect.');
        } else {
          setWalletError(err.message || 'Failed to reconnect to Lace.');
        }
        throw err;
      }
    },
    []
  );

  // Connect Lace wallet explicitly
  const connectWallet = useCallback(
    async (walletName: string = 'mnLace') => {
      isCancelledRef.current = false;
      setIsConnecting(true);
      setConnectingStatus('Requesting authorization from Lace...');
      setWalletError(null);
      setIsWalletLocked(false);

      try {
        const targetNetwork = MIDNIGHT_CONFIG.networkId || 'preprod';
        const api = await connectLaceWallet(walletName, targetNetwork, (st) => {
          if (!isCancelledRef.current) setConnectingStatus(st);
        });

        if (isCancelledRef.current) return;

        // Immediately store API reference and mark connected
        extensionApiRef.current = api;

        const matchedMeta = installedWallets.find(
          (w) => w.id === walletName || w.name.toLowerCase().includes('lace')
        );

        const immediateAddress =
          (typeof api?.unshieldedAddress === 'string' && api.unshieldedAddress) ||
          (typeof api?.shieldedAddress === 'string' && api.shieldedAddress) ||
          (typeof api?.address === 'string' && api.address) ||
          '';

        if (immediateAddress) {
          setAccountAddress(immediateAddress);
          setStorageItem(STORAGE_KEYS.LAST_ADDRESS, immediateAddress);
        }

        setIsConnected(true);
        setModeState('lace');
        setStorageItem(STORAGE_KEYS.MODE, 'lace');
        setStorageItem(STORAGE_KEYS.CONNECTED, 'true');
        setStorageItem(STORAGE_KEYS.WALLET_ID, walletName);

        setActiveIdentity({
          name: matchedMeta?.name || 'Lace Midnight Wallet',
          label: 'Connected via Lace Extension',
          addressHex: immediateAddress || '01'.repeat(32),
          role: 'user',
        });

        setIsConnecting(false);
        setConnectingStatus(null);

        // Offload address, configuration, and balance fetching to background asynchronously
        (async () => {
          try {
            if (typeof api.getConfiguration === 'function') {
              try {
                const config = await withTimeout(
                  Promise.resolve(api.getConfiguration()),
                  2000,
                  null,
                  'getConfiguration'
                );
                if (config?.networkId && !isCancelledRef.current) {
                  setNetworkId(config.networkId.toString());
                }
              } catch {}
            }

            const resolvedAddress = await getLaceAccountAddress(api);
            if (resolvedAddress && !isCancelledRef.current) {
              setAccountAddress(resolvedAddress);
              setStorageItem(STORAGE_KEYS.LAST_ADDRESS, resolvedAddress);
              setActiveIdentity({
                name: matchedMeta?.name || 'Lace Midnight Wallet',
                label: 'Connected via Lace Extension',
                addressHex: resolvedAddress,
                role: 'user',
              });
            }

            const balances = await fetchExtensionWalletBalances(api);
            if (!isCancelledRef.current) {
              const locked = Boolean(balances.isLocked);
              setIsWalletLocked(locked);
              if (locked) {
                setWalletError(balances.errorMessage || 'Lace wallet is locked. Please click the Lace extension icon in your browser toolbar to unlock it.');
              } else {
                setWalletError(null);
                setDustBalance(BigInt(balances.dustBalance || '0'));
                setDustDisplay(balances.dustDisplay);
                setTNightBalance(BigInt(balances.tNightBalance || '0'));
                setTNightDisplay(balances.tNightDisplay);
              }
            }
          } catch (bgErr: any) {
            console.warn('[WalletContext] Background info fetch error:', bgErr);
            if (isWalletLockedError(bgErr)) {
              setIsWalletLocked(true);
              setWalletError('Lace wallet is locked. Please click the Lace extension icon in your browser toolbar to unlock it.');
            }
          }
        })();
      } catch (error: any) {
        console.error('[WalletContext] Lace connection error:', error);
        setIsConnecting(false);
        setConnectingStatus(null);
        if (isWalletLockedError(error)) {
          setIsWalletLocked(true);
          setWalletError(error.message || 'Lace wallet is locked. Please click the Lace extension icon in your browser toolbar to unlock it.');
        }
        throw error;
      }
    },
    [installedWallets]
  );

  // Select a preset identity (Test Mode)
  const selectPresetIdentity = useCallback((identity: WalletIdentity) => {
    extensionApiRef.current = null;
    setModeState('test');
    setStorageItem(STORAGE_KEYS.MODE, 'test');
    setStorageItem(STORAGE_KEYS.IDENTITY_NAME, identity.name);
    setActiveIdentity(identity);
    setAccountAddress(identity.addressHex);
    setIsConnected(true);
    setDustBalance(50_000_000_000_000_000n);
    setDustDisplay('50.00');
    setTNightBalance(1_000_000_000n);
    setTNightDisplay('1,000.00');
    setNetworkId(MIDNIGHT_CONFIG.networkId);
  }, []);

  // Explicit Mode Switching (Smoothly preserves connection across toggles)
  const setMode = useCallback(
    (newMode: AppMode) => {
      setStorageItem(STORAGE_KEYS.MODE, newMode);
      if (newMode === 'test') {
        setModeState('test');
        const wasConn = getStorageItem(STORAGE_KEYS.CONNECTED) === 'true';
        if (wasConn) {
          const savedIdentName = getStorageItem(STORAGE_KEYS.IDENTITY_NAME);
          const ident =
            PRESET_IDENTITIES.find((p) => p.name === savedIdentName) || PRESET_IDENTITIES[0];
          selectPresetIdentity(ident);
        } else {
          setIsConnected(false);
          setAccountAddress(null);
          setActiveIdentity(null);
        }
      } else {
        // Switching back to Lace mode
        setModeState('lace');
        if (extensionApiRef.current) {
          // Already have active API in memory
          setIsConnected(true);
          const savedAddr = getStorageItem(STORAGE_KEYS.LAST_ADDRESS);
          if (savedAddr) setAccountAddress(savedAddr);
        } else if (getStorageItem(STORAGE_KEYS.CONNECTED) === 'true') {
          // Previously connected to Lace: re-establish silently without opening modal
          setIsConnected(true);
          const savedAddr = getStorageItem(STORAGE_KEYS.LAST_ADDRESS);
          if (savedAddr) setAccountAddress(savedAddr);
          const walletId = getStorageItem(STORAGE_KEYS.WALLET_ID) || 'mnLace';
          performAutoReconnect(walletId);
        } else {
          setIsConnected(false);
          setAccountAddress(null);
          setDustBalance(null);
          setDustDisplay('0.00');
          setTNightBalance(null);
          setTNightDisplay('0.00');
          setActiveIdentity(null);
        }
      }
    },
    [selectPresetIdentity, performAutoReconnect]
  );

  // Explicit user disconnect
  const disconnectWallet = useCallback(() => {
    if (extensionApiRef.current && typeof extensionApiRef.current.disconnect === 'function') {
      try {
        extensionApiRef.current.disconnect();
      } catch {}
    }
    extensionApiRef.current = null;
    setIsConnected(false);
    setIsWalletLocked(false);
    setWalletError(null);
    setIsConnecting(false);
    setConnectingStatus(null);
    setActiveIdentity(null);
    setAccountAddress(null);
    setDustBalance(null);
    setDustDisplay('0.00');
    setTNightBalance(null);
    setTNightDisplay('0.00');
    setStorageItem(STORAGE_KEYS.CONNECTED, 'false');
    removeStorageItem(STORAGE_KEYS.WALLET_ID);
    removeStorageItem(STORAGE_KEYS.LAST_ADDRESS);
    removeStorageItem(STORAGE_KEYS.IDENTITY_NAME);
  }, []);

  // Window-level guard against unhandled promise rejections from Lace extension background internals
  // (e.g. "Remote API with channel 'activity-channel' was shutdown: object can no longer be used.")
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      const reason = event?.reason;
      if (isChannelShutdownError(reason)) {
        console.warn(
          '[WalletContext] Intercepted benign Lace background channel shutdown. Suppressing uncaught rejection and scheduling silent re-acquisition.'
        );
        // Cancel browser default error logging (removes "Uncaught (in promise) t: Remote API with channel ... was shutdown")
        try {
          event.preventDefault();
        } catch {}

        // Invalidate stale in-page API handle immediately so subsequent actions do not use dead proxy
        extensionApiRef.current = null;

        if (mode === 'lace') {
          const walletId = getStorageItem(STORAGE_KEYS.WALLET_ID) || 'mnLace';
          performAutoReconnect(walletId);
        }
      }
    };

    window.addEventListener('unhandledrejection', handleUnhandledRejection);
    return () => {
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
    };
  }, [mode, performAutoReconnect]);

  // Periodic balance sync when in Lace mode
  useEffect(() => {
    if (mode === 'lace' && isConnected) {
      const interval = setInterval(() => {
        refreshBalances();
      }, 15000);
      return () => clearInterval(interval);
    }
  }, [mode, isConnected, refreshBalances]);

  // Auto-refresh balances and recheck lock status when user focuses/switches back to tab
  useEffect(() => {
    const handleRecheck = () => {
      if (mode === 'lace' && isConnected) {
        console.log('[WalletContext] Tab active/focused; rechecking wallet status & balances...');
        refreshBalances();
      }
    };
    window.addEventListener('focus', handleRecheck);
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        handleRecheck();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      window.removeEventListener('focus', handleRecheck);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [mode, isConnected, refreshBalances]);

  const isSimulated = mode === 'test';

  return (
    <WalletContext.Provider
      value={{
        mode,
        setMode,
        isConnected,
        isExtensionInstalled,
        installedWallets,
        isSimulated,
        accountAddress,
        dustBalance,
        dustDisplay,
        tNightBalance,
        tNightDisplay,
        networkId,
        activeIdentity,
        extensionApi: extensionApiRef.current,
        isConnecting,
        connectingStatus,
        isWalletLocked,
        walletError,
        cancelConnecting,
        connectWallet,
        reconnectWallet,
        disconnectWallet,
        selectPresetIdentity,
        refreshBalances,
      }}
    >
      {children}
    </WalletContext.Provider>
  );
};

export const useWallet = (): WalletContextType => {
  const context = useContext(WalletContext);
  if (!context) {
    throw new Error('useWallet must be used within a WalletProvider');
  }
  return context;
};
