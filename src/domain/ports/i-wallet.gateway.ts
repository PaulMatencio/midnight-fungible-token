/**
 * Domain Port: Wallet Gateway
 * Filename: src/domain/ports/i-wallet.gateway.ts
 */

import type { WalletBalances, WalletMode } from '../entities/wallet.entity';

export interface IWalletGateway {
  /**
   * Connect to wallet.
   */
  connect(networkId: string, options?: { timeoutMs?: number }): Promise<void>;

  /**
   * Disconnect active wallet session.
   */
  disconnect(): Promise<void>;

  /**
   * Query balances (tNight, dust, shielded).
   */
  getBalances(): Promise<WalletBalances>;

  /**
   * Active connection state.
   */
  isConnected(): boolean;

  /**
   * Currently connected account address.
   */
  getAddress(): string | undefined;

  /**
   * Currently connected coin public key hex.
   */
  getCoinPublicKey(): string | undefined;

  /**
   * Active operation mode ('lace' | 'test').
   */
  getMode(): WalletMode;

  /**
   * Switch mode.
   */
  setMode(mode: WalletMode): void;

  /**
   * Raw extension API instance if connected to Lace.
   */
  getExtensionApi(): any | null;
}
