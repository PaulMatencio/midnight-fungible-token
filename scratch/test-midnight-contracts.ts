import fs from 'node:fs';
import { findDeployedContract } from '@midnight-ntwrk/midnight-js-contracts';
import { CompiledContract } from '@midnight-ntwrk/compact-js';
import { indexerPublicDataProvider } from '@midnight-ntwrk/midnight-js-indexer-public-data-provider';
import { httpClientProofProvider } from '@midnight-ntwrk/midnight-js-http-client-proof-provider';
import { ZKConfigProvider, createZKIR, createVerifierKey, createProverKey } from '@midnight-ntwrk/midnight-js-types';
import { Contract } from '../contract/index.js';

class FullPrivateStateProvider {
  private currentContractAddress: string = '';
  private stateStore = new Map<string, any>();
  private keyStore = new Map<string, any>();

  setContractAddress(address: string): void {
    this.currentContractAddress = address;
  }

  async get(privateStateId: string): Promise<any> {
    return this.stateStore.get(`${this.currentContractAddress}:${privateStateId}`) ?? null;
  }

  async set(privateStateId: string, state: any): Promise<void> {
    this.stateStore.set(`${this.currentContractAddress}:${privateStateId}`, state);
  }

  async remove(privateStateId: string): Promise<void> {
    this.stateStore.delete(`${this.currentContractAddress}:${privateStateId}`);
  }

  async clear(): Promise<void> {
    this.stateStore.clear();
  }

  async getSigningKey(address: string): Promise<any> {
    return this.keyStore.get(address) ?? null;
  }

  async setSigningKey(address: string, signingKey: any): Promise<void> {
    this.keyStore.set(address, signingKey);
  }

  async removeSigningKey(address: string): Promise<void> {
    this.keyStore.delete(address);
  }

  async clearSigningKeys(): Promise<void> {
    this.keyStore.clear();
  }
}

class CustomZkConfigProvider extends ZKConfigProvider<string> {
  constructor(private onChainState: any) {
    super();
  }

  async getZKIR(circuitId: string): Promise<any> {
    const file = fs.readFileSync(`public/zkir/fungible-token/${circuitId}.bzkir`);
    return createZKIR(new Uint8Array(file));
  }

  async getVerifierKey(circuitId: string): Promise<any> {
    const op = this.onChainState.operation(circuitId);
    if (!op || !op.verifierKey) {
      throw new Error(`No verifier key for circuit ${circuitId}`);
    }
    return createVerifierKey(op.verifierKey);
  }

  async getProverKey(circuitId: string): Promise<any> {
    return createProverKey(new Uint8Array(0));
  }
}

async function test() {
  const contractAddress = '8cefec943e9f715f21f766edb501ea1fb12a9e8a69c4a3281a133cac6b5ee271';
  const witnesses = {
    localSecretKey: (ctx: any) => {
      const sk = ctx.privateState?.secretKey || new Uint8Array(32);
      return [ctx.privateState, sk];
    },
  };

  const compiledContract = CompiledContract.make('fungible-token', Contract).pipe(
    CompiledContract.withWitnesses(witnesses)
  );

  const publicDataProvider = indexerPublicDataProvider(
    'https://indexer.preprod.midnight.network/api/v4/graphql',
    'wss://indexer.preprod.midnight.network/api/v4/graphql/ws'
  );

  const onChainState = await publicDataProvider.queryContractState(contractAddress);

  const zkConfigProvider = new CustomZkConfigProvider(onChainState);
  const proofProvider = httpClientProofProvider('http://127.0.0.1:6300', zkConfigProvider);
  const privateStateProvider = new FullPrivateStateProvider();

  const mockProviders = {
    publicDataProvider,
    privateStateProvider,
    zkConfigProvider,
    proofProvider,
    walletProvider: {
      getCoinPublicKey: () => '01'.repeat(32),
      getEncryptionPublicKey: () => '01'.repeat(32),
      balanceTx: async (tx: any) => tx,
    } as any,
    midnightProvider: {
      submitTx: async () => '0x123',
    } as any,
  };

  try {
    const found = await findDeployedContract(mockProviders as any, {
      compiledContract,
      contractAddress,
      privateStateId: 'fungible-token-state',
      initialPrivateState: { secretKey: new Uint8Array(32) },
    });
    console.log('findDeployedContract SUCCESS!');
    console.log('Keys on found:', Object.keys(found));
    console.log('callTx circuits:', Object.keys(found.callTx));
  } catch (err: any) {
    console.error('findDeployedContract error:', err);
  }
}

test();





