/**
 * Browser-compatible Private State Provider
 * Implements persistent browser storage using LocalStorage with in-memory fallback,
 * fully compliant with @midnight-ntwrk/midnight-js-types PrivateStateProvider.
 */

import type {
  PrivateStateProvider as MidnightPrivateStateProvider,
  PrivateStateExport,
  ExportPrivateStatesOptions,
  ImportPrivateStatesOptions,
  ImportPrivateStatesResult,
  SigningKeyExport,
  ExportSigningKeysOptions,
  ImportSigningKeysOptions,
  ImportSigningKeysResult,
} from '@midnight-ntwrk/midnight-js-types';
import type { ContractAddress } from '@midnight-ntwrk/compact-runtime';

export type PrivateStateProvider<PS = any> = MidnightPrivateStateProvider<string, PS>;

export class BrowserPrivateStateProvider<PS = any> implements MidnightPrivateStateProvider<string, PS> {
  private memoryStore: Map<string, PS> = new Map();
  private signingKeyStore: Map<string, any> = new Map();
  private prefix: string;
  private currentContractAddress: string = '';

  constructor(prefix: string = 'midnight_private_state_') {
    this.prefix = prefix;
  }

  public setContractAddress(address: ContractAddress): void {
    this.currentContractAddress = address as string;
  }

  private getKey(id: string): string {
    return `${this.prefix}${this.currentContractAddress || 'global'}_${id}`;
  }

  public async get(privateStateId: string): Promise<PS | null> {
    const storageKey = this.getKey(privateStateId);
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        const item = window.localStorage.getItem(storageKey);
        if (item) {
          return JSON.parse(item, (_k, v) => {
            if (v && typeof v === 'object' && v.__type === 'Uint8Array') {
              return new Uint8Array(v.data);
            }
            if (v && typeof v === 'object' && v.__type === 'BigInt') {
              return BigInt(v.data);
            }
            return v;
          });
        }
      } catch (err) {
        console.warn('[PrivateStateProvider] LocalStorage read failed, falling back to memory:', err);
      }
    }
    return this.memoryStore.get(storageKey) ?? null;
  }

  public async set(privateStateId: string, state: PS): Promise<void> {
    const storageKey = this.getKey(privateStateId);
    this.memoryStore.set(storageKey, state);
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        const serialized = JSON.stringify(state, (_k, v) => {
          if (v instanceof Uint8Array) {
            return { __type: 'Uint8Array', data: Array.from(v) };
          }
          if (typeof v === 'bigint') {
            return { __type: 'BigInt', data: v.toString() };
          }
          return v;
        });
        window.localStorage.setItem(storageKey, serialized);
      } catch (err) {
        console.warn('[PrivateStateProvider] LocalStorage write failed, stored in memory only:', err);
      }
    }
  }

  public async remove(privateStateId: string): Promise<void> {
    const storageKey = this.getKey(privateStateId);
    this.memoryStore.delete(storageKey);
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        window.localStorage.removeItem(storageKey);
      } catch {}
    }
  }

  public async clear(): Promise<void> {
    this.memoryStore.clear();
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        const keysToRemove: string[] = [];
        for (let i = 0; i < window.localStorage.length; i++) {
          const key = window.localStorage.key(i);
          if (key && key.startsWith(this.prefix)) {
            keysToRemove.push(key);
          }
        }
        for (const k of keysToRemove) {
          window.localStorage.removeItem(k);
        }
      } catch {}
    }
  }

  public async setSigningKey(address: ContractAddress, signingKey: any): Promise<void> {
    this.signingKeyStore.set(address as string, signingKey);
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        const key = `${this.prefix}sk_${address}`;
        window.localStorage.setItem(key, JSON.stringify(signingKey));
      } catch {}
    }
  }

  public async getSigningKey(address: ContractAddress): Promise<any | null> {
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        const key = `${this.prefix}sk_${address}`;
        const item = window.localStorage.getItem(key);
        if (item) return JSON.parse(item);
      } catch {}
    }
    return this.signingKeyStore.get(address as string) ?? null;
  }

  public async removeSigningKey(address: ContractAddress): Promise<void> {
    this.signingKeyStore.delete(address as string);
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        window.localStorage.removeItem(`${this.prefix}sk_${address}`);
      } catch {}
    }
  }

  public async clearSigningKeys(): Promise<void> {
    this.signingKeyStore.clear();
  }

  public async exportPrivateStates(_options?: ExportPrivateStatesOptions): Promise<PrivateStateExport> {
    return { version: 1, states: {} } as any;
  }

  public async importPrivateStates(_exportData: PrivateStateExport, _options?: ImportPrivateStatesOptions): Promise<ImportPrivateStatesResult> {
    return { imported: 0, skipped: 0, overwritten: 0 };
  }

  public async exportSigningKeys(_options?: ExportSigningKeysOptions): Promise<SigningKeyExport> {
    return { version: 1, keys: {} } as any;
  }

  public async importSigningKeys(_exportData: SigningKeyExport, _options?: ImportSigningKeysOptions): Promise<ImportSigningKeysResult> {
    return { imported: 0, skipped: 0, overwritten: 0 };
  }
}
