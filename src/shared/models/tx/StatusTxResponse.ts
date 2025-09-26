import { TxStatus } from '../..';

export interface StatusTxResponse {
  txStatus: TxStatus.SUCCESS | TxStatus.FAILED;
  rpcUrl?: string;
  error?: string;
}
