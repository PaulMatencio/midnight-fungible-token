/**
 * Application DTOs: Queries
 * Filename: src/application/dto/query.dto.ts
 */

export interface GetBalanceQueryDto {
  accountAddress: string;
  contractAddress?: string;
}

export interface GetAllowanceQueryDto {
  ownerAddress: string;
  spenderAddress: string;
  contractAddress?: string;
}

export interface GetHoldersReportQueryDto {
  contractAddress: string;
  currentUserAddress?: string;
  contractSalt?: Uint8Array;
  indexerUrl?: string;
}
