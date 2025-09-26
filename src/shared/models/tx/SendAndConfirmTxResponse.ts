import { TxStatus } from '../../constants';

export interface SendAndConfirmTxResponse {
  txSignature: string;
  txStatus: TxStatus;
  rpcUrl?: string;
  error?: Error;
  timedOut?: boolean;
  execTime?: string;
}
