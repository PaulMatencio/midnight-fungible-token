/**
 * Application Use Case: Get Token State & Balances
 * Filename: src/application/use-cases/get-token-state.usecase.ts
 */

import type { ITokenContractGateway, GrantedAllowance } from '@/src/domain/ports/i-token-contract.gateway';
import type { TokenMetadata } from '@/src/domain/entities/token.entity';
import type { GetBalanceQueryDto, GetAllowanceQueryDto } from '../dto/query.dto';

export class GetTokenStateUseCase {
  constructor(private readonly contractGateway: ITokenContractGateway) {}

  async getMetadata(contractAddress: string, currentCaller?: string): Promise<TokenMetadata> {
    return this.contractGateway.getContractState(contractAddress, currentCaller);
  }

  getBalance(query: GetBalanceQueryDto): bigint {
    return this.contractGateway.getBalanceOf(query.accountAddress, query.contractAddress);
  }

  getLockedBalance(query: GetBalanceQueryDto): bigint {
    return this.contractGateway.getLockedBalanceOf(query.accountAddress, query.contractAddress);
  }

  getAllowance(query: GetAllowanceQueryDto): bigint {
    return this.contractGateway.getAllowance(query.ownerAddress, query.spenderAddress, query.contractAddress);
  }

  getAllowancesForSpender(spenderAddress: string, contractAddress?: string): GrantedAllowance[] {
    return this.contractGateway.getAllowancesForSpender(spenderAddress, contractAddress);
  }
}
