/**
 * Application Use Case: Get Account Shares (Analytics)
 * Filename: src/application/use-cases/get-account-shares.usecase.ts
 */

import type { IIndexerGateway } from '@/src/domain/ports/i-indexer.gateway';
import type { HoldersReport } from '@/src/domain/entities/token.entity';
import type { GetHoldersReportQueryDto } from '../dto/query.dto';

export class GetAccountSharesUseCase {
  constructor(private readonly indexerGateway: IIndexerGateway) {}

  async execute(dto: GetHoldersReportQueryDto): Promise<HoldersReport> {
    return this.indexerGateway.fetchAccountSharesReport(
      dto.contractAddress,
      dto.currentUserAddress,
      dto.contractSalt,
      dto.indexerUrl
    );
  }
}
