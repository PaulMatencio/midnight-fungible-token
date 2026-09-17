/**
 * Domain Value Object & Helpers: Address
 * Filename: src/domain/entities/address.vo.ts
 */

import { bech32m } from '@scure/base';

/**
 * Converts any Midnight address format into a 32-byte Uint8Array for Compact circuits.
 * Supports:
 * 1. Midnight Bech32m addresses (unshielded e.g. mn_addr_..., or shielded e.g. mn_shield-addr_...)
 * 2. 32-byte hex strings (with or without 0x prefix)
 * 3. Arbitrary string padding fallback
 */
export function addressToBytes32(addr: string): Uint8Array {
  if (!addr || typeof addr !== 'string') {
    return new Uint8Array(32);
  }
  const trimmed = addr.trim();

  // 1. Bech32m Midnight Address
  if (
    trimmed.toLowerCase().startsWith('mn_') ||
    trimmed.toLowerCase().startsWith('midnight') ||
    trimmed.toLowerCase().startsWith('mn1')
  ) {
    try {
      const decoded = bech32m.decodeToBytes(trimmed, 200);
      if (decoded.bytes.length === 32) {
        return new Uint8Array(decoded.bytes);
      }
      if (decoded.bytes.length >= 32) {
        // Shielded address: coin public key is first 32 bytes
        return new Uint8Array(decoded.bytes.subarray(0, 32));
      }
    } catch (err: any) {
      console.warn('[Address Resolution] Bech32m decode warning:', err?.message || err);
    }
  }

  // 2. Hex string format
  const cleanHex = trimmed.replace(/^0x/, '').trim();
  if (/^[0-9a-fA-F]{64}$/.test(cleanHex)) {
    const bytes = new Uint8Array(32);
    for (let i = 0; i < 32; i++) {
      bytes[i] = parseInt(cleanHex.substr(i * 2, 2), 16) || 0;
    }
    return bytes;
  }

  // 3. Fallback: pad if valid hex
  if (/^[0-9a-fA-F]+$/.test(cleanHex) && cleanHex.length <= 64) {
    const padded = cleanHex.padStart(64, '0');
    const bytes = new Uint8Array(32);
    for (let i = 0; i < 32; i++) {
      bytes[i] = parseInt(padded.substr(i * 2, 2), 16) || 0;
    }
    return bytes;
  }

  // Default fallback for arbitrary strings
  const bytes = new Uint8Array(32);
  for (let i = 0; i < Math.min(trimmed.length, 32); i++) {
    bytes[i] = trimmed.charCodeAt(i);
  }
  return bytes;
}

/**
 * Converts a hex string to Uint8Array.
 * If the hex represents 32 bytes or fewer (<= 64 hex chars), it is zero-padded to 32 bytes (standard for Compact keys/salts/addresses).
 * If the hex is longer than 64 characters (e.g., serialized contract state), it decodes the full byte sequence.
 */
export function hexToBytes(hex: string | Uint8Array, targetLength?: number): Uint8Array {
  if (hex instanceof Uint8Array) return hex;
  if (!hex || typeof hex !== 'string') return new Uint8Array(targetLength ?? 0);
  const trimmed = hex.trim();

  // If passed a Midnight Bech32m address, safely delegate to addressToBytes32
  if (
    trimmed.toLowerCase().startsWith('mn_') ||
    trimmed.toLowerCase().startsWith('midnight') ||
    trimmed.toLowerCase().startsWith('mn1')
  ) {
    return addressToBytes32(trimmed);
  }

  let clean = trimmed.startsWith('0x') ? trimmed.slice(2).trim() : trimmed;

  // If targetLength is explicitly specified, pad/slice accordingly
  if (typeof targetLength === 'number') {
    clean = clean.padStart(targetLength * 2, '0');
    const bytes = new Uint8Array(targetLength);
    for (let i = 0; i < targetLength; i++) {
      bytes[i] = parseInt(clean.substring(i * 2, i * 2 + 2), 16) || 0;
    }
    return bytes;
  }

  // Compact convention: if <= 64 hex characters, treat as 32-byte value with leading zeros
  if (clean.length <= 64) {
    clean = clean.padStart(64, '0');
    const bytes = new Uint8Array(32);
    for (let i = 0; i < 32; i++) {
      bytes[i] = parseInt(clean.substring(i * 2, i * 2 + 2), 16) || 0;
    }
    return bytes;
  }

  // Arbitrary length payload (e.g. serialized contract state)
  if (clean.length % 2 !== 0) {
    clean = '0' + clean;
  }
  const len = clean.length / 2;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = parseInt(clean.substring(i * 2, i * 2 + 2), 16) || 0;
  }
  return bytes;
}

/**
 * Arbitrary length hex to bytes converter without 32-byte padding.
 */
export function rawHexToBytes(hex: string): Uint8Array {
  if (!hex || typeof hex !== 'string') return new Uint8Array(0);
  let clean = hex.startsWith('0x') ? hex.slice(2).trim() : hex.trim();
  if (clean.length % 2 !== 0) {
    clean = '0' + clean;
  }
  const len = clean.length / 2;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = parseInt(clean.substring(i * 2, i * 2 + 2), 16) || 0;
  }
  return bytes;
}

/**
 * Converts a Uint8Array to a 64-char hex string (without 0x).
 */
export function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Converts any address format (Bech32 or hex) to a 64-char hex string (32 bytes).
 */
export function addressToHex32(addr?: string | null): string {
  if (!addr || typeof addr !== 'string') {
    return '01'.repeat(32);
  }
  return bytesToHex(addressToBytes32(addr));
}

/**
 * Address Value Object
 */
export class Address {
  private readonly _bytes: Uint8Array;

  constructor(value: string | Uint8Array) {
    if (value instanceof Uint8Array) {
      if (value.length === 32) {
        this._bytes = new Uint8Array(value);
      } else {
        const padded = new Uint8Array(32);
        padded.set(value.subarray(0, 32));
        this._bytes = padded;
      }
    } else {
      this._bytes = addressToBytes32(value);
    }
  }

  public toBytes(): Uint8Array {
    return new Uint8Array(this._bytes);
  }

  public toHex(): string {
    return bytesToHex(this._bytes);
  }

  public equals(other: Address | string | Uint8Array): boolean {
    const otherAddress = other instanceof Address ? other : new Address(other);
    const otherBytes = otherAddress.toBytes();
    if (this._bytes.length !== otherBytes.length) return false;
    for (let i = 0; i < this._bytes.length; i++) {
      if (this._bytes[i] !== otherBytes[i]) return false;
    }
    return true;
  }
}
