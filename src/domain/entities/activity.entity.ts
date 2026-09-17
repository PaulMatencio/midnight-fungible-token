/**
 * Domain Entities & Models: Activity & Transactions
 * Filename: src/domain/entities/activity.entity.ts
 */

export type TransactionStatus =
  | 'idle'
  | 'preparing'
  | 'proving'
  | 'signing'
  | 'submitting'
  | 'confirmed'
  | 'failed';

export interface ActivityItem {
  id: string;
  circuitName: string;
  params: Record<string, string>;
  status: 'pending' | 'confirmed' | 'failed';
  txHash?: string;
  blockHeight?: number;
  timestamp: number;
  error?: string;
  caller?: string;
  contractAddress?: string;
  networkId?: string;
  mode?: 'lace' | 'test';
  durationMs?: number;
}
