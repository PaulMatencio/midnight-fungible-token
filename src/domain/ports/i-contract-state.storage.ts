/**
 * Domain Port: Contract State Storage
 * Filename: src/domain/ports/i-contract-state.storage.ts
 */

export interface IContractStateStorage {
  /**
   * Saves serialized contract state for offline/refresh persistence.
   */
  saveState(contractAddress: string, serializedState: string): void;

  /**
   * Retrieves cached contract state string.
   */
  loadState(contractAddress: string): string | null;

  /**
   * Clears state for a specific contract or all contracts.
   */
  clearState(contractAddress?: string): void;
}
