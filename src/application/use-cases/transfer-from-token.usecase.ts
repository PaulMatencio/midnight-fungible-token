/**
 * Application Use Case: TransferFrom Token
 * Filename: src/application/use-cases/transfer-from-token.usecase.ts
 */

import type { ITokenContractGateway } from '@/src/domain/ports/i-token-contract.gateway';
import { addressToBytes32, bytesToHex } from '@/src/domain/entities/address.vo';
import { DomainError, InsufficientBalanceError } from '@/src/domain/errors/domain-errors';
import type { TransferFromTokenDto, CircuitExecutionResultDto } from '../dto/token.dto';

export class TransferFromTokenUseCase {
  constructor(private readonly contractGateway: ITokenContractGateway) {}

  async execute(dto: TransferFromTokenDto): Promise<CircuitExecutionResultDto> {
    const amountBigInt = BigInt(dto.amount);
    if (amountBigInt <= 0n) {
      throw new DomainError('Transfer amount must be greater than zero', 'INVALID_AMOUNT');
    }

    if (typeof dto.from === 'string' && (dto.options?.callerAddress || dto.options?.customSecretKey)) {
      const effectiveSpender = dto.options?.customSecretKey
        ? bytesToHex(dto.options.customSecretKey)
        : dto.options.callerAddress!;

      const allowance = this.contractGateway.getAllowance(
        dto.from,
        effectiveSpender,
        dto.contractAddress
      );
      if (allowance < amountBigInt) {
        throw new InsufficientBalanceError(
          `Insufficient allowance: approved ${allowance.toString()}, requested ${amountBigInt.toString()}. (Note: transferFrom must be executed by the approved Spender account. If you are the token owner transferring your own tokens, please use the regular 'Transfer' action instead.)`
        );
      }
    }

    const result = await this.contractGateway.transferFrom(
      dto.contractAddress,
      dto.from,
      dto.to,
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
