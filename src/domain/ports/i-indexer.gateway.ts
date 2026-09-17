/**
 * Domain Port: Indexer Gateway
 * Filename: src/domain/ports/i-indexer.gateway.ts
 */

import type { HoldersReport } from '../entities/token.entity';

export interface IIndexerGateway {
  /**
   * Queries raw on-chain state bytes from the Midnight Indexer.
   */
  queryContractState(
    contractAddress: string,
    indexerUrl?: string
  ): Promise<string | null>;

  /**
   * Fetches account shares report and token distribution from indexer or decoded ledger.
   */
  fetchAccountSharesReport(
    contractAddress: string,
    currentUserAddress?: string,
    contractSalt?: Uint8Array,
    indexerUrl?: string
  ): Promise<HoldersReport>;
}
