/**
 * Browser-compatible Private State Provider
 * Implements persistent browser storage using LocalStorage with in-memory fallback.
 */

export interface PrivateStateProvider<PS = any> {
  get(key: string): Promise<PS | null>;
  set(key: string, state: PS): Promise<void>;
  clear(key: string): Promise<void>;
}

export class BrowserPrivateStateProvider<PS = any> implements PrivateStateProvider<PS> {
  private memoryStore: Map<string, PS> = new Map();
  private prefix: string;

  constructor(prefix: string = 'midnight_private_state_') {
    this.prefix = prefix;
  }

  public async get(key: string): Promise<PS | null> {
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        const item = window.localStorage.getItem(`${this.prefix}${key}`);
        if (item) {
          return JSON.parse(item, (_k, v) => {
            if (v && typeof v === 'object' && v.__type === 'Uint8Array') {
              return new Uint8Array(v.data);
            }
            return v;
          });
        }
      } catch (err) {
        console.warn('[PrivateStateProvider] LocalStorage read failed, falling back to memory:', err);
      }
    }
    return this.memoryStore.get(key) ?? null;
  }

  public async set(key: string, state: PS): Promise<void> {
    this.memoryStore.set(key, state);
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
        window.localStorage.setItem(`${this.prefix}${key}`, serialized);
      } catch (err) {
        console.warn('[PrivateStateProvider] LocalStorage write failed, stored in memory only:', err);
      }
    }
  }

  public async clear(key: string): Promise<void> {
    this.memoryStore.delete(key);
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        window.localStorage.removeItem(`${this.prefix}${key}`);
      } catch {}
    }
  }
}
