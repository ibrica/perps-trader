import { TxStatus } from '../../constants';

export interface UpdateTxOptions {
  status?: TxStatus;
  txSignature?: string;
  error?: string;
  rpcId?: string;
  sessionHash?: string;
  trigger?: string;
  mintAddress?: string;
  signingIntervalMs?: number;
}
