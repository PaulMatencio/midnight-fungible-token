/**
 * Infrastructure Persistence: LocalStorage Contract State Storage
 * Filename: src/infrastructure/persistence/local-storage-contract-state.storage.ts
 */

import * as CompactRuntime from '@midnight-ntwrk/compact-runtime';
import { bytesToHex } from '@/src/domain/entities/address.vo';
import type { IContractStateStorage } from '@/src/domain/ports/i-contract-state.storage';

const LACE_STORAGE_KEY_PREFIX = 'midnight_fungible_token_lace_state_';

export function serializeChargedState(chargedState: any): string {
  if (!chargedState || !chargedState.state) return '';
  try {
    const encoded = chargedState.state.encode();
    return JSON.stringify(encoded, (_key, value) => {
      if (typeof value === 'bigint') return { __type: 'bigint', val: value.toString() };
      if (value instanceof Map) return { __type: 'map', entries: Array.from(value.entries()) };
      if (value instanceof Uint8Array) return { __type: 'uint8', hex: bytesToHex(value) };
      return value;
    });
  } catch (err) {
    console.warn('[serializeChargedState] Error encoding state:', err);
    return '';
  }
}

export function deserializeChargedState(jsonStr: string): any {
  if (!jsonStr) return null;
  try {
    const parsed = JSON.parse(jsonStr, (_key, value) => {
      if (value && typeof value === 'object') {
        if (value.__type === 'bigint') return BigInt(value.val);
        if (value.__type === 'map') return new Map(value.entries);
        if (value.__type === 'uint8') {
          const hex = value.hex || '';
          const match = hex.match(/.{1,2}/g) || [];
          return new Uint8Array(match.map((byte: string) => parseInt(byte, 16)));
        }
      }
      return value;
    });
    const stateVal = CompactRuntime.StateValue.decode(parsed);
    return new CompactRuntime.ChargedState(stateVal);
  } catch (err) {
    console.warn('[deserializeChargedState] Error decoding state:', err);
    return null;
  }
}

export class LocalStorageContractStateStorage implements IContractStateStorage {
  saveState(contractAddress: string, serializedState: string): void {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(`${LACE_STORAGE_KEY_PREFIX}${contractAddress}`, serializedState);
    } catch (err) {
      console.warn('[LocalStorageContractStateStorage] Error saving state:', err);
    }
  }

  loadState(contractAddress: string): string | null {
    if (typeof window === 'undefined') return null;
    try {
      return localStorage.getItem(`${LACE_STORAGE_KEY_PREFIX}${contractAddress}`);
    } catch (err) {
      console.warn('[LocalStorageContractStateStorage] Error loading state:', err);
      return null;
    }
  }

  clearState(contractAddress?: string): void {
    if (typeof window === 'undefined') return;
    try {
      if (contractAddress) {
        localStorage.removeItem(`${LACE_STORAGE_KEY_PREFIX}${contractAddress}`);
      } else {
        for (let i = localStorage.length - 1; i >= 0; i--) {
          const key = localStorage.key(i);
          if (key && key.startsWith(LACE_STORAGE_KEY_PREFIX)) {
            localStorage.removeItem(key);
          }
        }
      }
    } catch (err) {
      console.warn('[LocalStorageContractStateStorage] Error clearing state:', err);
    }
  }
}
