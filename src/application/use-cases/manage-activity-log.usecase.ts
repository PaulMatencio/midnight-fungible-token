/**
 * Application Use Case: Manage Activity Log
 * Filename: src/application/use-cases/manage-activity-log.usecase.ts
 */

import type { IActivityStorage } from '@/src/domain/ports/i-activity.storage';
import type { ActivityItem } from '@/src/domain/entities/activity.entity';

export class ManageActivityLogUseCase {
  constructor(private readonly activityStorage: IActivityStorage) {}

  getActivities(contractAddress?: string): ActivityItem[] {
    return this.activityStorage.loadActivities(contractAddress);
  }

  recordActivity(item: ActivityItem, contractAddress?: string): void {
    this.activityStorage.addActivity(item, contractAddress);
  }

  updateActivity(id: string, updates: Partial<ActivityItem>, contractAddress?: string): void {
    this.activityStorage.updateActivity(id, updates, contractAddress);
  }

  dismissActivity(id: string, contractAddress?: string): void {
    this.activityStorage.updateActivity(
      id,
      { status: 'failed', error: 'Cancelled / Dismissed by user' },
      contractAddress
    );
  }

  deleteActivity(id: string, contractAddress?: string): void {
    if (this.activityStorage.deleteActivity) {
      this.activityStorage.deleteActivity(id, contractAddress);
    } else {
      const all = this.activityStorage.loadActivities(contractAddress);
      this.activityStorage.saveActivities(
        all.filter((item) => item.id !== id),
        contractAddress,
        true
      );
    }
  }

  clearActivities(contractAddress?: string): void {
    this.activityStorage.clearActivities(contractAddress);
  }
}
