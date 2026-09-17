/**
 * Infrastructure Persistence: LocalStorage Activity Storage
 * Filename: src/infrastructure/persistence/local-storage-activity.storage.ts
 */

import type { IActivityStorage } from '@/src/domain/ports/i-activity.storage';
import type { ActivityItem } from '@/src/domain/entities/activity.entity';

const LACE_STORAGE_KEY_PREFIX = 'midnight_fungible_token_lace_state_';
const ACTIVITY_STORAGE_KEY_PREFIX = 'midnight_fungible_token_activity_';
const MASTER_AUDIT_LOG_KEY = 'midnight_fungible_token_audit_log_master_v2';
const LEGACY_MASTER_AUDIT_LOG_KEY = 'midnight_fungible_token_audit_log_master';
const MAX_PERSISTED_ACTIVITIES = 1000;

export class LocalStorageActivityStorage implements IActivityStorage {
  loadActivities(contractAddress?: string): ActivityItem[] {
    if (typeof window === 'undefined') return [];
    try {
      const itemMap = new Map<string, ActivityItem>();

      const ingestJson = (raw: string | null) => {
        if (!raw) return;
        try {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) {
            parsed.forEach((item) => {
              if (item && item.id) {
                const existing = itemMap.get(item.id);
                if (!existing || (item.status === 'confirmed' && existing.status !== 'confirmed')) {
                  itemMap.set(item.id, item);
                }
              }
            });
          }
        } catch {}
      };

      // 1. Read Master key v2
      ingestJson(localStorage.getItem(MASTER_AUDIT_LOG_KEY));

      // 2. Read Legacy Master key
      ingestJson(localStorage.getItem(LEGACY_MASTER_AUDIT_LOG_KEY));

      // 3. Read specific contract key if specified
      if (contractAddress) {
        ingestJson(localStorage.getItem(`${ACTIVITY_STORAGE_KEY_PREFIX}${contractAddress}`));
      }

      // 4. Scan all localStorage keys for any other activity or audit logs
      try {
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && (key.startsWith(ACTIVITY_STORAGE_KEY_PREFIX) || key.includes('audit_log') || key.includes('activity'))) {
            ingestJson(localStorage.getItem(key));
          }
        }
      } catch {}

      return Array.from(itemMap.values())
        .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0))
        .slice(0, MAX_PERSISTED_ACTIVITIES);
    } catch (err) {
      console.warn('[LocalStorageActivityStorage] Error loading persistent activities:', err);
      return [];
    }
  }

  saveActivities(
    items: ActivityItem[],
    contractAddress?: string,
    forceClear = false
  ): void {
    if (typeof window === 'undefined') return;
    if (!forceClear && (!items || items.length === 0)) {
      return;
    }
    try {
      const trimmed = items.slice(0, MAX_PERSISTED_ACTIVITIES);
      const json = JSON.stringify(trimmed);

      // Save to primary master key
      localStorage.setItem(MASTER_AUDIT_LOG_KEY, json);

      // Also save to contract-specific key if provided
      if (contractAddress) {
        localStorage.setItem(`${ACTIVITY_STORAGE_KEY_PREFIX}${contractAddress}`, json);
      }
    } catch (err) {
      console.warn('[LocalStorageActivityStorage] Error persisting activities:', err);
    }
  }

  addActivity(item: ActivityItem, contractAddress?: string): void {
    const current = this.loadActivities(contractAddress);
    const existingIndex = current.findIndex((i) => i.id === item.id);
    if (existingIndex >= 0) {
      current[existingIndex] = { ...current[existingIndex], ...item };
    } else {
      current.unshift(item);
    }
    this.saveActivities(current, contractAddress);
  }

  updateActivity(
    id: string,
    updates: Partial<ActivityItem>,
    contractAddress?: string
  ): void {
    const current = this.loadActivities(contractAddress);
    const existingIndex = current.findIndex((i) => i.id === id);
    if (existingIndex >= 0) {
      current[existingIndex] = { ...current[existingIndex], ...updates };
      this.saveActivities(current, contractAddress);
    }
  }

  deleteActivity(id: string, contractAddress?: string): void {
    const current = this.loadActivities(contractAddress);
    const filtered = current.filter((i) => i.id !== id);
    this.saveActivities(filtered, contractAddress, true);
  }

  clearActivities(contractAddress?: string): void {
    if (typeof window === 'undefined') return;
    try {
      localStorage.removeItem(MASTER_AUDIT_LOG_KEY);
      localStorage.removeItem(LEGACY_MASTER_AUDIT_LOG_KEY);
      if (contractAddress) {
        localStorage.removeItem(`${ACTIVITY_STORAGE_KEY_PREFIX}${contractAddress}`);
      }
      for (let i = localStorage.length - 1; i >= 0; i--) {
        const key = localStorage.key(i);
        if (key && (key.startsWith(ACTIVITY_STORAGE_KEY_PREFIX) || key.includes('audit_log'))) {
          localStorage.removeItem(key);
        }
      }
    } catch (err) {
      console.warn('[LocalStorageActivityStorage] Error clearing activities:', err);
    }
  }
}
