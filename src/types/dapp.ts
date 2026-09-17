/**
 * DApp Data Transfer Objects & Type Definitions
 * Re-exported from Domain Layer for unified typing and backward compatibility.
 */

export type {
  TransactionStatus,
  ActivityItem,
} from '@/src/domain/entities/activity.entity';

export type {
  WalletIdentity,
  WalletBalances,
  WalletMode,
  NetworkConfig,
} from '@/src/domain/entities/wallet.entity';

export type {
  TokenMetadata,
  AccountShare,
  HoldersReport,
} from '@/src/domain/entities/token.entity';
