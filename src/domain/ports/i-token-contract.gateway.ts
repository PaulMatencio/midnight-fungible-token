/**
 * Domain Port: Token Contract Gateway
 * Filename: src/domain/ports/i-token-contract.gateway.ts
 */

import type { TokenMetadata } from '../entities/token.entity';
import type { TransactionStatus } from '../entities/activity.entity';

export interface CircuitInvocationOptions {
  callerAddress?: string;
  customSecretKey?: Uint8Array;
  onStatusChange?: (status: TransactionStatus, message?: string) => void;
}

export interface CircuitExecutionResult {
  txHash: string;
  blockHeight?: number;
  returnValue?: any;
}

export interface GrantedAllowance {
  ownerAccount: string;
  ownerLabel?: string;
  ownerAddress?: string;
  allowance: bigint;
}

export interface ITokenContractGateway {
  /**
   * Retrieves decoded contract state and metadata.
   */
  getContractState(
    contractAddress: string,
    currentCaller?: string
  ): Promise<TokenMetadata>;

  /**
   * Look up token balance for an account address from current state.
   */
  getBalanceOf(
    accountAddress: string,
    contractAddress?: string
  ): bigint;

  /**
   * Look up raw locked balance for an account address from current state.
   */
  getLockedBalanceOf(
    accountAddress: string,
    contractAddress?: string
  ): bigint;

  /**
   * Look up spender allowance from owner.
   */
  getAllowance(
    ownerAddress: string,
    spenderAddress: string,
    contractAddress?: string
  ): bigint;

  /**
   * Look up all allowances granted to a spender across all token owners.
   */
  getAllowancesForSpender(
    spenderAddress: string,
    contractAddress?: string
  ): GrantedAllowance[];

  /**
   * Initialize contract with name, symbol, decimals, maxSupply, and initialOwner.
   */
  initialize(
    contractAddress: string,
    params: {
      salt: Uint8Array;
      initialOwner: Uint8Array;
      name: string;
      symbol: string;
      decimals: bigint;
      maxSupply: bigint;
    },
    options?: CircuitInvocationOptions
  ): Promise<CircuitExecutionResult>;

  /**
   * Transfer tokens from caller to recipient.
   */
  transfer(
    contractAddress: string,
    recipient: Uint8Array | string,
    amount: bigint,
    options?: CircuitInvocationOptions
  ): Promise<CircuitExecutionResult>;

  /**
   * Grant allowance to spender.
   */
  approve(
    contractAddress: string,
    spender: Uint8Array | string,
    amount: bigint,
    options?: CircuitInvocationOptions
  ): Promise<CircuitExecutionResult>;

  /**
   * Transfer tokens from sender using allowance.
   */
  transferFrom(
    contractAddress: string,
    from: Uint8Array | string,
    to: Uint8Array | string,
    amount: bigint,
    options?: CircuitInvocationOptions
  ): Promise<CircuitExecutionResult>;

  /**
   * Mint new tokens to recipient (admin/owner only).
   */
  mint(
    contractAddress: string,
    recipient: Uint8Array | string,
    amount: bigint,
    options?: CircuitInvocationOptions
  ): Promise<CircuitExecutionResult>;

  /**
   * Burn tokens from caller account.
   */
  burn(
    contractAddress: string,
    amount: bigint,
    options?: CircuitInvocationOptions
  ): Promise<CircuitExecutionResult>;

  /**
   * Pause contract operations.
   */
  pause(
    contractAddress: string,
    options?: CircuitInvocationOptions
  ): Promise<CircuitExecutionResult>;

  /**
   * Unpause contract operations.
   */
  unpause(
    contractAddress: string,
    options?: CircuitInvocationOptions
  ): Promise<CircuitExecutionResult>;

  /**
   * Set emergency pauser address.
   */
  setEmergencyPauser(
    contractAddress: string,
    newPauser: Uint8Array,
    options?: CircuitInvocationOptions
  ): Promise<CircuitExecutionResult>;

  /**
   * Emergency withdraw locked tokens to a destination.
   */
  emergencyWithdraw(
    contractAddress: string,
    destination: Uint8Array,
    amount: bigint,
    options?: CircuitInvocationOptions
  ): Promise<CircuitExecutionResult>;

  /**
   * Admin reallocate tokens between accounts.
   */
  adminReallocate(
    contractAddress: string,
    from: Uint8Array,
    to: Uint8Array,
    amount: bigint,
    options?: CircuitInvocationOptions
  ): Promise<CircuitExecutionResult>;
}
