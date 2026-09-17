/**
 * Application Use Case: Initialize Token
 * Filename: src/application/use-cases/initialize-token.usecase.ts
 */

import type { ITokenContractGateway } from '@/src/domain/ports/i-token-contract.gateway';
import type { IActivityStorage } from '@/src/domain/ports/i-activity.storage';
import { addressToBytes32 } from '@/src/domain/entities/address.vo';
import { DomainError } from '@/src/domain/errors/domain-errors';
import type { InitializeTokenDto, CircuitExecutionResultDto } from '../dto/token.dto';

export class InitializeTokenUseCase {
  constructor(
    private readonly contractGateway: ITokenContractGateway,
    private readonly activityStorage?: IActivityStorage
  ) {}

  async execute(dto: InitializeTokenDto): Promise<CircuitExecutionResultDto> {
    if (!dto.name || !dto.name.trim()) {
      throw new DomainError('Token name cannot be empty', 'INVALID_NAME');
    }
    if (!dto.symbol || !dto.symbol.trim()) {
      throw new DomainError('Token symbol cannot be empty', 'INVALID_SYMBOL');
    }

    const decimalsBigInt = BigInt(dto.decimals);
    const maxSupplyBigInt = BigInt(dto.maxSupply);

    if (maxSupplyBigInt <= 0n) {
      throw new DomainError('Max supply must be greater than zero', 'INVALID_MAX_SUPPLY');
    }

    const saltBytes = dto.salt
      ? typeof dto.salt === 'string'
        ? addressToBytes32(dto.salt)
        : dto.salt
      : new Uint8Array(32).fill(42);

    const ownerBytes = dto.initialOwner
      ? typeof dto.initialOwner === 'string'
        ? addressToBytes32(dto.initialOwner)
        : dto.initialOwner
      : new Uint8Array(32).fill(1);

    const result = await this.contractGateway.initialize(
      dto.contractAddress,
      {
        salt: saltBytes,
        initialOwner: ownerBytes,
        name: dto.name.trim(),
        symbol: dto.symbol.trim().toUpperCase(),
        decimals: decimalsBigInt,
        maxSupply: maxSupplyBigInt,
      },
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
