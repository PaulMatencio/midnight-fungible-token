/**
 * Domain Port: Activity Storage
 * Filename: src/domain/ports/i-activity.storage.ts
 */

import type { ActivityItem } from '../entities/activity.entity';

export interface IActivityStorage {
  /**
   * Loads persisted activity items.
   */
  loadActivities(contractAddress?: string): ActivityItem[];

  /**
   * Saves all activities to persistent storage.
   */
  saveActivities(
    items: ActivityItem[],
    contractAddress?: string,
    forceClear?: boolean
  ): void;

  /**
   * Appends or prepends a new activity item.
   */
  addActivity(item: ActivityItem, contractAddress?: string): void;

  /**
   * Updates an existing activity item by ID.
   */
  updateActivity(
    id: string,
    updates: Partial<ActivityItem>,
    contractAddress?: string
  ): void;

  /**
   * Deletes an activity item by ID.
   */
  deleteActivity?(id: string, contractAddress?: string): void;

  /**
   * Clears persisted activity log.
   */
  clearActivities(contractAddress?: string): void;
}
