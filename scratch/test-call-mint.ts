const originalFetch = globalThis.fetch;
globalThis.fetch = async (input: any, init?: any) => {
  const url = typeof input === 'string' ? input : input?.url || String(input);
  const res = await originalFetch(input, init);
  if (url.includes(':6300') && !res.ok) {
    const clone = res.clone();
    try {
      const text = await clone.text();
      console.error('PROOFSVR ERROR BODY for ' + url + ':', res.status, text);
    } catch (e) {
      console.error('PROOFSVR ERROR failed clone:', e);
    }
  }
  return res;
};

import fs from 'node:fs';
import { findDeployedContract } from '@midnight-ntwrk/midnight-js-contracts';
import { CompiledContract } from '@midnight-ntwrk/compact-js';
import { indexerPublicDataProvider } from '@midnight-ntwrk/midnight-js-indexer-public-data-provider';
import { httpClientProofProvider } from '@midnight-ntwrk/midnight-js-http-client-proof-provider';
import { ZKConfigProvider, createZKIR, createVerifierKey, createProverKey } from '@midnight-ntwrk/midnight-js-types';
import { setNetworkId } from '@midnight-ntwrk/midnight-js-network-id';
import { Contract } from '../contract/index.js';

setNetworkId('preprod');

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
    const file = fs.readFileSync(`public/zkir/fungible-token/zkir/${circuitId}.bzkir`);
    return createZKIR(new Uint8Array(file));
  }

  async getVerifierKey(circuitId: string): Promise<any> {
    const file = fs.readFileSync(`public/zkir/fungible-token/keys/${circuitId}.verifier`);
    return createVerifierKey(new Uint8Array(file));
  }

  async getProverKey(circuitId: string): Promise<any> {
    const file = fs.readFileSync(`public/zkir/fungible-token/keys/${circuitId}.prover`);
    return createProverKey(new Uint8Array(file));
  }
}

async function test() {
  const contractAddress = '1f671d56337df583a799cc8657098a1601272e63b89ca706c6894fb8c8e8714b';
  const ownerSecretKey = Buffer.from('a3c24122f1bc023501cbe0edd21a99e2ac09a8072ab3693a450b0689549e5998', 'hex');

  const witnesses = {
    localSecretKey: (ctx: any) => {
      const sk = ctx.privateState?.secretKey || ownerSecretKey;
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

  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input: any, init?: any) => {
    const url = typeof input === 'string' ? input : input?.url || String(input);
    const res = await originalFetch(input, init);
    if (url.includes(':6300') && !res.ok) {
      const clone = res.clone();
      try {
        const text = await clone.text();
        console.error('PROOFSVR ERROR BODY:', res.status, text);
      } catch (e) {
        console.error('PROOFSVR ERROR failed clone:', e);
      }
    }
    return res;
  };

  const zkConfigProvider = new CustomZkConfigProvider(onChainState);
  const proofProvider = httpClientProofProvider('http://127.0.0.1:6300', zkConfigProvider);
  const privateStateProvider = new FullPrivateStateProvider();

  let capturedProvenTx: any = null;

  const mockProviders = {
    publicDataProvider,
    privateStateProvider,
    zkConfigProvider,
    proofProvider,
    walletProvider: {
      getCoinPublicKey: () => '01'.repeat(32),
      getEncryptionPublicKey: () => '01'.repeat(32),
      balanceTx: async (tx: any) => {
        console.log('walletProvider.balanceTx called with provenTx!');
        capturedProvenTx = tx;
        return tx;
      },
    } as any,
    midnightProvider: {
      submitTx: async (tx: any) => {
        console.log('midnightProvider.submitTx called with tx!');
        return '0x' + '99'.repeat(32);
      },
    } as any,
  };

  const found = await findDeployedContract(mockProviders as any, {
    compiledContract,
    contractAddress,
    privateStateId: 'fungible-token-state',
    initialPrivateState: { secretKey: ownerSecretKey },
  });

  console.log('Calling callTx.mint...');
  const toAccount = new Uint8Array(32).fill(7);
  const mintValue = 1000n;

  try {
    const result = await found.callTx.mint(toAccount, mintValue);
    console.log('callTx.mint SUCCESS! result:', result);
  } catch (err: any) {
    console.error('callTx.mint error:', err);
  }
}

test().catch(console.error);
