/**
 * Application Use Case: Approve Token
 * Filename: src/application/use-cases/approve-token.usecase.ts
 */

import type { ITokenContractGateway } from '@/src/domain/ports/i-token-contract.gateway';
import { addressToBytes32 } from '@/src/domain/entities/address.vo';
import { DomainError } from '@/src/domain/errors/domain-errors';
import type { ApproveTokenDto, CircuitExecutionResultDto } from '../dto/token.dto';

export class ApproveTokenUseCase {
  constructor(private readonly contractGateway: ITokenContractGateway) {}

  async execute(dto: ApproveTokenDto): Promise<CircuitExecutionResultDto> {
    const amountBigInt = BigInt(dto.amount);
    if (amountBigInt < 0n) {
      throw new DomainError('Approval amount cannot be negative', 'INVALID_AMOUNT');
    }

    const result = await this.contractGateway.approve(
      dto.contractAddress,
      dto.spender,
      amountBigInt,
      dto.options
    );

    return {
      success: true,
      txHash: result.txHash,
      blockHeight: result.blockHeight,
      returnValue: result.returnValue,
    };
  }
}
