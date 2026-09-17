/**
 * Domain Errors
 * Filename: src/domain/errors/domain-errors.ts
 */

export class DomainError extends Error {
  constructor(message: string, public readonly code?: string) {
    super(message);
    this.name = 'DomainError';
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class InsufficientBalanceError extends DomainError {
  constructor(message: string = 'Insufficient token balance to perform this operation') {
    super(message, 'INSUFFICIENT_BALANCE');
    this.name = 'InsufficientBalanceError';
  }
}

export class UnauthorizedError extends DomainError {
  constructor(message: string = 'Caller is not authorized to perform this operation') {
    super(message, 'UNAUTHORIZED');
    this.name = 'UnauthorizedError';
  }
}

export class ContractPausedError extends DomainError {
  constructor(message: string = 'Contract is currently paused') {
    super(message, 'CONTRACT_PAUSED');
    this.name = 'ContractPausedError';
  }
}

export class ContractNotInitializedError extends DomainError {
  constructor(message: string = 'Contract has not been initialized yet') {
    super(message, 'CONTRACT_NOT_INITIALIZED');
    this.name = 'ContractNotInitializedError';
  }
}

export class SupplyOverflowError extends DomainError {
  constructor(message: string = 'Operation would exceed the token maximum supply') {
    super(message, 'SUPPLY_OVERFLOW');
    this.name = 'SupplyOverflowError';
  }
}

export class WalletLockedError extends DomainError {
  constructor(message: string = 'Wallet is locked. Please unlock the wallet first.') {
    super(message, 'WALLET_LOCKED');
    this.name = 'WalletLockedError';
  }
}

export class TransactionDeclinedError extends DomainError {
  constructor(message: string = 'Transaction was declined or cancelled.') {
    super(message, 'TRANSACTION_DECLINED');
    this.name = 'TransactionDeclinedError';
  }
}
