/**
 * Application Use Case: Manage Token Pause (Pause / Unpause)
 * Filename: src/application/use-cases/manage-token-pause.usecase.ts
 */

import type { ITokenContractGateway, CircuitInvocationOptions } from '@/src/domain/ports/i-token-contract.gateway';
import type { CircuitExecutionResultDto } from '../dto/token.dto';

export class ManageTokenPauseUseCase {
  constructor(private readonly contractGateway: ITokenContractGateway) {}

  async pause(
    contractAddress: string,
    options?: CircuitInvocationOptions
  ): Promise<CircuitExecutionResultDto> {
    const result = await this.contractGateway.pause(contractAddress, options);
    return {
      success: true,
      txHash: result.txHash,
      blockHeight: result.blockHeight,
      returnValue: result.returnValue,
    };
  }

  async unpause(
    contractAddress: string,
    options?: CircuitInvocationOptions
  ): Promise<CircuitExecutionResultDto> {
    const result = await this.contractGateway.unpause(contractAddress, options);
    return {
      success: true,
      txHash: result.txHash,
      blockHeight: result.blockHeight,
      returnValue: result.returnValue,
    };
  }
}
