/**
 * Application Use Case: Transfer Token
 * Filename: src/application/use-cases/transfer-token.usecase.ts
 */

import type { ITokenContractGateway } from '@/src/domain/ports/i-token-contract.gateway';
import { addressToBytes32 } from '@/src/domain/entities/address.vo';
import { DomainError, InsufficientBalanceError } from '@/src/domain/errors/domain-errors';
import type { TransferTokenDto, CircuitExecutionResultDto } from '../dto/token.dto';

export class TransferTokenUseCase {
  constructor(private readonly contractGateway: ITokenContractGateway) {}

  async execute(dto: TransferTokenDto): Promise<CircuitExecutionResultDto> {
    const amountBigInt = BigInt(dto.amount);
    if (amountBigInt <= 0n) {
      throw new DomainError('Transfer amount must be greater than zero', 'INVALID_AMOUNT');
    }

    if (dto.options?.callerAddress) {
      const callerBalance = this.contractGateway.getBalanceOf(dto.options.callerAddress, dto.contractAddress);
      if (callerBalance < amountBigInt) {
        throw new InsufficientBalanceError(
          `Insufficient balance: have ${callerBalance.toString()}, need ${amountBigInt.toString()}`
        );
      }
    }

    const result = await this.contractGateway.transfer(
      dto.contractAddress,
      dto.recipient,
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
