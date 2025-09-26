import { Keypair } from '@solana/web3.js';
import { JitoRelayer } from './JitoRelayer';
import { ConnectionProvider } from '../../../infrastructure';

export interface JitoAdapterInitOptions {
  relayers: JitoRelayer[];
  connectionProvider: ConnectionProvider;
  authorityKeyPair: Keypair;
}
