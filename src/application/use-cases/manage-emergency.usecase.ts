/**
 * Application Use Case: Manage Emergency Operations
 * Filename: src/application/use-cases/manage-emergency.usecase.ts
 */

import type { ITokenContractGateway } from '@/src/domain/ports/i-token-contract.gateway';
import { addressToBytes32 } from '@/src/domain/entities/address.vo';
import { DomainError } from '@/src/domain/errors/domain-errors';
import type {
  SetEmergencyPauserDto,
  EmergencyWithdrawDto,
  AdminReallocateDto,
  CircuitExecutionResultDto,
} from '../dto/token.dto';

export class ManageEmergencyUseCase {
  constructor(private readonly contractGateway: ITokenContractGateway) {}

  async setEmergencyPauser(dto: SetEmergencyPauserDto): Promise<CircuitExecutionResultDto> {
    const pauserBytes = typeof dto.newPauser === 'string'
      ? addressToBytes32(dto.newPauser)
      : dto.newPauser;

    const result = await this.contractGateway.setEmergencyPauser(
      dto.contractAddress,
      pauserBytes,
      dto.options
    );

    return {
      success: true,
      txHash: result.txHash,
      blockHeight: result.blockHeight,
      returnValue: result.returnValue,
    };
  }

  async emergencyWithdraw(dto: EmergencyWithdrawDto): Promise<CircuitExecutionResultDto> {
    const amountBigInt = BigInt(dto.amount);
    if (amountBigInt <= 0n) {
      throw new DomainError('Withdraw amount must be greater than zero', 'INVALID_AMOUNT');
    }

    const destBytes = typeof dto.destination === 'string'
      ? addressToBytes32(dto.destination)
      : dto.destination;

    const result = await this.contractGateway.emergencyWithdraw(
      dto.contractAddress,
      destBytes,
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

  async adminReallocate(dto: AdminReallocateDto): Promise<CircuitExecutionResultDto> {
    const amountBigInt = BigInt(dto.amount);
    if (amountBigInt <= 0n) {
      throw new DomainError('Reallocate amount must be greater than zero', 'INVALID_AMOUNT');
    }

    const fromBytes = typeof dto.from === 'string'
      ? addressToBytes32(dto.from)
      : dto.from;

    const toBytes = typeof dto.to === 'string'
      ? addressToBytes32(dto.to)
      : dto.to;

    const result = await this.contractGateway.adminReallocate(
      dto.contractAddress,
      fromBytes,
      toBytes,
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
