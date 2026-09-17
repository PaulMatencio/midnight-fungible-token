/**
 * Dependency Injection Container
 * Filename: src/infrastructure/di/container.ts
 */

import { LocalStorageActivityStorage } from '../persistence/local-storage-activity.storage';
import { LocalStorageContractStateStorage } from '../persistence/local-storage-contract-state.storage';
import { MidnightWalletAdapter } from '../midnight/midnight-wallet.adapter';
import { MidnightIndexerAdapter } from '../midnight/midnight-indexer.adapter';
import { MidnightTokenContractAdapter } from '../midnight/midnight-token-contract.adapter';

import { InitializeTokenUseCase } from '@/src/application/use-cases/initialize-token.usecase';
import { TransferTokenUseCase } from '@/src/application/use-cases/transfer-token.usecase';
import { ApproveTokenUseCase } from '@/src/application/use-cases/approve-token.usecase';
import { TransferFromTokenUseCase } from '@/src/application/use-cases/transfer-from-token.usecase';
import { MintTokenUseCase } from '@/src/application/use-cases/mint-token.usecase';
import { BurnTokenUseCase } from '@/src/application/use-cases/burn-token.usecase';
import { ManageTokenPauseUseCase } from '@/src/application/use-cases/manage-token-pause.usecase';
import { ManageEmergencyUseCase } from '@/src/application/use-cases/manage-emergency.usecase';
import { GetTokenStateUseCase } from '@/src/application/use-cases/get-token-state.usecase';
import { GetAccountSharesUseCase } from '@/src/application/use-cases/get-account-shares.usecase';
import { ManageActivityLogUseCase } from '@/src/application/use-cases/manage-activity-log.usecase';

export class Container {
  private static instance: Container;

  // Infrastructure Services & Storage
  public readonly activityStorage: LocalStorageActivityStorage;
  public readonly contractStateStorage: LocalStorageContractStateStorage;
  public readonly walletGateway: MidnightWalletAdapter;
  public readonly indexerGateway: MidnightIndexerAdapter;
  public readonly tokenContractGateway: MidnightTokenContractAdapter;

  // Application Use Cases
  public readonly initializeTokenUseCase: InitializeTokenUseCase;
  public readonly transferTokenUseCase: TransferTokenUseCase;
  public readonly approveTokenUseCase: ApproveTokenUseCase;
  public readonly transferFromTokenUseCase: TransferFromTokenUseCase;
  public readonly mintTokenUseCase: MintTokenUseCase;
  public readonly burnTokenUseCase: BurnTokenUseCase;
  public readonly manageTokenPauseUseCase: ManageTokenPauseUseCase;
  public readonly manageEmergencyUseCase: ManageEmergencyUseCase;
  public readonly getTokenStateUseCase: GetTokenStateUseCase;
  public readonly getAccountSharesUseCase: GetAccountSharesUseCase;
  public readonly manageActivityLogUseCase: ManageActivityLogUseCase;

  private constructor() {
    // 1. Instantiate Storage & Gateways
    this.activityStorage = new LocalStorageActivityStorage();
    this.contractStateStorage = new LocalStorageContractStateStorage();
    this.walletGateway = new MidnightWalletAdapter();
    this.indexerGateway = new MidnightIndexerAdapter();

    this.tokenContractGateway = new MidnightTokenContractAdapter({
      walletGateway: this.walletGateway,
      stateStorage: this.contractStateStorage,
      indexerGateway: this.indexerGateway,
    });

    // 2. Instantiate Use Cases
    this.initializeTokenUseCase = new InitializeTokenUseCase(
      this.tokenContractGateway,
      this.activityStorage
    );
    this.transferTokenUseCase = new TransferTokenUseCase(this.tokenContractGateway);
    this.approveTokenUseCase = new ApproveTokenUseCase(this.tokenContractGateway);
    this.transferFromTokenUseCase = new TransferFromTokenUseCase(this.tokenContractGateway);
    this.mintTokenUseCase = new MintTokenUseCase(this.tokenContractGateway);
    this.burnTokenUseCase = new BurnTokenUseCase(this.tokenContractGateway);
    this.manageTokenPauseUseCase = new ManageTokenPauseUseCase(this.tokenContractGateway);
    this.manageEmergencyUseCase = new ManageEmergencyUseCase(this.tokenContractGateway);
    this.getTokenStateUseCase = new GetTokenStateUseCase(this.tokenContractGateway);
    this.getAccountSharesUseCase = new GetAccountSharesUseCase(this.indexerGateway);
    this.manageActivityLogUseCase = new ManageActivityLogUseCase(this.activityStorage);
  }

  public static getInstance(): Container {
    if (!Container.instance) {
      Container.instance = new Container();
    }
    return Container.instance;
  }
}

export const container = Container.getInstance();
