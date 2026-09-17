/**
 * Application Use Case: Burn Token
 * Filename: src/application/use-cases/burn-token.usecase.ts
 */

import type { ITokenContractGateway } from '@/src/domain/ports/i-token-contract.gateway';
import { DomainError, InsufficientBalanceError } from '@/src/domain/errors/domain-errors';
import type { BurnTokenDto, CircuitExecutionResultDto } from '../dto/token.dto';

export class BurnTokenUseCase {
  constructor(private readonly contractGateway: ITokenContractGateway) {}

  async execute(dto: BurnTokenDto): Promise<CircuitExecutionResultDto> {
    const amountBigInt = BigInt(dto.amount);
    if (amountBigInt <= 0n) {
      throw new DomainError('Burn amount must be greater than zero', 'INVALID_AMOUNT');
    }

    if (dto.options?.callerAddress) {
      const balance = this.contractGateway.getBalanceOf(dto.options.callerAddress, dto.contractAddress);
      if (balance < amountBigInt) {
        throw new InsufficientBalanceError(
          `Cannot burn: insufficient balance (have ${balance.toString()}, requested ${amountBigInt.toString()})`
        );
      }
    }

    const result = await this.contractGateway.burn(
      dto.contractAddress,
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
