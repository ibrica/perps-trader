import { Connection } from '@solana/web3.js';

export interface PrivateConnectionResponse {
  connection: Connection;
  session: string;
  nodeIdentity: string | undefined;
}
