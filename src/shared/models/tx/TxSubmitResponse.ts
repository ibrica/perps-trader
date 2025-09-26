import { TxStatus } from '../../constants';

export interface TxSubmitResponse {
  transactionSignature: string;
  status: TxStatus;
}
