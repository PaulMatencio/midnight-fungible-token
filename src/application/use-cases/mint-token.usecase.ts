/**
 * Application Use Case: Mint Token
 * Filename: src/application/use-cases/mint-token.usecase.ts
 */

import type { ITokenContractGateway } from '@/src/domain/ports/i-token-contract.gateway';
import { addressToBytes32 } from '@/src/domain/entities/address.vo';
import { DomainError, SupplyOverflowError } from '@/src/domain/errors/domain-errors';
import type { MintTokenDto, CircuitExecutionResultDto } from '../dto/token.dto';

export class MintTokenUseCase {
  constructor(private readonly contractGateway: ITokenContractGateway) {}

  async execute(dto: MintTokenDto): Promise<CircuitExecutionResultDto> {
    const amountBigInt = BigInt(dto.amount);
    if (amountBigInt <= 0n) {
      throw new DomainError('Mint amount must be greater than zero', 'INVALID_AMOUNT');
    }

    const metadata = await this.contractGateway.getContractState(
      dto.contractAddress,
      dto.options?.callerAddress
    );

    if (metadata.maxSupply && metadata.totalSupply + amountBigInt > metadata.maxSupply) {
      throw new SupplyOverflowError(
        `Cannot mint: would exceed maxSupply (${metadata.maxSupply.toString()})`
      );
    }

    const result = await this.contractGateway.mint(
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
