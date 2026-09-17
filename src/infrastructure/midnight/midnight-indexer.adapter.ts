/**
 * Infrastructure Adapter: Midnight Indexer Adapter
 * Filename: src/infrastructure/midnight/midnight-indexer.adapter.ts
 */

import type { IIndexerGateway } from '@/src/domain/ports/i-indexer.gateway';
import type { HoldersReport } from '@/src/domain/entities/token.entity';
import {
  queryIndexerContractState,
  CONTRACT_ACTION_QUERY,
} from './midnight-indexer-client';
import { MIDNIGHT_CONFIG } from '../config/midnight-config';

export class MidnightIndexerAdapter implements IIndexerGateway {
  constructor(private readonly indexerUrl: string = MIDNIGHT_CONFIG.indexerUrl) {}

  async queryContractState(
    contractAddress: string,
    indexerUrl?: string
  ): Promise<string | null> {
    const url = indexerUrl || this.indexerUrl;
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: CONTRACT_ACTION_QUERY,
          variables: { address: contractAddress.trim() },
        }),
        signal: AbortSignal.timeout(6000),
      });

      if (!response.ok) return null;
      const json = await response.json();
      return json.data?.contractAction?.state || null;
    } catch {
      return null;
    }
  }

  async fetchAccountSharesReport(
    contractAddress: string,
    currentUserAddress?: string,
    contractSalt?: Uint8Array,
    indexerUrl?: string
  ): Promise<HoldersReport> {
    const url = indexerUrl || this.indexerUrl;
    return queryIndexerContractState(contractAddress, url, {
      currentUserAddress,
      contractSalt,
    });
  }
}
