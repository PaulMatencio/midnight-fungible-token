/**
 * Application DTOs: Token Operations
 * Filename: src/application/dto/token.dto.ts
 */

import type { CircuitInvocationOptions } from '@/src/domain/ports/i-token-contract.gateway';

export interface InitializeTokenDto {
  contractAddress: string;
  name: string;
  symbol: string;
  decimals: number | bigint;
  maxSupply: number | bigint;
  initialOwner?: string | Uint8Array;
  salt?: string | Uint8Array;
  options?: CircuitInvocationOptions;
}

export interface TransferTokenDto {
  contractAddress: string;
  recipient: string | Uint8Array;
  amount: bigint | number;
  options?: CircuitInvocationOptions;
}

export interface ApproveTokenDto {
  contractAddress: string;
  spender: string | Uint8Array;
  amount: bigint | number;
  options?: CircuitInvocationOptions;
}

export interface TransferFromTokenDto {
  contractAddress: string;
  from: string | Uint8Array;
  to: string | Uint8Array;
  amount: bigint | number;
  options?: CircuitInvocationOptions;
}

export interface MintTokenDto {
  contractAddress: string;
  recipient: string | Uint8Array;
  amount: bigint | number;
  options?: CircuitInvocationOptions;
}

export interface BurnTokenDto {
  contractAddress: string;
  amount: bigint | number;
  options?: CircuitInvocationOptions;
}

export interface SetEmergencyPauserDto {
  contractAddress: string;
  newPauser: string | Uint8Array;
  options?: CircuitInvocationOptions;
}

export interface EmergencyWithdrawDto {
  contractAddress: string;
  destination: string | Uint8Array;
  amount: bigint | number;
  options?: CircuitInvocationOptions;
}

export interface AdminReallocateDto {
  contractAddress: string;
  from: string | Uint8Array;
  to: string | Uint8Array;
  amount: bigint | number;
  options?: CircuitInvocationOptions;
}

export interface CircuitExecutionResultDto {
  success: boolean;
  txHash: string;
  blockHeight?: number;
  error?: string;
  returnValue?: any;
}
