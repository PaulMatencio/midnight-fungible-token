/**
 * Infrastructure Adapter: Midnight Wallet Adapter
 * Filename: src/infrastructure/midnight/midnight-wallet.adapter.ts
 */

import type { IWalletGateway } from '@/src/domain/ports/i-wallet.gateway';
import type { WalletBalances, WalletMode } from '@/src/domain/entities/wallet.entity';
import {
  connectLaceWallet,
  fetchExtensionWalletBalances,
} from './midnight-dapp-connector';
import { PRESET_IDENTITIES } from '../config/midnight-config';

export class MidnightWalletAdapter implements IWalletGateway {
  private mode: WalletMode = 'lace';
  private extensionApi: any | null = null;
  private currentAddress?: string;
  private currentCoinPublicKey?: string;
  private connected = false;

  constructor(initialMode: WalletMode = 'lace') {
    this.mode = initialMode;
    if (initialMode === 'test') {
      this.currentAddress = PRESET_IDENTITIES[0].addressHex;
      this.currentCoinPublicKey = PRESET_IDENTITIES[0].addressHex;
      this.connected = true;
    }
  }

  async connect(networkId: string, options?: { timeoutMs?: number }): Promise<void> {
    if (this.mode === 'test') {
      this.connected = true;
      this.currentAddress = PRESET_IDENTITIES[0].addressHex;
      this.currentCoinPublicKey = PRESET_IDENTITIES[0].addressHex;
      return;
    }

    const api = await connectLaceWallet('mnLace', networkId, undefined, options);
    this.extensionApi = api;
    this.connected = true;

    // Fetch address and coin key
    if (api.getUnshieldedAddress) {
      this.currentAddress = await api.getUnshieldedAddress();
    }
    if (api.getCoinPublicKey) {
      this.currentCoinPublicKey = api.getCoinPublicKey();
    } else if (api.coinPublicKey) {
      this.currentCoinPublicKey = api.coinPublicKey;
    }
  }

  async disconnect(): Promise<void> {
    this.extensionApi = null;
    this.connected = false;
    if (this.mode === 'lace') {
      this.currentAddress = undefined;
      this.currentCoinPublicKey = undefined;
    }
  }

  async getBalances(): Promise<WalletBalances> {
    if (this.mode === 'test') {
      return {
        tNightBalance: '100000000',
        tNightDisplay: '100',
        dustBalance: '50000000000000000',
        dustDisplay: '50',
        isSynced: true,
      };
    }

    if (!this.extensionApi) {
      return {
        tNightBalance: '0',
        tNightDisplay: '0.00',
        dustBalance: '0',
        dustDisplay: '0.00',
        isSynced: false,
      };
    }

    return fetchExtensionWalletBalances(this.extensionApi);
  }

  isConnected(): boolean {
    return this.connected;
  }

  getAddress(): string | undefined {
    return this.currentAddress;
  }

  getCoinPublicKey(): string | undefined {
    return this.currentCoinPublicKey;
  }

  getMode(): WalletMode {
    return this.mode;
  }

  setMode(mode: WalletMode): void {
    this.mode = mode;
    if (mode === 'test') {
      this.currentAddress = PRESET_IDENTITIES[0].addressHex;
      this.currentCoinPublicKey = PRESET_IDENTITIES[0].addressHex;
      this.connected = true;
    } else {
      if (!this.extensionApi) {
        this.connected = false;
        this.currentAddress = undefined;
        this.currentCoinPublicKey = undefined;
      }
    }
  }

  getExtensionApi(): any | null {
    return this.extensionApi;
  }
}
